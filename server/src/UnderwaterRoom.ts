import { Client, Room, matchMaker } from "@colyseus/core";
import { MapSchema, Schema, type } from "@colyseus/schema";
import { ChatLimiter, cleanChat } from "./chat";
import type { RoomDeps } from "./FishingRoom";
import { BOSS, BOSS_REWARDS, BOSS_TITLE, ZONE_SPECIES, UW_CAP, UW_RATE, UW_SHELLS, uwTugParams, uwTugStart, uwTugStep, uwBeatPress, uwSoon, rollChest, crowdPriceMul, harpoonLevelOf, harpoonStats, huntPos, inwardSeed, resolveThrow, uwHitRadius, uwLength, uwSpeciesById } from "@fishing/shared";
import { BOSS_NAMES } from "@fishing/shared";
import type { HuntPath, MapId, Rarity, UwTug, UwTugState, UwSpecies, V3 } from "@fishing/shared";

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

/** 작살로 잡는 물고기. 위치는 보내지 않고 경로(ax~spd)만 보낸다: shared 의 huntPos 로 모두가 같은 위치를 계산한다 */
export class HuntFish extends Schema {
  @type("string") sp = "";
  @type("number") zone = 0;
  @type("number") ax = 0;
  @type("number") ay = 0;
  @type("number") az = 0;
  @type("number") t0 = 0;
  @type("number") seed = 0;
  @type("number") spd = 1;
  /** 이 물고기의 평소 속도(놀라 도망칠 때는 spd 가 커진다) */
  @type("number") base = 1;
  /** 잡으면 나올 크기(cm) */
  @type("number") cm = 0;
}

/** 바닥의 조개. 가까이 가서 주우면 사라지고 얼마 뒤 다른 곳에 다시 생긴다. 높이는 화면이 지형에서 읽는다 */
export class Shell extends Schema {
  @type("number") zone = 0;
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") kind = "";
}

/** 숨은 보물 상자. 가까이 가서 E 로 열면 사라지고 한참 뒤 다른 곳에 다시 생긴다 */
export class Chest extends Schema {
  @type("number") zone = 0;
  @type("number") x = 0;
  @type("number") z = 0;
  @type("string") kind = "";
}

/** 구역 보스. 이동은 물고기와 같은 경로 함수(huntPos)이고, 약점(w*)은 보스 몸 위의 한 점이다(보스 위치에 더한 값) */
export class Boss extends Schema {
  @type("string") name = "";
  @type("number") zone = 0;
  @type("number") ax = 0;
  @type("number") ay = 0;
  @type("number") az = 0;
  @type("number") t0 = 0;
  @type("number") seed = 0;
  @type("number") spd = 1;
  @type("number") hp = 0;
  @type("number") until = 0;
  @type("number") wx = 0;
  @type("number") wy = 0;
  @type("number") wz = 0;
  @type("number") wUntil = 0;
}

export class UnderwaterState extends Schema {
  @type("number") channel = 1;
  @type({ map: DiverState }) players = new MapSchema<DiverState>();
  @type({ map: HuntFish }) fish = new MapSchema<HuntFish>();
  @type({ map: Shell }) shells = new MapSchema<Shell>();
  @type({ map: Chest }) chests = new MapSchema<Chest>();
  @type(Boss) boss: Boss | undefined;
}

