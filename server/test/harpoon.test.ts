import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HARPOON, harpoonStats, huntPos, inwardSeed, resolveThrow, rollChest, uwHitRadius, uwLength, uwBeatPress, uwSoon, uwTugParams, uwTugStart, uwTugStep } from "@fishing/shared";
import type { HuntPath, V3 } from "@fishing/shared";
import { matchMaker } from "@colyseus/core";
import { startHarness, until, waitMessage } from "./harness";
import type { Harness } from "./harness";

const path = (over: Partial<HuntPath> = {}): HuntPath => ({ ax: 0, ay: -20, az: 0, t0: 0, seed: 12345, spd: 3, ...over });
const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const norm = (v: V3): V3 => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };

/** 던진 사람이 정확히 앞서 쏜다면 맞는 방향: 작살이 날아가는 시간 동안 물고기가 가는 곳을 겨냥한다 */
function leadAim(o: V3, p: HuntPath, t: number): V3 {
  let tau = 0.3;
  for (let i = 0; i < 12; i++) tau = dist(o, huntPos(p, t + tau * 1000)) / HARPOON.speed;
  return norm({ x: huntPos(p, t + tau * 1000).x - o.x, y: huntPos(p, t + tau * 1000).y - o.y, z: huntPos(p, t + tau * 1000).z - o.z });
}

describe("물고기 경로", () => {
  it("같은 입력이면 같은 위치이고, 시작 순간에는 출발점에 있다", () => {
    const p = path();
    expect(huntPos(p, 0)).toEqual({ x: 0, y: -20, z: 0 });
    expect(huntPos(p, 5000)).toEqual(huntPos({ ...p }, 5000));
  });

  it("경로를 새로 시작(놀람)해도 위치가 끊기지 않는다", () => {
    const p = path();
    const now = 7000, here = huntPos(p, now);
    const q = path({ ax: here.x, ay: here.y, az: here.z, t0: now, seed: 999, spd: 7 });
    expect(dist(huntPos(q, now), here)).toBeLessThan(1e-9);
    expect(dist(huntPos(q, now + 100), here)).toBeLessThan(1.5); // 빨라도 순간 이동은 없다
  });

  it("경로는 출발점 둘레의 일정한 폭 안에 머문다", () => {
    const p = path();
    for (let t = 0; t < 120000; t += 500) expect(Math.hypot(huntPos(p, t).x, huntPos(p, t).z)).toBeLessThan(40);
  });

  it("안쪽을 고른 씨앗은 처음에 중심 쪽으로 간다", () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 20; i++) {
      const s = inwardSeed(rng, 60, 0, 0, 0);
      const a = huntPos(path({ ax: 60, az: 0, seed: s, spd: 12 }), 0), b = huntPos(path({ ax: 60, az: 0, seed: s, spd: 12 }), 1000);
      expect(b.x - a.x).toBeLessThan(0.5); // 대부분 중심(-x)으로 향한다
    }
  });
});

describe("작살 판정", () => {
  const t = 100000;
  const fish = (over: Partial<HuntPath> = {}, id = "f") => ({ id, path: path({ t0: t, ...over }), radius: uwHitRadius(uwLength(40)) });

  it("앞서 정확히 쏘면 맞고, 겨냥한 자리를 그대로 쏘면 움직이는 물고기는 빗나간다", () => {
    const f = fish({ ax: 12, spd: 10 });
    const o = { x: 0, y: -20, z: 0 };
    const lead = resolveThrow(o, leadAim(o, f.path, t), t, [f]);
    expect(lead.hit).toBe("f");
    const now = huntPos(f.path, t);
    const naive = resolveThrow(o, norm({ x: now.x - o.x, y: now.y - o.y, z: now.z - o.z }), t, [f]);
    expect(naive.hit).toBeNull();
  });

  it("사거리 밖이면 빗나가고, 반대쪽을 쏘면 빗나간다", () => {
    const o = { x: 0, y: -20, z: 0 };
    const far = fish({ ax: HARPOON.range + 25 });
    expect(resolveThrow(o, leadAim(o, far.path, t), t, [far]).hit).toBeNull();
    const near = fish({ ax: 10 });
    expect(resolveThrow(o, { x: -1, y: 0, z: 0 }, t, [near]).hit).toBeNull();
  });

  it("가까이 지나간 물고기는 놀라고, 두 마리가 겹치면 먼저 닿는 쪽이 맞는다", () => {
    const o = { x: 0, y: -20, z: 0 };
    const a = fish({ ax: 20, az: 0, spd: 0.001 }, "far"), b = fish({ ax: 8, az: 0.5, spd: 0.001 }, "close");
    const r = resolveThrow(o, { x: 1, y: 0, z: 0 }, t, [a, b]);
    expect(r.hit).toBe("close");
    const side = fish({ ax: 15, az: 3.2, spd: 0.001 }, "side");
    expect(resolveThrow(o, { x: 1, y: 0, z: 0 }, t, [side])).toMatchObject({ hit: null, near: ["side"] });
  });
});

