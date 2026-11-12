import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, until, waitMessage } from "./harness";
import type { Harness } from "./harness";
import { UNDERWATER_MAX } from "../src/UnderwaterRoom";

describe("수중 탐험 채널", () => {
  let h: Harness;
  beforeAll(async () => { h = await startHarness(); });
  afterAll(async () => { await h.colyseus.shutdown(); });

  const join = (name: string) => h.colyseus.sdk.joinOrCreate("underwater", { token: name });

  it("같은 채널 사람끼리 위치와 채팅이 보이고, 15명이 차면 다음 사람은 2채널로 간다", async () => {
    const a = await join("uw-a");
    const b = await join("uw-b");
    await until(() => (a.state as any).players?.size === 2);
    expect((a.state as any).channel).toBe(1);
    expect(b.roomId).toBe(a.roomId);

    a.send("move", { x: 12, y: -30, z: -7, yaw: 1, zone: 2, moving: true, mount: "lake-35" });
    await until(() => (b.state as any).players.get(a.sessionId)?.zone === 2);
    const seen = (b.state as any).players.get(a.sessionId);
    expect([seen.x, seen.y, seen.z, seen.moving, seen.mount]).toEqual([12, -30, -7, true, "lake-35"]);

    a.send("move", { x: 99999, y: 50, zone: 42 }); // 맵 밖 값은 범위 안으로 잘린다
    await until(() => (b.state as any).players.get(a.sessionId)?.x === 320);
    expect((b.state as any).players.get(a.sessionId).y).toBe(0);
    expect((b.state as any).players.get(a.sessionId).zone).toBe(5);

    const got = waitMessage<{ name: string; text: string; sessionId: string }>(b, "chat");
    a.send("chat", { text: "안녕" });
    expect((await got).text).toBe("안녕");

    const rest = [];
    for (let i = 2; i < UNDERWATER_MAX; i++) rest.push(await join(`uw-${i}`));
    await until(() => (a.state as any).players.size === UNDERWATER_MAX);
    const next = await join("uw-next");
    await until(() => (next.state as any).channel === 2);
    expect(next.roomId).not.toBe(a.roomId);

    // 채널 목록에서 골라 직접 들어갈 수 있다. 꽉 찬 채널은 못 들어간다
    const list = await (await fetch(`http://localhost:${(h.colyseus.server as any).port}/api/underwater/channels`, { headers: { Authorization: "Bearer uw-pick" } })).json();
    expect(list.map((c: any) => [c.channel, c.players, c.max])).toEqual([[1, UNDERWATER_MAX, UNDERWATER_MAX], [2, 1, UNDERWATER_MAX]]);
    const pick = await h.colyseus.sdk.joinById(list[1].id, { token: "uw-pick" });
    await until(() => (pick.state as any).channel === 2);
    await expect(h.colyseus.sdk.joinById(list[0].id, { token: "uw-full" })).rejects.toBeTruthy();
    await pick.leave();

    for (const r of [a, b, next, ...rest]) await r.leave();
  });
});