/** 작살 사냥이 열린 구역. shortcut: 구역 중심·반지름은 client/src/underwater.ts 의 ZONES 와 손으로 맞춘다 */
interface HuntZone { zone: number; cx: number; cz: number; r: number; yLo: number; yHi: number; shells: number; chests: string[]; species: UwSpecies[] }
const ZONE_GEO: Array<[number, number, number, number, number]> = [[0, 0, 63, -22, -6], [-175, 95, 70, -33, -12], [175, -95, 63, -36, -14], [-175, -135, 87, -52, -32], [0, 205, 56, -54, -30], [205, 115, 63, -21, -6]]; // [중심 x, z, 반지름, 물고기 높이 아래·위] (client/src/underwater.ts 의 ZONES 와 맞춘다)
const HUNT: HuntZone[] = ZONE_GEO.map(([cx, cz, r, yLo, yHi], zone) => ({ zone, cx, cz, r, yLo, yHi, shells: 6, chests: ["나무", "나무", "나무", "은", "은", "금"], species: ZONE_SPECIES[zone] }));
const RARITIES: Rarity[] = ["common", "rare", "veryRare", "legendary", "mythic"];
const SHOW = process.env.UW_SHOW === "1"; // 확인용: 매우 희귀·전설·신화를 구역마다 전 종류 한 마리씩 처음부터 띄우고 사라지지 않게 한다
const TIME = Number(process.env.UW_TIME ?? 1); // 확인용: 희귀 이상이 나타나는 간격을 이 배율로 줄인다(예: 0.05)
/** 전설·신화: 채널 전체 동시 마리 수와, 떠 있는 평균 시간(ms). 나타나고 사라지는 건 시간표가 아니라 매초 확률(UW_RATE)로 정해진다 */
const CH_RARE: Partial<Record<Rarity, { cap: number }>> = { legendary: { cap: 2 }, mythic: { cap: 1 } };
interface TugRec { fid: string; p: UwTug; s: UwTugState; at: number; startedAt: number; reeling: boolean; phase: string; timer: { clear(): void } }
/** 매우 희귀 이상이 안 잡힌 채 떠 있는 평균 시간(ms). 매초 확률로 사라진다 */
const LIFE: Partial<Record<Rarity, number>> = { veryRare: 600000, legendary: 600000, mythic: 300000 };
/** 힘겨루기 중 걸린 물고기의 헤엄 속도 배율(평소 속도 기준). 돌진할 때 빠르다 */
const TUG_SPEED: Record<string, number> = { rest: 0.5, run: 2.4, hold: 0.35, beat: 0.2 };
const RARE_TEXT: Partial<Record<Rarity, string>> = { mythic: "신화의 물고기가 어딘가에 나타났어요!!" }; // 구역마다 알리면 너무 잦아서 신화만 알린다
const SHELL_KINDS = ["가리비", "소라", "진주조개"];
const LAG_MS = 400; // 서버가 인정하는 던진 시각의 지연 한도(낚시 타이밍과 같은 값)
const CHEST_AGAIN_MS = 90000;
const FLEE_MUL = 2.4, FLEE_MS = 2500, SHELL_AGAIN_MS = 30000;

const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

/**
 * 수중 탐험 채널. 개인이 만드는 방이 아니라 자동으로 열리는 채널이다: 1채널이 다 차면 2채널이 열린다.
 * 위치는 각자 보낸 것을 그대로 믿는다(보상이 걸린 것이 없다). shortcut: 채집·보물상자를 넣을 때는 서버가 위치를 검증해야 한다.
 */
