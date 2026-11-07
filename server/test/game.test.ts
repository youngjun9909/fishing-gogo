import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CYCLE_MS, DAY_MS, SPECIES, candidatesFor } from "@fishing/shared";
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

  it("로그인 없이 입장하거나 같은 사람이 두 번 들어오면 거절된다", async () => {
    const { code } = await h.open(["alice"]);
    await expect(h.colyseus.sdk.joinById(code, {})).rejects.toBeTruthy();
    await expect(h.colyseus.sdk.joinById(code, { token: "alice" })).rejects.toBeTruthy();
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
    await h.store.saveProfile({ ...p0, coins: 1000 });
    const p = await h.service.buy("a", "top-hoodie");
    expect(p.coins).toBe(800);
    await expect(h.service.equip("a", "pants", "top-hoodie")).rejects.toThrow("입을 수 없");
    expect((await h.service.equip("a", "top", "top-hoodie")).equipped.top).toBe("top-hoodie");
  });

  it("상의·하의·신발을 따로 사고 각자 칸에만 입을 수 있다", async () => {
    const p0 = await h.service.ensureProfile("a");
    await h.store.saveProfile({ ...p0, coins: 1000 });
    await h.service.buy("a", "top-hoodie");
    await h.service.buy("a", "pants-jeans");
    await expect(h.service.equip("a", "pants", "top-hoodie")).rejects.toThrow("입을 수 없");
    await expect(h.service.equip("a", "shoes", "shoes-white")).rejects.toThrow("가지고 있지 않");
    await h.service.equip("a", "top", "top-hoodie");
    const p = await h.service.equip("a", "pants", "pants-jeans");
    expect(p.equipped).toEqual({ top: "top-hoodie", pants: "pants-jeans" });
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
