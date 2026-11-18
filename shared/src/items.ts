import { codexSpeciesFor, SPECIES } from "./fish";
import type { MapId, Rarity } from "./types";
import { candidatesFor } from "./rules";

export type ItemSlot = "top" | "pants" | "shoes" | "outfit" | "aura";

export interface ShopItem {
  id: string;
  name: string;
  slot: ItemSlot;
  price: number;
  /** false면 도감 보상으로만 얻는다 */
  purchasable: boolean;
  /** true면 여자 캐릭터만 사고 입을 수 있다 */
  femaleOnly?: boolean;
}

/** 이 캐릭터(gender 0 여자, 1 남자)가 입을 수 있는 아이템인가 */
export const canWear = (item: ShopItem, gender?: number) => !(item.femaleOnly && gender === 1);

export const ITEMS: ShopItem[] = [
  // 옷은 상의·하의·신발을 따로 사고 입는다. 기본 옷(흰 티, 검정 반바지, 검정 운동화)은 아무것도 안 입었을 때 보인다
  { id: "top-hoodie", name: "남색 후드티", slot: "top", price: 1500, purchasable: true },
  { id: "pants-jeans", name: "청바지", slot: "pants", price: 1200, purchasable: true },
  { id: "shoes-white", name: "흰 운동화", slot: "shoes", price: 900, purchasable: true },
  // 한벌옷: 입으면 상의·하의·신발 자리를 한꺼번에 덮는다(따로 입은 상의·하의·신발은 그대로 남아 있고 보이지만 않는다)
  { id: "outfit-haori", name: "짙은 회색 하오리 한벌", slot: "outfit", price: 20000, purchasable: true },
  { id: "outfit-whitehoodie", name: "흰 후드 치마 한벌", slot: "outfit", price: 20000, purchasable: true, femaleOnly: true },
  { id: "outfit-tigerrobe", name: "백호 도포 한벌", slot: "outfit", price: 60000, purchasable: true },
  { id: "outfit-hanbokgirl", name: "화려한 궁중 한복 한벌", slot: "outfit", price: 60000, purchasable: true, femaleOnly: true },
  { id: "outfit-streetpuffer", name: "검은 패딩 카고 한벌", slot: "outfit", price: 62000, purchasable: true },
  // 낱개 옷(상의·하의·신발): 한벌옷 모델을 가른 것. 한벌옷을 입으면 가려진다
  { id: "top-trackjacket", name: "블랙 트랙재킷", slot: "top", price: 28000, purchasable: true },
  { id: "pants-washdenim", name: "워싱 와이드 데님", slot: "pants", price: 27000, purchasable: true },
  { id: "shoes-sneakerbw", name: "흑백 스니커즈", slot: "shoes", price: 5000, purchasable: true },
  { id: "top-trackcrop", name: "크롭 트랙재킷", slot: "top", price: 27000, purchasable: true, femaleOnly: true },
  { id: "pants-pleated", name: "블랙 플리츠 치마", slot: "pants", price: 28000, purchasable: true, femaleOnly: true },
  { id: "shoes-sambawarm", name: "삼바화 + 레그워머", slot: "shoes", price: 7000, purchasable: true, femaleOnly: true },
  { id: "top-navyknit", name: "네이비 니트", slot: "top", price: 29000, purchasable: true, femaleOnly: true },
  { id: "pants-frillskirt", name: "그레이 프릴 치마", slot: "pants", price: 29000, purchasable: true, femaleOnly: true },
  { id: "shoes-graysocks", name: "회색 양말 + 로퍼", slot: "shoes", price: 6000, purchasable: true, femaleOnly: true },
  { id: "top-pufferjacket", name: "검은 숏패딩", slot: "top", price: 30000, purchasable: true },
  { id: "pants-cargopants", name: "카키 와이드 카고", slot: "pants", price: 30000, purchasable: true },
  { id: "shoes-chunkysneaker", name: "청키 스니커즈", slot: "shoes", price: 8000, purchasable: true },
  { id: "top-redzip", name: "붉은 하프집업", slot: "top", price: 28000, purchasable: true },
  { id: "pants-graydenim", name: "그레이 워싱 데님", slot: "pants", price: 28000, purchasable: true },
  { id: "shoes-redsneaker", name: "붉은 스니커즈", slot: "shoes", price: 6000, purchasable: true },
  { id: "top-gruntop", name: "레드 그런지 롱슬리브", slot: "top", price: 29000, purchasable: true },
  { id: "pants-chainpants", name: "체인 블랙 팬츠", slot: "pants", price: 29000, purchasable: true },
  { id: "shoes-blackboots", name: "블랙 부츠", slot: "shoes", price: 7000, purchasable: true },
  { id: "outfit-trackjacket", name: "트랙재킷 워싱 데님 한벌", slot: "outfit", price: 54000, purchasable: true },
  { id: "outfit-trackskirt", name: "트랙재킷 플리츠 치마 한벌", slot: "outfit", price: 56000, purchasable: true, femaleOnly: true },
  { id: "outfit-redpullover", name: "붉은 하프집업 데님 한벌", slot: "outfit", price: 56000, purchasable: true },
  { id: "outfit-redgrunge", name: "레드 그런지 체인 한벌", slot: "outfit", price: 58000, purchasable: true },
  { id: "outfit-navyskirt", name: "네이비 니트 프릴 치마 한벌", slot: "outfit", price: 58000, purchasable: true, femaleOnly: true },
  { id: "aura-sparkle", name: "반짝 오라", slot: "aura", price: 6000, purchasable: true },
  { id: "aura-bubble", name: "물방울 오라", slot: "aura", price: 9000, purchasable: true },
  { id: "aura-flame", name: "불꽃 오라", slot: "aura", price: 12000, purchasable: true },
  { id: "aura-sakura", name: "벚꽃 오라", slot: "aura", price: 12000, purchasable: true },
  { id: "aura-lightning", name: "번개 오라", slot: "aura", price: 18000, purchasable: true },
  { id: "aura-rainbow", name: "무지개 오라", slot: "aura", price: 25000, purchasable: true },
  { id: "aura-galaxy", name: "은하 오라", slot: "aura", price: 30000, purchasable: true },
  { id: "aura-legend", name: "전설의 낚시꾼 오라", slot: "aura", price: 0, purchasable: false },
];

