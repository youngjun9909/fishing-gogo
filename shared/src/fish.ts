import type { FishSpecies, MapId, Rarity, Reach, TimeOfDay } from "./types";

// 한 줄 형식: "이름:등급:체형:시간대:위치[:나오는 맵(여럿이면 +)]" — 마지막 칸을 쓰면 그 목록의 기본 맵 대신 그 맵에서만 나온다
// 등급 c=일반 r=희귀 v=매우 희귀 l=전설 / 시간대 d=낮 n=밤 a=상관없음 / 위치 n=가까이 f=멀리 a=상관없음
const RARITY: Record<string, Rarity> = { c: "common", r: "rare", v: "veryRare", l: "legendary", m: "mythic" };
const TIME: Record<string, TimeOfDay | "any"> = { d: "day", n: "night", a: "any" };
const REACH: Record<string, Reach | "any"> = { n: "near", f: "far", a: "any" };

// 체형별 크기 범위(cm)
const BODY_SIZE: Record<string, [number, number]> = {
  round: [8, 30],
  slim: [15, 70],
  eel: [30, 110],
  flat: [20, 70],
  puffer: [12, 40],
  shark: [90, 400],
  ray: [50, 200],
  squid: [15, 80],
  catfish: [20, 90],
  carp: [20, 90],
  bass: [20, 70],
  whale: [300, 1200],
};

const RARITY_STATS: Record<Rarity, { price: number; weight: number; zone: number }> = {
  // 가격은 "한 시간 낚으면 약 1500코인"을 목표로 잡았다(옛 값의 약 1/4)
  common: { price: 5, weight: 100, zone: 0.46 },
  rare: { price: 23, weight: 40, zone: 0.36 },
  veryRare: { price: 88, weight: 12, zone: 0.26 },
  legendary: { price: 500, weight: 3, zone: 0.17 },
  // 신화: 전설의 3분의 1 확률, 5배 가격, 가장 좁은 칸
  mythic: { price: 2500, weight: 1, zone: 0.12 },
};

const FEATURES = [
  "long-dorsal", "horn", "whiskers", "hump", "forked-tail", "big-mouth",
  "spiky", "frill", "tusk", "glow", "wide-fins", "tall-tail",
];
const PATTERNS = ["plain", "stripes", "spots", "gradient", "scales"];

function build(prefix: string, maps: MapId[], lines: string): FishSpecies[] {
  return lines
    .trim()
    .split("\n")
    .map((line, i) => {
      const [name, r, body, t, re, mp] = line.trim().split(":");
      const rarity = RARITY[r];
      const [minSize, maxSize] = BODY_SIZE[body];
      const stats = RARITY_STATS[rarity];
      return {
        id: `${prefix}-${String(i + 1).padStart(2, "0")}`,
        name,
        rarity,
        basePrice: Math.round(stats.price * (1 + maxSize / 200)),
        minSize,
        maxSize,
        body,
        features: [FEATURES[(i * 5 + prefix.length) % FEATURES.length], PATTERNS[(i * 3) % PATTERNS.length]],
        maps: mp ? (mp.split("+") as MapId[]) : maps,
        time: TIME[t],
        reach: REACH[re],
        weight: stats.weight,
        zoneWidth: stats.zone,
      };
    });
}

const COMMON = build("common", [], `
붕어:c:carp:a:n
잉어:c:carp:a:n
피라미:c:slim:d:n
송사리:c:round:d:n
미꾸라지:c:eel:a:n
메기:c:catfish:n:a
가물치:r:catfish:a:f
블루길:c:round:d:n
배스:c:bass:d:a
숭어:c:slim:a:a
장어:r:eel:n:a
망둥어:c:round:d:n
가자미:c:flat:a:n
복어:r:puffer:a:a
농어:c:bass:a:f
학공치:c:slim:d:n
쥐치:c:flat:a:n
보리멸:c:slim:d:n
베도라치:c:eel:a:n
노래미:c:round:a:a
`);

const LAKE = build("lake", ["lake"], `
쏘가리:r:bass:a:a
꺽지:c:bass:d:n
누치:c:carp:a:a
끄리:c:slim:d:a
모래무지:c:round:d:n
참마자:c:carp:a:a
갈겨니:c:slim:d:n
버들치:c:round:d:n
열목어:r:slim:d:f
산천어:r:slim:d:f
무지개송어:c:slim:a:a
철갑상어:v:shark:a:f
황금잉어:v:carp:d:a
금붕어:c:round:d:n
향어:c:carp:a:a
초어:c:carp:a:a
백련어:c:carp:a:a
납자루:c:flat:d:n
돌고기:c:round:d:n
쉬리:r:slim:d:n
퉁가리:c:catfish:n:n
가시고기:r:round:d:n
동사리:c:catfish:n:n
안개의여왕어:l:slim:n:f
달빛잉어:v:carp:n:a
은빛메기:r:catfish:n:f
호수의수호어:l:whale:n:f
용잉어:l:carp:a:f
진주붕어:v:carp:d:n
심연의가물치:v:catfish:n:f
연화등불메기:l:catfish:n:f
비취가물치:l:catfish:a:f
나비날개어:l:round:d:f
황금등껍질어:l:round:a:f
천년이무기:m:eel:n:f
연화봉황어:m:round:d:f
`);