export function createUnderwaterRoom(deps: Pick<RoomDeps, "service" | "authenticate" | "now">) {
  return class UnderwaterRoom extends Room<UnderwaterState> {
    maxClients = UNDERWATER_MAX;
    private limiters = new Map<string, ChatLimiter>();
    private nextId = 1;
    private fleeUntil = new Map<string, number>();
    /** 작살이 날아가는 중이라 이미 맞은 것으로 정해진 물고기(그동안 놀라 도망치지도, 다른 작살에 맞지도 않는다) */
    private claimed = new Set<string>();
    /** 전설·신화는 구역마다가 아니라 채널 전체에서 정해진 마리 수만, 한동안 떠 있다가 사라진다 */
    private lastTick = 0;
    private bossAt = 0;
    private bossDmg = new Map<string, { name: string; dmg: number }>(); // 플레이어 id → 보스에게 준 피해(기여도)
    private lastThrow = new Map<string, number>();
    private harp = new Map<string, number>(); // 접속자별 작살총 단계
    private lastPos = new Map<string, { x: number; z: number }>();
    private nextSpawn = new Map<number, { shell: number; chest: number }>();
    private tugs = new Map<string, TugRec>();

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
      this.onMessage("ping", (c, m) => c.send("pong", { c: num(m?.c, 0, 1e15, 0), s: deps.now() })); // 화면이 서버 시계를 맞추는 데 쓴다(물고기 위치는 서버 시각의 함수)
      this.onMessage("throw", (c, m) => this.handleThrow(c, m));
      this.onMessage("gather", (c, m) => void this.handleGather(c, m));
      this.onMessage("sell", (c, m) => void this.handleSell(c, m));
      this.onMessage("open", (c, m) => void this.handleOpen(c, m));
      this.onMessage("reel", (c, m) => { const t = this.tugs.get(c.sessionId); if (t) t.reeling = !!m?.on; }); // 힘겨루기: 누르고 있는 동안 줄을 감는다
      this.onMessage("beat", (c, m) => this.handleBeat(c, m)); // 힘겨루기 박자 단계: 박자에 맞춰 누른다
      this.bossAt = deps.now() + 10 * 60000 * TIME;
      this.onMessage("refresh", (c) => void this.refreshHarp(c));
      for (const z of HUNT) { this.nextSpawn.set(z.zone, { shell: 0, chest: 0 }); for (const r of RARITIES) if (!(r in CH_RARE)) for (let i = 0; i < UW_CAP[r]; i++) this.spawnFish(z, r); if (SHOW) for (const sp of z.species) if (sp.rarity === "veryRare" || sp.rarity === "legendary" || sp.rarity === "mythic") this.spawnFish(z, sp.rarity, sp); for (let i = 0; i < z.shells; i++) this.spawnShell(z); for (const k of z.chests) this.spawnChest(z, k); }
      this.clock.setInterval(() => this.huntTick(), 250);
    }

    // ---- 작살 사냥 ------------------------------------------------------------
    private path(f: HuntFish): HuntPath {
      return { ax: f.ax, ay: f.ay, az: f.az, t0: f.t0, seed: f.seed, spd: f.spd };
    }

    /** 지금 위치에서 새 경로를 시작한다(끊김 없이 이어진다). mul 이 크면 빠르게 도망친다 */
    private rebase(f: HuntFish, z: HuntZone, mul: number) {
      const now = deps.now(), p = huntPos(this.path(f), now);
      f.ax = p.x; f.ay = Math.min(z.yHi, Math.max(z.yLo, p.y)); f.az = p.z;
      f.t0 = now;
      f.seed = inwardSeed(Math.random, p.x, p.z, z.cx, z.cz);
      f.spd = f.base * mul;
    }

    private spawnFish(z: HuntZone, rarity: Rarity, only?: UwSpecies): string | undefined {
      const pool = only ? [only] : z.species.filter((x) => (x.rarity ?? "common") === rarity);
      if (!pool.length) return;
      let sp = pool[Math.floor(Math.random() * pool.length)];
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * z.r;
      const f = new HuntFish();
      f.sp = sp.id; f.zone = z.zone;
      f.ax = z.cx + Math.cos(a) * d; f.az = z.cz + Math.sin(a) * d; f.ay = z.yLo + Math.random() * (z.yHi - z.yLo);
      if (rarity === "common" && Math.random() < 0.7) { // 일반 물고기는 같은 종류끼리 떼를 지어 나타난다(희귀 이상은 홀로)
        const mates = [...this.state.fish.values()].filter((o) => o.zone === z.zone && (uwSpeciesById(o.sp)?.rarity ?? "common") === "common");
        const m = mates[Math.floor(Math.random() * mates.length)];
        const mp = m && uwSpeciesById(m.sp);
        if (m && mp && pool.includes(mp)) {
          const q = huntPos(this.path(m), deps.now());
          sp = mp; f.sp = mp.id;
          f.ax = q.x + (Math.random() - 0.5) * 8; f.az = q.z + (Math.random() - 0.5) * 8; f.ay = Math.min(z.yHi, Math.max(z.yLo, q.y + (Math.random() - 0.5) * 3));
        }
      }
      f.t0 = deps.now();
      f.seed = inwardSeed(Math.random, f.ax, f.az, z.cx, z.cz);
      f.base = sp.speed * (0.85 + Math.random() * 0.3); f.spd = f.base;
      f.cm = Math.round((sp.sizeCm[0] + Math.random() * (sp.sizeCm[1] - sp.sizeCm[0])) * 10) / 10;
      const id = String(this.nextId++);
      this.state.fish.set(id, f);
      return id;
    }

    private spawnShell(z: HuntZone) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (z.r + 10);
      const s = new Shell();
      s.zone = z.zone; s.x = z.cx + Math.cos(a) * d; s.z = z.cz + Math.sin(a) * d;
      s.kind = SHELL_KINDS[Math.floor(Math.random() * SHELL_KINDS.length)];
      this.state.shells.set(String(this.nextId++), s);
    }

    private spawnChest(z: HuntZone, kind: string) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (z.r + 5);
      const c = new Chest();
      c.zone = z.zone; c.x = z.cx + Math.cos(a) * d; c.z = z.cz + Math.sin(a) * d; c.kind = kind;
      this.state.chests.set(String(this.nextId++), c);
    }

    // ---- 구역 보스 ------------------------------------------------------------
    private bossPath(b: Boss): HuntPath { return { ax: b.ax, ay: b.ay, az: b.az, t0: b.t0, seed: b.seed, spd: b.spd }; }

    private newWeak(b: Boss, now: number) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.2, r = BOSS.radius * 0.9; // 몸 표면 가까운 곳에 나타난다
      b.wx = Math.cos(a) * Math.cos(e) * r; b.wy = Math.sin(e) * r; b.wz = Math.sin(a) * Math.cos(e) * r;
      b.wUntil = now + BOSS.weakMs;
    }

    private spawnBoss(now: number) {
      const z = HUNT[Math.floor(Math.random() * HUNT.length)];
      const b = new Boss();
      b.name = BOSS_NAMES[z.zone]?.name ?? "구역 보스"; b.zone = z.zone;
      b.ax = z.cx + (Math.random() - 0.5) * 30; b.az = z.cz + (Math.random() - 0.5) * 30; b.ay = (z.yLo + z.yHi) / 2;
      b.t0 = now; b.seed = inwardSeed(Math.random, b.ax, b.az, z.cx, z.cz); b.spd = BOSS.speed;
      b.hp = BOSS.hp; b.until = now + BOSS.stayMs;
      this.newWeak(b, now);
      this.state.boss = b;
      this.bossDmg.clear();
      this.broadcast("boss", { text: "⚠️ 구역 보스가 나타났어요! 어디에 있을까요?" }); // 어느 구역인지는 알리지 않는다
      this.broadcast("chat", { sessionId: "", name: "", text: "⚠️ 구역 보스가 나타났어요!" });
    }

    private endBoss(text: string) {
      this.state.boss = undefined;
      this.bossDmg.clear();
      this.bossAt = deps.now() + (20 + Math.random() * 20) * 60000 * TIME;
      this.broadcast("chat", { sessionId: "", name: "", text });
    }

    /** 보스에게 피해를 준다. 체력이 0이 되면 기여도 순으로 보상한다 */
    private async hitBoss(playerId: string, name: string, weak: boolean, sid: string) {
      const b = this.state.boss;
      if (!b || b.hp <= 0) return;
      const dmg = weak ? BOSS.weak : BOSS.body;
      b.hp = Math.max(0, b.hp - dmg);
      const e = this.bossDmg.get(playerId) ?? { name, dmg: 0 };
      e.dmg += dmg; this.bossDmg.set(playerId, e);
      this.broadcast("bosshit", { sid, weak, hp: b.hp });
      if (b.hp > 0) return;
      const ranked = [...this.bossDmg.entries()].sort((x, y) => y[1].dmg - x[1].dmg);
      const bySession = new Map([...this.state.players.entries()].map(([s, p]) => [p.playerId, s]));
      for (const [i, [pid, info]] of ranked.entries()) {
        const rw = BOSS_REWARDS[Math.min(i, BOSS_REWARDS.length - 1)];
        await deps.service.grantReward(pid, { coins: rw.coins, stones: rw.stones, baitId: "", bait: 0, title: BOSS_TITLE }).catch((er) => console.error("보스 보상 저장 실패", er));
        const c = this.clients.find((x) => x.sessionId === bySession.get(pid));
        c?.send("bossend", { rank: i + 1, total: ranked.length, dmg: info.dmg, coins: rw.coins, stones: rw.stones, title: BOSS_TITLE });
      }
      this.endBoss(`🏆 보스를 쓰러뜨렸어요! 1위 ${ranked[0]?.[1].name ?? ""}님 (${ranked.length}명 참여)`);
    }

    private huntTick() {
      const now = deps.now();
      const boss = this.state.boss;
      if (boss) {
        if (now >= boss.until) this.endBoss("보스가 어디론가 사라졌어요…");
        else if (now >= boss.wUntil) this.newWeak(boss, now);
      } else if (this.bossAt && now >= this.bossAt) this.spawnBoss(now);
      const dt = Math.min(1, (now - (this.lastTick || now)) / 1000); this.lastTick = now;
      const roll = (r: Rarity) => Math.random() < 1 - Math.exp(-(UW_RATE[r] * dt) / TIME); // 이번 틱에 나타날 확률(매초 UW_RATE 의 확률)
      const moved = new Map<string, boolean>(); // 빠르게 움직이는 사람은 조용히 떠 있는 사람보다 물고기를 더 놀라게 한다
      this.state.players.forEach((p, sid) => {
        const last = this.lastPos.get(sid);
        moved.set(sid, !!last && Math.hypot(p.x - last.x, p.z - last.z) / 0.25 > 3);
        this.lastPos.set(sid, { x: p.x, z: p.z });
      });
      if (!SHOW) for (const [id, f] of [...this.state.fish.entries()]) { // 떠 있는 동안 매초 일정한 확률로 사라진다(작살이 박혔거나 힘겨루기 중이면 그대로)
        const life = LIFE[uwSpeciesById(f.sp)?.rarity ?? "common"];
        if (life && Math.random() < 1 - Math.exp(-dt / TIME / (life / 1000)) && !this.claimed.has(id) && ![...this.tugs.values()].some((t) => t.fid === id)) { this.state.fish.delete(id); this.fleeUntil.delete(id); }
      }
      for (const r of Object.keys(CH_RARE) as Rarity[]) {
        if (SHOW) break;
        const all = [...this.state.fish.entries()].filter(([, f]) => (uwSpeciesById(f.sp)?.rarity ?? "common") === r);
        if (all.length < CH_RARE[r]!.cap && roll(r)) {
          this.spawnFish(HUNT[Math.floor(Math.random() * HUNT.length)], r);
          if (RARE_TEXT[r]) this.broadcast("chat", { sessionId: "", name: "", text: RARE_TEXT[r] });
        }
      }
      for (const z of HUNT) {
        const q = this.nextSpawn.get(z.zone)!;
        const mine = [...this.state.fish.entries()].filter(([, f]) => f.zone === z.zone);
        for (const r of RARITIES) { if (r in CH_RARE) continue; // 등급마다 정해진 마리 수까지만 한 마리씩 채운다(희귀 이상은 드물게, 무리 없이)
          if (mine.filter(([, f]) => (uwSpeciesById(f.sp)?.rarity ?? "common") === r).length < UW_CAP[r] && roll(r)) this.spawnFish(z, r);
        }
        if ([...this.state.shells.values()].filter((s) => s.zone === z.zone).length < z.shells && now >= q.shell) { this.spawnShell(z); q.shell = now + 8000; }
        // 열린 상자는 정해진 시간 뒤 같은 등급으로 다시 생긴다
        const have = [...this.state.chests.values()].filter((c) => c.zone === z.zone).map((c) => c.kind);
        const miss = z.chests.find((k) => { const i = have.indexOf(k); if (i >= 0) { have.splice(i, 1); return false; } return true; });
        if (miss && now >= q.chest) { this.spawnChest(z, miss); q.chest = now + 5000; }
        for (const [id, f] of mine) {
          const sp = uwSpeciesById(f.sp);
          if (!sp || this.claimed.has(id)) continue;
          const flee = this.fleeUntil.get(id);
          if (flee !== undefined) { if (now >= flee) { this.fleeUntil.delete(id); this.rebase(f, z, 1); } continue; }
          const pos = huntPos(this.path(f), now);
          let scared = false;
          this.state.players.forEach((p, sid) => {
            if (p.zone === z.zone && Math.hypot(p.x - pos.x, p.y - pos.y, p.z - pos.z) < sp.skittish * (moved.get(sid) ? 1 : 0.4)) scared = true;
          });
          if (scared) this.scare(id, f, z);
          else if (Math.hypot(pos.x - z.cx, pos.z - z.cz) > z.r + 25) this.rebase(f, z, 1); // 구역 가장자리로 흘러가면 안쪽으로 돌린다
        }
      }
    }

    /** 힘겨루기 시작: 쉴 때 감고 돌진할 때 풀어 지치게 한다(전설은 이어서 장력 버티기, 신화는 거기에 박자까지). 서버가 계산하고 0.1초마다 상태를 보낸다 */
    private startTug(client: Client, sid: string, fid: string, p: UwTug) {
      const now = deps.now(), f = this.state.fish.get(fid);
      if (!f) return;
      this.tugs.get(sid)?.timer.clear();
      const z = HUNT.find((h) => h.zone === f.zone);
      if (z) this.rebase(f, z, TUG_SPEED.rest); // 걸린 물고기는 줄에 매인 채로 헤엄친다(돌진할 때 빨라진다. 모두의 화면에서 같은 경로)
      const tug = { fid, p, s: uwTugStart(p, Math.random), at: 0, startedAt: now, reeling: false, phase: "rest", timer: this.clock.setInterval(() => this.tugTick(client, sid), 100) };
      this.tugs.set(sid, tug);
      client.send("tug", { fid, ...p });
    }

    private tugTick(client: Client, sid: string) {
      const t = this.tugs.get(sid);
      if (!t) return;
      const now = deps.now(), e = now - t.startedAt, dt = Math.min(0.5, Math.max(0.001, (e - t.at) / 1000));
      t.at = e;
      if (uwTugStep(t.p, t.s, dt, e, t.reeling, Math.random) === "won") { this.endTug(client, sid, true); return; }
      const s = t.s;
      if (s.phase !== t.phase) { // 단계가 바뀌면 물고기의 헤엄 속도도 바뀐다
        t.phase = s.phase;
        const f = this.state.fish.get(t.fid), z = f && HUNT.find((h) => h.zone === f.zone);
        if (f && z) this.rebase(f, z, TUG_SPEED[s.phase]);
      }
      client.send("tugst", { fid: t.fid, tire: s.tire, ten: s.ten, phase: s.phase, soon: uwSoon(t.p, s, e), band: t.p.hold?.band ?? null, hold: t.p.hold ? Math.min(1, s.held / t.p.hold.ms) : 0, beats: s.phase === "beat" ? s.beatAt.map((x) => x + t.startedAt) : null, beatI: s.beatI });
      if (s.ten >= 1 || e >= t.p.durationMs) this.endTug(client, sid, false); // 줄이 끊기거나 시간이 다 됐다
    }

    /** 박자 단계: 누른 시각(화면이 짐작한 서버 시각, 지연은 조금 봐준다)이 박자에 맞는지 본다 */
    private handleBeat(client: Client, m: { at?: number }) {
      const sid = client.sessionId, t = this.tugs.get(sid);
      if (!t || t.s.phase !== "beat") return;
      const now = deps.now(), at = Math.min(now, Math.max(now - LAG_MS, num(m?.at, now - LAG_MS, now, now)));
      const r = uwBeatPress(t.p, t.s, at - t.startedAt, Math.random);
      client.send("beatres", { r, i: t.s.beatI });
      if (r === "won") this.endTug(client, sid, true);
    }

    private endTug(client: Client, sid: string, won: boolean) {
      const t = this.tugs.get(sid);
      if (!t) return;
      t.timer.clear();
      this.tugs.delete(sid);
      const p = this.state.players.get(sid);
      if (won && p) { void this.land(client, sid, p.playerId, p.name, t.fid); return; }
      // 놓쳤다: 줄이 끊기고 물고기는 놀라 도망친다
      this.claimed.delete(t.fid);
      const f = this.state.fish.get(t.fid), z = f && HUNT.find((h) => h.zone === f.zone);
      if (f && z) this.scare(t.fid, f, z);
      this.broadcast("escaped", { fid: t.fid, sid });
    }

    /** 물고기를 잡아 올린다: 방에서 지우고, 모두에게 알리고, 잡은 사람의 인벤토리·도감에 저장한다 */
    private async land(client: Client, sid: string, playerId: string, by: string, id: string) {
      this.claimed.delete(id);
      const f = this.state.fish.get(id), sp = f && uwSpeciesById(f.sp);
      if (!f || !sp) return;
      this.state.fish.delete(id);
      this.fleeUntil.delete(id);
      const r = sp.rarity ?? "common";
      this.broadcast("caught", { sid, by, sp: sp.id, name: sp.name, cm: f.cm, fid: id, rarity: r });
      const saved = await deps.service.recordCatch(playerId, sp.id, f.cm, "atlantis" as MapId).catch((e) => { console.error("수중 물고기 저장 실패", e); return null; });
      if (saved?.isNew && this.clients.includes(client)) client.send("newfish", { fid: id });
    }

    private scare(id: string, f: HuntFish, z: HuntZone) {
      this.rebase(f, z, FLEE_MUL);
      this.fleeUntil.set(id, deps.now() + FLEE_MS);
    }

    /** 작살 던지기. 던진 순간의 물고기 위치(지연 보정 한도 안)로 판정하고, 결과는 채널 전체에 알린다 */
    private handleThrow(client: Client, m: { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number; at: number }) {
      const p = this.state.players.get(client.sessionId);
      const z = p && HUNT.find((h) => h.zone === p.zone);
      if (!p || !z || !m) return;
      const now = deps.now();
      const st = harpoonStats(this.harp.get(client.sessionId) ?? 0);
      if (now - (this.lastThrow.get(client.sessionId) ?? 0) < st.cooldownMs - 150) return; // 연타 방지(약간의 지연은 봐준다)
      const o = { x: num(m.ox, -HALF, HALF, NaN), y: num(m.oy, -80, 0, NaN), z: num(m.oz, -HALF, HALF, NaN) };
      const dx = num(m.dx, -1, 1, NaN), dy = num(m.dy, -1, 1, NaN), dz = num(m.dz, -1, 1, NaN);
      const len = Math.hypot(dx, dy, dz);
      if ([o.x, o.y, o.z, len].some(Number.isNaN) || len < 0.5 || Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) > 8) return; // 내 몸에서 먼 곳에서 던졌다고 하면 무시
      this.lastThrow.set(client.sessionId, now);
      const at = Math.min(now, Math.max(now - LAG_MS, num(m.at, now - LAG_MS, now, now)));
      if (this.tugs.has(client.sessionId)) return; // 힘겨루기 중에는 작살을 쏘지 못한다
      const targets = [...this.state.fish.entries()].filter(([id, f]) => f.zone === z.zone && !this.claimed.has(id)).map(([id, f]) => ({ id, path: this.path(f), radius: uwHitRadius(uwLength(f.cm)) }));
      const dir = { x: dx / len, y: dy / len, z: dz / len };
      const boss = this.state.boss && this.state.boss.zone === z.zone && this.state.boss.hp > 0 ? this.state.boss : undefined;
      if (boss) targets.push({ id: "boss", path: this.bossPath(boss), radius: BOSS.radius });
      const res = resolveThrow(o, dir, at, targets, st);
      let weakHit = false;
      if (res.hit === "boss" && boss && now < boss.wUntil) { // 약점은 몸 안쪽 표면에 있어서 따로 본다: 몸보다 조금 늦게 닿아도 약점이 우선이다
        const wp = this.bossPath(boss);
        const rw = resolveThrow(o, dir, at, [{ id: "weak", path: { ...wp, ax: wp.ax + boss.wx, ay: wp.ay + boss.wy, az: wp.az + boss.wz }, radius: BOSS.weakRadius }], st);
        if (rw.hit && rw.tau <= res.tau + 0.2) { weakHit = true; res.tau = rw.tau; }
      }
      this.broadcast("spear", { sid: client.sessionId, ox: o.x, oy: o.y, oz: o.z, dx: dx / len, dy: dy / len, dz: dz / len, tau: res.tau, hit: res.hit !== null, fid: res.hit ?? "", spd: st.speed, rng: st.range });
      for (const id of res.near) { const f = this.state.fish.get(id); if (f && !this.fleeUntil.has(id)) this.scare(id, f, z); }
      if (res.hit === "boss") { // 보스: 작살이 닿는 순간 피해를 준다(잡아 올리지는 않는다)
        const pid = p.playerId, nm = p.name, sid2 = client.sessionId;
        this.clock.setTimeout(() => void this.hitBoss(pid, nm, weakHit, sid2), Math.max(0, at + res.tau * 1000 - now));
        return;
      }
      if (res.hit === null) return;
      // 작살이 물고기에 닿는 순간에 잡힌 것으로 한다(화면에서 작살이 날아가는 동안 물고기는 그대로 있다)
      const id = res.hit, playerId = p.playerId, by = p.name, sid = client.sessionId;
      this.claimed.add(id);
      this.clock.setTimeout(async () => {
        const f = this.state.fish.get(id), sp = f && uwSpeciesById(f.sp);
        if (!f || !sp) { this.claimed.delete(id); return; }
        const tug = sp.rarity && sp.rarity !== "common" && sp.rarity !== "rare" ? uwTugParams(sp.rarity, this.harp.get(sid) ?? 0, Math.random) : null;
        if (tug) { this.startTug(client, sid, id, tug); return; } // 매우 희귀 이상: 힘겨루기에서 이겨야 잡힌다
        await this.land(client, sid, playerId, by, id);
      }, Math.max(0, at + res.tau * 1000 - now));
    }

    /** 조개 줍기: 가까이(수평 5.5m 안) 있을 때만. 줍은 조개는 물고기와 같은 인벤토리·도감에 들어간다 */
    private async handleGather(client: Client, m: { id: string }) {
      const p = this.state.players.get(client.sessionId);
      const s = p && typeof m?.id === "string" ? this.state.shells.get(m.id) : undefined;
      if (!p || !s || s.zone !== p.zone || Math.hypot(p.x - s.x, p.z - s.z) > 5.5) return;
      this.state.shells.delete(m.id);
      const q = this.nextSpawn.get(s.zone);
      if (q) q.shell = Math.max(q.shell, deps.now() + SHELL_AGAIN_MS);
      const sp = UW_SHELLS.find((x) => x.name === s.kind);
      if (!sp) return;
      const cm = Math.round((sp.sizeCm[0] + Math.random() * (sp.sizeCm[1] - sp.sizeCm[0])) * 10) / 10;
      const saved = await deps.service.recordCatch(p.playerId, sp.id, cm, "atlantis" as MapId).catch((e) => { console.error("조개 저장 실패", e); return null; });
      client.send("gathered", { kind: s.kind, cm, isNew: !!saved?.isNew });
    }

    /** 보물 상자 열기: 가까이(수평 5.5m 안) 있을 때만. 먼저 연 사람이 가진다 */
    private async handleOpen(client: Client, m: { id: string }) {
      const p = this.state.players.get(client.sessionId);
      const c = p && typeof m?.id === "string" ? this.state.chests.get(m.id) : undefined;
      if (!p || !c || c.zone !== p.zone || Math.hypot(p.x - c.x, p.z - c.z) > 5.5) return;
      this.state.chests.delete(m.id);
      const q = this.nextSpawn.get(c.zone);
      if (q) q.chest = Math.max(q.chest, deps.now() + CHEST_AGAIN_MS);
      const r = rollChest(c.kind);
      await deps.service.grantReward(p.playerId, r).catch((e) => console.error("상자 보상 저장 실패", e));
      client.send("chest", { kind: c.kind, ...r });
      if (c.kind === "금") this.broadcast("chat", { sessionId: "", name: "", text: `${p.name}님이 금 상자를 열었어요!` });
    }

    /** 수중에서 잡은 것(물고기·조개)을 판다. 같은 채널에 사람이 많을수록 값이 조금 높다 */
    private async handleSell(client: Client, m: { ids: string[] }) {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Array.isArray(m?.ids)) return;
      const mul = crowdPriceMul(this.state.players.size);
      const r = await deps.service.sell(p.playerId, m.ids.filter((x) => typeof x === "string").slice(0, 200), (id) => id.startsWith("uw-"), mul).catch(() => null);
      client.send("sold", r ? { ...r, mul } : { sold: 0, earned: 0, stones: 0, mul });
    }

    /** 작살총을 강화한 뒤 새 단계를 다시 읽는다 */
    private async refreshHarp(client: Client) {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const profile = await deps.service.profile(p.playerId);
      if (profile) this.harp.set(client.sessionId, harpoonLevelOf(profile.equipped));
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
      let profile = await deps.service.ensureProfile(auth.playerId);
      if (SHOW && (profile.coins < 1_000_000 || (profile.stones ?? 0) < 10_000)) { // 확인용 서버: 강화를 단계마다 해 볼 수 있게 돈과 강화석을 넉넉히 넣어 준다
        await deps.service.grantReward(auth.playerId, { coins: 2_000_000, stones: 30_000, baitId: "", bait: 0 });
        profile = await deps.service.ensureProfile(auth.playerId);
      }
      const p = new DiverState();
      p.playerId = profile.id;
      p.name = profile.nickname;
      p.look = JSON.stringify({ appearance: profile.appearance, equipped: profile.equipped });
      this.state.players.set(client.sessionId, p);
      this.limiters.set(client.sessionId, new ChatLimiter());
      this.harp.set(client.sessionId, harpoonLevelOf(profile.equipped));
      client.send("welcome", { sessionId: client.sessionId, channel: this.state.channel, serverNow: deps.now() });
    }

    onLeave(client: Client) {
      this.state.players.delete(client.sessionId);
      this.limiters.delete(client.sessionId);
      this.lastThrow.delete(client.sessionId);
      this.lastPos.delete(client.sessionId);
      this.harp.delete(client.sessionId);
      const tug = this.tugs.get(client.sessionId);
      if (tug) { tug.timer.clear(); this.tugs.delete(client.sessionId); this.claimed.delete(tug.fid); const f = this.state.fish.get(tug.fid), z = f && HUNT.find((h) => h.zone === f.zone); if (f && z) this.rebase(f, z, 1); } // 힘겨루기 중에 나가면 물고기는 풀려난다
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