describe("힘겨루기(지치게 하기 → 마지막 버티기 → 박자)", () => {
  type R = "veryRare" | "legendary" | "mythic";
  const mid = () => 0.5;
  /** 누르고 있는가를 정하는 규칙(단계, 장력, 목표 띠). 박자 단계에서는 press 가 true 인 시각에 눌러 본다 */
  type Pol = { hold: (s: { phase: string; ten: number }, band: [number, number] | null) => boolean; press?: (t: number, next: number) => boolean };
  const ideal: Pol = { hold: (s, band) => (s.phase === "rest" ? true : s.phase === "hold" && band ? s.ten < (band[0] + band[1]) / 2 : false), press: (t, next) => Math.abs(t - next) <= 50 };
  const play = (r: R, pol: Pol, lvl = 0, stopAt?: string) => {
    const p = uwTugParams(r, lvl, mid)!, s = uwTugStart(p, mid);
    for (let t = 0; t < p.durationMs; t += 100) {
      if (stopAt && s.phase === stopAt) return { end: "phase", t, s, p };
      if (s.phase === "beat" && pol.press?.(t, s.beatAt[s.beatI]) && uwBeatPress(p, s, t, mid) === "won") return { end: "won", t, s, p };
      if (uwTugStep(p, s, 0.1, t, pol.hold(s, p.hold?.band ?? null), mid) === "won") return { end: "won", t, s, p };
      if (s.ten >= 1) return { end: "snap", t, s, p };
    }
    return { end: "time", t: p.durationMs, s, p };
  };
  it("계속 누르고만 있으면 돌진 때 줄이 끊기고, 아예 안 누르면 시간이 다 된다", () => {
    for (const r of ["veryRare", "legendary", "mythic"] as const) {
      expect(play(r, { hold: () => true }).end).toBe("snap");
      expect(play(r, { hold: () => false }).end).toBe("time");
    }
  });
  it("매우 희귀: 쉴 때 감고 돌진할 때 풀면 지친 물고기가 바로 잡힌다(약 6~11초)", () => {
    const x = play("veryRare", ideal); expect(x.end).toBe("won"); expect(x.t).toBeGreaterThan(5000); expect(x.t).toBeLessThan(11000);
  });
  it("전설: 지치게 한 뒤 목표 띠에 장력을 유지해야 하고, 가만히 있거나 계속 누르면 못 잡는다", () => {
    expect(play("legendary", ideal).end).toBe("won");
    const sw = (hold: boolean): Pol => ({ hold: (s) => (s.phase === "hold" ? hold : s.phase === "rest") });
    expect(play("legendary", sw(true)).end).toBe("snap"); // 계속 누르면 장력이 가득 찬다
    expect(play("legendary", sw(false)).end).toBe("time"); // 안 누르면 장력이 0이라 띠에 못 들어간다
  });
  it("신화: 띠 유지 뒤에 박자 세 번을 맞춰야 한다(박자 밖에 눌러서는 못 잡고, 박자를 놓치면 장력이 오른다)", () => {
    const x = play("mythic", ideal); expect(x.end).toBe("won");
    expect(play("mythic", { ...ideal, press: () => false }).end).not.toBe("won"); // 아무것도 안 누르면 박자를 놓쳐 처음부터 반복
    const p = uwTugParams("mythic", 0, mid)!, y = play("mythic", { ...ideal, press: () => false }, 0, "beat");
    expect(y.end).toBe("phase"); // 박자 단계까지는 간다
    const s = y.s, t0 = y.t;
    expect(uwBeatPress(p, s, s.beatAt[0] - 300, mid)).toBe("miss"); // 박자 직전이 아니라 조금 일찍 누름: 틀림
    expect(s.ten).toBeGreaterThan(0.25);
    expect(uwBeatPress(p, s, t0 - 9000, mid)).toBe("ignore"); // 박자와 상관없는 때
  });
  it("신화 박자: 세 번 모두 맞으면 이기고, 중간에 한 번이라도 지나치면 장력이 오르며 처음부터 다시 시작한다", () => {
    const p = uwTugParams("mythic", 0, mid)!, y = play("mythic", { ...ideal, press: () => false }, 0, "beat"), s = y.s;
    expect(uwBeatPress(p, s, s.beatAt[0], mid)).toBe("hit");
    expect(uwBeatPress(p, s, s.beatAt[1] + 20, mid)).toBe("hit");
    expect(uwBeatPress(p, s, s.beatAt[2] - 30, mid)).toBe("won");
    const z = play("mythic", { ...ideal, press: () => false }, 0, "beat"), s2 = z.s, ten0 = s2.ten;
    uwTugStep(p, s2, 0.1, s2.beatAt[0] + p.beat!.windowMs + 50, false, mid); // 첫 박자를 놓침
    expect(s2.ten).toBeGreaterThan(ten0); expect(s2.beatI).toBe(0);
  });
  it("돌진 구간 직전에 미리 알려 준다", () => {
    const p = uwTugParams("veryRare", 0, mid)!, s = uwTugStart(p, mid);
    expect(uwSoon(p, s, s.until - 300)).toBe(true); expect(uwSoon(p, s, 0)).toBe(false);
  });
  it("작살총 단계가 오르면 장력이 천천히 오르고, 버티기 때 물고기가 덜 흔들고 띠가 넓어져 덜 깎인다", () => {
    const a = uwTugParams("legendary", 0, mid)!, b = uwTugParams("legendary", 10, mid)!;
    expect(b.rise).toBeLessThan(a.rise); expect(b.runRise).toBeLessThan(a.runRise); expect(b.hold!.push).toBeLessThan(a.hold!.push);
    expect(b.hold!.decay).toBeLessThan(a.hold!.decay); expect(b.hold!.band[1] - b.hold!.band[0]).toBeGreaterThan(a.hold!.band[1] - a.hold!.band[0]); // 띠는 넓어지고 깎이는 속도는 느려진다
  });
});

