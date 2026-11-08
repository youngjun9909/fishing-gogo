import type { FishSpecies, MapId, Reach, Rarity, TimeOfDay } from "./types";
import { SPECIES } from "./fish";

export const DAY_MS = 12 * 60 * 1000;
export const NIGHT_MS = 8 * 60 * 1000;
export const CYCLE_MS = DAY_MS + NIGHT_MS;

export const WAIT_MIN_MS = 3000;
export const WAIT_MAX_MS = 15000;
export const BITE_WINDOW_MS = 2200;
export const MINIGAME_TIMEOUT_MS = 10000;
export const MAX_PLAYERS = 8;
export const RECONNECT_SECONDS = 60;
export const CHAT_MAX_LENGTH = 100;

export const RARITY_ORDER: Rarity[] = ["common", "rare", "veryRare", "legendary"];

/** 서버 시계 기준으로 방 안 모두가 같은 시간대를 본다 */
export function timeOfDay(nowMs: number): TimeOfDay {
  return nowMs % CYCLE_MS < DAY_MS ? "day" : "night";
}

export function isRareOrBetter(r: Rarity): boolean {
  return RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf("rare");
}

export function sellPrice(species: FishSpecies, size: number): number {
  const avg = (species.minSize + species.maxSize) / 2;
  return Math.max(1, Math.round((species.basePrice * size) / avg));
}

/** 던진 힘(0~1)이 크면 멀리 던진 것으로 본다 */
export function reachOf(power: number, farPower = 0.55): Reach {
  return power >= farPower ? "far" : "near";
}

export function candidatesFor(mapId: MapId, time: TimeOfDay, reach: Reach): FishSpecies[] {
  return SPECIES.filter(
    (s) =>
      (s.maps.length === 0 || s.maps.includes(mapId)) &&
      (s.time === "any" || s.time === time) &&
      (s.reach === "any" || s.reach === reach),
  );
}

/** 등급별 가중치 배율(미끼가 바꾼다). 0이면 그 등급은 아예 안 나온다 */
export interface PickBias { common: number; rare: number; veryRare: number; legendary: number }
export const NO_BIAS: PickBias = { common: 1, rare: 1, veryRare: 1, legendary: 1 };

/** rng()는 [0,1) 난수. 시험에서는 값을 고정해서 넣는다 */
export function pickSpecies(
  rng: () => number,
  mapId: MapId,
  time: TimeOfDay,
  reach: Reach,
  bias: PickBias = NO_BIAS,
): FishSpecies | null {
  const list = candidatesFor(mapId, time, reach);
  let w = (s: FishSpecies) => s.weight * bias[s.rarity];
  let total = list.reduce((sum, s) => sum + w(s), 0);
  if (total <= 0) {
    // 배율 때문에 후보가 하나도 안 남으면(예: 일반만 사는 곳에서 일반을 막은 경우) 배율 없이 뽑는다
    w = (s) => s.weight;
    total = list.reduce((sum, s) => sum + w(s), 0);
  }
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const s of list) {
    roll -= w(s);
    if (roll < 0) return s;
  }
  return list[list.length - 1];
}

export function rollSize(rng: () => number, species: FishSpecies): number {
  const size = species.minSize + rng() * (species.maxSize - species.minSize);
  return Math.round(size * 10) / 10;
}

/** 타이밍 바 커서: 0~1 사이를 왕복한다. speed는 1초에 왕복 몇 번인지 */
export function cursorAt(elapsedMs: number, speed: number): number {
  const phase = (elapsedMs / 1000) * speed;
  const t = phase - Math.floor(phase);
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

export function judge(cursor: number, target: number, zoneWidth: number): boolean {
  return Math.abs(cursor - target) <= zoneWidth / 2;
}

/** 어려운 물고기일수록 커서가 빨라진다 */
export function cursorSpeed(species: FishSpecies): number {
  return 0.3 + (1 - species.zoneWidth) * 0.55;
}