// ---- 낚싯대: 대장장이에게서 강화석과 코인으로 강화한다(확률로 성공, 실패하면 재료와 코인만 사라진다). 단계는 입은 것(equipped) 안의 "rod" 값으로 저장한다 ----
export interface RodTier {
  level: number;
  name: string;
  /** 이 단계로 올리는 시도 한 번에 드는 강화석(0단계는 기본) */
  cost: number;
  /** 시도 한 번에 드는 코인 */
  coins: number;
  /** 강화 성공 확률(0~1) */
  rate: number;
}
const ROD_NAMES = ["나무", "대나무", "유리섬유", "카본", "강철", "은빛", "황금", "백금", "용왕", "별빛", "전설의"];
const ROD_COST = [0, 50, 65, 80, 100, 150, 220, 300, 380, 500, 720];
const ROD_COINS = [0, 1000, 1500, 3000, 4000, 4500, 5000, 5800, 6800, 8600, 12000];
const ROD_RATE = [1, 0.85, 0.7, 0.55, 0.45, 0.35, 0.28, 0.2, 0.12, 0.08, 0.05];
export const RODS: RodTier[] = ROD_NAMES.map((n, level) => ({ level, name: `${n} 낚싯대`, cost: ROD_COST[level], coins: ROD_COINS[level], rate: ROD_RATE[level] }));
export const MAX_ROD = RODS.length - 1;

/** 대장장이에게서 강화석 한 개를 사는 값 */
export const STONE_PRICE = 300;
export const MAX_STONE_BUY = 1000; // 한 번에 살 수 있는 최대 개수

/** 물고기를 팔 때마다(한 마리당) 받는 강화석: 등급이 높을수록 많다 */
export const STONES_PER_FISH: Record<"common" | "rare" | "veryRare" | "legendary" | "mythic", number> = { common: 1, rare: 3, veryRare: 8, legendary: 25, mythic: 100 };

