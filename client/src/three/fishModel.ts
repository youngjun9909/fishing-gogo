import * as THREE from "three";
import { CUSTOM_MODELS } from "./legendModels";
import type { FishSpecies } from "@fishing/shared";

// 둥글둥글하고 윤기 나는 장난감 같은 물고기. 뾰족한 모서리 없이 부드러운 모양으로 만든다.
// 종마다 실제 물고기의 특징(색, 무늬, 수염, 부리 등)을 살린다.

export type Pattern = "plain" | "stripes" | "bands" | "sidestripe" | "spots" | "freckles" | "mottled" | "patches" | "mackerel" | "parr";

interface Design {
  base: string;
  accent: string;
  belly?: string;
  pattern?: Pattern;
  body?: string;
  features?: string[];
  glow?: boolean;
  scale?: number;
}

const D = (base: string, accent: string, pattern: Pattern = "plain", extra: Partial<Design> = {}): Design => ({ base, accent, pattern, ...extra });

/** 이름으로 찾는 실제 물고기 특징. 여기에 없는 종은 아래 기본 팔레트를 쓴다 */
const DESIGN: Record<string, Design> = {
  // 공통
  붕어: D("#c9a24a", "#a8802f", "plain", { belly: "#f2e0a8", body: "carp" }),
  잉어: D("#f0873a", "#ffffff", "patches", { belly: "#fff0d6", body: "carp", features: ["whiskers"] }),
  피라미: D("#8fb8d8", "#ff7a4a", "sidestripe", { belly: "#f4f8ff", body: "slim" }),
  송사리: D("#bfe0a8", "#ffd84a", "plain", { belly: "#f6ffe8", body: "round", scale: 0.8 }),
  미꾸라지: D("#b89a6a", "#7a5a3a", "freckles", { belly: "#e8d8b0", body: "ribbon", features: ["whiskers"] }),
  메기: D("#6a6a78", "#3a3a48", "mottled", { belly: "#c8c8d4", body: "catfish", features: ["whiskers"] }),
  가물치: D("#7a6a3a", "#3a2a18", "mottled", { belly: "#d8c890", body: "snakehead" }),
  블루길: D("#5a8a6a", "#2a4a6a", "bands", { belly: "#ffa860", body: "round" }),
  배스: D("#7ab06a", "#2f4a2a", "sidestripe", { belly: "#eef4d8", body: "bass" }),
  숭어: D("#9ab4c4", "#6a8090", "plain", { belly: "#f6fafc", body: "slim" }),
  장어: D("#4a3f3a", "#2a2420", "plain", { belly: "#d8c8a8", body: "ribbon" }),
  망둥어: D("#b8a078", "#6a4a30", "spots", { belly: "#f0e4c4", body: "round", scale: 0.85 }),
  가자미: D("#a88a62", "#6a5238", "mottled", { belly: "#f0e4cc", body: "flat" }),
  복어: D("#e8c860", "#3a3a3a", "spots", { belly: "#fff6d8", body: "puffer" }),
  농어: D("#aab8c4", "#5a6a78", "plain", { belly: "#f6f8fa", body: "bass" }),
  학공치: D("#b8d8e8", "#e84a3a", "plain", { belly: "#f6fbff", body: "slim", features: ["bill"] }),
  쥐치: D("#a09078", "#6a5a40", "mottled", { belly: "#e8dcc0", body: "round" }),
  보리멸: D("#e8d8b0", "#b09870", "plain", { belly: "#fff8e8", body: "slim" }),
  베도라치: D("#8a7a4a", "#5a4a2a", "freckles", { belly: "#d8cc9a", body: "ribbon", scale: 0.8 }),
  노래미: D("#a88a4a", "#e8c060", "mottled", { belly: "#f0dca0", body: "round" }),
  // 호수
  쏘가리: D("#c8a860", "#6a4a20", "spots", { belly: "#f6ecc8", body: "bass" }),
  꺽지: D("#7a7048", "#3a3018", "bands", { belly: "#d8d0a0", body: "bass" }),
  열목어: D("#9ab0a0", "#c04a48", "spots", { belly: "#f0f4ec", body: "slim" }),
  산천어: D("#a0b8a8", "#486a58", "parr", { belly: "#f4f6f0", body: "slim" }),
  무지개송어: D("#9ab4a8", "#f06a8a", "sidestripe", { belly: "#f6f8f4", body: "slim", features: ["dots"] }),
  철갑상어: D("#6a7a8a", "#4a5a68", "plain", { belly: "#d8dde2", body: "shark", features: ["bumps"] }),
  황금잉어: D("#ffc83a", "#ff9a2a", "plain", { belly: "#fff2c0", body: "carp", features: ["whiskers"] }),
  금붕어: D("#ff7a3a", "#ff4a3a", "plain", { belly: "#ffd0a0", body: "round", features: ["bigtail"] }),
  달빛잉어: D("#bcd0ff", "#ffffff", "patches", { belly: "#f0f4ff", body: "carp", features: ["whiskers"], glow: true }),
  진주붕어: D("#f4eef8", "#ffd0f0", "plain", { belly: "#ffffff", body: "carp", glow: true }),
  호수의수호어: D("#4a78c8", "#ffd84a", "plain", { belly: "#e8f2ff", body: "whale", features: ["bumps"] }),
  용잉어: D("#2fa89a", "#ffd84a", "patches", { belly: "#e8fff4", body: "ribbon", features: ["whiskers", "horn", "bumps"], glow: true }),
  안개의여왕어: D("#c8c0f0", "#ffffff", "plain", { belly: "#f6f4ff", body: "slim", features: ["bigtail"], glow: true }),
  심연의가물치: D("#3a3a58", "#8a8aff", "mottled", { belly: "#8a8ab8", body: "snakehead", glow: true }),
  은빛메기: D("#c8ccd8", "#8890a0", "mottled", { belly: "#f4f6fa", body: "catfish", features: ["whiskers"], glow: true }),
  // 부두
  광어: D("#9a7a52", "#5a4228", "mottled", { belly: "#f0e4cc", body: "flat" }),
  도다리: D("#a88a62", "#6a5238", "mottled", { belly: "#f0e4cc", body: "flat" }),
  우럭: D("#8a6a4a", "#4a3020", "mottled", { belly: "#e8d8c0", body: "bass" }),
  놀래기: D("#4aa88a", "#ffb040", "stripes", { belly: "#e8fff0", body: "round" }),
  감성돔: D("#4a5060", "#8890a0", "plain", { belly: "#c8ccd4", body: "carp" }),
  참돔: D("#f0707a", "#4ac8ff", "freckles", { belly: "#ffe0e0", body: "carp" }),
  돌돔: D("#c8d0d8", "#2a2a30", "bands", { belly: "#f4f6f8", body: "round" }),
  볼락: D("#b8503a", "#6a2a20", "mottled", { belly: "#f0c0a8", body: "round", scale: 0.9 }),
  갈치: D("#d8e0e8", "#9ab0c8", "plain", { belly: "#ffffff", body: "ribbon", scale: 1.45, features: ["curvy"] }),
  고등어: D("#2f7a8a", "#1a3a4a", "mackerel", { belly: "#f0f4f6", body: "slim" }),
  전갱이: D("#7a9ab0", "#ffd84a", "sidestripe", { belly: "#f6fafc", body: "slim" }),
  삼치: D("#5a8aa8", "#3a6a88", "spots", { belly: "#f0f6fa", body: "slim" }),
  방어: D("#4a7aa8", "#ffd84a", "sidestripe", { belly: "#f4f8fc", body: "bass" }),
  부시리: D("#5a88a8", "#ffd84a", "sidestripe", { belly: "#f4f8fc", body: "bass" }),
  한치: D("#f0c8b8", "#c8645a", "freckles", { belly: "#fff0e8", body: "squid", scale: 1.35 }),
  오징어: D("#f0c8b8", "#c8645a", "freckles", { belly: "#fff0e8", body: "squid", scale: 1.35 }),
  갑오징어: D("#d8b8a0", "#6a4a38", "stripes", { belly: "#f6e8d8", body: "squid", scale: 1.35 }),
  문어: D("#d8604a", "#f6c8b8", "freckles", { body: "octopus" }),
  대왕문어: D("#e0643a", "#ffe6b0", "freckles", { body: "octopus", glow: true, scale: 1.5 }),
  가오리: D("#8a98a8", "#4a5868", "spots", { belly: "#ffffff", body: "ray" }),
  까치상어: D("#5a6a7a", "#ffffff", "spots", { belly: "#f4f6f8", body: "shark" }),
  아귀: D("#8a6a4a", "#4a3020", "mottled", { belly: "#d8c8a8", body: "round", features: ["lure", "bigmouth"], scale: 1.1 }),
  황새치: D("#4a78c8", "#2a4a98", "plain", { belly: "#e8f0ff", body: "slim", features: ["bill"] }),
  청새치: D("#3a78d8", "#2a58b8", "stripes", { belly: "#e8f2ff", body: "slim", features: ["bill"] }),
  참치: D("#2a58a8", "#ffd84a", "plain", { belly: "#e8f0f8", body: "bass" }),
  형광오징어: D("#5ae8d8", "#ffffff", "freckles", { belly: "#d8fff8", body: "squid", scale: 1.35, glow: true }),
  달빛갈치: D("#e8f0ff", "#9ab0ff", "plain", { belly: "#ffffff", body: "ribbon", glow: true, scale: 1.45, features: ["curvy"] }),
  리바이어던: D("#2a6a8a", "#ffd84a", "plain", { belly: "#d8f0f4", body: "whale", features: ["bumps"], glow: true }),
  크라켄: D("#2a3a6a", "#5affd0", "mottled", { body: "octopus", glow: true, scale: 1.8 }),
  // 겨울 호수
  빙어: D("#d8ecf6", "#a8d0e8", "plain", { belly: "#ffffff", body: "slim", scale: 0.85 }),
  송어: D("#9ab0a8", "#f08090", "sidestripe", { belly: "#f6f8f4", body: "slim" }),
  열빙어: D("#c8d8e4", "#8aa0b0", "plain", { belly: "#f6fafc", body: "slim", scale: 0.85 }),
  대구: D("#8a8a60", "#4a4a30", "spots", { belly: "#f0eed8", body: "bass", features: ["chinbarbel"] }),
  명태: D("#a8987a", "#6a5a3a", "plain", { belly: "#f0e8d0", body: "slim" }),
  연어: D("#a8b8c8", "#e86a6a", "freckles", { belly: "#f4f6f8", body: "slim" }),
  북극곤들매기: D("#7a98a8", "#ffa070", "spots", { belly: "#ffe0d0", body: "slim" }),
  곤들매기: D("#8aa098", "#f0d8c0", "spots", { belly: "#f6f4ee", body: "slim" }),
  강꼬치고기: D("#5a7a48", "#c8d890", "spots", { belly: "#eef2d8", body: "bass", features: ["bill"] }),
  눈꽃가오리: D("#bfe4ff", "#ffffff", "spots", { belly: "#ffffff", body: "ray", glow: true }),
  서리복어: D("#bfd8f0", "#6a98c8", "spots", { belly: "#ffffff", body: "puffer" }),
  오로라연어: D("#5ae8b8", "#c88aff", "stripes", { belly: "#e8fff4", body: "slim", glow: true }),
  고드름물고기: D("#d8f4ff", "#8ad0f0", "plain", { belly: "#ffffff", body: "ribbon", glow: true }),
  그린란드상어: D("#7a8a9a", "#aab8c8", "plain", { belly: "#e8eef4", body: "shark" }),
  빙하고래: D("#a8d0f0", "#ffffff", "plain", { belly: "#ffffff", body: "whale", glow: true }),
  프로스트드래곤피쉬: D("#8ad0ff", "#ffffff", "plain", { belly: "#e8f6ff", body: "ribbon", features: ["horn", "bumps"], glow: true, scale: 1.2 }),
  눈의여왕대구: D("#e8f4ff", "#8ad0f0", "spots", { belly: "#ffffff", body: "bass", features: ["bumps", "chinbarbel"], glow: true }),
  북극광철갑상어: D("#6ae8c8", "#a88aff", "stripes", { belly: "#e8fff8", body: "shark", features: ["bumps"], glow: true }),
  // 직접 색을 정하지 않았던 종(실제 색에 맞춘다)
  누치: D("#c4b89a", "#6a5a40", "plain", { belly: "#f4ecd8", body: "carp", features: ["whiskers"] }),
  끄리: D("#b8c8d0", "#6a8090", "plain", { belly: "#f4f8fa", body: "slim" }),
  모래무지: D("#d8c89a", "#6a5a3a", "spots", { belly: "#f4ecd0", body: "slim", scale: 0.9, features: ["whiskers"] }),
  참마자: D("#b0b8a8", "#7a8a70", "plain", { belly: "#f4f4ec", body: "carp" }),
  갈겨니: D("#9ab0b8", "#ff8a40", "sidestripe", { belly: "#f6f8f8", body: "slim", scale: 0.8 }),
  버들치: D("#8a8a5a", "#3a3a22", "mottled", { belly: "#e8e4c8", body: "slim", scale: 0.8 }),
  향어: D("#8a7a4a", "#c8b070", "freckles", { belly: "#e8d8a0", body: "carp" }),
  초어: D("#7a8a5a", "#4a5a34", "plain", { belly: "#e8ecd0", body: "carp" }),
  백련어: D("#c8d0d8", "#8a98a8", "plain", { belly: "#ffffff", body: "carp" }),
  납자루: D("#b8c0c8", "#3aa8c8", "sidestripe", { belly: "#f4f8ff", body: "round", scale: 0.8 }),
  돌고기: D("#a8a890", "#4a4a3a", "plain", { belly: "#eceadc", body: "slim", scale: 0.85 }),
  쉬리: D("#a8b8a0", "#d88a3a", "sidestripe", { belly: "#f4f6ec", body: "slim", scale: 0.85 }),
  퉁가리: D("#7a6a4a", "#d8b04a", "bands", { belly: "#e8d8a0", body: "catfish", scale: 0.8, features: ["whiskers"] }),
  가시고기: D("#8a9a6a", "#d84a3a", "plain", { belly: "#f6e8d8", body: "round", scale: 0.75 }),
  동사리: D("#6a5a3a", "#2a2418", "mottled", { belly: "#c8b890", body: "catfish" }),
  쥐노래미: D("#8a7a4a", "#4a3a20", "mottled", { belly: "#d8cc9a", body: "round" }),
  레이크송어: D("#7a8a80", "#e8e4d0", "spots", { belly: "#f2f2e8", body: "slim" }),
  북극송어: D("#6a8a98", "#f08a50", "spots", { belly: "#ff9a60", body: "slim" }),
  흰송어: D("#c0c8d0", "#8a98a8", "plain", { belly: "#ffffff", body: "slim" }),
  얼음붕어: D("#b8c0a8", "#7a8a68", "plain", { belly: "#f0f2e0", body: "carp" }),
  빙하메기: D("#8aa0b0", "#5a7080", "mottled", { belly: "#d8e4ee", body: "catfish", features: ["whiskers"] }),
  설원잉어: D("#e8e4d8", "#f0a060", "patches", { belly: "#ffffff", body: "carp", features: ["whiskers"] }),
  얼음장어: D("#6a7a88", "#3a4858", "plain", { belly: "#c8d4dc", body: "ribbon" }),
  북극가자미: D("#8a96a0", "#4a5a68", "mottled", { belly: "#e8eef2", body: "flat" }),
  얼음도다리: D("#b0b8bc", "#6a7880", "mottled", { belly: "#eef2f4", body: "flat" }),
  남극빙어: D("#e0f0f8", "#a8d0e8", "plain", { belly: "#ffffff", body: "slim", scale: 0.85 }),
  한파대구: D("#8a9078", "#4a5040", "spots", { belly: "#eceee0", body: "bass", features: ["chinbarbel"] }),
  하얀유령어: D("#f4f8ff", "#cfe4ff", "plain", { belly: "#ffffff", body: "slim", glow: true }),
};

