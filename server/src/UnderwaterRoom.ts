import { Client, Room, matchMaker } from "@colyseus/core";
import { MapSchema, Schema, type } from "@colyseus/schema";
import { ChatLimiter, cleanChat } from "./chat";
import type { RoomDeps } from "./FishingRoom";

/** 수중 탐험 채널 한 곳의 정원. 다 차면 다음 사람부터 다음 채널로 간다 */
export const UNDERWATER_MAX = 15;
/** 수중 맵의 한 변 절반(client/src/underwater.ts 의 HALF)과 구역 수 */
const HALF = 320, ZONES = 6;

export class DiverState extends Schema {
  @type("string") playerId = "";
  @type("string") name = "";
  /** 겉모습과 입은 것(JSON 문자열) */
  @type("string") look = "";
  @type("number") x = 0;
  @type("number") y = -20;
  @type("number") z = 0;
  @type("number") yaw = 0;
  /** 지금 있는 구역. 같은 구역 사람끼리만 서로 보인다(구역 사이는 순간 이동이라 떨어져 있다) */
  @type("number") zone = 0;
  @type("boolean") moving = false;
  /** 타고 있는 신화 물고기(종 id). 안 탔으면 빈 문자열 */
  @type("string") mount = "";
}

export class UnderwaterState extends Schema {
  @type("number") channel = 1;
  @type({ map: DiverState }) players = new MapSchema<DiverState>();
}

const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

/**
 * 수중 탐험 채널. 개인이 만드는 방이 아니라 자동으로 열리는 채널이다: 1채널이 다 차면 2채널이 열린다.
 * 위치는 각자 보낸 것을 그대로 믿는다(보상이 걸린 것이 없다). shortcut: 채집·보물상자를 넣을 때는 서버가 위치를 검증해야 한다.
 */
export function createUnderwaterRoom(deps: Pick<RoomDeps, "service" | "authenticate" | "now">) {
  return class UnderwaterRoom extends Room<UnderwaterState> {
    maxClients = UNDERWATER_MAX;
    private limiters = new Map<string, ChatLimiter>();

    async onCreate() {
      // 비어 있는 가장 작은 채널 번호를 쓴다
      const used = new Set((await matchMaker.query({ name: "underwater" })).map((r) => Number(r.metadata?.channel)));
      let channel = 1;
      while (used.has(channel)) channel++;
      await this.setMetadata({ channel });
      this.setState(new UnderwaterState());
      this.state.channel = channel;
      this.onMessage("move", (c, m) => this.handleMove(c, m));
      this.onMessage("chat", (c, m) => this.handleChat(c, m));
    }

    async onAuth(_client: Client, options: { token?: string }) {
      const id = options?.token ? await deps.authenticate(options.token) : null;
      if (!id) throw new Error("로그인이 필요해요");
      // 한 사람은 한 채널에 한 번만: 다른 창이나 다른 채널에 남은 옛 접속은 내보낸다
      for (const r of await matchMaker.query({ name: "underwater" })) (matchMaker.getLocalRoomById(r.roomId) as any)?.evictPlayer?.(id);
      return { playerId: id };
    }

    evictPlayer(playerId: string) {
      for (const [sid, p] of [...this.state.players.entries()]) {
        if (p.playerId !== playerId) continue;
        this.clients.find((c) => c.sessionId === sid)?.leave(4002);
        this.state.players.delete(sid);
        this.limiters.delete(sid);
      }
    }

    async onJoin(client: Client, _options: unknown, auth: { playerId: string }) {
      const profile = await deps.service.ensureProfile(auth.playerId);
      const p = new DiverState();
      p.playerId = profile.id;
      p.name = profile.nickname;
      p.look = JSON.stringify({ appearance: profile.appearance, equipped: profile.equipped });
      this.state.players.set(client.sessionId, p);
      this.limiters.set(client.sessionId, new ChatLimiter());
      client.send("welcome", { sessionId: client.sessionId, channel: this.state.channel });
    }

    onLeave(client: Client) {
      this.state.players.delete(client.sessionId);
      this.limiters.delete(client.sessionId);
    }

    private handleMove(client: Client, m: Partial<DiverState>) {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m) return;
      p.x = num(m.x, -HALF, HALF, p.x);
      p.y = num(m.y, -80, 0, p.y);
      p.z = num(m.z, -HALF, HALF, p.z);
      p.yaw = num(m.yaw, -100, 100, p.yaw);
      p.zone = Math.round(num(m.zone, 0, ZONES - 1, p.zone));
      p.moving = m.moving === true;
      p.mount = typeof m.mount === "string" ? m.mount.slice(0, 40) : "";
    }

    /** 채팅은 채널 전체(모든 구역)에 보낸다. 가까운 사람에게 말풍선으로 보일지는 받는 쪽 화면이 정한다 */
    private handleChat(client: Client, m: { text: string }) {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof m?.text !== "string") return;
      if (!this.limiters.get(client.sessionId)!.allow(deps.now())) {
        client.send("chatBlocked", { reason: "너무 빨리 보내고 있어요" });
        return;
      }
      const text = cleanChat(m.text);
      if (text) this.broadcast("chat", { sessionId: client.sessionId, name: p.name, text });
    }
  };
}
