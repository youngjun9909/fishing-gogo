import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BASE_MAPS, SPECIES, candidatesFor, codexSpeciesFor } from "@fishing/shared";
import type { MapId } from "@fishing/shared";
import { startHarness, waitMessage } from "./harness";
import type { Harness } from "./harness";

let h: Harness;
beforeAll(async () => { h = await startHarness(); });
beforeEach(() => h.reset());
afterEach(async () => { await h.colyseus.cleanup(); });
afterAll(async () => { await h.colyseus.shutdown(); });

describe("크루즈 맵 규칙", () => {
  const m = BASE_MAPS.cruise;

  it("시작 위치는 걸을 수 있고 물이 아니다", () => {
    expect(m.isWalkable(m.spawn.x, m.spawn.z)).toBe(true);
    expect(m.isWater(m.spawn.x, m.spawn.z)).toBe(false);
  });

  it("걸을 수 있는 곳은 절대 물이 아니고, 난간 밖과 선실·무대·수영장은 걸을 수 없다", () => {
    for (let x = -45; x <= 45; x += 1.5) for (let z = -20; z <= 24; z += 1.5) {
      if (m.isWalkable(x, z)) expect(m.isWater(x, z)).toBe(false);
    }
    expect(m.isWalkable(0, -13)).toBe(false); // 난간 밖(바다)
    expect(m.isWater(0, -13)).toBe(true);
    expect(m.isWalkable(0, 10)).toBe(false); // 선실 건물
    expect(m.isWalkable(-29, -1)).toBe(false); // 무대
    expect(m.isWalkable(17, -2)).toBe(false); // 수영장
  });

  it("모든 맵에서 낮·밤, 가까이·멀리 어느 쪽으로 던져도 잡을 물고기가 있다", () => {
    for (const id of Object.keys(BASE_MAPS) as MapId[])
      for (const t of ["day", "night"] as const)
        for (const r of ["near", "far"] as const) expect(candidatesFor(id, t, r).length).toBeGreaterThan(0);
  });

  it("크루즈는 전용 물고기(일반 28종)를 쓰고 부두 물고기는 나오지 않는다", () => {
    const own = SPECIES.filter((s) => s.maps.includes("cruise") && s.id.startsWith("cruise-"));
    expect(own.filter((s) => s.rarity === "common" || s.rarity === "rare" || s.rarity === "veryRare")).toHaveLength(28);
    const pierOnly = SPECIES.filter((s) => s.maps.includes("pier") && !s.maps.includes("cruise"));
    expect(codexSpeciesFor("cruise").some((s) => pierOnly.includes(s))).toBe(false);
  });
});

describe("크루즈 방", () => {
  it("난간 너머 바다로 던지면 입질이 오고, 갑판 쪽으로 던지면 실패한다", async () => {
    const { clients } = await h.open(["alice"], "cruise");
    const alice = clients[0];
    const bite = waitMessage(alice, "bite");
    alice.send("cast", { power: 0.3, yaw: Math.PI });
    const { speciesId } = await bite;
    expect(SPECIES.find((s) => s.id === speciesId)).toBeTruthy();
    await waitMessage(alice, "result");
    const failed = waitMessage(alice, "castFailed");
    alice.send("cast", { power: 0.3, yaw: 0 });
    await failed;
  });
});