// 이름이 없는 종은 선명한 기본 색 조합에서 고른다 (등 색, 포인트 색)
const PALETTE: Array<[string, string]> = [
  ["#3fb6e8", "#ffd84a"], ["#ff8a5c", "#fff1b8"], ["#7bd88f", "#2e8f6a"], ["#b58cf0", "#ffd0f0"],
  ["#ffb347", "#e8503a"], ["#5f8df0", "#bfe3ff"], ["#f06fa0", "#ffd1e1"], ["#4fc3b0", "#f4f1a0"],
];
const PATTERN_OF: Record<string, Pattern> = { plain: "plain", stripes: "stripes", spots: "spots", gradient: "plain", scales: "freckles" };

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function designOf(sp: FishSpecies): Design {
  const known = DESIGN[sp.name];
  if (known) return known;
  const [base, accent] = PALETTE[hash(sp.id) % PALETTE.length];
  return { base, accent, pattern: PATTERN_OF[sp.features[1]] ?? "plain", glow: sp.rarity === "legendary" };
}

export function speciesPattern(sp: FishSpecies): Pattern {
  return designOf(sp).pattern ?? "plain";
}

/** 채도를 올려 장난감처럼 선명하게 */
const boost = (c: THREE.Color, sat = 1.25) => {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, Math.min(1, hsl.s * sat + 0.05), Math.min(0.88, hsl.l * 0.96));
};

export function speciesColors(sp: FishSpecies) {
  const d = designOf(sp);
  const base = boost(new THREE.Color(d.base));
  const accent = boost(new THREE.Color(d.accent), 1.15);
  const belly = d.belly ? new THREE.Color(d.belly) : base.clone().lerp(new THREE.Color("#ffffff"), 0.72);
  return { base, belly, accent };
}

