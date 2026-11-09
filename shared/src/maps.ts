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

// 크루즈선: 양 끝이 둥근 긴 갑판(스타디움 모양). 갑판 밖은 모두 바다이고, 낚시는 난간 너머로 한다
export const CRUISE_HULL = { cx: 0, cz: 2, hx: 38, hz: 14 };
/** 선체 윤곽까지의 부호 있는 거리: 음수면 배 안쪽 */
function hullDist(x: number, z: number): number {
  const { cx, cz, hx, hz } = CRUISE_HULL;
  const qx = Math.abs(x - cx) - (hx - hz);
  const qz = Math.abs(z - cz);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - hz;
}
// 걸어 들어갈 수 없는 곳: [x0, x1, z0, z1] (선실 건물, 무대, 수영장, 바)
const CRUISE_BLOCKS: Array<[number, number, number, number]> = [
  [-22, 22, 5.9, 16],
  [-33.2, -25.8, -5.3, 3.3],
  [11.6, 22.4, -6.4, 2.4],
  [-7.2, 9.2, 3.5, 5.9],
];
const cruise: MapDef = {
  id: "cruise",
  name: "크루즈 파티",
  halfSize: 40,
  spawn: { x: -1, z: -10 },
  isWater: (x, z) => hullDist(x, z) > 0,
  isWalkable: (x, z) =>
    hullDist(x, z) < -0.8 && !CRUISE_BLOCKS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1),
  bgm: "bgm-cruise",
};

export const BASE_MAPS: Record<MapId, MapDef> = { lake, pier, ice, cruise };

export function isBaseMap(id: string): id is MapId {
  return id in BASE_MAPS;
}

export const MAX_CASTING_DISTANCE = 18;
export const MIN_CASTING_DISTANCE = 3;

export function castDistance(power: number): number {
  const p = Math.min(1, Math.max(0, power));
  return MIN_CASTING_DISTANCE + p * (MAX_CASTING_DISTANCE - MIN_CASTING_DISTANCE);
}