export function rodLevelOf(equipped: Record<string, string> | undefined): number {
  const n = Number(equipped?.rod ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= MAX_ROD ? n : 0;
}

/**
 * 단계별 효과. 등급 가중치(bias)는 단계가 오를수록 희귀 이상이 잘 나오게 하되 상한을 둔다
 * 구간(0~3 / 4~7 / 8~9 / 10)마다 확 좋아지고, 구간 안에서는 조금씩만 오른다.
 * 10단계: 희귀 x3, 매우 희귀 x6.5, 전설 x8, 신화 x16.86(맵 평균 신화 약 1%).
 */
const ROD_TIER = [0, 0.03, 0.06, 0.09, 0.22, 0.26, 0.3, 0.34, 0.55, 0.63, 1];
const bias = (max: number, l: number) => Math.round((1 + (max - 1) * ROD_TIER[l]) * 100) / 100;

export function rodEffects(level: number) {
  const l = Math.min(MAX_ROD, Math.max(0, level));
  return {
    /** 던지는 거리 배율 */
    castMul: 1 + 0.04 * l,
    /** 타이밍 바 성공 칸 폭 배율 */
    zoneMul: 1 + 0.03 * l,
    /** 이 힘 이상으로 던지면 "멀리" (낮을수록 쉬움) */
    farPower: 0.55 - 0.03 * l,
    /** 등급별 가중치 배율 */
    bias: {
      common: 1,
      rare: bias(3, l),
      veryRare: bias(6.5, l),
      legendary: bias(8, l),
      mythic: bias(16.86, l),
    },
  };
}

/**
 * 이 단계의 낚싯대로 멀리 던졌을 때 등급별로 낚일 확률(0~1).
 * 네 맵 x 낮·밤 여덟 경우를 같은 비중으로 평균 낸 값이라, 실제 맵마다 조금씩 다르다(강화창·결과창에 보여 준다).
 */
export function rarityOdds(level: number): Record<Rarity, number> {
  const bias = rodEffects(level).bias;
  const maps: MapId[] = ["lake", "pier", "ice", "cruise"];
  const out: Record<Rarity, number> = { common: 0, rare: 0, veryRare: 0, legendary: 0, mythic: 0 };
  let n = 0;
  for (const m of maps) {
    for (const t of ["day", "night"] as const) {
      const list = candidatesFor(m, t, "far");
      const total = list.reduce((s, f) => s + f.weight * bias[f.rarity], 0);
      if (total <= 0) continue;
      for (const f of list) out[f.rarity] += (f.weight * bias[f.rarity]) / total;
      n++;
    }
  }
  for (const k of Object.keys(out) as Rarity[]) out[k] /= n || 1;
  return out;
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
  { id: "bait-worm", name: "지렁이 미끼", price: 50, pack: 1, desc: "쓰면 1분 동안 입질이 조금 빨리 와요 (기다리는 시간 -10%)" },
  { id: "bait-plain", name: "그냥 미끼", price: 150, pack: 1, desc: "쓰면 1분 동안 입질이 빨리 와요 (기다리는 시간 -30%)" },
  { id: "bait-glitter", name: "반짝이 미끼", price: 300, pack: 1, desc: "쓰면 1분 동안 입질이 아주 빨리 와요 (기다리는 시간 -50%)" },
  { id: "bait-gold", name: "황금 미끼", price: 500, pack: 1, desc: "쓰면 1분 동안 입질이 가장 빨리 와요 (기다리는 시간 -70%)" },
]
export const MAX_BAIT = 99;
/** 미끼 한 개를 쓰면 이 시간 동안 효과가 이어진다 */
export const BAIT_DURATION_MS = 60_000;

export function baitById(id: string | null | undefined): Bait | undefined {
  return BAITS.find((b) => b.id === id);
}

/** 미끼 효과: 입질까지 기다리는 시간만 줄인다(물고기 등급 확률은 낚싯대가 정한다) */
export function baitEffects(id: string | null | undefined) {
  return { waitMul: { "bait-worm": 0.9, "bait-plain": 0.7, "bait-glitter": 0.5, "bait-gold": 0.3 }[id ?? ""] ?? 1 };
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

const MAP_TITLES: Record<MapId, string> = { lake: "호수", pier: "부두", ice: "얼음", cruise: "크루즈" };

export const CODEX_REWARDS: CodexReward[] = [
  ...(["lake", "pier", "ice", "cruise"] as MapId[]).flatMap((m): CodexReward[] => [
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
