import * as THREE from "three";

// 수중 탐험의 소품: 바닥의 조개, 보물 상자, 강화 단계마다 다른 작살총

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const std = (c: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
const lit = (c: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color: c });
const halo = (c: THREE.ColorRepresentation, r: number, op = 0.35) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
const dome = (r: number, w = 16, h = 8) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2);

/** 부채꼴 골이 진 조개껍데기 한 장(경첩이 -z 쪽). 경첩에서 부채처럼 퍼지는 면을 직접 짜고, 아홉 줄의 골과 물결 가장자리를 넣는다 */
function valve(color: string, rim: string) {
  const A = 54, R = 10, P: number[] = [], I: number[] = [];
  for (let i = 0; i <= A; i++) for (let j = 0; j <= R; j++) {
    const a = -1.25 + (i / A) * 2.5, r = j / R, w = Math.cos((i / A) * Math.PI * 18), len = 0.95 * (1 + 0.04 * w) * (1 - 0.1 * Math.abs(a));
    P.push(Math.sin(a) * r * len, Math.pow(Math.sin(Math.PI * r), 0.6) * 0.22 * (1 + 0.32 * w * r), -0.45 + Math.cos(a) * r * len);
    if (i < A && j < R) { const k = i * (R + 1) + j; I.push(k, k + 1, k + R + 1, k + 1, k + R + 2, k + R + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setIndex(I);
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, std(color, { roughness: 0.4, emissive: color, emissiveIntensity: 0.22, side: THREE.DoubleSide })), M(new THREE.BoxGeometry(0.36, 0.08, 0.14), std(rim, { roughness: 0.5, emissive: rim, emissiveIntensity: 0.2 }), 0, 0.03, -0.45));
  return g;
}

/** 바닥에서 줍는 조개. kind: 가리비·소라·진주조개. 돌려준 spark 는 위아래로 흔들어 눈에 띄게 한다 */
export function buildShell(kind: string) {
  const g = new THREE.Group();
  if (kind === "소라") {
    const m = std("#ffd6a0", { roughness: 0.4, emissive: "#e89a5c", emissiveIntensity: 0.25 }), in2 = std("#ff9ab0", { roughness: 0.3, emissive: "#ff7a9a", emissiveIntensity: 0.3 });
    for (let i = 0; i < 8; i++) { const r = 0.34 - i * 0.038, a = i * 1.1; g.add(M(new THREE.SphereGeometry(r, 12, 10), m, -i * 0.085 + Math.cos(a) * 0.03, 0.28 + i * 0.075, Math.sin(a) * 0.04)); }
    g.add(M(new THREE.ConeGeometry(0.05, 0.22, 7), m, -0.72, 0.9, 0, 0, 0, 0.85), M(new THREE.TorusGeometry(0.2, 0.06, 8, 16), m, 0.26, 0.22, 0.06, 0, 1.2, 0.2), M(new THREE.SphereGeometry(0.17, 10, 8), in2, 0.24, 0.22, 0.05));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(M(new THREE.ConeGeometry(0.045, 0.16, 6), m, Math.cos(a) * 0.3 - 0.02, 0.36, Math.sin(a) * 0.3, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2)); }
    g.rotation.z = 0.5;
  } else {
    const pearl = kind === "진주조개";
    const lower = valve(pearl ? "#b8aee8" : "#ffb3c6", pearl ? "#8a7cd0" : "#e8809c"), upper = valve(pearl ? "#d9d4ff" : "#ffc4d4", pearl ? "#a99be0" : "#f090aa");
    lower.rotation.z = Math.PI; lower.scale.y = 0.7; lower.position.y = 0.1; // 아랫껍데기는 뒤집어 놓는다
    upper.position.set(0, 0.1, -0.44);
    const hinge = new THREE.Group(); // 윗껍데기는 경첩을 축으로 벌어진다
    upper.position.z = 0.44; hinge.add(upper); hinge.position.set(0, 0.1, -0.44); upper.position.y = 0;
    hinge.rotation.x = pearl ? -0.75 : -0.16;
    g.add(lower, hinge);
    if (pearl) { const p = M(new THREE.SphereGeometry(0.15, 16, 12), std("#ffffff", { roughness: 0.1, metalness: 0.2, emissive: "#fff0ff", emissiveIntensity: 0.9 }), 0, 0.2, 0.05); const h = halo("#f0e0ff", 0.3); h.position.copy(p.position); g.add(p, h, M(new THREE.SphereGeometry(0.4, 12, 8), std("#ffd8ec", { roughness: 0.3 }), 0, 0.02, 0).rotateX(0)); (g.children[g.children.length - 1] as THREE.Mesh).scale.set(1, 0.2, 0.9); }
  }
  g.scale.setScalar(1.25);
  const spark = new THREE.Group();
  spark.add(M(new THREE.OctahedronGeometry(0.1), lit("#ffffff")), halo("#ffffff", 0.2, 0.3));
  spark.children[0].scale.set(0.5, 1.6, 0.5);
  const root = new THREE.Group();
  root.add(g, spark);
  return { group: root, spark };
}