/** 등은 약간 어둡고 배는 밝은 부드러운 색 + 종마다 다른 큼직한 무늬 */
function paintTexture(sp: FishSpecies, d: Design) {
  const W = 1024, H = 512, HALF = W / 2;
  const { base, belly, accent } = speciesColors(sp);
  const hex = (c: THREE.Color) => `#${c.getHexString()}`;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, hex(base.clone().multiplyScalar(0.86)));
  grad.addColorStop(0.35, hex(base));
  grad.addColorStop(0.62, hex(base));
  grad.addColorStop(0.9, hex(belly));
  grad.addColorStop(1, hex(belly));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const seed = hash(sp.id);
  const rnd = (i: number) => (((Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453) % 1) + 1) % 1;
  const pattern = d.pattern ?? "plain";
  const acc = hex(accent);
  const dark = hex(base.clone().multiplyScalar(0.55));

  // 왼쪽 절반은 +z 옆면(꼬리→머리), 오른쪽 절반은 -z 옆면(머리→꼬리)
  const side = (x0: number, dir: 1 | -1) => {
    const X = (u: number) => x0 + (dir === 1 ? u : 1 - u) * HALF;
    g.save();
    g.beginPath();
    g.rect(x0, 0, HALF, H);
    g.clip();
    g.fillStyle = acc;
    g.strokeStyle = acc;
    const band = (uc: number, w: number, i: number) => {
      g.beginPath();
      for (let y = 0; y <= H; y += 16) g.lineTo(X(uc - w / 2 + Math.sin(y * 0.022 + i * 1.7) * 0.014), y);
      for (let y = H; y >= 0; y -= 16) g.lineTo(X(uc + w / 2 + Math.sin(y * 0.022 + i * 1.7 + 0.6) * 0.014), y);
      g.closePath();
      g.fill();
    };
    if (pattern === "stripes") for (let i = 0; i < 6; i++) band(0.16 + i * 0.12, 0.058, i);
    else if (pattern === "bands") for (let i = 0; i < 3; i++) band(0.22 + i * 0.22, 0.1, i);
    else if (pattern === "sidestripe") {
      g.globalAlpha = 0.92;
      g.beginPath();
      for (let u = 0.04; u <= 0.9; u += 0.04) g.lineTo(X(u), 222 + Math.sin(u * 9) * 5);
      for (let u = 0.9; u >= 0.04; u -= 0.04) g.lineTo(X(u), 282 + Math.sin(u * 9 + 1) * 5);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    } else if (pattern === "spots") {
      g.globalAlpha = 0.85;
      for (let i = 0; i < 16; i++) {
        g.beginPath();
        g.arc(X(0.14 + rnd(i) * 0.62), 70 + rnd(i + 30) * 260, 12 + rnd(i + 60) * 14, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    } else if (pattern === "freckles") {
      g.globalAlpha = 0.65;
      for (let i = 0; i < 80; i++) {
        g.beginPath();
        g.arc(X(0.1 + rnd(i) * 0.72), 60 + rnd(i + 90) * 250, 3 + rnd(i + 20) * 4, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    } else if (pattern === "mottled") {
      for (let i = 0; i < 46; i++) {
        g.globalAlpha = 0.28;
        g.fillStyle = i % 3 ? dark : acc;
        g.beginPath();
        g.ellipse(X(0.08 + rnd(i) * 0.76), 40 + rnd(i + 70) * 340, 14 + rnd(i + 10) * 26, 10 + rnd(i + 50) * 18, rnd(i) * 3, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    } else if (pattern === "patches") {
      // 잉어 같은 큼직한 얼룩무늬
      const blobs: Array<[number, number, number, string]> = [[0.22, 150, 74, acc], [0.5, 210, 86, "#ffffff"], [0.34, 330, 66, acc], [0.68, 130, 58, "#ffffff"], [0.7, 300, 70, acc]];
      for (const [u, y, r, col] of blobs) {
        g.fillStyle = col;
        g.globalAlpha = 0.92;
        g.beginPath();
        g.ellipse(X(u), y, r * 0.7, r * 0.9, 0.4, 0, 7);
        g.ellipse(X(u + 0.06), y + 20, r * 0.5, r * 0.6, 0.1, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    } else if (pattern === "mackerel") {
      g.globalAlpha = 0.85;
      g.lineWidth = 7;
      g.lineCap = "round";
      for (let k = 0; k < 11; k++) {
        g.beginPath();
        const y0 = 40 + k * 17;
        for (let u = 0.1; u <= 0.84; u += 0.04) g.lineTo(X(u), y0 + Math.sin(u * 28 + k) * 11);
        g.stroke();
      }
      g.globalAlpha = 1;
    } else if (pattern === "parr") {
      g.globalAlpha = 0.8;
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        g.ellipse(X(0.18 + i * 0.095), 245, 22, 46, 0, 0, 7);
        g.fill();
      }
      g.fillStyle = "#e84a4a";
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(X(0.23 + i * 0.095), 215, 7, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (d.features?.includes("dots")) {
      g.fillStyle = dark;
      g.globalAlpha = 0.5;
      for (let i = 0; i < 30; i++) {
        g.beginPath();
        g.arc(X(0.12 + rnd(i + 5) * 0.7), 60 + rnd(i + 40) * 150, 3.5, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.restore();
  };
  side(0, 1);
  side(HALF, -1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

interface BodyDef {
  /** x=몸 길이, y=높이, z=폭 */
  scale: [number, number, number];
  tail: number;
  dorsal: number;
}

const BODIES: Record<string, BodyDef> = {
  round: { scale: [0.85, 0.78, 0.6], tail: 0.34, dorsal: 0.3 },
  slim: { scale: [1.2, 0.64, 0.5], tail: 0.4, dorsal: 0.26 },
  eel: { scale: [2.0, 0.38, 0.38], tail: 0.26, dorsal: 0.16 },
  flat: { scale: [1.0, 0.2, 0.78], tail: 0.28, dorsal: 0 },
  puffer: { scale: [0.8, 0.8, 0.8], tail: 0.24, dorsal: 0.14 },
  shark: { scale: [1.5, 0.64, 0.56], tail: 0.55, dorsal: 0.5 },
  ray: { scale: [1.0, 0.12, 1.0], tail: 0, dorsal: 0 },
  squid: { scale: [0.9, 0.42, 0.42], tail: 0, dorsal: 0 },
  octopus: { scale: [0.7, 0.62, 0.62], tail: 0, dorsal: 0 },
  ribbon: { scale: [3.4, 0.2, 0.1], tail: 0, dorsal: 0 },
  catfish: { scale: [1.05, 0.56, 0.56], tail: 0.36, dorsal: 0.16 },
  snakehead: { scale: [1.9, 0.5, 0.5], tail: 0.32, dorsal: 0.14 },
  carp: { scale: [1.05, 0.7, 0.5], tail: 0.4, dorsal: 0.34 },
  bass: { scale: [1.1, 0.64, 0.48], tail: 0.4, dorsal: 0.32 },
  whale: { scale: [2.3, 1.05, 1.0], tail: 0.85, dorsal: 0.4 },
};

/** 전설 물고기를 만드는 동안만 켜지는 고품질 표현(두께·곡률 있는 지느러미, 홍채 눈, 비늘 요철) */
let HQ = false;

let rayTex: THREE.CanvasTexture | null = null;
/** 지느러미 살(뼈대)처럼 중심에서 퍼져 나가는 가는 줄무늬 */
function rayMap() {
  if (!rayTex) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 8;
    const x = c.getContext("2d")!;
    x.fillStyle = "#c8c8c8"; x.fillRect(0, 0, 128, 8);
    for (let i = 0; i < 128; i += 8) {
      const g = x.createLinearGradient(i, 0, i + 8, 0);
      g.addColorStop(0, "#d8d8d8"); g.addColorStop(0.5, "#6a6a6a"); g.addColorStop(1, "#d8d8d8");
      x.fillStyle = g; x.fillRect(i, 0, 8, 8);
    }
    rayTex = new THREE.CanvasTexture(c);
    rayTex.wrapS = rayTex.wrapT = THREE.RepeatWrapping;
  }
  return rayTex;
}

let scaleTex: THREE.CanvasTexture | null = null;
/** 비늘 한 장 한 장이 살짝 솟은 느낌을 주는 표면 요철 */
export function scaleMap() {
  if (!scaleTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#555"; x.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 8; col++) {
      const cx = col * 16 + (row % 2 ? 8 : 0), cy = row * 16;
      const g = x.createRadialGradient(cx, cy - 2, 1, cx, cy, 11);
      g.addColorStop(0, "#fff"); g.addColorStop(0.7, "#aaa"); g.addColorStop(1, "#444");
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.fill();
    }
    scaleTex = new THREE.CanvasTexture(c);
    scaleTex.wrapS = scaleTex.wrapT = THREE.RepeatWrapping;
    scaleTex.repeat.set(5, 3);
  }
  return scaleTex;
}

/** 두툼하고 곡률이 있는 지느러미: 뿌리에서 끝으로 갈수록 밝아지고, 가장자리가 물결치며, 살 줄무늬가 퍼진다 */
export function softFin(shape: THREE.Shape, mat: THREE.Material, depth = 0.05) {
  if (!HQ) {
    const g0 = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 5, curveSegments: 20 });
    g0.translate(0, 0, -depth / 2);
    const m0 = new THREE.Mesh(g0, mat);
    m0.castShadow = true;
    return m0;
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 6, curveSegments: 24 });
  geo.translate(0, 0, -depth / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  let maxR = 1e-3;
  for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getY(i)));
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const r = Math.hypot(x, y), t = r / maxR, ang = Math.atan2(y, x);
    // 부드럽게 말린 곡률과 가장자리의 잔물결
    pos.setZ(i, pos.getZ(i) + 0.07 * maxR * t * t + 0.012 * maxR * t * Math.sin(ang * 14));
    uv.setXY(i, ang * 4.5, t);
    const shade = 0.72 + 0.4 * t;
    col[i * 3] = shade; col[i * 3 + 1] = shade; col[i * 3 + 2] = shade;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const fm = (mat as THREE.MeshPhysicalMaterial).clone();
  fm.vertexColors = true;
  fm.bumpMap = rayMap();
  fm.bumpScale = 0.5;
  const m = new THREE.Mesh(geo, fm);
  m.castShadow = true;
  return m;
}

type TailStyle = "fan" | "fork" | "crescent" | "round" | "ribbon";

/** 꼬리 모양: 부채형, 갈라진 형, 초승달형, 둥근 노형, 가는 리본형 */
export function tailFin(len: number, mat: THREE.Material, style: TailStyle = "fan") {
  const sh = new THREE.Shape();
  if (style === "fork") {
    sh.moveTo(0.04, 0);
    sh.bezierCurveTo(-len * 0.2, len * 0.3, -len * 0.6, len * 0.8, -len * 1.0, len * 0.78);
    sh.bezierCurveTo(-len * 1.1, len * 0.62, -len * 0.9, len * 0.3, -len * 0.62, 0);
    sh.bezierCurveTo(-len * 0.9, -len * 0.3, -len * 1.1, -len * 0.62, -len * 1.0, -len * 0.78);
    sh.bezierCurveTo(-len * 0.6, -len * 0.8, -len * 0.2, -len * 0.3, 0.04, 0);
  } else if (style === "crescent") {
    sh.moveTo(0.04, 0);
    sh.bezierCurveTo(-len * 0.1, len * 0.4, -len * 0.5, len * 1.05, -len * 1.1, len * 1.0);
    sh.bezierCurveTo(-len * 1.05, len * 0.7, -len * 0.7, len * 0.25, -len * 0.55, 0);
    sh.bezierCurveTo(-len * 0.7, -len * 0.25, -len * 1.05, -len * 0.7, -len * 1.1, -len * 1.0);
    sh.bezierCurveTo(-len * 0.5, -len * 1.05, -len * 0.1, -len * 0.4, 0.04, 0);
  } else if (style === "round") {
    sh.moveTo(0.04, 0);
    sh.bezierCurveTo(-len * 0.1, len * 0.55, -len * 0.9, len * 0.6, -len * 0.95, 0);
    sh.bezierCurveTo(-len * 0.9, -len * 0.6, -len * 0.1, -len * 0.55, 0.04, 0);
  } else if (style === "ribbon") {
    sh.moveTo(0.04, 0);
    sh.bezierCurveTo(-len * 0.3, len * 0.28, -len * 0.9, len * 0.22, -len * 1.2, 0);
    sh.bezierCurveTo(-len * 0.9, -len * 0.22, -len * 0.3, -len * 0.28, 0.04, 0);
  } else {
    sh.moveTo(0.04, 0);
    sh.bezierCurveTo(-len * 0.15, len * 0.3, -len * 0.55, len * 0.85, -len * 0.95, len * 0.62);
    sh.bezierCurveTo(-len * 1.12, len * 0.42, -len * 0.95, len * 0.12, -len * 0.76, 0);
    sh.bezierCurveTo(-len * 0.95, -len * 0.12, -len * 1.12, -len * 0.42, -len * 0.95, -len * 0.62);
    sh.bezierCurveTo(-len * 0.55, -len * 0.85, -len * 0.15, -len * 0.3, 0.04, 0);
  }
  return softFin(sh, mat);
}

export function dorsalFin(w: number, h: number, mat: THREE.Material) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(w * 0.05, h * 0.9, w * 0.4, h * 1.25, w * 0.7, h * 0.75);
  sh.bezierCurveTo(w * 0.88, h * 0.4, w * 0.96, h * 0.15, w, 0);
  sh.closePath();
  return softFin(sh, mat);
}

export function sideFin(len: number, mat: THREE.Material) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(-len * 0.2, len * 0.55, -len * 0.8, len * 0.6, -len, len * 0.15);
  sh.bezierCurveTo(-len * 0.75, -len * 0.1, -len * 0.3, -len * 0.15, 0, 0);
  return softFin(sh, mat, 0.04);
}

/** 머리(+x)는 둥글고 꼬리(-x)로 갈수록 가늘어지는 통통한 몸통 */
/** 몸 중심선을 원호로 휘게 하는 변환. kappa는 곡률(클수록 더 휘어짐) */
interface Bend {
  map(x: number, y: number, z: number): THREE.Vector3;
  /** 그 위치에서 몸이 기울어진 각도 (지느러미, 꼬리를 같이 돌리는 데 쓴다) */
  ang(x: number): number;
}
const noBend: Bend = { map: (x, y, z) => new THREE.Vector3(x, y, z), ang: () => 0 };
const arcBend = (kappa: number): Bend => ({
  map: (x, y, z) => {
    const th = kappa * x;
    return new THREE.Vector3(Math.sin(th) / kappa - y * Math.sin(th), (1 - Math.cos(th)) / kappa + y * Math.cos(th), z);
  },
  ang: (x) => kappa * x,
});

function bodyGeometry(sx: number, sy: number, sz: number, taper: number, bend: Bend = noBend) {
  const geo = new THREE.SphereGeometry(0.5, 56, 40);
  const pos = geo.attributes.position;
  // 긴 몸일수록 머리 끝을 더 짧고 둥글게 마무리한다 (뾰족한 부리처럼 보이지 않게)
  const cap = Math.min(0.22, Math.max(0.07, (sy * 0.6) / sx));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * 2;
    const t = (x + 1) / 2;
    const sine = Math.sin((Math.min(t, 1 - cap) / (1 - cap)) * Math.PI * 0.5);
    const profile = t > 1 - cap ? Math.sqrt(Math.max(0, 1 - ((t - (1 - cap)) / cap) ** 2)) : Math.pow(sine, 0.5) * (1 - taper) + taper * sine;
    const r = Math.max(0.16, profile);
    const o = bend.map(pos.getX(i) * sx, pos.getY(i) * sy * r * 1.08, pos.getZ(i) * sz * r * 1.08);
    pos.setXYZ(i, o.x, o.y, o.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** 몸 단면을 직접 정하는 몸통: maxAt에서 가장 굵고, 머리 쪽(pointed면 뾰족, 아니면 둥글게)과 꼬리 쪽으로 가늘어진다 */
export function profileBody(sx: number, sy: number, sz: number, maxAt: number, pointed: boolean, tailExp: number) {
  const geo = new THREE.SphereGeometry(0.5, 64, 44);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getX(i) + 0.5; // 0=꼬리 끝, 1=머리 끝
    let r: number;
    if (t >= maxAt) {
      const u = (t - maxAt) / (1 - maxAt);
      r = pointed ? Math.pow(Math.max(0, 1 - u), 0.85) * (1 - 0.15 * u * u) + 0.0 : Math.sqrt(Math.max(0, 1 - u * u));
    } else {
      r = Math.pow(Math.sin((t / maxAt) * Math.PI * 0.5), tailExp);
    }
    r = Math.max(0.05, r);
    // 구의 단면 반지름(0.5*sqrt(1-4x²))으로 나눠 단위 원으로 만든 뒤, 원하는 굵기 r을 곱한다
    const unit = Math.max(1e-3, 0.5 * Math.sqrt(Math.max(0, 1 - (pos.getX(i) * 2) ** 2)));
    pos.setXYZ(i, pos.getX(i) * sx, (pos.getY(i) / unit) * 0.5 * sy * r, (pos.getZ(i) / unit) * 0.5 * sz * r);
  }
  geo.computeVertexNormals();
  return geo;
}

/** 끝이 둥글게 가늘어지는 다리/수염 */
export function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, taper = 0.7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = 20, radial = 12;
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const pos = geo.attributes.position;
  const ring = radial + 1;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / ring) / segs;
    const c = curve.getPointAt(Math.min(1, t));
    const k = 1 - taper * Math.pow(t, 1.2);
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(radius * (1 - taper) + 0.005, 10, 8), mat);
  tip.position.copy(points[points.length - 1]);
  const g = new THREE.Group();
  g.add(m, tip);
  return g;
}


/** 전설 물고기 크기와 특징 (종마다 완전히 다른 모습) */
const LEGEND_SCALE: Record<string, number> = {
  안개의여왕어: 2.3, 호수의수호어: 3.4, 용잉어: 2.9, 대왕문어: 2.6, 리바이어던: 4.2,
  크라켄: 3.2, 빙하고래: 3.8, 프로스트드래곤피쉬: 2.9, 눈의여왕대구: 2.5, 북극광철갑상어: 3.1,
};
const LEGEND_FEATS: Record<string, string[]> = { 용잉어: ["dragon"], 프로스트드래곤피쉬: ["dragon"] };

export type Anim = Array<(t: number) => void>;

/** 몸을 감싸며 가장자리가 빛나는 후광 껍질 */
export function auraShell(geo: THREE.BufferGeometry, color: THREE.Color) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color } },
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uColor * f * 0.9, f * 0.5); }",
  });
  const shellMesh = new THREE.Mesh(geo, mat);
  shellMesh.name = "fx";
  return shellMesh;
}

