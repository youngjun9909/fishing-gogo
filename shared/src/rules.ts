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

export const RARITY_ORDER: Rarity[] = ["common", "rare", "veryRare", "legendary", "mythic"];

/** 서버 시계 기준으로 방 안 모두가 같은 시간대를 본다 */
export function timeOfDay(nowMs: number): TimeOfDay {
  return nowMs % CYCLE_MS < DAY_MS ? "day" : "night";
}

export function isRareOrBetter(r: Rarity): boolean {
  return RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf("rare");
}

/** 낚싯대 한 단계마다 판매가 +2.5% */
export const ROD_SELL_BONUS = 0.025;

export function sellPrice(species: FishSpecies, size: number, rodLevel = 0): number {
  const avg = (species.minSize + species.maxSize) / 2;
  return Math.max(1, Math.round(((species.basePrice * size) / avg) * (1 + ROD_SELL_BONUS * rodLevel)));
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
export type PickBias = Record<Rarity, number>;
export const NO_BIAS: PickBias = { common: 1, rare: 1, veryRare: 1, legendary: 1, mythic: 1 };

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

/**
 * 힘겨루기: 타이밍 칸을 맞춘 뒤 전설·신화 물고기는 연타로 게이지(0~1)를 채워야 잡는다.
 * 게이지는 시간이 갈수록 줄고, 한 번 누를 때마다 gain만큼 오른다. 신화는 "발작" 구간이 있어서 그때 누르면 오히려 penalty만큼 깎인다(드레인은 멈춘다).
 */
export interface TugParams {
  gain: number;
  /** 초당 줄어드는 양 */
  drain: number;
  durationMs: number;
  start: number;
  penalty: number;
  /** 발작 구간 [시작ms, 끝ms] (힘겨루기 시작 기준) */
  frenzy: Array<[number, number]>;
}
export const TUG_MIN_GAP_MS = 80; // 초당 12번까지만 센다(자동 연타 방지)
export const ROD_TUG_EASE = 0.04; // 낚싯대 한 단계마다 줄어드는 속도 4% 완화

export function tugParams(rarity: Rarity, rodLevel: number, rng: () => number): TugParams | null {
  const ease = 1 - ROD_TUG_EASE * rodLevel;
  if (rarity === "legendary") return { gain: 0.07, drain: 0.25 * ease, durationMs: 8000, start: 0.3, penalty: 0, frenzy: [] };
  if (rarity === "mythic") {
    const frenzy = [0, 1, 2].map((k): [number, number] => {
      const s = 3200 + k * 3600 + rng() * 400; // 첫 발작은 "신화다!" 안내(약 1.4초)와 3-2-1(1.5초)이 끝난 뒤에 온다
      return [Math.round(s), Math.round(s + 1000)];
    });
    return { gain: 0.064, drain: 0.29 * ease, durationMs: 12500, start: 0.3, penalty: 0.13, frenzy };
  }
  return null;
}

export function inFrenzy(p: TugParams, tMs: number): boolean {
  return p.frenzy.some(([s, e]) => tMs >= s && tMs < e);
}

/** fromMs~toMs 사이에 게이지가 줄어드는 만큼 반영한다(발작 중에는 줄지 않는다) */
export function tugDecay(p: TugParams, g: number, fromMs: number, toMs: number): number {
  for (let t = fromMs; t < toMs; t += 20) {
    if (!inFrenzy(p, t)) g -= (p.drain * Math.min(20, toMs - t)) / 1000;
  }
  return g;
}

/** 한 번 누른 결과 */
export function tugPull(p: TugParams, g: number, tMs: number): number {
  return Math.min(1, inFrenzy(p, tMs) ? g - p.penalty : g + p.gain);
}

/** 어려운 물고기일수록 커서가 빨라진다 */
export function cursorSpeed(species: FishSpecies): number {
  return 0.3 + (1 - species.zoneWidth) * 0.55;
}
