export type Rarity = "common" | "rare" | "veryRare" | "legendary" | "mythic";
export type MapId = "lake" | "pier" | "ice" | "cruise";
export type TimeOfDay = "day" | "night";
/** 던진 거리: near는 발밑 가까운 물, far는 멀리 던진 깊은 물 */
export type Reach = "near" | "far";

export interface FishSpecies {
  id: string;
  name: string;
  rarity: Rarity;
  basePrice: number;
  minSize: number;
  maxSize: number;
  /** 3D 기본 체형 이름 (클라이언트가 모델과 연결) */
  body: string;
  /** 종마다 다른 특징 파츠와 무늬 */
  features: string[];
  /** 비어 있으면 모든 맵에서 나오는 공통 물고기 */
  maps: MapId[];
  time: TimeOfDay | "any";
  reach: Reach | "any";
  /** 가중치: 클수록 자주 나옴 */
  weight: number;
  /** 타이밍 바에서 성공 영역의 폭 (0~1), 작을수록 어려움 */
  zoneWidth: number;
}

export interface Appearance {
  eyes: number;
  nose: number;
  mouth: number;
  hair: number;
  skinColor: number;
  hairColor: number;
  eyeColor: number;
  body: number;
  /** 0 여자, 1 남자. 옛 저장 데이터에는 없을 수 있다(없으면 여자) */
  gender?: number;
}

export interface PlayerProfile {
  id: string;
  nickname: string;
  appearance: Appearance;
  coins: number;
  ownedItems: string[];
  equipped: Record<string, string>;
  titles: string[];
  claimedRewards: string[];
  /** 가진 미끼 개수(미끼 id → 개수). 쓸지는 방 안에서 낚시할 때 고른다 */
  baits: Record<string, number>;
}

export interface CatchRecord {
  id: string;
  speciesId: string;
  size: number;
  caughtAt: number;
  mapId: MapId;
}

export interface CodexEntry {
  speciesId: string;
  firstCaughtAt: number;
  maxSize: number;
  count: number;
}