const CHEST: Record<string, { wood: string; metal: string; glow: string; m: number }> = {
  나무: { wood: "#8a5a2a", metal: "#5a5a64", glow: "#ffd9a0", m: 0.1 },
  은: { wood: "#93a4b4", metal: "#eef4fa", glow: "#d8f0ff", m: 0.65 },
  금: { wood: "#d8a020", metal: "#fff0a0", glow: "#ffd24d", m: 0.75 },
};
/** 숨은 보물 상자. 모래에 반쯤 묻혀 비스듬히 놓인다. 금 상자는 멀리서도 빛기둥이 보인다 */
export function buildChest(kind: string) {
  const k = CHEST[kind] ?? CHEST.나무, g = new THREE.Group();
  const wood = std(k.wood, { roughness: 0.65 - k.m * 0.4, metalness: k.m, emissive: k.wood, emissiveIntensity: 0.18 });
  const dark = std(new THREE.Color(k.wood).multiplyScalar(0.7), { roughness: 0.7, metalness: k.m });
  const metal = std(k.metal, { roughness: 0.3, metalness: 0.8, emissive: k.metal, emissiveIntensity: kind === "나무" ? 0.05 : 0.3 });
  const gold = std("#ffd24d", { roughness: 0.25, metalness: 0.8, emissive: "#c88a00", emissiveIntensity: 0.6 });
  g.add(M(new THREE.BoxGeometry(1.5, 0.8, 1), wood, 0, 0.4, 0));
  for (let i = 0; i < 4; i++) g.add(M(new THREE.BoxGeometry(1.52, 0.015, 1.02), dark, 0, 0.16 + i * 0.2, 0)); // 널빤지 사이 홈
  const lid = new THREE.Group();
  lid.add(M(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16, 1, false, 0, Math.PI), wood, 0, 0, 0, 0, 0, Math.PI / 2));
  for (const x of [-0.56, 0, 0.56]) {
    g.add(M(new THREE.BoxGeometry(0.14, 0.84, 1.05), metal, x, 0.4, 0));
    lid.add(M(new THREE.TorusGeometry(0.515, 0.045, 6, 14, Math.PI), metal, x, 0, 0, 0, Math.PI / 2, 0));
  }
  lid.add(M(new THREE.BoxGeometry(1.56, 0.07, 1.06), metal, 0, 0.01, 0));
  lid.position.y = 0.8;
  g.add(lid);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(M(new THREE.SphereGeometry(0.06, 8, 6), metal, sx * 0.72, 0.06, sz * 0.47), M(new THREE.SphereGeometry(0.06, 8, 6), metal, sx * 0.72, 0.74, sz * 0.47));
  for (const sx of [-1, 1]) g.add(M(new THREE.TorusGeometry(0.14, 0.03, 6, 12, Math.PI), metal, sx * 0.76, 0.46, 0, 0, Math.PI / 2, Math.PI));
  g.add(M(new THREE.BoxGeometry(0.26, 0.32, 0.08), gold, 0, 0.7, 0.53), M(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), std("#2a1c10"), 0, 0.72, 0.56, Math.PI / 2), M(new THREE.BoxGeometry(0.03, 0.1, 0.1), std("#2a1c10"), 0, 0.64, 0.56));
  if (kind !== "나무") { // 옆에 흘러나온 동전·보석
    for (let i = 0; i < 6; i++) g.add(M(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 10), gold, 0.95 + (i % 3) * 0.14, 0.03 + (i % 2) * 0.03, 0.2 + ((i * 7) % 5) * 0.12 - 0.3, (i % 3) * 0.2, i, 0));
    if (kind === "금") g.add(M(new THREE.OctahedronGeometry(0.11), std("#ff3a5a", { emissive: "#ff3a5a", emissiveIntensity: 0.8, roughness: 0.1 }), 1.0, 0.12, -0.3), M(new THREE.OctahedronGeometry(0.09), std("#3ad8ff", { emissive: "#3ad8ff", emissiveIntensity: 0.8, roughness: 0.1 }), -0.95, 0.1, 0.35));
  }
  g.rotation.set(0.06, 0, -0.14); // 모래에 비스듬히 박혀 있다
  g.position.y = -0.14;
  const glow = new THREE.Group();
  glow.add(M(new THREE.OctahedronGeometry(0.13), lit(k.glow)), halo(k.glow, 0.28, 0.35));
  glow.children[0].scale.set(0.5, 1.6, 0.5);
  const root = new THREE.Group();
  root.add(g, glow);
  if (kind === "금") { // 빛기둥
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.35, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: "#ffe9a0", transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 5;
    root.add(beam);
  }
  return { group: root, glow, lid };
}

