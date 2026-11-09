import { Client, Room, matchMaker } from "@colyseus/core";
import { MapSchema, Schema, type } from "@colyseus/schema";
import {
  BASE_MAPS, BITE_WINDOW_MS, MAX_PLAYERS, MINIGAME_TIMEOUT_MS, RECONNECT_SECONDS, WAIT_MAX_MS,
  WAIT_MIN_MS, baitById, baitEffects, castDistance, rodEffects, rodLevelOf, cursorAt, cursorSpeed, isBaseMap, isRareOrBetter, judge, pickSpecies,
  reachOf, rollSize, sellPrice, speciesById, timeOfDay,
} from "@fishing/shared";
import type { FishSpecies, MapDef, MapId } from "@fishing/shared";
import { ChatLimiter, cleanChat, hasBadWord } from "./chat";
import type { GameService } from "./service";

export class PlayerState extends Schema {
  @type("string") playerId = "";
  @type("string") name = "";
  /** 외형과 장착 아이템을 합친 JSON. 클라이언트가 3D 캐릭터를 조립한다 */
  @type("string") look = "";
  @type("string") title = "";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") yaw = 0;
  @type("string") emote = "";
  @type("number") emoteSeq = 0;
  /** idle | waiting | bite | minigame */
  @type("string") fishing = "idle";
  @type("number") bobX = 0;
  @type("number") bobZ = 0;
}

export class RoomState extends Schema {
  @type("string") mapId = "lake";
  @type("string") hostId = "";
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

export interface RoomDeps {
  service: GameService;
  authenticate(token: string): Promise<string | null>;
  rng: () => number;
  now: () => number;
  waitMs: () => number;
  biteWindowMs: number;
  minigameTimeoutMs: number;
  resolveMap(mapId: string, playerId: string): Promise<MapDef | null>;
}

export function defaultDeps(partial: Pick<RoomDeps, "service" | "authenticate"> & Partial<RoomDeps>): RoomDeps {
  const rng = partial.rng ?? Math.random;
  return {
    rng,
    now: Date.now,
    waitMs: () => WAIT_MIN_MS + rng() * (WAIT_MAX_MS - WAIT_MIN_MS),
    biteWindowMs: BITE_WINDOW_MS,
    minigameTimeoutMs: MINIGAME_TIMEOUT_MS,
    resolveMap: async (id) => (isBaseMap(id) ? BASE_MAPS[id] : null),
    ...partial,
  };
}

interface Fishing {
  phase: "idle" | "waiting" | "bite" | "minigame";
  reach: "near" | "far";
  species?: FishSpecies;
  timer?: { clear(): void };
  startedAt?: number;
  target?: number;
  speed?: number;
  /** 던질 때 정해진 낚싯대 효과 */
  eff: ReturnType<typeof rodEffects>;
  /** 던질 때 쓴 미끼 효과(없으면 모두 1) */
  bait: ReturnType<typeof baitEffects>;
  /** 이번 입질의 타이밍 칸 폭(낚싯대 효과 반영) */
  zone?: number;
}

interface Score {
  value: number;
  count: number;
  biggest: { speciesId: string; size: number } | null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(rng: () => number, len = 4): string {
  return Array.from({ length: len }, () => CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)]).join("");
}