// shortcut: 크루즈는 전용 물고기가 정해지기 전까지 부두 물고기를 임시로 같이 쓴다, 전용 목록이 정해지면 "cruise"를 빼고 새로 만든다
const PIER = build("pier", ["pier", "cruise"], `
도다리:c:flat:a:n
광어:r:flat:a:a
우럭:c:bass:a:a
놀래기:c:round:d:n
감성돔:r:bass:a:f
참돔:r:bass:a:f
돌돔:v:bass:d:f
볼락:c:round:n:n
쥐노래미:c:round:a:n
갈치:c:slim:n:f
고등어:c:slim:d:f
전갱이:c:slim:d:n
삼치:c:slim:d:f
방어:r:slim:d:f
부시리:r:slim:d:f
한치:c:squid:n:a
오징어:c:squid:n:a
갑오징어:r:squid:a:n
문어:r:squid:a:n
가오리:r:ray:a:f
까치상어:l:shark:n:f:ice
아귀:r:catfish:n:f
황새치:v:shark:d:f
참치:v:slim:d:f
청새치:v:shark:d:f
형광오징어:v:squid:n:f
달빛갈치:v:slim:n:f
대왕문어:l:squid:d:f:lake
리바이어던:l:whale:n:f:pier
크라켄:l:squid:n:f:pier
천공비행어:l:round:d:f:pier
산호불꽃쏠배감펭:l:round:d:f:pier
고대나선어:l:round:n:f:pier
해초왕해마:l:slim:a:f:pier
용왕의 해신수:m:round:a:f:pier
무지개유니콘피쉬:m:round:d:f:pier
`);

const ICE = build("ice", ["ice"], `
빙어:c:slim:d:n
송어:c:slim:a:a
열빙어:c:slim:d:n
대구:c:bass:a:f
명태:c:slim:a:a
연어:r:slim:d:f
북극곤들매기:r:slim:d:f
곤들매기:c:slim:a:a
강꼬치고기:c:bass:a:a
레이크송어:r:slim:n:f
북극송어:r:slim:d:f
흰송어:c:slim:a:n
얼음붕어:c:carp:d:n
빙하메기:c:catfish:n:a
설원잉어:r:carp:d:a
얼음장어:c:eel:n:a
북극가자미:c:flat:a:n
눈꽃가오리:v:ray:n:f
서리복어:r:puffer:a:a
얼음도다리:c:flat:a:n
남극빙어:c:slim:d:n
오로라연어:l:slim:d:f
한파대구:r:bass:n:f
고드름물고기:v:eel:n:f
그린란드상어:l:shark:n:f
빙하고래:l:whale:n:f:pier
프로스트드래곤피쉬:l:eel:n:f:pier
눈의여왕대구:l:bass:n:f
북극광철갑상어:l:shark:n:f
하얀유령어:r:slim:n:a
은빛빙어:l:slim:d:f
빙정창어:l:slim:a:f
설화유영어:l:round:d:f
설령빙호어:m:round:n:f
빙하거신수:m:whale:a:f
`);

// 크루즈 전용 전설(깊은 바다: 어둡고 기묘한 모습). 일반 물고기는 아직 부두 물고기를 같이 쓴다
const CRUISE = build("cruise", ["cruise"], `
심연등불아귀:l:round:n:f
유령날개가오리:l:ray:n:f
블랙홀장어:l:eel:n:f
홍월흡혈오징어:l:squid:a:f
심해갑옷어:l:round:d:f
심해수정해파리:l:squid:a:f
황금송곳니어:l:bass:d:f
심연의 흑룡:m:eel:n:f
태초의 성운어:m:slim:n:f
`);

export const SPECIES: FishSpecies[] = [...COMMON, ...LAKE, ...PIER, ...ICE, ...CRUISE];

const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));
export function speciesById(id: string): FishSpecies | undefined {
  return BY_ID.get(id);
}

/** 맵 도감 대상: 공통 물고기와 그 맵의 고유 물고기 */
export function codexSpeciesFor(mapId: MapId): FishSpecies[] {
  return SPECIES.filter((s) => s.maps.length === 0 || s.maps.includes(mapId));
}