describe("상자·강화", () => {
  it("금 상자가 나무 상자보다 평균 보상이 크고, 꽝도 나온다", () => {
    const avg = (kind: string) => { let n = 0, seed = 11; const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); for (let i = 0; i < 3000; i++) { const r = rollChest(kind, rng); n += r.coins + r.stones * 300; } return n / 3000; };
    expect(avg("금")).toBeGreaterThan(avg("나무") * 3);
    expect(rollChest("나무", () => 0)).toEqual({ coins: 0, stones: 0, baitId: "", bait: 0 }); // 가장 낮은 값은 꽝
  });
  it("작살총 단계가 오르면 능력이 모두 조금씩 좋아진다", () => {
    const a = harpoonStats(0), b = harpoonStats(10);
    expect(b.range).toBeGreaterThan(a.range); expect(b.speed).toBeGreaterThan(a.speed);
    expect(b.cooldownMs).toBeLessThan(a.cooldownMs); expect(b.steady).toBeLessThan(a.steady); expect(b.line).toBeGreaterThan(a.line);
  });
});

describe("수중 채널의 작살 사냥", () => {
  let h: Harness;
  beforeAll(async () => { h = await startHarness(); });
  afterAll(async () => { await h.colyseus.shutdown(); });

  it("물고기·조개가 채워지고, 앞서 쏘면 잡히고, 멀리서는 조개를 못 줍고, 연타는 막힌다", async () => {
    h.clock.now = 1_000_000; // 시험의 시계는 멈춰 있어서 물고기도 제자리에 있다(경로 계산은 위에서 따로 시험)
    const a = await h.colyseus.sdk.joinOrCreate("underwater", { token: "hunt-a" });
    const b = await h.colyseus.sdk.joinOrCreate("underwater", { token: "hunt-b" });
    await until(() => (a.state as any).fish?.size >= 240 && (a.state as any).shells?.size === 36 && (b.state as any).players?.size === 2, 10000);

    // 아틀란티스(구역 1)에서 물고기 한 마리를 고른다. 가만히 있는 사람은 조금만 가까워져도 놀라지 않는다
    const [id, f] = [...(a.state as any).fish.entries()].find(([, x]: any) => x.zone === 1 && /^uw-1-0/.test(x.sp)) as [string, any];
    const p = (): HuntPath => ({ ax: f.ax, ay: f.ay, az: f.az, t0: f.t0, seed: f.seed, spd: f.spd });
    const now = h.clock.now;
    const at = huntPos(p(), now);
    const o = { x: at.x + 14, y: at.y, z: at.z };
    a.send("move", { ...o, yaw: 0, zone: 1, moving: false });
    await until(() => (b.state as any).players.get(a.sessionId)?.zone === 1);

    const caught = waitMessage<{ name: string; cm: number; sid: string }>(b, "caught");
    const t = h.clock.now;
    a.send("throw", { ox: o.x, oy: o.y, oz: o.z, ...(() => { const d = leadAim(o, p(), t); return { dx: d.x, dy: d.y, dz: d.z }; })(), at: t });
    const c = await caught;
    expect(c.sid).toBe(a.sessionId);
    expect(c.cm).toBeGreaterThan(0);
    await until(() => !(a.state as any).fish.has(id));
    // 잡은 것은 낚시와 같은 인벤토리에 저장된다(상인에게 팔 수 있다)
    const inv = await (await fetch(`http://localhost:${(h.colyseus.server as any).port}/api/inventory`, { headers: { Authorization: "Bearer hunt-a" } })).json();
    expect(inv).toHaveLength(1);
    expect(inv[0]).toMatchObject({ speciesId: expect.stringMatching(/^uw-1-/), size: c.cm });

    // 바로 다시 던지면(연타) 무시된다
    let spears = 0;
    b.onMessage("spear", () => spears++);
    a.send("throw", { ox: o.x, oy: o.y, oz: o.z, dx: 1, dy: 0, dz: 0, at: h.clock.now });
    await new Promise((r) => setTimeout(r, 200));
    expect(spears).toBe(0);

    // 조개: 멀리서는 못 줍고, 가까이 가면 줍는다
    const [sid, s] = [...(a.state as any).shells.entries()].find(([, x]: any) => x.zone === 1) as [string, any];
    a.send("gather", { id: sid });
    await new Promise((r) => setTimeout(r, 150));
    expect((a.state as any).shells.has(sid)).toBe(true);
    a.send("move", { x: s.x, y: -30, z: s.z, yaw: 0, zone: 1, moving: false });
    await until(() => (b.state as any).players.get(a.sessionId)?.x === Math.round(s.x * 1e6) / 1e6 || true);
    await new Promise((r) => setTimeout(r, 150));
    const got = waitMessage<{ kind: string }>(a, "gathered");
    a.send("gather", { id: sid });
    expect((await got).kind).toMatch(/가리비|소라|진주조개/);
    await until(() => !(a.state as any).shells.has(sid));

    // 상자: 멀리서는 못 열고, 가까이 가면 열려서 사라지고 보상 소식이 온다
    const [cid, c0] = [...(a.state as any).chests.entries()].find(([, x]: any) => x.zone === 1) as [string, any];
    a.send("open", { id: cid });
    await new Promise((r) => setTimeout(r, 150));
    expect((a.state as any).chests.has(cid)).toBe(true);
    a.send("move", { x: c0.x, y: -30, z: c0.z, yaw: 0, zone: 1, moving: false });
    await new Promise((r) => setTimeout(r, 150));
    const opened = waitMessage<{ kind: string }>(a, "chest");
    a.send("open", { id: cid });
    expect((await opened).kind).toMatch(/나무|은|금/);
    await until(() => !(a.state as any).chests.has(cid));

    await a.leave(); await b.leave();
  });

  it("매우 희귀 물고기는 맞힌 뒤 꾹 눌러 감고 헤엄쳐서 끌어와야 잡힌다(그냥은 안 잡힌다)", async () => {
    h.clock.now = 2_000_000;
    const a = await h.colyseus.sdk.joinOrCreate("underwater", { token: "tug-a" });
    await until(() => (a.state as any).fish?.size >= 240, 10000);
    const [id, f] = [...(a.state as any).fish.entries()].find(([, x]: any) => /^uw-1-4[1-6]/.test(x.sp)) as [string, any];
    const p: HuntPath = { ax: f.ax, ay: f.ay, az: f.az, t0: f.t0, seed: f.seed, spd: f.spd };
    const at = huntPos(p, h.clock.now), o = { x: at.x + 14, y: at.y, z: at.z };
    a.send("move", { ...o, yaw: 0, zone: 1, moving: false });
    await new Promise((r) => setTimeout(r, 300));
    const tug = waitMessage<{ fid: string; start: number }>(a, "tug");
    const d = leadAim(o, p, h.clock.now);
    a.send("throw", { ox: o.x, oy: o.y, oz: o.z, dx: d.x, dy: d.y, dz: d.z, at: h.clock.now });
    expect((await tug).fid).toBe(id);
    expect((a.state as any).fish.has(id)).toBe(true); // 아직 잡히지 않았다
    const caught = waitMessage<{ fid: string }>(a, "caught", () => true, 30000);
    // 쉴 때 감고 돌진할 때 풀면 지친 물고기가 잡힌다(매우 희귀)
    let phase = "rest";
    a.onMessage("tugst", (m: any) => { phase = m.phase; });
    let done = false; void caught.then(() => { done = true; });
    for (let i = 0; i < 400 && !done; i++) {
      h.clock.now += 200;
      a.send("reel", { on: phase === "rest" });
      await new Promise((r) => setTimeout(r, 120));
    }
    expect((await caught).fid).toBe(id);
    await until(() => !(a.state as any).fish.has(id));
    await a.leave();
  });

  it("보스: 몸을 맞히면 조금, 약점을 맞히면 크게 깎이고, 다 깎으면 기여도 순으로 보상이 간다", async () => {
    h.clock.now = 3_000_000;
    const a = await h.colyseus.sdk.joinOrCreate("underwater", { token: "boss-a" });
    await until(() => (a.state as any).fish?.size >= 240, 10000);
    const room = matchMaker.getLocalRoomById(a.roomId) as any;
    room.spawnFish = () => undefined; // 확률로 새로 나타난 물고기(특히 힘겨루기를 일으키는 희귀 이상)가 작살을 가로채지 않게 한다
    room.spawnBoss(h.clock.now);
    const bs = room.state.boss;
    bs.zone = 1; bs.ax = -175; bs.az = 95; bs.ay = -22; // 아틀란티스로 옮긴다
    for (const k of [...room.state.fish.keys()]) room.state.fish.delete(k); // 작살이 다른 물고기에 먼저 맞지 않게 치운다
    await until(() => !!(a.state as any).boss);
    const bossAt = (t: number) => huntPos({ ax: bs.ax, ay: bs.ay, az: bs.az, t0: bs.t0, seed: bs.seed, spd: bs.spd }, t);
    const me = { x: bossAt(h.clock.now).x + 14, y: -22, z: bossAt(h.clock.now).z };
    a.send("move", { ...me, yaw: 0, zone: 1, moving: false });
    await new Promise((r) => setTimeout(r, 400));
    const fire = async (target: (t: number) => V3) => {
      for (const k of [...room.state.fish.keys()]) room.state.fish.delete(k); // 확률로 새로 나타난 물고기가 작살을 가로채지 않게 매번 치운다
      h.clock.now += 2000;
      const t = h.clock.now;
      const c = bossAt(t); // 보스는 돌아다니므로 매번 사거리 안으로 다시 다가선다
      me.x = c.x + 13; me.y = c.y; me.z = c.z;
      a.send("move", { ...me, yaw: 0, zone: 1, moving: false });
      await new Promise((r) => setTimeout(r, 80));
      let tau = 0.5;
      for (let i = 0; i < 12; i++) tau = Math.hypot(me.x - target(t + tau * 1000).x, me.y - target(t + tau * 1000).y, me.z - target(t + tau * 1000).z) / HARPOON.speed;
      const tp = target(t + tau * 1000), len = Math.hypot(tp.x - me.x, tp.y - me.y, tp.z - me.z);
      a.send("throw", { ox: me.x, oy: me.y, oz: me.z, dx: (tp.x - me.x) / len, dy: (tp.y - me.y) / len, dz: (tp.z - me.z) / len, at: t });
      await new Promise((r) => setTimeout(r, 1100));
    };
    const hp0 = room.state.boss.hp;
    await fire((t) => ({ x: bossAt(t).x - 3, y: bossAt(t).y, z: bossAt(t).z })); // 몸 한가운데 근처(약점이 아닌 쪽)
    const afterBody = room.state.boss.hp;
    expect([1, 6]).toContain(hp0 - afterBody); // 약점이 우연히 겹쳤을 수도 있다
    const ended = waitMessage<{ rank: number; coins: number; title: string }>(a, "bossend", () => true, 80000);
    for (let i = 0; i < 14 && room.state.boss; i++) { // 약점이 내 쪽 표면에 있게 맞춰 놓고 쏜다(반대쪽에 있으면 몸에 먼저 닿아 약점이 안 된다)
      const w = room.state.boss; w.wx = 6.3; w.wy = 0; w.wz = 0; w.wUntil = h.clock.now + 4500;
      await fire((t) => ({ x: bossAt(t).x + 6.3, y: bossAt(t).y, z: bossAt(t).z }));
    }
    const r = await ended;
    expect(r.rank).toBe(1);
    expect(r.coins).toBeGreaterThan(0);
    expect(r.title).toBeTruthy();
    expect(room.state.boss).toBeUndefined();
    await a.leave();
  }, 120000);
});
