import { codexSpeciesFor, SPECIES } from "./fish";
import type { MapId } from "./types";

export type ItemSlot = "top" | "pants" | "shoes" | "aura";

export interface ShopItem {
  id: string;
  name: string;
  slot: ItemSlot;
  price: number;
  /** false면 도감 보상으로만 얻는다 */
  purchasable: boolean;
}

export const ITEMS: ShopItem[] = [
  // 옷은 상의·하의·신발을 따로 사고 입는다. 기본 옷(흰 티, 검정 반바지, 검정 운동화)은 아무것도 안 입었을 때 보인다
  { id: "top-hoodie", name: "남색 후드티", slot: "top", price: 1500, purchasable: true },
  { id: "pants-jeans", name: "청바지", slot: "pants", price: 1200, purchasable: true },
  { id: "shoes-white", name: "흰 운동화", slot: "shoes", price: 900, purchasable: true },
  { id: "aura-sparkle", name: "반짝 오라", slot: "aura", price: 6000, purchasable: true },
  { id: "aura-bubble", name: "물방울 오라", slot: "aura", price: 9000, purchasable: true },
  { id: "aura-flame", name: "불꽃 오라", slot: "aura", price: 12000, purchasable: true },
  { id: "aura-sakura", name: "벚꽃 오라", slot: "aura", price: 12000, purchasable: true },
  { id: "aura-lightning", name: "번개 오라", slot: "aura", price: 18000, purchasable: true },
  { id: "aura-rainbow", name: "무지개 오라", slot: "aura", price: 25000, purchasable: true },
  { id: "aura-galaxy", name: "은하 오라", slot: "aura", price: 30000, purchasable: true },
  { id: "aura-legend", name: "전설의 낚시꾼 오라", slot: "aura", price: 0, purchasable: false },
];

// ---- 낚싯대: 코인으로 한 단계씩 강화한다. 단계는 입은 것(equipped) 안의 "rod" 값으로 저장한다 ----
export interface RodTier {
  level: number;
  name: string;
  /** 이 단계로 올리는 데 드는 코인(0단계는 기본) */
  price: number;
}
export const RODS: RodTier[] = [
  { level: 0, name: "나무 낚싯대", price: 0 },
  { level: 1, name: "대나무 낚싯대", price: 2000 },
  { level: 2, name: "유리섬유 낚싯대", price: 6000 },
  { level: 3, name: "카본 낚싯대", price: 15000 },
  { level: 4, name: "황금 낚싯대", price: 35000 },
  { level: 5, name: "전설의 낚싯대", price: 80000 },
];
export const MAX_ROD = RODS.length - 1;

export function rodLevelOf(equipped: Record<string, string> | undefined): number {
  const n = Number(equipped?.rod ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= MAX_ROD ? n : 0;
}

/** 단계별 효과. 같은 방에서 겨루니 차이가 너무 커지지 않게 5단계에서도 약 30%로 둔다 */
export function rodEffects(level: number) {
  const l = Math.min(MAX_ROD, Math.max(0, level));
  return {
    /** 던지는 거리 배율 */
    castMul: 1 + 0.06 * l,
    /** 입질까지 기다리는 시간 배율(작을수록 빠름) */
    waitMul: 1 - 0.06 * l,
    /** 타이밍 바 성공 칸 폭 배율 */
    zoneMul: 1 + 0.05 * l,
    /** 이 힘 이상으로 던지면 "멀리" (낮을수록 쉬움) */
    farPower: 0.55 - 0.04 * l,
  };
}

// ---- 미끼: 던질 때마다 1개씩 쓰는 소모품. 사서 하나를 골라 쓴다 ----
export interface Bait {
  id: string;
  name: string;
  /** 한 묶음 값 */
  price: number;
  /** 한 묶음에 들어 있는 개수 */
  pack: number;
  desc: string;
}
export const BAITS: Bait[] = [
  { id: "bait-worm", name: "지렁이 미끼", price: 50, pack: 10, desc: "입질이 빨리 와요 (기다리는 시간 -30%)" },
  { id: "bait-glitter", name: "반짝이 미끼", price: 120, pack: 5, desc: "희귀 이상 물고기가 약 1.7배 잘 물려요" },
  { id: "bait-gold", name: "황금 미끼", price: 600, pack: 3, desc: "일반은 안 나와요! 희귀 이상만, 밤에 멀리 던지면 매우 희귀 약 24%·전설 약 9%, 타이밍 칸 +15%" },
]
export const MAX_BAIT = 99;

export function baitById(id: string | null | undefined): Bait | undefined {
  return BAITS.find((b) => b.id === id);
}

/** 미끼 효과. 미끼가 없으면 모두 1(배율 없음) */
export function baitEffects(id: string | null | undefined) {
  return {
    waitMul: id === "bait-worm" ? 0.7 : 1,
    /** 등급별 가중치 배율: 반짝이는 희귀 이상 2배, 황금은 일반을 막고 매우 희귀 2배, 전설 3배 */
    bias:
      id === "bait-glitter"
        ? { common: 1, rare: 2, veryRare: 2, legendary: 2 }
        : id === "bait-gold"
          ? { common: 0, rare: 1, veryRare: 2, legendary: 3 }
          : { common: 1, rare: 1, veryRare: 1, legendary: 1 },
    zoneMul: id === "bait-gold" ? 1.15 : 1,
  };
}

export function itemById(id: string): ShopItem | undefined {
  return ITEMS.find((i) => i.id === id);
}

export const EMOTES = ["wave", "angry", "aegyo", "dance", "cry"] as const;
/** 도감을 모두 채우면 받는 전용 이모트 */
export const SECRET_EMOTES = ["legend-bow"] as const;
export type EmoteId = (typeof EMOTES)[number] | (typeof SECRET_EMOTES)[number];

export const STARTING_COINS = 100;
export const MAX_CUSTOM_MAPS = 5;

export interface CodexReward {
  id: string;
  mapId: MapId | "all";
  /** 도감 완성 비율 */
  ratio: number;
  title?: string;
  coins?: number;
  items?: string[];
  emotes?: string[];
}

const MAP_TITLES: Record<MapId, string> = { lake: "호수", pier: "부두", ice: "얼음" };

export const CODEX_REWARDS: CodexReward[] = [
  ...(["lake", "pier", "ice"] as MapId[]).flatMap((m): CodexReward[] => [
    { id: `${m}-25`, mapId: m, ratio: 0.25, title: `${MAP_TITLES[m]}의 초보 낚시꾼`, coins: 200 },
    { id: `${m}-50`, mapId: m, ratio: 0.5, title: `${MAP_TITLES[m]}의 숙련 낚시꾼`, coins: 500 },
    { id: `${m}-100`, mapId: m, ratio: 1, title: `${MAP_TITLES[m]}의 전설`, coins: 2000 },
  ]),
  {
    id: "all-100",
    mapId: "all",
    ratio: 1,
    title: "전설의 낚시꾼",
    items: ["aura-legend"],
    emotes: ["legend-bow"],
  },
];

/** 이 맵의 도감 중 잡은 종의 비율 */
export function codexRatio(mapId: MapId | "all", caught: Set<string>): number {
  const list = mapId === "all" ? SPECIES : codexSpeciesFor(mapId);
  return list.filter((s) => caught.has(s.id)).length / list.length;
}