export function createFishingRoom(deps: RoomDeps) {
  return class FishingRoom extends Room<RoomState> {
    maxClients = MAX_PLAYERS;
    private map!: MapDef;
    private fishing = new Map<string, Fishing>();
    private limiters = new Map<string, ChatLimiter>();
    private scores = new Map<string, Score>();
    private names = new Map<string, string>();
    private rods = new Map<string, number>(); // 접속한 사람의 낚싯대 단계
    private baitPick = new Map<string, string | null>(); // 낚시할 때 쓰기로 고른 미끼(없으면 안 씀)

    async onCreate(options: { map?: string; ownerId?: string; title?: string; isPublic?: boolean }) {
      const mapId = options.map ?? "lake";
      const title = String(options.title ?? "").trim().slice(0, 20);
      if (hasBadWord(title)) throw new Error("방 제목에 쓸 수 없는 말이 들어 있어요");
      // 공개 방만 방 목록에 나온다. 비공개 방도 코드·링크로는 들어올 수 있다
      await this.setPrivate(options.isPublic !== true);
      await this.setMetadata({ title, mapId, hostName: "" });
      const map = await deps.resolveMap(mapId, options.ownerId ?? "");
      if (!map) throw new Error("없는 맵이에요");
      this.map = map;
      this.setState(new RoomState());
      this.state.mapId = mapId;

      for (let i = 0; i < 20; i++) {
        const code = randomCode(Math.random);
        if (!matchMaker.getLocalRoomById(code)) {
          this.roomId = code;
          break;
        }
      }

      this.onMessage("move", (c, m) => this.handleMove(c, m));
      this.onMessage("emote", (c, m) => this.handleEmote(c, m));
      this.onMessage("chat", (c, m) => this.handleChat(c, m));
      this.onMessage("cast", (c, m) => void this.handleCast(c, m));
      this.onMessage("bait", (c, m) => void this.handleBait(c, m));
      this.onMessage("hook", (c) => this.handleHook(c));
      this.onMessage("reel", (c) => this.handleReel(c));
      this.onMessage("kick", (c, m) => this.handleKick(c, m));
      this.onMessage("cancel", (c) => this.handleCancel(c));
      this.onMessage("refresh", (c) => void this.handleRefresh(c));
    }

    async onAuth(_client: Client, options: { token?: string }) {
      const id = options?.token ? await deps.authenticate(options.token) : null;
      if (!id) throw new Error("로그인이 필요해요");
      for (const [sid, p] of [...this.state.players.entries()]) {
        if (p.playerId !== id) continue;
        // 나중에 들어온 접속이 이긴다: 끊겨서 남은 자리는 치우고, 아직 붙어 있는 옛 접속(다른 창·멈춘 창)은 내보낸다(4002)
        this.clients.find((c) => c.sessionId === sid)?.leave(4002);
        this.cancelFishing(sid);
        this.state.players.delete(sid);
        this.limiters.delete(sid);
        if (this.state.hostId === sid) this.state.hostId = "";
      }
      return { playerId: id };
    }

    async onJoin(client: Client, _options: unknown, auth: { playerId: string }) {
      const profile = await deps.service.ensureProfile(auth.playerId);
      const p = new PlayerState();
      p.playerId = profile.id;
      p.name = profile.nickname;
      p.look = JSON.stringify({ appearance: profile.appearance, equipped: profile.equipped });
      p.title = profile.titles.at(-1) ?? "";
      p.x = this.map.spawn.x;
      p.z = this.map.spawn.z;
      this.state.players.set(client.sessionId, p);
      this.names.set(client.sessionId, profile.nickname);
      this.rods.set(client.sessionId, rodLevelOf(profile.equipped));
      this.limiters.set(client.sessionId, new ChatLimiter());
      if (!this.state.hostId) this.state.hostId = client.sessionId;
      this.syncHostName();
      client.send("welcome", {
        code: this.roomId,
        sessionId: client.sessionId,
        serverNow: deps.now(),
        mapId: this.state.mapId,
      });
      this.broadcastRanking();
    }

    async onLeave(client: Client, consented: boolean) {
      if (!consented) {
        try {
          await this.allowReconnection(client, RECONNECT_SECONDS);
          return;
        } catch {
          // 시간 안에 돌아오지 못함
        }
      }
      this.cancelFishing(client.sessionId);
      this.state.players.delete(client.sessionId);
      this.limiters.delete(client.sessionId);
      if (this.state.hostId === client.sessionId) {
        const next = this.state.players.keys().next();
        this.state.hostId = next.done ? "" : next.value;
      }
      this.syncHostName();
    }

    private syncHostName() {
      void this.setMetadata({ hostName: this.state.players.get(this.state.hostId)?.name ?? "" });
    }

    onDispose() {
      for (const id of this.fishing.keys()) this.cancelFishing(id);
    }

    /** 방 안 상점에서 옷·낚싯대를 바꾼 뒤, 저장된 정보를 다시 읽어 모습과 낚싯대 단계를 새로 맞춘다 */
    private async handleRefresh(client: Client) {
      const p = this.player(client);
      if (!p) return;
      const profile = await deps.service.profile(p.playerId);
      if (!profile || !this.state.players.has(client.sessionId)) return;
      p.look = JSON.stringify({ appearance: profile.appearance, equipped: profile.equipped });
      if (this.state.players.get(client.sessionId)?.fishing === "idle") this.rods.set(client.sessionId, rodLevelOf(profile.equipped));
    }

    private player(client: Client) {
      return this.state.players.get(client.sessionId);
    }

    private handleMove(client: Client, m: { x: number; z: number; yaw: number }) {
      const p = this.player(client);
      if (!p || typeof m?.x !== "number" || typeof m?.z !== "number") return;
      if (this.fishing.get(client.sessionId)?.phase && this.fishing.get(client.sessionId)!.phase !== "idle") return;
      if (!this.map.isWalkable(m.x, m.z)) return;
      p.x = m.x;
      p.z = m.z;
      p.yaw = Number(m.yaw) || 0;
    }

    private async handleEmote(client: Client, m: { id: string }) {
      const p = this.player(client);
      if (!p) return;
      const profile = await deps.service.profile(p.playerId);
      if (!profile || !deps.service.canUseEmote(profile, m?.id)) return;
      p.emote = m.id;
      p.emoteSeq += 1;
    }

    private handleChat(client: Client, m: { text: string }) {
      const p = this.player(client);
      if (!p || typeof m?.text !== "string") return;
      if (!this.limiters.get(client.sessionId)!.allow(deps.now())) {
        client.send("chatBlocked", { reason: "너무 빨리 보내고 있어요" });
        return;
      }
      const text = cleanChat(m.text);
      if (text) this.broadcast("chat", { sessionId: client.sessionId, name: p.name, text });
    }

    private handleKick(client: Client, m: { sessionId: string }) {
      if (client.sessionId !== this.state.hostId || m?.sessionId === client.sessionId) return;
      this.clients.getById(m.sessionId)?.leave(4000);
    }

    // 낚시: 던지기 → 기다림 → 입질 → 타이밍 바 → 결과. 결정은 모두 서버가 한다
    private async handleCast(client: Client, m: { power: number; yaw: number }) {
      const p = this.player(client);
      const f = this.fishing.get(client.sessionId);
      if (!p || (f && f.phase !== "idle")) return;
      const power = Math.min(1, Math.max(0, Number(m?.power) || 0));
      const yaw = Number(m?.yaw) || 0;
      const eff = rodEffects(this.rods.get(client.sessionId) ?? 0);
      const d = castDistance(power) * eff.castMul;
      const bx = p.x + Math.sin(yaw) * d;
      const bz = p.z + Math.cos(yaw) * d;
      if (!this.map.isWater(bx, bz)) {
        client.send("castFailed", { reason: "물 위로 던져 주세요" });
        return;
      }
      p.yaw = yaw;
      p.bobX = bx;
      p.bobZ = bz;
      p.fishing = "waiting";
      const state: Fishing = { phase: "waiting", reach: reachOf(power, eff.farPower), eff, bait: baitEffects(null) };
      this.fishing.set(client.sessionId, state);
      // 고른 미끼는 던지는 순간 1개 쓴다. 그 사이에 거두거나 나갔으면 타이머를 걸지 않는다
      const pick = this.baitPick.get(client.sessionId) ?? null;
      const none = { id: null as string | null, left: 0 };
      const used = pick ? await deps.service.consumeBait(p.playerId, pick).catch(() => none) : none;
      if (this.fishing.get(client.sessionId) !== state) return;
      if (used.id) {
        state.bait = baitEffects(used.id);
        client.send("baitLeft", used);
      } else if (pick) {
        this.baitPick.set(client.sessionId, null); // 다 썼다
        client.send("baitLeft", { ...none, out: pick });
      }
      state.timer = this.clock.setTimeout(() => this.bite(client.sessionId), deps.waitMs() * eff.waitMul * state.bait.waitMul);
    }

    /** 낚시할 때 쓸 미끼를 고른다(id가 없으면 안 쓴다). 가진 개수가 없으면 거절한다 */
    private async handleBait(client: Client, m: { id?: string | null }) {
      const p = this.player(client);
      if (!p) return;
      const id = m?.id ?? null;
      if (id === null) {
        this.baitPick.set(client.sessionId, null);
        client.send("baitLeft", { id: null, left: 0 });
        return;
      }
      const left = (await deps.service.profile(p.playerId))?.baits?.[id] ?? 0;
      if (!baitById(id) || left <= 0) {
        this.baitPick.set(client.sessionId, null);
        client.send("baitLeft", { id: null, left: 0, out: id });
        return;
      }
      this.baitPick.set(client.sessionId, id);
      client.send("baitLeft", { id, left });
    }

    /** 기다리는 중이거나 입질 중일 때 낚싯줄을 거둔다 */
    private handleCancel(client: Client) {
      const f = this.fishing.get(client.sessionId);
      if (f && (f.phase === "waiting" || f.phase === "bite")) this.cancelFishing(client.sessionId);
    }

    private bite(sessionId: string) {
      const f = this.fishing.get(sessionId);
      const p = this.state.players.get(sessionId);
      if (!f || !p || f.phase !== "waiting") return;
      const species = pickSpecies(deps.rng, this.state.mapId as MapId, timeOfDay(deps.now()), f.reach, f.bait.bias);
      if (!species) return this.cancelFishing(sessionId);
      f.species = species;
      f.phase = "bite";
      p.fishing = "bite";
      this.clients.getById(sessionId)?.send("bite", { speciesId: species.id });
      f.timer = this.clock.setTimeout(() => this.finish(sessionId, false, "missed"), deps.biteWindowMs);
    }

    private handleHook(client: Client) {
      const f = this.fishing.get(client.sessionId);
      const p = this.player(client);
      if (!f || !p || f.phase !== "bite" || !f.species) return;
      f.timer?.clear();
      f.phase = "minigame";
      p.fishing = "minigame";
      f.startedAt = deps.now();
      f.target = 0.15 + deps.rng() * 0.7;
      f.speed = cursorSpeed(f.species);
      f.zone = Math.min(0.9, f.species.zoneWidth * f.eff.zoneMul * f.bait.zoneMul);
      client.send("minigame", {
        target: f.target,
        zoneWidth: f.zone,
        speed: f.speed,
        timeoutMs: deps.minigameTimeoutMs,
      });
      f.timer = this.clock.setTimeout(() => this.finish(client.sessionId, false, "timeout"), deps.minigameTimeoutMs);
    }

    private handleReel(client: Client) {
      const f = this.fishing.get(client.sessionId);
      if (!f || f.phase !== "minigame" || !f.species) return;
      const cursor = cursorAt(deps.now() - f.startedAt!, f.speed!);
      const ok = judge(cursor, f.target!, f.zone ?? f.species.zoneWidth);
      void this.finish(client.sessionId, ok, ok ? "caught" : "escaped");
    }

    private cancelFishing(sessionId: string) {
      this.fishing.get(sessionId)?.timer?.clear();
      this.fishing.delete(sessionId);
      const p = this.state.players.get(sessionId);
      if (p) p.fishing = "idle";
    }

    private async finish(sessionId: string, success: boolean, reason: string) {
      const f = this.fishing.get(sessionId);
      const p = this.state.players.get(sessionId);
      const client = this.clients.getById(sessionId);
      if (!f || !p) return;
      this.cancelFishing(sessionId);
      if (!success || !f.species) {
        client?.send("result", { success: false, reason });
        return;
      }
      const species = f.species;
      const size = rollSize(deps.rng, species);
      const { record, rewards, isNew, isRecord } = await deps.service.recordCatch(p.playerId, species.id, size, this.state.mapId as MapId);
      const price = sellPrice(species, size, this.rods.get(sessionId) ?? 0);
      this.addScore(sessionId, species, size, price);
      client?.send("result", { success: true, reason, catch: record, price, isNew, isRecord, rewards: rewards.map((r) => r.id) });
      this.broadcast("caught", { sessionId, speciesId: species.id, size }, { except: client });
      if (isRareOrBetter(species.rarity)) {
        this.broadcast("announce", {
          name: p.name, speciesId: species.id, speciesName: species.name, rarity: species.rarity, size,
        });
      }
      if (rewards.length) {
        const profile = await deps.service.profile(p.playerId);
        p.title = profile?.titles.at(-1) ?? p.title;
      }
    }

    // 방 안 순위: 총 가치, 마릿수, 가장 큰 물고기. 그 방에서만 집계한다
    private addScore(sessionId: string, species: FishSpecies, size: number, price: number) {
      const s = this.scores.get(sessionId) ?? { value: 0, count: 0, biggest: null };
      s.value += price;
      s.count += 1;
      if (!s.biggest || size > s.biggest.size) s.biggest = { speciesId: species.id, size };
      this.scores.set(sessionId, s);
      this.broadcastRanking();
    }

    private broadcastRanking() {
      const rows = [...this.scores.entries()].map(([sid, s]) => ({
        sessionId: sid, name: this.names.get(sid) ?? "", ...s,
      }));
      this.broadcast("ranking", {
        value: [...rows].sort((a, b) => b.value - a.value),
        count: [...rows].sort((a, b) => b.count - a.count),
        biggest: rows
          .filter((r) => r.biggest)
          .sort((a, b) => b.biggest!.size - a.biggest!.size),
      });
    }
  };
}
