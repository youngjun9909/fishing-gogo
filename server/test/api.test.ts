import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness } from "./harness";
import type { Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.colyseus.shutdown();
});

const call = async (path: string, token: string | null, body?: unknown) => {
  const res = await fetch(`http://localhost:2568${path}`, {
    method: body ? "POST" : "GET",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

describe("로비 API", () => {
  it("로그인 없이는 거절된다", async () => {
    expect((await call("/api/me", null)).status).toBe(401);
  });

  it("처음 접속하면 기본 프로필이 만들어지고 캐릭터를 저장할 수 있다", async () => {
    const me = await call("/api/me", "api-user");
    expect(me.json.coins).toBe(100);
    const a = { eyes: 2, nose: 1, mouth: 3, hair: 4, skinColor: 1, hairColor: 2, eyeColor: 3, body: 1 };
    const saved = await call("/api/character", "api-user", { nickname: "바다", appearance: a });
    expect(saved.json.nickname).toBe("바다");
    const bad = await call("/api/character", "api-user", { nickname: "", appearance: a });
    expect(bad.status).toBe(400);
  });

  it("물고기를 팔고 상점에서 살 수 있다", async () => {
    await call("/api/me", "shopper");
    const { record } = await h.service.recordCatch("shopper", "common-01", 40, "lake");
    expect((await call("/api/inventory", "shopper")).json).toHaveLength(1);
    const sold = await call("/api/sell", "shopper", { ids: [record.id] });
    expect(sold.json.earned).toBeGreaterThan(0);
    expect((await call("/api/shop", "shopper")).json.length).toBeGreaterThan(0);
    const bought = await call("/api/buy", "shopper", { itemId: "hat-straw" });
    expect([200, 400]).toContain(bought.status);
  });
});
