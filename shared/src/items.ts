import { codexSpeciesFor, SPECIES } from "./fish";
import type { MapId } from "./types";

export type ItemSlot = "outfit" | "hat" | "aura";

export interface ShopItem {
  id: string;
  name: string;
  slot: ItemSlot;
  price: number;
  /** false면 도감 보상으로만 얻는다 */
  purchasable: boolean;
}

export const ITEMS: ShopItem[] = [
  { id: "outfit-hoodie", name: "후드티 코디", slot: "outfit", price: 400, purchasable: true },
  { id: "outfit-overalls", name: "멜빵바지", slot: "outfit", price: 300, purchasable: true },
  { id: "outfit-raincoat", name: "노란 우비", slot: "outfit", price: 500, purchasable: true },
  { id: "outfit-hanbok", name: "한복", slot: "outfit", price: 900, purchasable: true },
  { id: "hat-straw", name: "밀짚모자", slot: "hat", price: 200, purchasable: true },
  { id: "hat-beanie", name: "털모자", slot: "hat", price: 350, purchasable: true },
  { id: "hat-captain", name: "선장 모자", slot: "hat", price: 700, purchasable: true },
  { id: "aura-sparkle", name: "반짝 오라", slot: "aura", price: 1500, purchasable: true },
  { id: "aura-bubble", name: "물방울 오라", slot: "aura", price: 2500, purchasable: true },
  { id: "aura-legend", name: "전설의 낚시꾼 오라", slot: "aura", price: 0, purchasable: false },
];

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