// ---- 작살총: 강화 단계(0~10)마다 이름에 맞는 모양 ------------------------------------------
interface GunTier { body: string; grip: string; barrel: string; band: string; tip: string; metal: number; glow: number }
const GUN: GunTier[] = [
  { body: "#5f7480", grip: "#2c3c46", barrel: "#9ab0bc", band: "#ff7a3d", tip: "#dfe6ea", metal: 0.15, glow: 0.2 }, // 기본: 플라스틱과 고무줄
  { body: "#4a5a48", grip: "#2a3428", barrel: "#8a9a86", band: "#e8b030", tip: "#e0e4dc", metal: 0.3, glow: 0.2 }, // 튼튼한: 국방색, 덧댄 쇠 고리
  { body: "#1f96a8", grip: "#125a68", barrel: "#bfeaf0", band: "#fff06a", tip: "#f0fbff", metal: 0.3, glow: 0.25 }, // 날랜: 청록 유선형, 옆 날개
  { body: "#23272e", grip: "#14171c", barrel: "#5a626c", band: "#ff3b4d", tip: "#e8ecf0", metal: 0.45, glow: 0.2 }, // 정밀: 검은 몸, 조준경
  { body: "#8f9ba6", grip: "#4a5560", barrel: "#c8d2da", band: "#3ab0ff", tip: "#f4f8fa", metal: 0.85, glow: 0.15 }, // 강철
  { body: "#dfe6ee", grip: "#7a8898", barrel: "#f4f8fc", band: "#8ad0ff", tip: "#ffffff", metal: 0.9, glow: 0.22 }, // 은빛: 새김 고리
  { body: "#f2b82a", grip: "#7a4a12", barrel: "#ffe07a", band: "#ff5a3d", tip: "#fff4c0", metal: 0.9, glow: 0.35 }, // 황금
  { body: "#eef4fb", grip: "#5a78a8", barrel: "#ffffff", band: "#5ab0ff", tip: "#e8f6ff", metal: 0.95, glow: 0.35 }, // 백금: 푸른 보석
  { body: "#128a7a", grip: "#0a4a48", barrel: "#2ac8a0", band: "#ffd24d", tip: "#ffe07a", metal: 0.6, glow: 0.4 }, // 용왕: 비취색 비늘, 용머리 총구
  { body: "#1c2a6a", grip: "#101840", barrel: "#4a6aff", band: "#7af0ff", tip: "#c8f6ff", metal: 0.5, glow: 0.7 }, // 별빛: 밤하늘 색, 떠도는 별
  { body: "#fff6e0", grip: "#c89a30", barrel: "#ffe9a0", band: "#ff7ad8", tip: "#ffffff", metal: 0.8, glow: 0.8 }, // 전설의: 흰 금, 날개, 수정 촉, 빛 고리
];
/** 작살총. 앞(+z)을 보고, 장전된 작살(loaded)은 쏜 직후 잠깐 숨긴다 */
export function buildHarpoonGun(level: number) {
  const l = Math.min(GUN.length - 1, Math.max(0, Math.floor(level))), t = GUN[l];
  const mat = (c: string, glow = t.glow, metal = t.metal) => std(c, { roughness: 0.55 - metal * 0.35, metalness: metal, emissive: c, emissiveIntensity: glow });
  const body = mat(t.body), grip = mat(t.grip, 0.15), barrel = mat(t.barrel), band = mat(t.band, 0.6, 0.1), tip = mat(t.tip, 0.7), gold = mat("#ffd24d", 0.5, 0.85);
  const g = new THREE.Group(), loaded = new THREE.Group(), anim: Array<(t: number) => void> = [];
  const cyl = (r1: number, r2: number, len: number, m: THREE.Material, z: number, y = 0.02, n = 12) => M(new THREE.CylinderGeometry(r1, r2, len, n), m, 0, y, z, Math.PI / 2);
  // 몸통(뒤가 굵고 앞으로 가늘어진다), 개머리, 손잡이, 방아쇠울, 총열
  g.add(cyl(0.085, 0.115, 0.95, body, 0.1), M(new THREE.SphereGeometry(0.115, 12, 10), body, 0, 0.02, -0.375), M(new THREE.BoxGeometry(0.1, 0.3, 0.14), grip, 0, -0.2, -0.14, 0.25), M(new THREE.TorusGeometry(0.075, 0.016, 6, 12, Math.PI), grip, 0, -0.1, 0.02, 0, Math.PI / 2, Math.PI), M(new THREE.BoxGeometry(0.03, 0.09, 0.03), tip, 0, -0.12, 0.0, -0.3));
  g.add(cyl(0.05, 0.055, 1.2, barrel, 0.78), cyl(0.07, 0.07, 0.07, body, 1.36));
  for (const z of [0.5, 0.95]) g.add(M(new THREE.TorusGeometry(0.095, 0.03, 6, 14), band, 0, 0.02, z));
  for (const s of [-1, 1]) g.add(M(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), band, s * 0.1, 0.02, 0.72, Math.PI / 2)); // 고무줄
  loaded.add(cyl(0.03, 0.03, 1.5, tip, 1.0, 0.02, 6));
  if (l >= 1) for (const z of [0.3, 1.15]) g.add(M(new THREE.TorusGeometry(0.075, 0.022, 6, 12), mat(t.barrel), 0, 0.02, z)); // 덧댄 고리
  if (l >= 2) for (const s of [-1, 1]) { const f = M(new THREE.ConeGeometry(0.1, 0.42, 4), mat(l >= 6 ? t.barrel : t.band, 0.35), s * 0.13, 0.02, -0.12, -Math.PI / 2, 0, s * 0.5); f.scale.set(0.25, 1, 1); g.add(f); } // 옆 날개
  if (l >= 3) g.add(cyl(0.04, 0.04, 0.36, grip, 0.05, 0.17), cyl(0.052, 0.04, 0.06, grip, 0.25, 0.17), M(new THREE.SphereGeometry(0.03, 8, 6), lit(l >= 9 ? "#7af0ff" : "#ff3b4d"), 0, 0.17, 0.285), M(new THREE.BoxGeometry(0.03, 0.08, 0.06), grip, 0, 0.11, 0.05)); // 조준경
  if (l >= 5) for (const z of [-0.2, 0.0, 0.2, 0.4]) g.add(M(new THREE.TorusGeometry(0.108 - (z + 0.2) * 0.022, 0.012, 5, 14), l >= 6 ? gold : tip, 0, 0.02, z)); // 새김 고리
  if (l >= 7) for (const [z, c] of [[-0.3, "#3ab0ff"], [0.1, "#ff5a8a"], [0.42, "#5aff9a"]] as const) for (const s of [-1, 1]) g.add(M(new THREE.OctahedronGeometry(0.035), std(l === 9 ? "#c8f6ff" : c, { emissive: l === 9 ? "#7af0ff" : c, emissiveIntensity: 0.9, roughness: 0.1 }), s * 0.1, 0.05, z)); // 보석
  if (l === 8) { // 용머리 총구: 뿔과 수염, 등의 지느러미 가시
    for (const s of [-1, 1]) g.add(M(new THREE.ConeGeometry(0.03, 0.3, 6), gold, s * 0.07, 0.17, 1.22, -0.9, 0, s * -0.3), M(new THREE.CylinderGeometry(0.008, 0.004, 0.4, 4), gold, s * 0.1, -0.02, 1.52, Math.PI / 2 - 0.3, 0, s * 0.35), M(new THREE.SphereGeometry(0.025, 8, 6), lit("#ffe07a"), s * 0.06, 0.07, 1.36));
    for (let i = 0; i < 6; i++) g.add(M(new THREE.ConeGeometry(0.03, 0.1, 4), gold, 0, 0.14, -0.3 + i * 0.13));
    g.add(M(new THREE.SphereGeometry(0.1, 10, 8), body, 0, 0.03, 1.36));
  }
  if (l >= 9) { // 총을 따라 도는 빛 알갱이
    const orbs = new THREE.Group(), c = l === 10 ? ["#ff7ad8", "#ffe07a", "#7af0ff", "#b08aff", "#8aff9a"] : ["#7af0ff", "#ffffff", "#c8f6ff", "#7af0ff", "#ffffff"];
    for (let i = 0; i < 5; i++) { const o = M(new THREE.OctahedronGeometry(0.03), lit(c[i])); o.userData.ph = (i / 5) * Math.PI * 2; orbs.add(o); }
    g.add(orbs);
    anim.push((tt) => orbs.children.forEach((o, i) => { const a = (o.userData.ph as number) + tt * 2; o.position.set(Math.cos(a) * 0.19, 0.02 + Math.sin(a) * 0.19, 0.1 + i * 0.26); }));
  }
  if (l === 10) { // 날개와 빛 고리
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const w = M(new THREE.SphereGeometry(0.5, 8, 5), mat("#ffffff", 0.7, 0.2), s * (0.2 + i * 0.03), 0.08 + i * 0.07, -0.2 - i * 0.06, 0, s * 0.5, s * (0.4 + i * 0.25)); w.scale.set(0.5 - i * 0.08, 0.03, 0.14); g.add(w); }
    const ring = M(new THREE.TorusGeometry(0.16, 0.012, 6, 24), lit("#ffe9a0"), 0, 0.02, 1.2), h = halo("#ffe9a0", 0.14, 0.4);
    h.position.set(0, 0.02, 1.9);
    g.add(ring); loaded.add(h);
    anim.push((tt) => { ring.rotation.z = tt * 2; ring.position.z = 1.2 + Math.sin(tt * 3) * 0.05; });
  }
  // 작살촉: 단계가 오르면 미늘이 달리고, 높은 단계는 수정처럼 빛난다
  loaded.add(M(new THREE.ConeGeometry(l >= 4 ? 0.085 : 0.1, 0.36, l >= 8 ? 4 : 6), l >= 6 ? mat(l === 6 ? "#ffe07a" : t.tip, 1.0, 0.6) : tip, 0, 0.02, 1.9, Math.PI / 2));
  if (l >= 4) for (const s of [-1, 1]) loaded.add(M(new THREE.ConeGeometry(0.04, 0.2, 4), tip, s * 0.07, 0.02, 1.7, -Math.PI / 2 + 0.5 * 0, 0, s * 2.6));
  g.add(loaded);
  return { group: g, loaded, update: (tt: number) => anim.forEach((f) => f(tt)) };
}