/** 물결치듯 흔들리는 반투명 천 지느러미. 원점에서 -x 방향으로 펼쳐진다 */
export function veil(len: number, wid: number, color: THREE.Color, opacity: number, anim: Anim, phase = 0) {
  const geo = new THREE.PlaneGeometry(len, wid, 30, 8);
  geo.translate(-len / 2, 0, 0);
  const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  anim.push((t) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      const k = Math.min(1, -x / len);
      pos.setXYZ(i, x, y * (1 + 0.3 * Math.sin(k * Math.PI)) * (1 - 0.6 * k) + Math.sin(k * 5 - t * 2.4 + phase) * 0.08 * wid * k, Math.sin(k * 7 - t * 3 + phase) * 0.16 * len * k);
    }
    pos.needsUpdate = true;
  });
  return m;
}

/** 얼음/수정 조각 (모서리를 둥글린 반투명 막대) */
export function crystal(h: number, r: number, color: THREE.Color, glowColor: THREE.Color) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 3, 6), new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.78, emissive: glowColor, emissiveIntensity: 0.55, clearcoat: 1 }));
  return m;
}

export function sparkField(g: THREE.Group, anim: Anim, color: THREE.Color, count: number, rx: number, ry: number) {
  const group = new THREE.Group();
  group.name = "fx"; // 2D 그림을 찍을 때 빼는 꾸밈
  for (let i = 0; i < count; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.025 + (i % 4) * 0.012, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    s.userData.phase = (i / count) * Math.PI * 2;
    s.userData.speed = 0.6 + (i % 5) * 0.25;
    group.add(s);
  }
  g.add(group);
  anim.push((t) => {
    group.children.forEach((c, i) => {
      const a = (c.userData.phase as number) + t * (c.userData.speed as number) * 0.7;
      c.position.set(Math.cos(a) * rx, Math.sin(a * 1.3 + i) * ry, Math.sin(a) * ry * 1.1);
      c.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(t * 2 + i)));
    });
  });
}

/** 몸 둘레를 도는 빛나는 룬 고리 */
function runeRing(g: THREE.Group, anim: Anim, color: THREE.Color, x: number, radius: number, speed: number, beads = 6) {
  const wrap = new THREE.Group();
  wrap.name = "fx";
  wrap.position.x = x;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.022, 8, 72), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.y = Math.PI / 2;
  wrap.add(ring);
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    b.position.set(0, Math.cos(a) * radius, Math.sin(a) * radius);
    wrap.add(b);
  }
  g.add(wrap);
  anim.push((t) => { wrap.rotation.x = t * speed; });
}

interface FlairCtx {
  bend: Bend; hp: THREE.Vector3; ribbon: RibbonInfo | null;
  g: THREE.Group; sp: FishSpecies; bodyKind: string; sx: number; sy: number; sz: number;
  base: THREE.Color; accent: THREE.Color; finMat: THREE.Material; anim: Anim;
}

function legendaryFlair(c: FlairCtx) {
  const { g, sp, bodyKind, sx, sy, sz, base, accent, anim, bend } = c;
  // 머리가 휘어진 몸을 따라 움직인 만큼 머리 장식도 같이 옮긴다
  const head = new THREE.Group();
  head.position.set(c.hp.x - sx * 0.45, c.hp.y, c.hp.z);
  g.add(head);
  const gold = new THREE.MeshPhysicalMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.4, clearcoat: 1 });
  const light = accent.clone().lerp(new THREE.Color("#ffffff"), 0.4);

  // 후광 껍질과 떠다니는 빛 알갱이
  if (bodyKind === "octopus") {
    const shell = auraShell(new THREE.SphereGeometry(0.5, 32, 24), accent);
    shell.scale.set(sx * 1.4, sy * 1.7, sz * 1.4);
    shell.position.set(-0.05, 0.25, 0);
    g.add(shell);
  } else if (!c.ribbon) {
    const shell = auraShell(new THREE.SphereGeometry(0.5, 40, 28), accent);
    shell.scale.set(sx * 1.18, sy * 1.5, sz * 1.5);
    g.add(shell);
  }
  sparkField(g, anim, accent, 26, Math.max(sx, 1.2) * 0.8, Math.max(sy, 0.6) * 1.2);

  const n = sp.name;
  if (n === "용잉어") {
    for (const s of [-1, 1]) {
      const main = [new THREE.Vector3(sx * 0.38, sy * 0.42, s * 0.1), new THREE.Vector3(sx * 0.34, sy * 0.95, s * 0.2), new THREE.Vector3(sx * 0.14, sy * 1.5, s * 0.26)];
      head.add(tube(main, 0.05, gold, 0.55));
      head.add(tube([main[1], new THREE.Vector3(sx * 0.5, sy * 1.25, s * 0.3), new THREE.Vector3(sx * 0.58, sy * 1.55, s * 0.34)], 0.032, gold, 0.5));
      head.add(tube([main[1], new THREE.Vector3(sx * 0.22, sy * 1.25, s * 0.14), new THREE.Vector3(sx * 0.2, sy * 1.7, s * 0.1)], 0.03, gold, 0.5));
      for (let i = 0; i < 2; i++) {
        head.add(tube([new THREE.Vector3(sx * 0.5, -sy * 0.05, s * 0.06), new THREE.Vector3(sx * 0.7, -sy * 0.2 - i * 0.1, s * (0.3 + i * 0.2)), new THREE.Vector3(sx * 0.35, -sy * 0.55 - i * 0.2, s * (0.6 + i * 0.3)), new THREE.Vector3(sx * 0.0, -sy * 0.9 - i * 0.2, s * (0.7 + i * 0.3))], 0.022, gold, 0.5));
      }
    }
        if (c.ribbon) {
      // 용: 몸 곡선을 따라 갈기가 이어진다
      for (const u of [0.86, 0.74, 0.62, 0.5, 0.38]) {
        const m2 = veil(c.ribbon.length * 0.12, c.ribbon.height(u) * 4.4, accent, 0.6, anim, u * 9);
        const P = c.ribbon.point(u), up = c.ribbon.up(u), tg = c.ribbon.tangent(u);
        m2.position.set(P.x + up.x * c.ribbon.height(u), P.y + up.y * c.ribbon.height(u), 0);
        m2.rotation.z = Math.atan2(tg.y, tg.x);
        g.add(m2);
      }
    } else {
      for (const fx of [0.3, -0.05, -0.4]) {
        const m2 = veil(sx * 0.4, sy * 1.1, accent, 0.6, anim, fx * 5);
        m2.position.copy(bend.map(sx * fx, sy * 0.5, 0));
        m2.rotation.z = bend.ang(sx * fx);
        g.add(m2);
      }
    }
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    pearl.position.set(sx * 0.95, 0, 0);
    head.add(pearl);
    head.add(auraShell(new THREE.SphereGeometry(0.2, 20, 16), light).translateX(sx * 0.95));
    anim.push((t) => { pearl.position.y = Math.sin(t * 2) * 0.1; });
  } else if (n === "안개의여왕어") {
    for (let i = 0; i < 3; i++) {
      const v = veil(sx * 1.5, sy * (1.8 - i * 0.3), i === 1 ? light : accent, 0.5, anim, i * 1.7);
      v.position.set(-sx * 0.46, 0, 0);
      v.rotation.x = (i - 1) * 0.5;
      g.add(v);
    }
    const dv = veil(sx * 0.9, sy * 1.1, accent, 0.5, anim, 2);
    dv.position.set(sx * 0.3, sy * 0.85, 0);
    g.add(dv);
    for (const s of [-1, 1]) {
      const pv = veil(sx * 0.7, sy * 1.2, light, 0.45, anim, s);
      pv.position.set(sx * 0.12, -sy * 0.1, s * sz * 0.45);
      pv.rotation.x = s * 1.2;
      g.add(pv);
    }
  } else if (n === "호수의수호어" || n === "리바이어던" || n === "빙하고래") {
    runeRing(g, anim, accent, sx * 0.08, sy * 1.7, 0.35);
    runeRing(g, anim, light, -sx * 0.15, sy * 2.15, -0.25, 8);
    if (n === "리바이어던") {
      for (let i = 0; i < 8; i++) {
        const sp2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.07 - i * 0.004, 0.45 - i * 0.03, 4, 8), gold);
        sp2.position.set(sx * (0.38 - i * 0.085), sy * 0.55, 0);
        sp2.rotation.z = -0.2;
        g.add(sp2);
      }
    }
    if (n === "빙하고래") {
      for (let i = 0; i < 10; i++) {
        const cr = crystal(0.35 + (i % 3) * 0.18, 0.07, base, accent);
        cr.position.set(sx * (0.36 - i * 0.07), sy * 0.52, ((i % 3) - 1) * 0.12);
        cr.rotation.set(((i % 3) - 1) * 0.4, 0, -0.15 + (i % 2) * 0.3);
        g.add(cr);
      }
    }
    for (let i = 0; i < 3; i++) {
      const rune = new THREE.Mesh(new THREE.TorusGeometry(sy * 0.52, 0.014, 6, 40), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
      rune.rotation.y = Math.PI / 2;
      rune.position.x = sx * (0.28 - i * 0.2);
      rune.scale.set(1, 1, 1.0);
      g.add(rune);
    }
  } else if (n === "프로스트드래곤피쉬") {
    for (let i = 0; i < 8; i++) {
      const cr = crystal(0.26 + (i % 3) * 0.1, 0.05, base, accent);
      cr.position.set(sx * (0.34 - i * 0.09), sy * 0.7 + Math.sin(i) * 0.1, 0);
      cr.rotation.z = -0.3;
      g.add(cr);
    }
    for (const s of [-1, 1]) {
      const wing = veil(sx * 0.55, sy * 3.4, accent, 0.55, anim, s * 2);
      wing.position.set(sx * 0.26, 0, s * sz * 0.5);
      wing.rotation.x = s * 1.35;
      g.add(wing);
    }
    // 차가운 숨결
    const breath = new THREE.Group();
    for (let i = 0; i < 12; i++) breath.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.8 })));
    breath.position.set(sx * 0.52, 0, 0);
    g.add(breath);
    anim.push((t) => breath.children.forEach((b, i) => {
      const u = ((t * 0.5 + i / 12) % 1);
      b.position.set(u * 1.4, Math.sin(i * 2.3) * 0.15 * u, Math.cos(i * 1.7) * 0.15 * u);
      b.scale.setScalar(0.4 + u * 2.2);
      ((b as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - u);
    }));
  } else if (n === "눈의여왕대구") {
    for (let i = 0; i < 2; i++) {
      const v = veil(sx * 1.2, sy * 1.6, light, 0.5, anim, i * 2);
      v.position.set(-sx * 0.46, 0, 0);
      v.rotation.x = (i - 0.5) * 0.9;
      g.add(v);
    }
    const flakes = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: accent, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, roughness: 0.2 }));
      f.position.set(0, Math.cos(a) * sy * 1.5, Math.sin(a) * sy * 1.5);
      f.rotation.z = Math.PI / 2;
      flakes.add(f);
    }
    flakes.position.x = sx * 0.3;
    g.add(flakes);
    anim.push((t) => { flakes.rotation.x = t * 0.7; flakes.children.forEach((f, i) => (f.rotation.y = t * 1.5 + i)); });
  } else if (n === "북극광철갑상어") {
    for (let i = 0; i < 2; i++) {
      const v = veil(sx * 0.9, sy * 1.5, i ? new THREE.Color("#b08aff") : new THREE.Color("#5affc0"), 0.55, anim, i * 2.5);
      v.position.set(-sx * 0.3, sy * 0.5, 0);
      v.rotation.x = (i - 0.5) * 1.2;
      g.add(v);
    }
    runeRing(g, anim, new THREE.Color("#5affc0"), sx * 0.15, sy * 1.5, 0.4);
  } else if (bodyKind === "octopus") {
    // 크라켄, 대왕문어: 빛나는 빨판 + 떠도는 빛 구슬
    const orbs = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: light }));
      o.userData.phase = (i / 6) * Math.PI * 2;
      orbs.add(o);
    }
    g.add(orbs);
    anim.push((t) => orbs.children.forEach((o, i) => {
      const a = (o.userData.phase as number) + t * 0.9;
      o.position.set(Math.cos(a) * 1.5, 0.9 + Math.sin(t * 1.5 + i) * 0.3, Math.sin(a) * 1.5);
    }));
    runeRing(g, anim, accent, 0, 1.2, 0.3, 8);
  }
}

