import { describe, expect, it } from "vitest";
import { UW_FISH, UW_ZONE_NAMES, ZONE_SPECIES, speciesById } from "@fishing/shared";

describe("수중 탐험 구역별 물고기", () => {
  it("여섯 구역마다 일반 30 · 희귀 10 · 매우 희귀 6 · 전설 3 · 신화 1종이다", () => {
    expect(UW_ZONE_NAMES).toHaveLength(6);
    for (let z = 0; z < 6; z++) {
      const n = (r: string) => ZONE_SPECIES[z].filter((s) => s.rarity === r).length;
      expect([n("common"), n("rare"), n("veryRare"), n("legendary"), n("mythic")]).toEqual([30, 10, 6, 3, 1]);
    }
  });

  it("이름과 번호가 겹치지 않고, 모두 생김새가 정해져 있으며 가방·도감에서 찾을 수 있다", () => {
    const all = Object.values(ZONE_SPECIES).flat();
    expect(new Set(all.map((s) => s.name)).size).toBe(300);
    expect(new Set(all.map((s) => s.id)).size).toBe(300);
    for (const s of all) {
      expect(s.look?.base, s.name).toMatch(/^#[0-9a-f]{6}$/);
      expect(s.look?.accent, s.name).toMatch(/^#[0-9a-f]{6}$/);
      expect(speciesById(s.id)?.name).toBe(s.name);
    }
    expect(UW_FISH).toHaveLength(303); // 조개 3종 포함
  });
});
