import type { FishLook, FishSpecies, Rarity } from "./types";

// 수중 탐험의 작살 사냥 규칙. 서버와 화면이 같은 계산을 써야 하므로 여기에 둔다.
// 물고기는 서버가 "만들기만" 하고, 이동은 (출발 위치, 시작 시각, 씨앗)으로 정해지는 경로 함수라서
// 모든 접속자가 같은 시각에 같은 위치를 계산한다(위치를 계속 보내지 않는다).

export const HARPOON = {
  /** 작살이 날아가는 속도(m/s)와 사거리(m). 느린 편이라 움직이는 물고기는 앞서 쏴야 한다 */
  speed: 32,
  range: 20,
  /** 던지고 다음 번 던질 수 있을 때까지(ms) */
  cooldownMs: 1400,
  /** 서버가 인정하는 던진 시각의 지연 한도(ms). 낚시 타이밍과 같은 값 */
  lagMs: 400,
};

/** 작살 단계별 능력(낚싯대처럼 단계가 오를수록 전부 조금씩 좋아진다). 단계는 입은 것(equipped)의 "harpoon" 값으로 저장한다 */
const HP_NAMES = ["기본", "튼튼한", "날랜", "정밀", "강철", "은빛", "황금", "백금", "용왕", "별빛", "전설의"];
const HP_COST = [0, 50, 65, 80, 100, 150, 220, 300, 380, 500, 720];
const HP_COINS = [0, 1000, 1500, 3000, 4000, 4500, 5000, 5800, 6800, 8600, 12000];
const HP_RATE = [1, 0.85, 0.7, 0.55, 0.45, 0.35, 0.28, 0.2, 0.12, 0.08, 0.05];
export interface HarpoonTier { level: number; name: string; cost: number; coins: number; rate: number }
export const HARPOONS: HarpoonTier[] = HP_NAMES.map((n, level) => ({ level, name: `${n} 작살총`, cost: HP_COST[level], coins: HP_COINS[level], rate: HP_RATE[level] }));
export const MAX_HARPOON = HARPOONS.length - 1;
export function harpoonLevelOf(equipped: Record<string, string> | undefined): number {
  const n = Number(equipped?.harpoon ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= MAX_HARPOON ? n : 0;
}
export interface HarpoonStats { speed: number; range: number; cooldownMs: number; /** 조준 흔들림 배율(작을수록 안정) */ steady: number; /** 힘겨루기에서 줄이 끊기지 않는 정도 배율 */ line: number }
export function harpoonStats(level: number): HarpoonStats {
  const l = Math.min(MAX_HARPOON, Math.max(0, level));
  return { speed: HARPOON.speed * (1 + 0.03 * l), range: HARPOON.range * (1 + 0.09 * l), cooldownMs: Math.round(HARPOON.cooldownMs * (1 - 0.03 * l)), steady: 1 - 0.045 * l, line: 1 + 0.05 * l };
}

/** 같은 구역에 사람이 많을수록 잡기 쉬우니 파는 값을 조절한다: 1명 0.85배 ~ 15명 1.15배 */
export function crowdPriceMul(divers: number): number {
  return 0.85 + (Math.min(15, Math.max(1, divers)) - 1) * (0.3 / 14);
}

/** 숨은 보물 상자: 나무·은·금. 열면 꽝이거나 코인·강화석·미끼가 나온다(금 상자일수록 좋다) */
export const CHEST_KINDS = ["나무", "은", "금"] as const;
export interface ChestReward { coins: number; stones: number; baitId: string; bait: number }
export function rollChest(kind: string, rng: () => number = Math.random): ChestReward {
  const t = { 나무: { blank: 0.3, coin: 0.3, stone: 0.15, both: 0.1 }, 은: { blank: 0.15, coin: 0.3, stone: 0.2, both: 0.2 }, 금: { blank: 0.05, coin: 0.25, stone: 0.25, both: 0.3 } }[kind] ?? { blank: 1, coin: 0, stone: 0, both: 0 };
  const m = kind === "금" ? 4 : kind === "은" ? 2 : 1; // 상자 등급별 양 배율
  const between = (a: number, b: number) => Math.round(a + rng() * (b - a));
  const r = rng(), out: ChestReward = { coins: 0, stones: 0, baitId: "", bait: 0 };
  if (r < t.blank) return out;
  if (r < t.blank + t.coin) out.coins = between(200, 500) * m;
  else if (r < t.blank + t.coin + t.stone) out.stones = between(3, 8) * m;
  else if (r < t.blank + t.coin + t.stone + t.both) { out.coins = between(150, 400) * m; out.stones = between(2, 6) * m; }
  else { out.baitId = ["bait-worm", "bait-plain", "bait-glitter", "bait-gold"][Math.min(3, Math.floor(rng() * (1 + m)))]; out.bait = between(1, 3); } // 나머지는 미끼(상자가 좋을수록 좋은 미끼)
  return out;
}

/** 구역 보스: 아주 가끔 나타나는 거대한 생물. 약점이 잠깐씩 나타나고 거기를 맞히면 큰 피해를 준다. 여럿이 쓰러뜨리면 기여도 순으로 보상한다 */
export const BOSS = { hp: 60, body: 1, weak: 6, weakMs: 4500, stayMs: 10 * 60 * 1000, radius: 7, len: 15, weakRadius: 1.5, speed: 1.6 };
export const BOSS_NAMES: Record<number, { name: string; base: string }> = {
  0: { name: "산호 숲의 거대 쥐가오리", base: "만타가오리" }, 1: { name: "아틀란티스의 수호자", base: "리바이어던" }, 2: { name: "난파선의 크라켄", base: "크라켄" },
  3: { name: "동굴의 해적 대왕문어", base: "대왕문어" }, 4: { name: "심해의 흑룡", base: "심연의 흑룡" }, 5: { name: "모래 만의 늙은 고래", base: "빙하고래" },
};
/** 보스를 쓰러뜨렸을 때 기여도 순위별 보상(1위부터). 순위 밖은 마지막 값 */
export const BOSS_REWARDS: Array<{ coins: number; stones: number }> = [{ coins: 6000, stones: 80 }, { coins: 4000, stones: 50 }, { coins: 2500, stones: 30 }, { coins: 1200, stones: 15 }];
export const BOSS_TITLE = "구역 보스 사냥꾼";

/** 작살 사냥이 열려 있는 구역(client/src/underwater.ts 의 ZONES 번호) */
export const HUNT_ZONES = [0, 1, 2, 3, 4, 5];

export interface UwSpecies {
  id: string;
  name: string;
  /** 도감·가방의 2D 그림에 쓰는 체형 */
  body: string;
  /** 3D 생김새(색·무늬·체형·특색 부품). 조개에는 없다 */
  look?: FishLook;
  /** 잡았을 때 크기(cm) 범위 */
  sizeCm: [number, number];
  /** 등급(안 적으면 일반). 희귀 이상은 무리 없이 한 마리씩 드물게 나온다 */
  rarity?: Rarity;
  /** 평소 헤엄 속도(m/s) */
  speed: number;
  /** 사람이 이 거리(m) 안에서 빠르게 다가오면 놀라 도망친다 */
  skittish: number;
}

/** 바닥에서 줍는 조개. 물고기와 같은 인벤토리·도감에 들어간다(그림은 body "shell") */
export const UW_SHELLS: UwSpecies[] = [
  { id: "uw-s-01", name: "가리비", body: "shell", sizeCm: [6, 14], speed: 0, skittish: 0 },
  { id: "uw-s-02", name: "소라", body: "shell", sizeCm: [8, 18], speed: 0, skittish: 0 },
  { id: "uw-s-03", name: "진주조개", body: "shell", sizeCm: [5, 12], speed: 0, skittish: 0 },
];
/** 구역별 물고기 전체. 내용은 uwZones.ts 가 등록한다 */
export const UW_SPECIES: UwSpecies[] = [];

/** 등급별 동시에 떠 있는 최대 마리 수와, 자리가 비었을 때 다시 나타날 매초 확률. 희귀할수록 드물다 */
export const UW_CAP: Record<Rarity, number> = { common: 36, rare: 3, veryRare: 1, legendary: 1, mythic: 1 };
export const UW_RATE: Record<Rarity, number> = { common: 0.5, rare: 1 / 20, veryRare: 1 / 60, legendary: 1 / 600, mythic: 1 / 1800 }; // 자리가 비어 있을 때 매초 새로 나타날 확률. 평균으로 위 시간(초)쯤 걸린다

/**
 * 매우 희귀 이상은 작살이 박힌 뒤 힘겨루기를 해야 잡힌다. 조준은 없고 누르고 떼기뿐이다:
 * ① 지치게 하기(모두): 물고기는 "쉬는 구간"과 "돌진 구간"을 번갈아 한다. 쉴 때는 꾹 눌러 감고, 돌진할 때는 손을 떼서 줄을 풀어 준다.
 *    돌진할 때 계속 감고 있으면 장력이 급히 올라 줄이 끊긴다. 지침이 가득 차면 매우 희귀는 잡는다.
 * ② 마지막 버티기(전설·신화): 장력을 목표 띠 안에 일정 시간 연속으로 유지한다. 물고기가 불규칙하게 밀어서 장력이 흔들린다.
 * ③ 박자(신화): 박동 링이 모이는 순간에 맞춰 세 번 누른다.
 */
export interface UwTug {
  durationMs: number;
  /** 돌진 중에 풀어 주면 초당 오르는 지침 / 쉬는 중에 감으면 초당 오르는 지침 / 쉬는 중에 풀어 두면 초당 회복되는 양 */
  tireRun: number; pull: number; recover: number;
  /** 감는 동안 초당 오르는 장력 / 풀어 둔 동안 초당 내려가는 장력 / 돌진 중에 감고 있으면 더 오르는 장력 */
  rise: number; relax: number; runRise: number;
  /** 돌진·쉬는 구간 길이 범위(ms) */
  runMs: [number, number]; restMs: [number, number];
  /** 지침이 이 값 이상이 되면 ①이 끝난다 */
  fullAt: number;
  /** ② 마지막 버티기: 목표 띠(장력), 띠 안에 있어야 하는 시간(ms), 감을 때 오르는/뗄 때 내려가는 장력(초당), 물고기가 미는 힘(초당), 띠 밖일 때 모인 시간이 줄어드는 배수 */
  hold: { band: [number, number]; ms: number; rise: number; fall: number; push: number; decay: number } | null;
  /** ③ 박자: 횟수, 박자 사이 간격 범위(ms), 맞는 허용(±ms), 틀렸을 때 오르는 장력 */
  beat: { n: number; gapMs: [number, number]; windowMs: number; miss: number } | null;
}
export type UwPhase = "rest" | "run" | "hold" | "beat";
export interface UwTugState { tire: number; ten: number; phase: UwPhase; until: number; held: number; n1: number; n2: number; beatAt: number[]; beatI: number }
const between = (r: [number, number], rng: () => number) => r[0] + rng() * (r[1] - r[0]);
export const uwTugStart = (p: UwTug, rng: () => number): UwTugState => ({ tire: 0, ten: 0, phase: "rest", until: between(p.restMs, rng), held: 0, n1: 0, n2: 0, beatAt: [], beatI: 0 });
/** 곧 돌진한다(미리 알려 주는 구간) */
export const uwSoon = (p: UwTug, s: UwTugState, tMs: number) => s.phase === "rest" && s.until - tMs < 500;
const startBeats = (p: UwTug, s: UwTugState, tMs: number, rng: () => number) => {
  s.phase = "beat"; s.beatI = 0; s.beatAt = [];
  let t = tMs + 1300;
  for (let i = 0; i < p.beat!.n; i++) { s.beatAt.push(Math.round(t)); t += between(p.beat!.gapMs, rng); }
};
/** 한 걸음 진행한다. 다 이기면 "won" */
export function uwTugStep(p: UwTug, s: UwTugState, dtS: number, tMs: number, held: boolean, rng: () => number): "won" | null {
  if (s.phase === "beat") {
    s.ten = Math.max(0, s.ten - p.relax * dtS);
    if (s.beatI < s.beatAt.length && tMs > s.beatAt[s.beatI] + p.beat!.windowMs) { s.ten += p.beat!.miss; startBeats(p, s, tMs, rng); } // 놓쳤다: 처음 박자부터 다시
    return null;
  }
  if (s.phase === "hold") {
    const h = p.hold!, k = tMs / 1000, noise = (h.push * (Math.sin(k * 2.3 + s.n1) + 0.7 * Math.sin(k * 5.1 + s.n2))) / 1.7;
    s.ten = Math.max(0, s.ten + ((held ? h.rise : -h.fall) + noise) * dtS);
    if (s.ten >= h.band[0] && s.ten <= h.band[1]) s.held += dtS * 1000; else s.held = Math.max(0, s.held - dtS * 1000 * h.decay);
    if (s.held >= h.ms) { if (p.beat) { startBeats(p, s, tMs, rng); return null; } return "won"; }
    return null;
  }
  if (tMs >= s.until) { s.phase = s.phase === "rest" ? "run" : "rest"; s.until = tMs + between(s.phase === "run" ? p.runMs : p.restMs, rng); }
  if (s.phase === "run") {
    if (held) s.ten += (p.rise + p.runRise) * dtS; else { s.ten -= p.relax * dtS; s.tire += p.tireRun * dtS; }
  } else if (held) { s.ten += p.rise * dtS; s.tire += p.pull * dtS; } else { s.ten -= p.relax * dtS; s.tire -= p.recover * dtS; }
  s.ten = Math.max(0, s.ten); s.tire = Math.min(1, Math.max(0, s.tire));
  if (s.tire >= p.fullAt) {
    if (p.hold) { s.phase = "hold"; s.held = 0; s.n1 = rng() * 6.28; s.n2 = rng() * 6.28; return null; }
    if (p.beat) { startBeats(p, s, tMs, rng); return null; }
    return "won";
  }
  return null;
}
/** 박자에 맞춰 눌렀다: "hit"(맞음) "won"(마지막 박자까지 맞음) "miss"(빗나감: 장력이 오르고 처음부터 다시) "ignore"(박자와 상관없는 때) */
export function uwBeatPress(p: UwTug, s: UwTugState, tMs: number, rng: () => number): "hit" | "won" | "miss" | "ignore" {
  if (s.phase !== "beat" || s.beatI >= s.beatAt.length) return "ignore";
  const d = tMs - s.beatAt[s.beatI], w = p.beat!.windowMs;
  if (Math.abs(d) <= w) { s.beatI++; return s.beatI >= s.beatAt.length ? "won" : "hit"; }
  if (d < -w && d > -w * 2.5) { s.ten += p.beat!.miss; startBeats(p, s, tMs, rng); return "miss"; } // 너무 일찍 눌렀다
  return "ignore";
}
export function uwTugParams(rarity: Rarity, harpoonLevel: number, rng: () => number): UwTug | null {
  void rng;
  const ease = 1 / (1 + 0.05 * harpoonLevel); // 작살총 단계가 오르면 장력이 천천히 오르고, 버티기 때 물고기가 덜 흔든다
  const lv = Math.max(0, harpoonLevel), widen = (b: [number, number]): [number, number] => [Math.max(0.05, b[0] - 0.01 * lv), Math.min(0.95, b[1] + 0.01 * lv)]; // 단계마다 목표 띠가 양쪽으로 0.01씩 넓어진다
  const slow = Math.max(0.4, 1 - 0.05 * lv); // 단계마다 띠를 벗어났을 때 모은 시간이 깎이는 속도가 5%씩 느려진다
  if (rarity === "veryRare") return { durationMs: 26000, tireRun: 0, pull: 0.3, recover: 0.08, rise: 0.32 * ease, relax: 0.6, runRise: 0.8 * ease, runMs: [1700, 2300], restMs: [1300, 1800], fullAt: 1, hold: null, beat: null };
  if (rarity === "legendary") return { durationMs: 36000, tireRun: 0, pull: 0.25, recover: 0.09, rise: 0.36 * ease, relax: 0.6, runRise: 1.0 * ease, runMs: [1900, 2500], restMs: [1200, 1600], fullAt: 0.9, hold: { band: widen([0.33, 0.67]), ms: 2200, rise: 0.6, fall: 0.6, push: 0.4 * ease, decay: 1.5 * slow }, beat: null };
  if (rarity === "mythic") return { durationMs: 46000, tireRun: 0, pull: 0.23, recover: 0.1, rise: 0.36 * ease, relax: 0.6, runRise: 1.05 * ease, runMs: [2000, 2700], restMs: [1000, 1500], fullAt: 0.95, hold: { band: widen([0.4, 0.6]), ms: 3200, rise: 0.6, fall: 0.6, push: 0.55 * ease, decay: 3 * slow }, beat: { n: 3, gapMs: [650, 950], windowMs: 200, miss: 0.3 } };
  return null;
}
export const uwSpeciesById = (id: string) => UW_SPECIES.find((s) => s.id === id);
/** 다른 구역의 물고기를 등록한다(uwZones.ts). 인벤토리·판매가 같은 목록에서 찾는다 */
export function registerUwSpecies(list: UwSpecies[]) { for (const s of list) { UW_SPECIES.push(s); UW_FISH.push(toFish(s)); } }

/** 인벤토리·판매·도감이 낚시 물고기와 같은 방식으로 다루도록 FishSpecies 모양으로 바꾼 것. 낚시에서는 뽑히지 않는다(maps 에 없는 맵, weight 0). 값은 일반 등급 낚시 물고기와 같은 식 */
const UW_PRICE: Record<Rarity, number> = { common: 5, rare: 23, veryRare: 88, legendary: 500, mythic: 2500 }; // 낚시와 같은 등급별 기본가
const toFish = (s: UwSpecies): FishSpecies => ({
  id: s.id, name: s.name, rarity: s.rarity ?? (s.id === "uw-s-03" ? "rare" : "common"), basePrice: Math.round(UW_PRICE[s.rarity ?? (s.id === "uw-s-03" ? "rare" : "common")] * (1 + s.sizeCm[1] / 200)), minSize: s.sizeCm[0], maxSize: s.sizeCm[1],
  body: s.body, features: [], look: s.look, maps: ["atlantis" as FishSpecies["maps"][number]], time: "any", reach: "any", weight: 0, zoneWidth: 0.46,
});
export const UW_FISH: FishSpecies[] = [...UW_SPECIES, ...UW_SHELLS].map(toFish);

/** 화면에서 그리는 몸길이(m). 실제 크기를 그대로 쓰면 너무 작아 보이고 맞히기 어려워 키운다 */
export const uwLength = (cm: number) => Math.min(12, Math.max(0.8, cm * 0.026));
/** 작살이 맞는 거리(m): 몸길이의 절반에 여유를 더한 구 */
export const uwHitRadius = (lenM: number) => lenM * 0.5 + 0.4;

export interface HuntPath {
  ax: number;
  ay: number;
  az: number;
  /** 이 경로가 시작된 서버 시각(ms) */
  t0: number;
  seed: number;
  /** 헤엄 속도(m/s) */
  spd: number;
}
export interface V3 { x: number; y: number; z: number }

const ORBIT = 12; // 한 경로가 움직이는 폭(m). 구역 가장자리까지 가지 않게 작게 둔다
const ORBIT_Y = 3.5;

function unit(seed: number, k: number): number {
  let t = (seed + k * 0x9e3779b9) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 시작점에서 g(s)를 뺀 모양이라 경로가 바뀌어도(놀라서 다시 시작해도) 위치가 끊기지 않는다 */
function wave(seed: number, s: number): V3 {
  const p1 = unit(seed, 1) * Math.PI * 2, p2 = unit(seed, 2) * Math.PI * 2, p3 = unit(seed, 3) * Math.PI * 2;
  const w1 = 0.8 + unit(seed, 4) * 0.3, w2 = 0.55 + unit(seed, 5) * 0.25;
  return { x: ORBIT * Math.sin(w1 * s + p1), y: ORBIT_Y * Math.sin(0.5 * s + p3), z: ORBIT * Math.sin(w2 * s + p2) };
}

export function huntPos(p: HuntPath, nowMs: number): V3 {
  const s = (((nowMs - p.t0) / 1000) * p.spd) / ORBIT;
  const g = wave(p.seed, s), g0 = wave(p.seed, 0);
  return { x: p.ax + g.x - g0.x, y: p.ay + g.y - g0.y, z: p.az + g.z - g0.z };
}

/** 가는 방향의 수평 각도(라디안, atan2(z, x)). 그릴 때 몸을 이쪽으로 돌린다 */
export function huntHeading(p: HuntPath, nowMs: number): number {
  const a = huntPos(p, nowMs), b = huntPos(p, nowMs + 100);
  return Math.atan2(b.z - a.z, b.x - a.x);
}

/** 새 경로의 씨앗을 고른다. 처음에 (cx, cz) 쪽으로 향하는 것을 골라 물고기가 구역 밖으로 흘러가지 않게 한다 */
export function inwardSeed(rng: () => number, x: number, z: number, cx: number, cz: number): number {
  let best = 0;
  for (let i = 0; i < 10; i++) {
    const seed = Math.floor(rng() * 4294967296);
    const p: HuntPath = { ax: x, ay: 0, az: z, t0: 0, seed, spd: ORBIT }; // spd=ORBIT 이면 s가 초 단위
    const a = huntPos(p, 0), b = huntPos(p, 1000);
    best = seed;
    if ((b.x - a.x) * (cx - x) + (b.z - a.z) * (cz - z) > 0) break;
  }
  return best;
}

export interface Target { id: string; path: HuntPath; radius: number }
export interface ThrowResult {
  /** 맞은 물고기 id(없으면 null)와 던진 뒤 맞기까지 걸린 시간(초) */
  hit: string | null;
  tau: number;
  /** 맞지는 않았지만 가까이 지나가 놀란 물고기 */
  near: string[];
}

/**
 * 던진 작살의 결과. 작살은 던진 순간(tMs)에 origin 에서 dir(길이 1) 방향으로 직선으로 날아가고, 물고기는 그동안 경로를 따라 움직인다.
 * 날아가는 길을 짧게 나눠 보며 처음으로 물고기 몸(구)에 닿는 때를 찾는다. 가장 먼저 닿는 물고기가 맞는다.
 */
export function resolveThrow(origin: V3, dir: V3, tMs: number, targets: Target[], st: { speed: number; range: number } = HARPOON): ThrowResult {
  const flight = st.range / st.speed;
  const minD = new Map<string, number>();
  let hit: string | null = null, tau = flight;
  for (let s = 0; s <= flight + 1e-9 && hit === null; s += 0.025) {
    const px = origin.x + dir.x * st.speed * s, py = origin.y + dir.y * st.speed * s, pz = origin.z + dir.z * st.speed * s;
    for (const f of targets) {
      const q = huntPos(f.path, tMs + s * 1000);
      const d = Math.hypot(px - q.x, py - q.y, pz - q.z);
      if (d < (minD.get(f.id) ?? Infinity)) minD.set(f.id, d);
      if (d <= f.radius && (hit === null || s < tau)) { hit = f.id; tau = s; }
    }
  }
  const near = targets.filter((f) => f.id !== hit && (minD.get(f.id) ?? Infinity) <= f.radius * 2.5 + 2).map((f) => f.id);
  return { hit, tau, near };
}