interface RibbonInfo {
  length: number;
  /** u: 0=꼬리 끝, 1=머리 */
  point(u: number): THREE.Vector3;
  tangent(u: number): THREE.Vector3;
  /** 그 지점의 등(위쪽) 방향 */
  up(u: number): THREE.Vector3;
  height(u: number): number;
  width(u: number): number;
}

/**
 * 갈치처럼 아주 길고 납작한 생선: 큰 곡선을 그리며 휘어 감기고,
 * 꼬리는 채찍처럼 가늘어지고, 등 전체를 따라 지느러미가 이어진다.
 */
function buildRibbon(L: number, thick: number, skin: THREE.Material, finMat: THREE.Material, anim: Anim) {
  const k = L * 0.62;
  // 사진 속 갈치처럼 크게 한 바퀴 돌아 나오는 U자 곡선 (꼬리 → 머리)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.55 * k, -0.7 * k, 0),
    new THREE.Vector3(0.15 * k, -0.74 * k, 0),
    new THREE.Vector3(-0.45 * k, -0.62 * k, 0),
    new THREE.Vector3(-0.95 * k, -0.34 * k, 0),
    new THREE.Vector3(-1.12 * k, 0.02 * k, 0),
    new THREE.Vector3(-0.98 * k, 0.38 * k, 0),
    new THREE.Vector3(-0.5 * k, 0.58 * k, 0),
    new THREE.Vector3(0.1 * k, 0.56 * k, 0),
    new THREE.Vector3(0.65 * k, 0.4 * k, 0),
    new THREE.Vector3(1.1 * k, 0.34 * k, 0),
  ], false, "catmullrom", 0.5);
  const len = curve.getLength();
  const hMax = len * 0.036 * thick;
  const wMax = hMax * 0.62;
  const prof = (u: number) => {
    const body = u < 0.84 ? Math.pow(u / 0.84, 1.25) : Math.sqrt(Math.max(0, 1 - ((u - 0.84) / 0.16) ** 2));
    // 머리 뒤(어깨)에서 가장 굵고 꼬리 쪽은 길게 가늘어진다
    return Math.max(0.0035, body * (u > 0.5 ? 1 : 0.9 + 0.1 * Math.sin(u * 12)));
  };
  const hAt = (u: number) => hMax * prof(u);
  const wAt = (u: number) => wMax * prof(u);

  const N = 140, Mh = 12;
  const info: RibbonInfo = {
    length: len,
    point: (u) => curve.getPointAt(Math.min(1, Math.max(0, u))),
    tangent: (u) => curve.getTangentAt(Math.min(1, Math.max(0, u))),
    up: (u) => { const t = curve.getTangentAt(Math.min(1, Math.max(0, u))); return new THREE.Vector3(-t.y, t.x, 0).normalize(); },
    height: hAt,
    width: wAt,
  };

  // 단면이 타원인 관을 곡선을 따라 만든다. 왼쪽(+z) 옆면과 오른쪽(-z) 옆면을 따로 만들어 질감 배치에 맞춘다
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], index: number[] = [];
  let base = 0;
  for (const side of [1, -1] as const) {
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const P = info.point(u), Nn = info.up(u);
      const h = hAt(u), w = wAt(u);
      for (let j = 0; j <= Mh; j++) {
        const sFrac = (side === 1 ? 0 : 0.5) + (j / Mh) * 0.5;
        const phi = sFrac * Math.PI * 2;
        const c = Math.cos(phi), sn = Math.sin(phi);
        positions.push(P.x + Nn.x * h * c, P.y + Nn.y * h * c, w * sn);
        const nx = w * c * Nn.x, ny = w * c * Nn.y, nz = h * sn;
        const nl = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / nl, ny / nl, nz / nl);
        const v = side === 1 ? 1 - 2 * sFrac : 2 * sFrac - 1;
        uvs.push(side === 1 ? 0.5 * u : 0.5 + 0.5 * (1 - u), v);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < Mh; j++) {
      const a = base + i * (Mh + 1) + j, b = a + 1, c2 = a + (Mh + 1), d = c2 + 1;
      index.push(a, b, c2, b, d, c2);
    }
    base += (N + 1) * (Mh + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  const body = new THREE.Mesh(geo, skin);
  body.castShadow = true;

  const g = new THREE.Group();
  g.add(body);

  // 등 전체를 따라 이어진 지느러미 (등과 배)
  const finStrip = (fromU: number, toU: number, side: 1 | -1, heightK: number) => {
    const fp: number[] = [], fi: number[] = [];
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const u = fromU + ((toU - fromU) * i) / steps;
      const P = info.point(u), Nn = info.up(u);
      const h = hAt(u);
      const rise = h * heightK * (0.55 + 0.45 * Math.sin((i / steps) * Math.PI)) + 0.004;
      fp.push(P.x + Nn.x * h * 0.92 * side, P.y + Nn.y * h * 0.92 * side, 0, P.x + Nn.x * (h * 0.92 + rise) * side, P.y + Nn.y * (h * 0.92 + rise) * side, 0);
      if (i < steps) fi.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3));
    fg.setIndex(fi);
    fg.computeVertexNormals();
    const fm = new THREE.Mesh(fg, finMat);
    anim.push((t) => {
      const arr = fg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i <= steps; i++) {
        arr.setZ(i * 2 + 1, Math.sin(i * 0.28 - t * 6) * hMax * 0.18);
      }
      arr.needsUpdate = true;
    });
    return fm;
  };
  g.add(finStrip(0.1, 0.86, 1, 0.95));
  g.add(finStrip(0.3, 0.8, -1, 0.35));
  return { group: g, info };
}

/**
 * 3D 물고기. 길이 방향이 +x(머리)이고 몸길이는 대략 sx.
 * 둥글고 윤기 나는 몸, 종마다 다른 색과 무늬, 작은 검은 구슬 눈.
 */
/** 귀여운 눈: 크고 동그란 윤기 나는 눈에 큰 반사광과 작은 반사광, 아래쪽에 은은한 색. side=+1이면 +z쪽을 본다 */
export function makeEye(r: number, side: number, tint: THREE.Color, glowEye = false) {
  const eye = new THREE.Group();
  r *= 1.18;
  const dark = new THREE.MeshPhysicalMaterial({ color: glowEye ? tint.clone().multiplyScalar(0.35) : 0x1c1424, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, emissive: glowEye ? tint : new THREE.Color(0), emissiveIntensity: glowEye ? 0.9 : 0 });
  eye.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), dark));
  // 아래쪽에 비치는 은은한 색(눈이 촉촉해 보이게)
  const rim = new THREE.Mesh(new THREE.SphereGeometry(r * 1.004, 20, 12, 0, Math.PI * 2, 0.9, 0.9), new THREE.MeshPhysicalMaterial({ color: tint.clone().lerp(new THREE.Color("#ffffff"), 0.3), roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false }));
  rim.rotation.x = side * Math.PI / 2;
  rim.rotation.z = Math.PI;
  eye.add(rim);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const h1 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 12, 10), white);
  h1.position.set(r * 0.3, r * 0.34, side * r * 0.82);
  const h2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), white);
  h2.position.set(-r * 0.28, -r * 0.3, side * r * 0.88);
  eye.add(h1, h2);
  return eye;
}

