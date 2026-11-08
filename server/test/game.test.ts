import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CYCLE_MS, DAY_MS, MAX_ROD, RODS, BAITS, SPECIES, baitEffects, candidatesFor, castDistance, pickSpecies, rodEffects, rodLevelOf } from "@fishing/shared";
import { startHarness, until, waitMessage } from "./harness";
import type { Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
beforeEach(() => {
  h.reset();
});
afterEach(async () => {
  await h.colyseus.cleanup();
});
afterAll(async () => {
  await h.colyseus.shutdown();
});

const players = (c: any) => [...c.state.players.values()] as any[];
const me = (c: any) => c.state.players.get(c.sessionId) as any;

describe("방과 초대", () => {
  it("초대 코드가 생기고 코드로 입장한다", async () => {
    const { code, clients } = await h.open(["alice"]);
    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    const bob = await h.colyseus.sdk.joinById(code, { token: "bob" });
    await until(() => players(clients[0]).length === 2);
    expect(players(bob).map((p) => p.name).sort()).toEqual(["낚시꾼", "낚시꾼"]);
  });

  it("8명까지만 들어오고 9번째는 거절된다", async () => {
    const { code } = await h.open(Array.from({ length: 8 }, (_, i) => `p${i}`));
    await expect(h.colyseus.sdk.joinById(code, { token: "p9" })).rejects.toBeTruthy();
  });

  it("로그인 없이 입장하면 거절된다", async () => {
    const { code } = await h.open(["alice"]);
    await expect(h.colyseus.sdk.joinById(code, {})).rejects.toBeTruthy();
  });

  it("없는 방 코드는 거절된다", async () => {
    await expect(h.colyseus.sdk.joinById("ZZZZ", { token: "bob" })).rejects.toBeTruthy();
  });

  it("방장이 나가면 다음 사람이 방장이 된다", async () => {
    const { clients } = await h.open(["alice", "bob"]);
    const [alice, bob] = clients;
    expect(bob.state.hostId).toBe(alice.sessionId);
    await alice.leave();
    await until(() => bob.state.hostId === bob.sessionId);
  });

  it("방장만 사람을 내보낼 수 있다", async () => {
    const { clients } = await h.open(["alice", "bob", "carol"]);
    const [alice, bob, carol] = clients;
    bob.send("kick", { sessionId: carol.sessionId });
    await new Promise((r) => setTimeout(r, 100));
    expect(players(alice).length).toBe(3);
    alice.send("kick", { sessionId: carol.sessionId });
    await until(() => players(alice).length === 2);
  });

  it("연결이 끊겨도 1분 안에 다시 들어오면 같은 자리로 돌아온다", async () => {
    const { clients } = await h.open(["alice", "bob"]);
    const [alice, bob] = clients;
    alice.send("move", { x: 5, z: 25, yaw: 1 });
    await until(() => (bob.state.players.get(alice.sessionId) as any).x === 5);
    const token = alice.reconnectionToken;
    alice.connection.close(4001); // 4000이 아닌 코드는 비정상 끊김으로 취급된다
    await new Promise((r) => setTimeout(r, 100));
    const back = await h.colyseus.sdk.reconnect(token);
    await until(() => (back as any).state?.players?.size === 2);
    expect((back.state.players.get(back.sessionId) as any).x).toBe(5);
  });

  it("접속 중인 같은 사람이 다시 들어오면 옛 접속이 밀려나고 새 접속이 들어간다", async () => {
    const { code, clients } = await h.open(["alice", "bob"]);
    const again = await h.colyseus.sdk.joinById(code, { token: "alice" });
    await until(() => (again as any).state?.players?.size === 2);
    await until(() => players(clients[1]).length === 2 && !clients[1].state.players.has(clients[0].sessionId));
  });

  it("끊긴 자리가 남아 있어도 같은 사람이 새로 들어오면 받아 준다", async () => {
    const { code, clients } = await h.open(["alice", "bob"]);
    clients[0].connection.close(4001);
    await new Promise((r) => setTimeout(r, 100));
    const again = await h.colyseus.sdk.joinById(code, { token: "alice" });
    await until(() => (again as any).state?.players?.size === 2);
  });
});

describe("이동과 이모트", () => {
  it("이동이 다른 사람에게 보이고 물 위로는 못 간다", async () => {
    const { clients } = await h.open(["alice", "bob"]);
    const [alice, bob] = clients;
    alice.send("move", { x: 3, z: 22, yaw: 0.5 });
    await until(() => (bob.state.players.get(alice.sessionId) as any).x === 3);
    alice.send("move", { x: 0, z: -8, yaw: 0 });
    await new Promise((r) => setTimeout(r, 100));
    expect((bob.state.players.get(alice.sessionId) as any).z).toBe(22);
  });

  it("기본 이모트는 되고 전용 이모트는 보상을 받기 전에는 안 된다", async () => {
    const { clients } = await h.open(["alice", "bob"]);
    const [alice, bob] = clients;
    alice.send("emote", { id: "wave" });
    await until(() => (bob.state.players.get(alice.sessionId) as any).emoteSeq === 1);
    expect((bob.state.players.get(alice.sessionId) as any).emote).toBe("wave");
    alice.send("emote", { id: "legend-bow" });
    await new Promise((r) => setTimeout(r, 100));
    expect((bob.state.players.get(alice.sessionId) as any).emoteSeq).toBe(1);
  });
});

describe("채팅", () => {
  it("욕설은 좋은 말로 바뀌고 100자까지만 보인다", async () => {
    const { clients } = await h.open(["alice", "bob"]);
    const [alice, bob] = clients;
    const got = waitMessage(bob, "chat");
    alice.send("chat", { text: "씨발 " + "가".repeat(200) });
    const msg = await got;
    expect(msg.text.startsWith("사랑해 ")).toBe(true);
    expect(msg.text.length).toBeLessThanOrEqual(100);
  });

  it("도배하면 막힌다", async () => {
    const { clients } = await h.open(["alice"]);
    const blocked = waitMessage(clients[0], "chatBlocked");
    for (let i = 0; i < 6; i++) clients[0].send("chat", { text: `안녕 ${i}` });
    await blocked;
  });
});

describe("낚시", () => {
  // 낚싯대를 던진다. 호수 시작 위치에서 위쪽(-z)으로 던지면 물에 닿는다
  const cast = (c: any) => c.send("cast", { power: 0.3, yaw: Math.PI });
  // 첫 후보가 뽑히고(rng=0) 성공 영역 한가운데 타이밍으로 올리기
  const reelAtTarget = async (c: any, speed: number, target: number) => {
    const t = (target / 2 / speed) * 1000; // 커서가 target에 오는 시각(ms)
    h.clock.now += t;
    c.send("reel");
  };

  it("던지고 입질이 오면 올려서 잡고, 인벤토리와 도감과 순위에 남는다", async () => {
    const { clients } = await h.open(["alice", "bob"]);
    const [alice, bob] = clients;
    const bite = waitMessage(alice, "bite");
    const ranking = waitMessage(bob, "ranking", (m: any) => m.count.length > 0);
    cast(alice);
    const { speciesId } = await bite;
    expect(speciesId).toBe("common-01");
    alice.send("hook");
    const mini = await waitMessage(alice, "minigame");
    const result = waitMessage(alice, "result");
    await reelAtTarget(alice, mini.speed, mini.target);
    const r = await result;
    expect(r.success).toBe(true);
    expect(r.catch.speciesId).toBe("common-01");
    expect(r.isNew).toBe(true);
    expect(await h.service.inventory("alice")).toHaveLength(1);
    expect((await h.service.codex("alice"))[0].speciesId).toBe("common-01");
    const rk = await ranking;
    expect(rk.count[0].name).toBe("낚시꾼");
    expect(rk.value[0].value).toBeGreaterThan(0);
  });

  it("낚싯대 단계가 높으면 더 멀리 던지고 타이밍 칸이 넓어진다", async () => {
    const base = await h.service.ensureProfile("basic");
    const pro = await h.service.ensureProfile("pro");
    await h.store.saveProfile({ ...pro, equipped: { rod: String(MAX_ROD) } });
    void base;
    const { clients } = await h.open(["basic", "pro"]);
    const dist = (c: any) => Math.hypot(me(c).bobX - me(c).x, me(c).bobZ - me(c).z);
    const bites = clients.map((c) => waitMessage(c, "bite"));
    for (const c of clients) cast(c);
    await Promise.all(bites);
    const eff = rodEffects(MAX_ROD);
    expect(dist(clients[0])).toBeCloseTo(castDistance(0.3), 1);
    expect(dist(clients[1])).toBeCloseTo(castDistance(0.3) * eff.castMul, 1);
    const zones: number[] = [];
    for (const c of clients) {
      c.send("hook");
      zones.push((await waitMessage(c, "minigame")).zoneWidth);
    }
    expect(zones[1] / zones[0]).toBeCloseTo(eff.zoneMul, 2);
  });

  it("입질 알림 뒤에 반응하지 않으면 놓친다", async () => {
    const { clients } = await h.open(["alice"]);
    const miss = waitMessage(clients[0], "result");
    cast(clients[0]);
    const r = await miss;
    expect(r).toMatchObject({ success: false, reason: "missed" });
    await until(() => me(clients[0]).fishing === "idle");
  });

  it("타이밍을 못 맞추면 놓친다", async () => {
    const { clients } = await h.open(["alice"]);
    const alice = clients[0];
    const bite = waitMessage(alice, "bite");
    cast(alice);
    await bite;
    alice.send("hook");
    const mini = await waitMessage(alice, "minigame");
    const result = waitMessage(alice, "result");
    h.clock.now += (0.5 / mini.speed) * 1000; // 커서가 반대편 끝(1.0)에 있을 때
    alice.send("reel");
    expect(await result).toMatchObject({ success: false, reason: "escaped" });
    expect(await h.service.inventory("alice")).toHaveLength(0);
  });

  it("땅 위로 던지면 안 된다", async () => {
    const { clients } = await h.open(["alice"]);
    const failed = waitMessage(clients[0], "castFailed");
    clients[0].send("cast", { power: 0.3, yaw: 0 });
    await failed;
  });

  it("밤에는 밤에만 나오는 물고기도 후보가 되고 낮 전용은 빠진다", async () => {
    h.clock.now = DAY_MS + 1000;
    const night = candidatesFor("lake", "night", "near");
    expect(night.some((s) => s.time === "day")).toBe(false);
    const { clients } = await h.open(["alice"]);
    const bite = waitMessage(clients[0], "bite");
    cast(clients[0]);
    const { speciesId } = await bite;
    expect(speciesId).toBe(night[0].id);
    expect(h.clock.now % CYCLE_MS).toBeGreaterThanOrEqual(DAY_MS);
  });

  it("희귀 이상 물고기를 잡으면 방 전체에 알림이 간다", async () => {
    const list = candidatesFor("lake", "day", "near");
    const rare = list.find((s) => s.rarity === "rare")!;
    const before = list.slice(0, list.indexOf(rare)).reduce((a, s) => a + s.weight, 0);
    const total = list.reduce((a, s) => a + s.weight, 0);
    h.rng.next = () => (before + 1) / total;
    const { clients } = await h.open(["alice", "bob"]);
    const [alice, bob] = clients;
    const announce = waitMessage(bob, "announce");
    const bite = waitMessage(alice, "bite");
    cast(alice);
    expect((await bite).speciesId).toBe(rare.id);
    alice.send("hook");
    const mini = await waitMessage(alice, "minigame");
    await reelAtTarget(alice, mini.speed, mini.target);
    expect(await announce).toMatchObject({ speciesId: rare.id, rarity: "rare" });
  });
});

describe("경제와 도감", () => {
  const record = async (id: string, speciesId: string, size = 20) => {
    await h.service.ensureProfile(id);
    return h.service.recordCatch(id, speciesId, size, "lake");
  };

  it("물고기를 팔면 돈이 늘고 인벤토리에서 빠지지만 도감은 남는다", async () => {
    const { record: r } = await record("a", "common-01", 30);
    const res = await h.service.sell("a", [r.id]);
    expect(res.sold).toBe(1);
    expect(res.earned).toBeGreaterThan(0);
    expect(res.coins).toBe(100 + res.earned);
    expect(await h.service.inventory("a")).toHaveLength(0);
    expect(await h.service.codex("a")).toHaveLength(1);
  });

  it("남의 물고기나 없는 물고기는 팔 수 없다", async () => {
    const { record: r } = await record("a", "common-01");
    await h.service.ensureProfile("b");
    expect((await h.service.sell("b", [r.id])).sold).toBe(0);
    expect(await h.service.inventory("a")).toHaveLength(1);
  });

  it("돈이 부족하면 못 사고, 사면 입을 수 있다", async () => {
    const p0 = await h.service.ensureProfile("a");
    await expect(h.service.buy("a", "top-hoodie")).rejects.toThrow("돈이 부족");
    await h.store.saveProfile({ ...p0, coins: 5000 });
    const p = await h.service.buy("a", "top-hoodie");
    expect(p.coins).toBe(3500);
    await expect(h.service.equip("a", "pants", "top-hoodie")).rejects.toThrow("입을 수 없");
    expect((await h.service.equip("a", "top", "top-hoodie")).equipped.top).toBe("top-hoodie");
  });

  it("상의·하의·신발을 따로 사고 각자 칸에만 입을 수 있다", async () => {
    const p0 = await h.service.ensureProfile("a");
    await h.store.saveProfile({ ...p0, coins: 5000 });
    await h.service.buy("a", "top-hoodie");
    await h.service.buy("a", "pants-jeans");
    await expect(h.service.equip("a", "pants", "top-hoodie")).rejects.toThrow("입을 수 없");
    await expect(h.service.equip("a", "shoes", "shoes-white")).rejects.toThrow("가지고 있지 않");
    await h.service.equip("a", "top", "top-hoodie");
    const p = await h.service.equip("a", "pants", "pants-jeans");
    expect(p.equipped).toEqual({ top: "top-hoodie", pants: "pants-jeans" });
  });

  it("낚싯대는 한 단계씩 코인으로 올리고, 돈이 모자라거나 끝 단계면 거절한다", async () => {
    const p0 = await h.service.ensureProfile("a");
    await expect(h.service.upgradeRod("a")).rejects.toThrow("돈이 부족");
    await h.store.saveProfile({ ...p0, coins: 200000 });
    const p1 = await h.service.upgradeRod("a");
    expect(rodLevelOf(p1.equipped)).toBe(1);
    expect(p1.coins).toBe(200000 - RODS[1].price);
    for (let i = 2; i <= MAX_ROD; i++) await h.service.upgradeRod("a");
    await expect(h.service.upgradeRod("a")).rejects.toThrow("가장 좋은");
    expect(rodLevelOf((await h.service.profile("a"))!.equipped)).toBe(MAX_ROD);
  });

  it("낚싯대 칸은 입기·벗기로 바꿀 수 없다(단계가 사라지지 않게)", async () => {
    await h.service.ensureProfile("a");
    await expect(h.service.equip("a", "rod", null)).rejects.toThrow("강화로만");
  });

  it("미끼를 사면 묶음 개수만큼 늘고, 처음 산 미끼는 바로 골라진다. 돈이 모자라거나 너무 많으면 거절한다", async () => {
    const p0 = await h.service.ensureProfile("a");
    await expect(h.service.buyBait("a", "bait-gold")).rejects.toThrow("돈이 부족");
    await h.store.saveProfile({ ...p0, coins: 100000 });
    const worm = BAITS.find((b) => b.id === "bait-worm")!;
    const p1 = await h.service.buyBait("a", "bait-worm");
    expect(p1.baits["bait-worm"]).toBe(worm.pack);
    expect(p1.equipped.bait).toBeUndefined(); // 쓸지는 낚시할 때 고른다
    expect(p1.coins).toBe(100000 - worm.price);
    await expect(h.service.buyBait("a", "없는미끼")).rejects.toThrow("없는 미끼");
    for (let i = 0; i < 20; i++) await h.service.buyBait("a", "bait-worm").catch(() => undefined);
    await expect(h.service.buyBait("a", "bait-worm")).rejects.toThrow("99개");
  });

  it("던질 때 고른 미끼를 하나 쓰고, 다 쓰거나 없는 미끼면 효과가 없다", async () => {
    const p0 = await h.service.ensureProfile("a");
    await h.store.saveProfile({ ...p0, baits: { "bait-gold": 1 } });
    expect(await h.service.consumeBait("a", "bait-gold")).toEqual({ id: "bait-gold", left: 0 });
    expect(await h.service.consumeBait("a", "bait-gold")).toEqual({ id: null, left: 0 });
    expect(await h.service.consumeBait("a", "bait-worm")).toEqual({ id: null, left: 0 });
  });

  it("반짝이는 희귀 이상을 더 잘 뽑고, 황금은 일반을 막고 매우 희귀·전설을 크게 늘린다", () => {
    const share = (id: string | null) => {
      const bias = baitEffects(id).bias;
      let rare = 0, vr = 0, leg = 0, common = 0;
      for (let i = 0; i < 4000; i++) {
        const sp = pickSpecies(() => (i + 0.5) / 4000, "lake", "night", "far", bias)!;
        if (sp.rarity === "common") common++;
        else if (sp.rarity === "rare") rare++;
        else if (sp.rarity === "veryRare") vr++;
        else leg++;
      }
      return { common: common / 4000, rare: rare / 4000, vr: vr / 4000, leg: leg / 4000 };
    };
    const none = share(null), glitter = share("bait-glitter"), gold = share("bait-gold");
    expect(glitter.common).toBeLessThan(none.common);
    expect(glitter.leg).toBeGreaterThan(none.leg * 1.5);
    expect(gold.common).toBe(0); // 황금은 일반이 절대 안 나온다
    expect(gold.leg).toBeGreaterThan(none.leg * 8); // 밤에 멀리 던지면 전설이 8배 넘게 나온다
    expect(gold.vr).toBeGreaterThan(gold.leg);
    // 일반만 사는 곳이라도 후보가 없어 멈추지 않는다(배율 없이 뽑는다)
    expect(pickSpecies(() => 0.5, "lake", "day", "near", baitEffects("bait-gold").bias)).not.toBeNull();
  });

  it("방 안에서 고른 미끼만 던질 때 쓰고, 안 고르면 안 쓴다. 없는 미끼는 고를 수 없다", async () => {
    await h.service.ensureProfile("plain");
    const gold = await h.service.ensureProfile("gold");
    await h.store.saveProfile({ ...gold, baits: { "bait-gold": 2 } });
    const { clients } = await h.open(["plain", "gold"]);
    // 없는 미끼는 거절된다
    const refused = waitMessage(clients[0], "baitLeft");
    clients[0].send("bait", { id: "bait-gold" });
    expect(await refused).toMatchObject({ id: null, out: "bait-gold" });
    // 가진 미끼를 고르면 개수를 알려 준다
    const chosen = waitMessage(clients[1], "baitLeft");
    clients[1].send("bait", { id: "bait-gold" });
    expect(await chosen).toEqual({ id: "bait-gold", left: 2 });
    // 던질 때 하나 쓴다
    const used = waitMessage(clients[1], "baitLeft");
    const bites = clients.map((c) => waitMessage(c, "bite"));
    for (const c of clients) c.send("cast", { power: 0.3, yaw: Math.PI });
    expect(await used).toEqual({ id: "bait-gold", left: 1 });
    await Promise.all(bites);
    const zones: number[] = [];
    for (const c of clients) {
      c.send("hook");
      zones.push((await waitMessage(c, "minigame")).zoneWidth);
    }
    // 황금은 일반을 막으니 다른 물고기가 걸린다. 그 물고기 칸 폭의 +15%가 와야 한다
    const sp = pickSpecies(() => 0, "lake", "day", "near", baitEffects("bait-gold").bias)!;
    expect(sp.rarity).not.toBe("common");
    expect(zones[1]).toBeCloseTo(sp.zoneWidth * 1.15, 5);
    expect((await h.service.profile("gold"))!.baits["bait-gold"]).toBe(1);
    expect((await h.service.profile("plain"))!.baits["bait-gold"]).toBeUndefined();
  });

  it("낚싯대 단계가 높을수록 멀리 던지고 기다림이 짧고 타이밍 칸이 넓다", () => {
    const lo = rodEffects(0), hi = rodEffects(MAX_ROD);
    expect(hi.castMul).toBeGreaterThan(lo.castMul);
    expect(hi.waitMul).toBeLessThan(lo.waitMul);
    expect(hi.zoneMul).toBeGreaterThan(lo.zoneMul);
    expect(hi.farPower).toBeLessThan(lo.farPower);
  });

  it("전용 오라는 살 수 없고, 도감을 모두 채우면 전용 오라와 이모트를 받는다", async () => {
    await h.service.ensureProfile("a");
    await expect(h.service.buy("a", "aura-legend")).rejects.toThrow("살 수 없는");
    for (const s of SPECIES) await h.service.recordCatch("a", s.id, s.minSize, "lake");
    const p = (await h.service.profile("a"))!;
    expect(p.ownedItems).toContain("aura-legend");
    expect(p.titles).toContain("전설의 낚시꾼");
    expect(h.service.canUseEmote(p, "legend-bow")).toBe(true);
  });

  it("맵 도감 25%를 채우면 칭호와 돈 보상이 한 번만 나온다", async () => {
    await h.service.ensureProfile("a");
    const lake = SPECIES.filter((s) => s.maps.length === 0 || s.maps.includes("lake"));
    const need = Math.ceil(lake.length * 0.25);
    let given = 0;
    for (const s of lake.slice(0, need + 3)) {
      given += (await h.service.recordCatch("a", s.id, s.minSize, "lake")).rewards.length;
    }
    // 공통 물고기는 모든 맵의 도감에 들어가서 세 맵의 25% 보상이 함께 열린다
    expect(given).toBe(3);
    const p = (await h.service.profile("a"))!;
    expect(p.titles).toContain("호수의 초보 낚시꾼");
  });
});

describe("캐릭터와 맵 저장", () => {
  it("올바른 캐릭터만 저장된다", async () => {
    const a = { eyes: 1, nose: 1, mouth: 1, hair: 1, skinColor: 1, hairColor: 1, eyeColor: 1, body: 1 };
    const p = await h.service.setCharacter("a", " 하늘 ", a);
    expect(p.nickname).toBe("하늘");
    await expect(h.service.setCharacter("a", "x", { ...a, eyes: 99 })).rejects.toThrow();
    await expect(h.service.setCharacter("a", "", a)).rejects.toThrow();
  });

  it("커스텀맵은 5개까지만 저장된다", async () => {
    const ok = () => null;
    for (let i = 0; i < 5; i++) await h.service.saveCustomMap("a", { id: `m${i}`, name: "x", data: {} }, ok);
    await expect(h.service.saveCustomMap("a", { id: "m6", name: "x", data: {} }, ok)).rejects.toThrow("5개");
    await h.service.saveCustomMap("a", { id: "m0", name: "수정", data: {} }, ok);
  });
});
