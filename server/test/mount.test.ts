import { describe, expect, it } from "vitest";
import { SPECIES } from "@fishing/shared";
import { GameService } from "../src/service";
import { MemoryStore } from "../src/store";

describe("신화 탈것 칸", () => {
  const myth = SPECIES.filter((s) => s.rarity === "mythic");
  const common = SPECIES.find((s) => s.rarity === "common")!;

  it("잡아 본 신화만 1~4번 칸에 넣을 수 있고, 같은 신화는 한 칸에만 남는다", async () => {
    const service = new GameService(new MemoryStore());
    await service.ensureProfile("p1");
    await expect(service.setMount("p1", 1, myth[0].id)).rejects.toThrow("아직 잡지 못한");
    await expect(service.setMount("p1", 5, myth[0].id)).rejects.toThrow("1~4번");
    await expect(service.setMount("p1", 1, common.id)).rejects.toThrow("신화 물고기만");

    await service.recordCatch("p1", myth[0].id, 100, "lake");
    await service.recordCatch("p1", myth[1].id, 100, "lake");
    expect((await service.setMount("p1", 1, myth[0].id)).equipped.mount1).toBe(myth[0].id);
    expect((await service.setMount("p1", 2, myth[1].id)).equipped.mount2).toBe(myth[1].id);

    const moved = await service.setMount("p1", 3, myth[0].id); // 1번 칸에 있던 것을 3번으로 옮긴다
    expect(moved.equipped.mount1).toBeUndefined();
    expect(moved.equipped.mount3).toBe(myth[0].id);

    const cleared = await service.setMount("p1", 2, null);
    expect(cleared.equipped.mount2).toBeUndefined();
    expect((await service.profile("p1"))!.equipped.mount3).toBe(myth[0].id); // 저장되어 있다
  });
});