export function buildFish(sp: FishSpecies): THREE.Group {
  HQ = sp.rarity === "legendary" || sp.rarity === "mythic"; // 전설·신화에만 고품질 표현을 쓴다
  const custom = CUSTOM_MODELS[sp.name];
  if (custom) return custom(sp);
  const g = new THREE.Group();
  const d = designOf(sp);
  const bodyKind = d.body ?? sp.body;
  const def = BODIES[bodyKind] ?? BODIES.round;
  const { base, accent } = speciesColors(sp);
  const none = new THREE.Color(0);
  const glow = !!d.glow || sp.rarity === "legendary";
  const tex = paintTexture(sp, d);
  const skin = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.18, emissive: glow ? accent : none, emissiveIntensity: glow ? 0.16 : 0 });
  if (sp.rarity === "legendary" && !["octopus", "squid", "ribbon", "ray"].includes(bodyKind)) { skin.bumpMap = scaleMap(); skin.bumpScale = 0.22; } // 비늘 요철
  const finColor = base.clone().lerp(accent, bodyKind === "squid" || bodyKind === "octopus" ? 0.1 : 0.45);
  const finMat = new THREE.MeshPhysicalMaterial({ color: finColor, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25, side: THREE.DoubleSide, emissive: glow ? accent : none, emissiveIntensity: glow ? 0.2 : 0 });
  const legend = sp.rarity === "legendary";
  const k = d.scale ?? LEGEND_SCALE[sp.name] ?? 1;
  let [sx, sy, sz] = def.scale;
  // 이름으로 직접 디자인한 종은 그 특징만 쓴다(무작위로 배정된 뿔·혹이 숭어 등에 붙지 않게)
  const designed = !!DESIGN[sp.name];
  const has = (f: string) => d.features?.includes(f) || (!designed && sp.features.includes(f)) || LEGEND_FEATS[sp.name]?.includes(f);
  const feat = new THREE.Group();
  const realShark = bodyKind === "shark" && sp.name.includes("상어") && !sp.name.includes("철갑");
  const sturgeon = bodyKind === "shark" && sp.name.includes("철갑상어");
  const anim: Anim = [];
  let bendUsed: Bend = noBend;
  let ribbonInfo: RibbonInfo | null = null;
  let headPos = new THREE.Vector3(0, 0, 0);
  // 용 계열은 몸이 훨씬 길고 가늘어 굽이치는 모습이 된다
  if (has("dragon")) { sx *= 2.0; sy *= 0.72; sz *= 0.78; }
  if (has("curvy")) { sx *= 1.2; sy *= 0.8; sz *= 0.8; }

  const bead = (r: number, x: number, y: number, z: number) => {
    if (legend) {
      const eye = makeEye(r, Math.sign(z || 1), accent, true);
      eye.position.set(x, y, z);
      g.add(eye);
      return;
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0x120d18, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }));
    eye.position.set(x, y, z);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(r * 0.35, r * 0.4, Math.sign(z || 1) * r * 0.7);
    eye.add(shine);
    g.add(eye);
  };

  if (bodyKind === "octopus") {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), skin);
    head.scale.set(sx * 1.05, sy * 1.2, sz * 1.05);
    head.position.set(-0.05, 0.25, 0);
    g.add(head);
    const kraken = sp.name === "크라켄";
    if (kraken) {
      // 크라켄: 뒤로 길게 솟은 머리에 가시 볏, 크고 빛나는 눈, 곤봉 끝 두 개의 긴 촉수
      head.scale.set(sx * 0.95, sy * 2.0, sz * 1.0);
      head.position.set(-0.1, 0.45, 0);
      const ax = 0.5 * sx * 0.95, ay = 0.5 * sy * 2.0;
      const spikeMat = new THREE.MeshPhysicalMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.8, roughness: 0.3 });
      for (let i = 0; i < 6; i++) {
        const phi = (60 + i * 18) * (Math.PI / 180);
        const n = new THREE.Vector3(Math.cos(phi) / ax, Math.sin(phi) / ay, 0).normalize();
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07 - i * 0.004, 0.32 - i * 0.02, 10), spikeMat);
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        spike.position.set(-0.1 + ax * Math.cos(phi) * 1.02, 0.45 + ay * Math.sin(phi) * 1.02, 0);
        g.add(spike);
      }
      for (const s of [-1, 1]) {
        g.add(tube([new THREE.Vector3(0.25, 0.1, s * 0.12), new THREE.Vector3(0.7, 0.35, s * 0.4), new THREE.Vector3(1.3, 0.1, s * 0.85), new THREE.Vector3(2.1, 0.45, s * 1.05)], 0.05, skin, 0.35));
        const club = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin);
        club.scale.set(1.5, 0.8, 0.8);
        club.position.set(2.1, 0.45, s * 1.05);
        g.add(club);
      }
    }
    for (const s of [-1, 1]) bead(kraken ? 0.12 : 0.07, 0.3, kraken ? 0.2 : 0.1, s * (kraken ? 0.34 : 0.32));
    const armN = kraken ? 8 : legend ? 8 : 8;
    const L = kraken ? 1.9 : legend ? 1.25 : 1;
    const suck = new THREE.MeshBasicMaterial({ color: accent });
    for (let i = 0; i < armN; i++) {
      const a = (i / armN) * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a);
      const pts = [new THREE.Vector3(dx * 0.2, -0.1, dz * 0.2), new THREE.Vector3(dx * 0.5 * L, -0.38, dz * 0.5 * L), new THREE.Vector3(dx * 0.85 * L, -0.5 - (i % 2) * 0.1, dz * 0.85 * L), new THREE.Vector3((dx * 1.1 + dz * 0.2) * L, -0.3 + (i % 3) * 0.08 + (legend ? 0.25 : 0), (dz * 1.1 - dx * 0.2) * L)];
      g.add(tube(pts, 0.1, skin, 0.75));
      if (legend) {
        const curve = new THREE.CatmullRomCurve3(pts);
        for (let j = 1; j <= 5; j++) {
          const q = curve.getPointAt(j / 6);
          const sbead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), suck);
          sbead.position.set(q.x, q.y + 0.06, q.z);
          g.add(sbead);
        }
      }
    }
  } else if (bodyKind === "squid") {
    // 오징어: 뒤로 뾰족하게 빠지는 원뿔 몸통(외투막)과 뒤쪽 마름모 지느러미
    const mantle = new THREE.Mesh(profileBody(sx * 1.5, sy * 1.05, sz * 1.05, 0.62, false, 0.75), skin);
    mantle.scale.x = 1;
    mantle.position.x = -0.18;
    g.add(mantle);
    for (const s of [-1, 1]) {
      const f = sideFin(0.42, finMat);
      f.position.set(-0.62, 0, s * 0.1);
      f.rotation.set(s * 1.3, 0, 0);
      g.add(f);
      bead(0.06, 0.28, 0.02, s * 0.28);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pts = [new THREE.Vector3(0.38, Math.cos(a) * 0.1, Math.sin(a) * 0.1), new THREE.Vector3(0.62, Math.cos(a) * 0.14, Math.sin(a) * 0.14), new THREE.Vector3(0.88 + (i % 2) * 0.1, Math.cos(a) * 0.1 + Math.sin(i) * 0.05, Math.sin(a) * 0.1)];
      g.add(tube(pts, 0.085, skin, 0.7));
    }
  } else if (bodyKind === "ray") {
    const disc = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 24), skin);
    disc.scale.set(0.95, 0.14, 1.2);
    g.add(disc);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), skin);
      wing.scale.set(0.7, 0.1, 0.5);
      wing.position.set(-0.05, 0, s * 0.62);
      g.add(wing);
      bead(0.055, 0.34, 0.12, s * 0.2);
    }
    g.add(tube([new THREE.Vector3(-0.4, 0, 0), new THREE.Vector3(-0.85, 0.02, 0.05), new THREE.Vector3(-1.3, 0.0, -0.05)], 0.07, skin, 0.7));
  } else if (bodyKind === "ribbon") {
    const thick = has("dragon") ? 2.6 : has("curvy") ? 1.05 : bodyKind === "ribbon" && sp.name.includes("미꾸라지") ? 1.6 : 1.25;
    const { group, info } = buildRibbon(sx, thick, skin, finMat, anim);
    g.add(group);
    const uh = 0.915;
    const H = info.point(uh), Nu = info.up(uh), hw = info.width(uh), hh = info.height(uh);
    for (const sgn of [-1, 1]) bead(Math.max(0.035, hh * 0.38), H.x + Nu.x * hh * 0.22, H.y + Nu.y * hh * 0.22, sgn * hw * 0.82);
    // 가슴지느러미
    for (const sgn of [-1, 1]) {
      const pf = sideFin(Math.max(0.12, hh * 1.5), finMat);
      const q = info.point(0.8), tq = info.tangent(0.8);
      pf.position.set(q.x, q.y - info.height(0.8) * 0.2, sgn * info.width(0.8) * 0.9);
      pf.rotation.set(sgn * 1.05, 0.15, Math.atan2(tq.y, tq.x) - 0.35);
      g.add(pf);
    }
    bendUsed = noBend;
    headPos = info.point(0.98).clone();
    ribbonInfo = info;
  } else if (bodyKind === "flat") {
    const body = new THREE.Mesh(bodyGeometry(sx, sy, sz, 0.15), skin);
    body.castShadow = true;
    g.add(body);
    // 납작한 몸: 눈 두 개가 한쪽(위)에 몰려 있다
    for (const s of [-1, 1]) bead(0.05, sx * 0.34, sy * 0.55, s * 0.09);
    for (const s of [-1, 1]) {
      const fr = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 14), finMat);
      fr.scale.set(sx * 0.62, 0.05, 0.1);
      fr.position.set(-sx * 0.05, 0, s * sz * 0.52);
      g.add(fr);
    }
    const tail = new THREE.Group();
    tail.name = "tail";
    tail.position.set(-sx * 0.47, 0, 0);
    const tf = tailFin(0.3, finMat);
    tf.rotation.x = Math.PI / 2;
    tail.add(tf);
    g.add(tail);
  } else if (realShark) {
    // 진짜 상어: 어뢰 모양 몸, 뾰족한 주둥이, 뒤로 젖혀진 큰 등지느러미, 위 날개가 긴 꼬리, 아가미 줄
    sx *= 1.15; sy *= 0.9;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 0.6 });
    // 몸통 자체가 코끝으로 매끄럽게 좁아진다(따로 붙인 뿔이 아니다)
    const body = new THREE.Mesh(profileBody(sx, sy * 1.15, sz * 1.1, 0.55, true, 0.8), skin);
    body.castShadow = true;
    g.add(body);
    for (const s of [-1, 1]) bead(Math.max(0.045, sy * 0.07), sx * 0.34, sy * 0.1, s * sz * 0.36);
    headPos = new THREE.Vector3(sx * 0.45, 0, 0);
    const fin = (w: number, h: number) => {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      sh.bezierCurveTo(w * 0.3, h * 0.55, w * 0.55, h * 0.95, w * 0.75, h);
      sh.bezierCurveTo(w * 0.8, h * 0.6, w * 0.9, h * 0.25, w, 0);
      sh.closePath();
      return softFin(sh, finMat);
    };
    const df = fin(sx * 0.26, sy * 0.85);
    df.scale.x = -1; // 앞쪽 밑동에서 뒤로 젖혀진다
    df.position.set(sx * 0.12, sy * 0.4, 0);
    g.add(df);
    const d2 = fin(sx * 0.1, sy * 0.3);
    d2.scale.x = -1;
    d2.position.set(-sx * 0.28, sy * 0.3, 0);
    g.add(d2);
    const anal = fin(sx * 0.1, sy * 0.3);
    anal.scale.set(-1, -1, 1);
    anal.position.set(-sx * 0.3, -sy * 0.32, 0);
    g.add(anal);
    for (const s of [-1, 1]) {
      const pf = sideFin(sx * 0.32, finMat);
      pf.position.set(sx * 0.16, -sy * 0.2, s * sz * 0.4);
      pf.rotation.set(s * 1.05, 0.15, -0.35);
      g.add(pf);
      for (let i = 0; i < 5; i++) {
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.014, sy * 0.3, 0.014), dark);
        slit.position.set(sx * (0.27 - i * 0.03), 0, s * sz * 0.46);
        slit.rotation.x = s * 0.15;
        g.add(slit);
      }
    }
    // 무서운 입: 살짝 벌어진 아래턱과 위아래 줄줄이 난 이빨
    const white = new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 0.25 });
    const gape = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), new THREE.MeshStandardMaterial({ color: 0x4a1020, roughness: 0.5 }));
    gape.scale.set(sx * 0.3, sy * 0.2, sz * 0.5);
    gape.position.set(sx * 0.3, -sy * 0.36, 0);
    g.add(gape);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 14), skin);
    jaw.scale.set(sx * 0.32, sy * 0.16, sz * 0.52);
    jaw.position.set(sx * 0.27, -sy * 0.55, 0);
    jaw.rotation.z = -0.22;
    g.add(jaw);
    for (let i = 0; i < 13; i++) {
      const th = ((i / 12) * 2 - 1) * 1.25;
      const ux = sx * 0.2 + sx * 0.25 * Math.cos(th), uz = sz * 0.3 * Math.sin(th);
      const up = new THREE.Mesh(new THREE.ConeGeometry(0.022, sy * 0.2, 6), white); // 위 이빨은 아래로
      up.rotation.z = Math.PI;
      up.position.set(ux, -sy * 0.34, uz);
      g.add(up);
      const low = new THREE.Mesh(new THREE.ConeGeometry(0.02, sy * 0.17, 6), white); // 아래 이빨은 위로
      low.position.set(sx * 0.17 + sx * 0.25 * Math.cos(th) * 0.95, -sy * 0.48, uz * 0.95);
      g.add(low);
    }
    // 매서운 눈썹
    for (const s of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.1, 0.02, 0.035), new THREE.MeshStandardMaterial({ color: 0x141018 }));
      brow.position.set(sx * 0.34, sy * 0.24, s * sz * 0.36);
      brow.rotation.z = -0.45;
      brow.rotation.y = s * 0.3;
      g.add(brow);
    }
    const tail = new THREE.Group();
    tail.name = "tail";
    tail.position.set(-sx * 0.47, 0, 0);
    tail.rotation.z = 0.12;
    const L = sx * 0.3;
    const ts = new THREE.Shape();
    ts.moveTo(0.04, 0);
    ts.bezierCurveTo(-L * 0.2, L * 0.35, -L * 0.6, L * 1.1, -L * 1.1, L * 1.3);
    ts.bezierCurveTo(-L * 1.0, L * 0.7, -L * 0.75, L * 0.25, -L * 0.7, 0);
    ts.bezierCurveTo(-L * 0.85, -L * 0.2, -L * 0.9, -L * 0.45, -L * 0.75, -L * 0.55);
    ts.bezierCurveTo(-L * 0.4, -L * 0.35, -L * 0.15, -L * 0.15, 0.04, 0);
    tail.add(softFin(ts, finMat));
    g.add(tail);
  } else if (sturgeon) {
    // 철갑상어: 길쭉한 몸, 뾰족하고 긴 주둥이, 몸을 따라 줄지은 뼈 방패 판, 입 앞 수염, 위 날개가 긴 꼬리
    sx *= 1.35; sy *= 0.78; sz *= 0.9;
    const body = new THREE.Mesh(profileBody(sx, sy, sz, 0.5, true, 0.8), skin);
    body.castShadow = true;
    g.add(body);
    headPos = new THREE.Vector3(sx * 0.45, 0, 0);
    const plate = new THREE.MeshPhysicalMaterial({ color: base.clone().lerp(new THREE.Color("#ffffff"), 0.45), roughness: 0.35, clearcoat: 0.8, emissive: glow ? accent : none, emissiveIntensity: glow ? 0.25 : 0 });
    const rAt = (t: number) => (t >= 0.5 ? Math.pow(Math.max(0, 1 - (t - 0.5) / 0.5), 0.85) : Math.pow(Math.sin((t / 0.5) * Math.PI * 0.5), 0.8));
    for (let i = 0; i < 11; i++) {
      const t = 0.12 + i * 0.062; // 꼬리 쪽 0.12 ~ 머리 쪽 0.74
      const x = (t - 0.5) * sx, r = rAt(t) * 0.5;
      for (const [ang, row] of [[Math.PI / 2, 0], [0.62, 1], [-0.1, 2]] as const) {
        const sides = row === 0 ? [0] : [-1, 1];
        for (const sd of sides) {
          const sc = new THREE.Mesh(new THREE.SphereGeometry(0.05 + 0.02 * r, 10, 8), plate);
          sc.scale.set(1.5, 0.7, 1);
          sc.position.set(x, Math.sin(ang) * sy * r * 1.02, row === 0 ? 0 : sd * Math.cos(ang) * sz * r * 1.02);
          sc.rotation.z = row === 0 ? 0 : 0;
          g.add(sc);
        }
      }
    }
    for (const sd of [-1, 1]) {
      bead(Math.max(0.035, sy * 0.06), sx * 0.3, sy * 0.1, sd * sz * 0.2);
      for (let i = 0; i < 2; i++) g.add(tube([new THREE.Vector3(sx * 0.3, -sy * 0.16, sd * (0.02 + i * 0.04)), new THREE.Vector3(sx * 0.32, -sy * 0.3, sd * (0.04 + i * 0.06)), new THREE.Vector3(sx * 0.29, -sy * 0.38, sd * (0.03 + i * 0.06))], 0.016, skin, 0.4));
      const pf = sideFin(sx * 0.22, finMat);
      pf.position.set(sx * 0.2, -sy * 0.2, sd * sz * 0.4);
      pf.rotation.set(sd * 1.05, 0.15, -0.35);
      g.add(pf);
    }
    const dfin = dorsalFin(sx * 0.16, sy * 0.6, finMat);
    dfin.position.set(-sx * 0.3, sy * 0.4, 0);
    g.add(dfin);
    const afin = dorsalFin(sx * 0.12, sy * 0.4, finMat);
    afin.scale.y = -1;
    afin.position.set(-sx * 0.28, -sy * 0.38, 0);
    g.add(afin);
    const tail = new THREE.Group();
    tail.name = "tail";
    tail.position.set(-sx * 0.47, 0, 0);
    tail.rotation.z = 0.15;
    const L = sx * 0.28;
    const ts = new THREE.Shape();
    ts.moveTo(0.04, 0);
    ts.bezierCurveTo(-L * 0.2, L * 0.35, -L * 0.6, L * 1.1, -L * 1.1, L * 1.3);
    ts.bezierCurveTo(-L * 1.0, L * 0.7, -L * 0.75, L * 0.25, -L * 0.7, 0);
    ts.bezierCurveTo(-L * 0.85, -L * 0.2, -L * 0.9, -L * 0.45, -L * 0.75, -L * 0.55);
    ts.bezierCurveTo(-L * 0.4, -L * 0.35, -L * 0.15, -L * 0.15, 0.04, 0);
    tail.add(softFin(ts, finMat));
    g.add(tail);
  } else if (bodyKind === "whale") {
    // 고래: 크고 뭉툭한 머리, 머리 위 숨구멍, 입선, 긴 가슴지느러미, 위아래로 흔드는 가로 꼬리
    sx *= 1.3; // 고래는 더 길쭉하게
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 0.6 });
    const light = base.clone().lerp(new THREE.Color("#ffffff"), 0.7);
    const body = new THREE.Mesh(profileBody(sx, sy * 1.1, sz * 1.0, 0.6, false, 0.7), skin);
    body.castShadow = true;
    g.add(body);
    headPos = new THREE.Vector3(sx * 0.45, 0, 0);
    for (const s of [-1, 1]) {
      bead(0.06, sx * 0.3, -sy * 0.02, s * sz * 0.45);
      // 입선: 주둥이 끝에서 눈 아래까지 굽은 선
      g.add(tube([new THREE.Vector3(sx * 0.47, -sy * 0.12, s * sz * 0.1), new THREE.Vector3(sx * 0.36, -sy * 0.16, s * sz * 0.38), new THREE.Vector3(sx * 0.2, -sy * 0.1, s * sz * 0.47)], 0.016, dark, 0.2));
      const pf = sideFin(sx * 0.34, finMat);
      pf.position.set(sx * 0.1, -sy * 0.26, s * sz * 0.44);
      pf.rotation.set(s * 1.15, 0.25, -0.5);
      g.add(pf);
    }
    const blow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), dark);
    blow.scale.set(1.6, 0.5, 1);
    blow.position.set(sx * 0.22, sy * 0.5, 0);
    g.add(blow);
    // 배의 주름
    for (let i = -3; i <= 3; i++) {
      g.add(tube([new THREE.Vector3(sx * 0.4, -sy * 0.4, i * sz * 0.1), new THREE.Vector3(sx * 0.1, -sy * 0.46, i * sz * 0.1), new THREE.Vector3(-sx * 0.12, -sy * 0.4, i * sz * 0.08)], 0.012, new THREE.MeshStandardMaterial({ color: light, roughness: 0.5 }), 0.3));
    }
    const dorsal = dorsalFin(sx * 0.14, sy * 0.28, finMat);
    dorsal.position.set(-sx * 0.2, sy * 0.46, 0);
    g.add(dorsal);
    const tail = new THREE.Group();
    tail.name = "whaleTail";
    tail.position.set(-sx * 0.5, 0, 0);
    const flukes = tailFin(sx * 0.36, finMat, "crescent");
    flukes.rotation.x = Math.PI / 3; // 옆에서도 보이게 비스듬히 세운 꼬리
    tail.add(flukes);
    g.add(tail);
    anim.push((t) => { tail.rotation.z = Math.sin(t * 2.2) * 0.2; });
  } else {
    const round = bodyKind === "puffer" || bodyKind === "round";
    // 가늘고 긴 물고기는 S자로 휘어서 더 커 보이게 한다
    const total = has("dragon") ? 1.9 : bodyKind === "eel" ? 1.3 : has("curvy") ? 1.2 : 0; // 몸 전체가 휘는 각도(라디안)
    const bend: Bend = total ? arcBend(total / sx) : noBend;
    const at = (x: number, y: number, z: number) => bend.map(x, y, z);
    // 종류마다 몸 단면을 다르게: 날씬한 어뢰형(고등어·참치), 높은 몸(붕어·배스), 머리가 큰 메기형
    const prof: Record<string, [number, number]> = { slim: [0.4, 0.85], bass: [0.45, 0.8], carp: [0.45, 0.75], catfish: [0.6, 0.6], snakehead: [0.55, 0.65] };
    // 빠르게 헤엄치는 날씬한 종류(고등어·참치·방어·연어·송어 등)는 어뢰형 몸에 두 개의 등지느러미를 단다
    const FAST = ["참치", "고등어", "삼치", "전갱이", "방어", "부시리"];
    const tor = !total && !legend && !round && (bodyKind === "slim" || FAST.includes(sp.name));
    if (sp.name === "참치") { sy *= 1.25; sz *= 1.1; }
    if (tor) sx *= 1.2;
    if (bodyKind === "carp") sy *= 1.15;
    const pp = tor ? ([0.4, 0.85] as [number, number]) : !total && !round ? prof[bodyKind] : undefined;
    const body = new THREE.Mesh(pp ? profileBody(sx, sy * 1.08, sz * 1.08, pp[0], false, pp[1]) : bodyGeometry(sx, sy, sz, round ? 0.5 : 0.12, bend), skin);
    body.castShadow = true;
    g.add(body);
    for (const s of [-1, 1]) {
      const e = at(sx * 0.32, sy * 0.12, s * sz * 0.42);
      bead(Math.max(0.04, sy * (pp ? 0.085 : bodyKind === "puffer" ? 0.11 : 0.1)), e.x, e.y, e.z);
    }
    const hp = at(sx * 0.45, 0, 0);
    bendUsed = bend;
    headPos = new THREE.Vector3(hp.x, hp.y, hp.z);
    feat.position.set(hp.x - sx * 0.45, hp.y, hp.z);

    const tail = new THREE.Group();
    tail.name = "tail";
    tail.position.copy(at(-sx * 0.47, 0, 0));
    tail.rotation.z = bend.ang(-sx * 0.47);
    const tstyle: TailStyle = has("bigtail") ? "ribbon" : tor && (FAST.includes(sp.name) || has("bill")) ? "crescent" : bodyKind === "eel" ? (total ? "fork" : "ribbon") : bodyKind === "slim" ? "fork" : bodyKind === "shark" || bodyKind === "whale" ? "crescent" : bodyKind === "round" || bodyKind === "puffer" || bodyKind === "catfish" || bodyKind === "snakehead" ? "round" : "fan";
    tail.add(tailFin(Math.max(0.22, def.tail * (has("bigtail") ? 1.9 : total ? 1.5 : 1.1)), finMat, tstyle));
    g.add(tail);
    if (def.dorsal > 0) {
      const long = (bodyKind === "eel" || bodyKind === "snakehead") && !total;
      const spiny = bodyKind === "bass" && !tor && !total;
      const mkD = (w: number, h: number) => { const f = dorsalFin(w, h, finMat); f.userData.w = w; return f; };
      const df = tor ? mkD(sx * 0.24, def.dorsal * 1.5)
        : bodyKind === "catfish" && !total ? mkD(sx * 0.18, def.dorsal * 1.1) // 메기: 작은 등지느러미
        : spiny ? mkD(sx * 0.34, def.dorsal * 1.35) // 농어류: 가시가 선 앞 등지느러미
        : bodyKind === "carp" && !total ? mkD(sx * 0.62, def.dorsal * 0.9) // 잉어류: 길게 이어진 등지느러미
        : mkD(sx * (long ? 0.85 : 0.5), def.dorsal * (long ? 0.7 : 1.1));
      df.position.copy(at(tor ? -sx * 0.02 : bodyKind === "catfish" && !total ? sx * 0.05 : spiny ? sx * 0.06 : bodyKind === "carp" && !total ? -sx * 0.08 : -sx * (long ? 0.45 : 0.28), sy * 0.44, 0));
      df.rotation.z = bend.ang(-sx * (long ? 0.45 : 0.28));
      g.add(df);
      if (spiny) {
        const soft = dorsalFin(sx * 0.2, def.dorsal * 0.8, finMat);
        soft.position.set(-sx * 0.22, sy * 0.4, 0);
        g.add(soft);
      }
      if (tor) {
        // 작은 둘째 등지느러미, 꼬리 쪽 작은 지느러미 조각(고속 어종만)
        const d2 = dorsalFin(sx * 0.12, def.dorsal * 0.55, finMat);
        d2.position.set(-sx * 0.27, sy * 0.3, 0);
        g.add(d2);
        if (FAST.includes(sp.name)) {
          for (let i = 0; i < 5; i++) for (const up of [1, -1]) {
            const fl = dorsalFin(sx * 0.035, sy * 0.13, finMat);
            fl.position.set(-sx * (0.3 + i * 0.035), up * sy * (0.2 - i * 0.012), 0);
            fl.scale.y = up;
            g.add(fl);
          }
        }
      }
      if (bodyKind === "shark" || bodyKind === "whale") {
        const d2 = dorsalFin(sx * 0.18, def.dorsal * 0.45, finMat);
        d2.position.copy(at(-sx * 0.42, sy * 0.28, 0));
        d2.rotation.z = bend.ang(-sx * 0.42);
        g.add(d2);
      }
    }
    const longAnal = !total && (bodyKind === "catfish" || bodyKind === "snakehead");
    const anal = dorsalFin(sx * (total ? 0.1 : longAnal ? 0.5 : 0.2), def.dorsal * (total ? 0.25 : longAnal ? 0.45 : 0.4), finMat);
    anal.position.copy(at(longAnal ? -sx * 0.45 : -sx * 0.3, -sy * 0.4, 0));
    anal.rotation.z = bend.ang(-sx * 0.3);
    anal.scale.y = -1;
    g.add(anal);
    for (const s of [-1, 1]) {
      const pf = sideFin(0.26 * (bodyKind === "whale" ? 2.4 : total ? 0.8 : 1), finMat);
      pf.position.copy(at(sx * 0.14, -sy * 0.16, s * sz * 0.46));
      pf.rotation.set(s * 1.05, 0.15, -0.35 + bend.ang(sx * 0.14));
      g.add(pf);
    }
    if (bodyKind === "puffer" || has("bumps")) {
      const n = bodyKind === "puffer" ? 24 : 8;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const bump = new THREE.Mesh(new THREE.SphereGeometry(bodyKind === "puffer" ? 0.045 : 0.06 - t * 0.02, 10, 8), finMat);
        if (bodyKind === "puffer") {
          const th = Math.acos(1 - 2 * t), ph = Math.PI * (1 + Math.sqrt(5)) * i;
          const dir = new THREE.Vector3(Math.cos(th) * 0.9, Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)).normalize();
          bump.position.set((dir.x * 0.4 * sx) / 0.8, (dir.y * 0.4 * sy) / 0.8, (dir.z * 0.4 * sz) / 0.8);
        } else bump.position.set(sx * (0.3 - t * 0.55), sy * (0.5 - t * 0.12), 0);
        g.add(bump);
      }
    }
  }

  // 종의 특징 파츠 (전부 둥글게)
  if (!["octopus", "squid", "ray", "flat", "ribbon", "whale"].includes(bodyKind) && !realShark && !sturgeon) {
    if (has("whiskers") || bodyKind === "catfish") {
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
        { const w = bodyKind === "catfish" ? 1.9 : 1; feat.add(tube([new THREE.Vector3(sx * 0.5, -sy * 0.12, s * (0.05 + i * 0.04)), new THREE.Vector3(sx * (0.5 + 0.12 * w), -sy * 0.2 - i * 0.04, s * (0.14 + i * 0.1) * w), new THREE.Vector3(sx * (0.5 + 0.1 * w), -sy * 0.42 * w - i * 0.05, s * (0.2 + i * 0.12) * w)], 0.026, skin, 0.5)); }
      }
    }
    if (has("chinbarbel")) feat.add(tube([new THREE.Vector3(sx * 0.46, -sy * 0.3, 0), new THREE.Vector3(sx * 0.5, -sy * 0.48, 0)], 0.03, skin, 0.4));
    if (has("hump")) {
      const hump = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin);
      hump.position.set(sx * 0.22, sy * 0.4, 0);
      feat.add(hump);
    }
    if (has("horn")) {
      for (const s of [-1, 1]) {
        feat.add(tube([new THREE.Vector3(sx * 0.4, sy * 0.38, s * 0.08), new THREE.Vector3(sx * 0.36, sy * 0.72, s * 0.14), new THREE.Vector3(sx * 0.22, sy * 0.9, s * 0.16)], 0.045, finMat, 0.6));
      }
    }
    if (has("bill")) {
      const bill = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, sx * 0.55, 6, 12), skin);
      bill.rotation.z = Math.PI / 2;
      bill.position.set(sx * 0.5 + sx * 0.3, 0, 0);
      feat.add(bill);
    }
    if (has("lure")) {
      feat.add(tube([new THREE.Vector3(sx * 0.4, sy * 0.45, 0), new THREE.Vector3(sx * 0.62, sy * 0.95, 0), new THREE.Vector3(sx * 0.82, sy * 0.85, 0)], 0.03, skin, 0.3));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
      bulb.position.set(sx * 0.82, sy * 0.85, 0);
      feat.add(bulb);
    }
    if (has("bigmouth")) {
      const lip = new THREE.Mesh(new THREE.TorusGeometry(sy * 0.3, 0.03, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.5), roughness: 0.5 }));
      lip.position.set(sx * 0.47, -sy * 0.1, 0);
      lip.rotation.set(0, Math.PI / 2, Math.PI);
      feat.add(lip);
    }
  }

  g.add(feat);

  if (legend) legendaryFlair({ bend: bendUsed, hp: headPos, ribbon: ribbonInfo, g, sp, bodyKind, sx, sy, sz, base, accent, finMat, anim });
  if (glow && !legend) {
    // 주위를 도는 빛 알갱이
    const sparks = new THREE.Group();
    sparks.name = "sparks";
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: accent }));
      s.userData.phase = (i / 9) * Math.PI * 2;
      sparks.add(s);
    }
    g.add(sparks);
    g.userData.radius = Math.max(sx, 1) * 0.7;
  }

  g.scale.setScalar(k);
  g.userData.designScale = k;
  g.userData.update = (t: number) => {
    anim.forEach((f) => f(t));
    const tail = g.getObjectByName("tail");
    if (tail) tail.rotation.y = Math.sin(t * 7) * 0.4;
    g.rotation.z = Math.sin(t * 3.5) * 0.03;
    const sparks = g.getObjectByName("sparks");
    if (sparks) {
      const r = (g.userData.radius as number) ?? 1;
      sparks.children.forEach((c, i) => {
        const a = (c.userData.phase as number) + t * 1.5;
        c.position.set(Math.cos(a) * r, Math.sin(a * 1.3 + i) * r * 0.45, Math.sin(a) * r * 0.5);
      });
    }
  };
  return g;
}

/** 물고기 몸의 크기(후광·빛 줄기·입자 같은 꾸밈은 빼고 잰다) */
export function bodyBox(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (o as THREE.Sprite).isSprite) return;
    const mat = m.material as THREE.Material;
    if (mat.type === "ShaderMaterial" || mat.blending === THREE.AdditiveBlending || (mat as THREE.MeshBasicMaterial).type === "MeshBasicMaterial") return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
  });
  return box.isEmpty() ? new THREE.Box3().setFromObject(obj) : box;
}

/** 물속에서 희미하게 보이는 실루엣용 재질로 바꾼다 */
export function asSilhouette(fish: THREE.Object3D, opacity = 0.35) {
  fish.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.material = new THREE.MeshBasicMaterial({ color: 0x1d4b66, transparent: true, opacity, depthWrite: false });
  });
}
