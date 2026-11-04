import type { MapId } from "./types";

export interface MapDef {
  id: string;
  name: string;
  /** 맵은 -halfSize ~ +halfSize 사각형 */
  halfSize: number;
  spawn: { x: number; z: number };
  /** 낚싯줄이 닿을 수 있는 물인가 */
  isWater(x: number, z: number): boolean;
  /** 걸어서 갈 수 있는 곳인가 */
  isWalkable(x: number, z: number): boolean;
  bgm: string;
}

const inCircle = (x: number, z: number, cx: number, cz: number, r: number) =>
  (x - cx) ** 2 + (z - cz) ** 2 <= r * r;

const lake: MapDef = {
  id: "lake",
  name: "잔잔한 호수",
  halfSize: 40,
  spawn: { x: 0, z: 20 },
  isWater: (x, z) => inCircle(x, z, 0, -8, 22),
  isWalkable(x, z) {
    return Math.abs(x) <= 40 && Math.abs(z) <= 40 && !this.isWater(x, z);
  },
  bgm: "bgm-lake",
};

const onPier = (x: number, z: number) => Math.abs(x) < 2 && z <= -6 && z > -20;

const pier: MapDef = {
  id: "pier",
  name: "바닷가 부두",
  halfSize: 40,
  spawn: { x: 0, z: 10 },
  isWater: (x, z) => z < -6 && !onPier(x, z),
  isWalkable(x, z) {
    return Math.abs(x) <= 40 && Math.abs(z) <= 40 && (z >= -6 || onPier(x, z));
  },
  bgm: "bgm-pier",
};

// 눈 덮인 겨울 호수: 호수는 차가운 물이고 가장자리에 얼음 조각이 떠 있다
const ice: MapDef = {
  id: "ice",
  name: "겨울 호수",
  halfSize: 40,
  spawn: { x: 0, z: 25 },
  isWater: (x, z) => inCircle(x, z, 0, -5, 20),
  isWalkable(x, z) {
    return Math.abs(x) <= 40 && Math.abs(z) <= 40 && !this.isWater(x, z);
  },
  bgm: "bgm-ice",
};

export const BASE_MAPS: Record<MapId, MapDef> = { lake, pier, ice };

export function isBaseMap(id: string): id is MapId {
  return id in BASE_MAPS;
}

export const MAX_CASTING_DISTANCE = 18;
export const MIN_CASTING_DISTANCE = 3;

export function castDistance(power: number): number {
  const p = Math.min(1, Math.max(0, power));
  return MIN_CASTING_DISTANCE + p * (MAX_CASTING_DISTANCE - MIN_CASTING_DISTANCE);
}
