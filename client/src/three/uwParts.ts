import * as THREE from "three";
import { crystal, sideFin, softFin, tube, veil } from "./fishModel";
import type { Anim } from "./fishModel";

// 수중 탐험 물고기의 특색 부품(왕관·산호·초롱·닻 등)과 물고기 모양이 아닌 체형(거북·해파리·해마).
// 부품은 "몸 높이 1"을 기준으로 만들고, 몸 위의 자리(등·머리·주둥이·꼬리)에 몸 높이만큼 키워 붙인다.

export interface Anchor { p: THREE.Vector3; ang: number }
export interface PartCtx {
  g: THREE.Group; feats: string[]; anim: Anim;
  skin: THREE.MeshPhysicalMaterial; finMat: THREE.Material; base: THREE.Color; accent: THREE.Color;
  /** 등 위의 점(u: 0 꼬리 ~ 1 머리)과 그 자리의 기울기 */
  back: (u: number) => Anchor;
  /** 옆구리의 점(s: +1/-1 쪽, v: 위아래로 옮기는 양) */
  side: (u: number, s: number, v?: number) => THREE.Vector3;
  head: Anchor; nose: THREE.Vector3; tail: THREE.Vector3;
  /** 몸 높이·폭·길이, 부품 크기 기준(몸 높이보다 조금 크게 잡아 멀리서도 보이게 한다) */
  H: number; W: number; L: number; S: number;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); return o; };
const std = (c: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
const lit = (c: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color: c });
const gold = () => std("#ffcf40", { metalness: 0.7, roughness: 0.28, emissive: "#a86a00", emissiveIntensity: 0.45 });
const iron = (c: THREE.ColorRepresentation = "#3a4048") => std(c, { metalness: 0.6, roughness: 0.5 });
const gem = (c: THREE.ColorRepresentation) => std(c, { metalness: 0.2, roughness: 0.12, emissive: c, emissiveIntensity: 0.7 });
const G = (...o: THREE.Object3D[]) => { const g = new THREE.Group(); if (o.length) g.add(...o); return g; };
const sph = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const cyl = (a: number, b: number, h: number, n = 10, open = false) => new THREE.CylinderGeometry(a, b, h, n, 1, open);
const cone = (r: number, h: number, n = 8) => new THREE.ConeGeometry(r, h, n);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const tor = (r: number, t: number, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 6, 20, arc);
const rot = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0) => { o.rotation.set(x, y, z); return o; };
const scl = <T extends THREE.Object3D>(o: T, x: number, y = x, z = x) => { o.scale.set(x, y, z); return o; };

/** 부품을 몸 위의 자리에 붙인다(크기 s 는 몸 높이 배율) */
function put(c: PartCtx, o: THREE.Object3D, a: Anchor, s = 1) {
  o.position.copy(a.p); o.rotation.z += a.ang; o.scale.multiplyScalar(c.S * s);
  c.g.add(o);
  return o;
}
/** 등을 따라 n 개를 줄지어 붙인다 */
function row(c: PartCtx, n: number, u0: number, u1: number, make: (i: number) => THREE.Object3D, s = 1) {
  for (let i = 0; i < n; i++) put(c, make(i), c.back(u0 + ((u1 - u0) * i) / Math.max(1, n - 1)), s);
}
const at = (p: THREE.Vector3, ang = 0): Anchor => ({ p, ang });

/** 가지가 갈라진 산호 한 그루 */
function coralBranch(color: THREE.ColorRepresentation, h: number, lean: number) {
  const m = std(color, { roughness: 0.7, emissive: color, emissiveIntensity: 0.18 });
  return G(
    tube([V(0, 0, 0), V(lean * 0.1, h * 0.5, 0), V(lean * 0.25, h, 0)], h * 0.09, m, 0.6),
    tube([V(lean * 0.08, h * 0.4, 0), V(lean * 0.1 + 0.16 * h, h * 0.62, 0.06 * h), V(lean * 0.1 + 0.22 * h, h * 0.9, 0.08 * h)], h * 0.065, m, 0.6),
    tube([V(lean * 0.05, h * 0.3, 0), V(-0.16 * h, h * 0.5, -0.08 * h), V(-0.2 * h, h * 0.78, -0.1 * h)], h * 0.06, m, 0.6),
  );
}
const CORAL = ["#ff6a8a", "#ff9a5a", "#ffd0e0", "#e84a6a", "#ffb0c8"];
const FLOWER = ["#ff8ac0", "#ffe04a", "#ffffff", "#c88aff", "#ff9a5a"];
function crownOf() {
  const gd = gold(), g = G(M(cyl(0.2, 0.17, 0.14, 12, true), gd, 0, 0.07, 0));
  (g.children[0] as THREE.Mesh).material = Object.assign(gd, { side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(M(cone(0.045, 0.16, 5), gd, Math.cos(a) * 0.19, 0.2, Math.sin(a) * 0.19), M(sph(0.03), gem(i % 2 ? "#ff3a5a" : "#3ad8ff"), Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2));
  }
  return g;
}
function palm(h: number, lean: number) {
  const g = G(tube([V(0, 0, 0), V(lean * 0.3, h * 0.5, 0), V(lean, h, 0)], 0.06, std("#9a6a3a", { roughness: 0.8 }), 0.75));
  const leaf = std("#4ab850", { roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, l = scl(M(sph(0.5, 8, 5), leaf), 0.75, 0.05, 0.2);
    l.position.set(lean + Math.cos(a) * 0.32, h - 0.08, Math.sin(a) * 0.32);
    l.rotation.set(0, -a, -0.45);
    g.add(l);
  }
  return g;
}

type Part = (c: PartCtx, col: THREE.Color | null) => void;
const PARTS: Record<string, Part> = {
  // ---- 머리 ----
  crown: (c) => put(c, crownOf(), c.head, 1.1),
  wreath: (c) => { const g = G(rot(M(tor(0.2, 0.025), gold()), Math.PI / 2)); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(scl(M(sph(0.06, 6, 5), gold(), Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2), 1.3, 0.5, 0.8)); } g.position.y = 0.02; put(c, G(g), c.head); },
  helmet: (c) => { const gd = gold(); put(c, G(scl(M(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), gd, 0, -0.12, 0), 1.25, 1, 1), rot(M(tor(0.3, 0.05, Math.PI), std("#e83a4a", { emissive: "#e83a4a", emissiveIntensity: 0.3 }), -0.02, 0.06, 0)), M(box(0.04, 0.2, 0.34), gd, 0.36, -0.1, 0)), c.head); },
  hat: (c) => { const bl = std("#1a1a22", { roughness: 0.6 }), gd = gold(); put(c, G(scl(M(sph(0.3, 12, 8), bl, 0, 0.1, 0), 0.75, 0.6, 1.5), scl(M(sph(0.3, 12, 8), bl, 0, 0.02, 0), 1.0, 0.16, 1.7), rot(M(tor(0.21, 0.02), gd, 0, 0.06, 0), Math.PI / 2), M(sph(0.06), lit("#ffffff"), 0.2, 0.14, 0), M(cone(0.03, 0.3, 5), std("#e83a4a"), -0.1, 0.4, 0.1)), c.head, 1.1); },
  halo: (c, col) => { const h = rot(M(tor(0.3, 0.025), lit(col ?? "#fff0a0")), Math.PI / 2); h.position.y = 0.42; put(c, G(h), c.head); c.anim.push((t) => { h.rotation.z = t * 0.8; }); },
  petalcrest: (c, col) => { const m = std(col ?? c.accent, { side: THREE.DoubleSide, emissive: col ?? c.accent, emissiveIntensity: 0.2 }), g = G(); for (let i = 0; i < 7; i++) { const a = -1.1 + (i / 6) * 2.2, p = scl(M(sph(0.5, 8, 6), m), 0.16, 0.5, 0.05); p.position.set(Math.sin(a) * 0.22, 0.2 + Math.cos(a) * 0.12, 0); p.rotation.z = -a; g.add(p); } g.add(M(sph(0.08), lit("#ffe04a"), 0, 0.06, 0)); put(c, g, c.head); },
  unicorn: (c, col) => { const m = std(col ?? "#fff4d0", { emissive: col ?? "#ffe0a0", emissiveIntensity: 0.3, roughness: 0.3 }); const g = G(M(cone(0.07, 0.75, 8), m, 0, 0.36, 0)); if (col) g.add(rot(M(cone(0.04, 0.3, 6), m, 0.08, 0.36, 0), 0, 0, -0.8), rot(M(cone(0.035, 0.24, 6), m, -0.06, 0.5, 0), 0, 0, 0.7)); g.rotation.z = -0.9; put(c, g, at(c.head.p.clone().lerp(c.nose, 0.45), c.head.ang)); },
  antler: (c, col) => { const m = std(col ?? c.accent, { emissive: col ?? c.accent, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.35 }), g = G(); for (const s of [-1, 1]) g.add(tube([V(0, 0, s * 0.08), V(-0.06, 0.3, s * 0.16), V(-0.22, 0.6, s * 0.22)], 0.05, m, 0.5), tube([V(-0.05, 0.28, s * 0.15), V(0.12, 0.46, s * 0.24), V(0.16, 0.66, s * 0.28)], 0.035, m, 0.5), tube([V(-0.13, 0.44, s * 0.19), V(-0.3, 0.5, s * 0.3), V(-0.4, 0.66, s * 0.34)], 0.03, m, 0.5)); put(c, g, c.head); },
  lantern: (c, col) => { const k = col ?? new THREE.Color("#ffe84a"), g = G(tube([V(0, 0, 0), V(0.25, 0.55, 0), V(0.62, 0.5, 0)], 0.03, c.skin, 0.5), M(sph(0.1, 12, 10), lit(k), 0.62, 0.44, 0)); const halo = M(sph(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: k, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), 0.62, 0.44, 0); halo.name = "fx"; g.add(halo); put(c, g, c.head); c.anim.push((t) => halo.scale.setScalar(1 + Math.sin(t * 3) * 0.2)); },
  mane: (c, col) => { const m = std(col ?? c.accent, { emissive: col ?? c.accent, emissiveIntensity: 0.25, roughness: 0.5 }), g = G(); for (let i = 0; i < 11; i++) { const a = -1.5 + (i / 10) * 3.0; g.add(tube([V(0, Math.cos(a) * 0.1, Math.sin(a) * 0.3), V(-0.3, 0.05 + Math.cos(a) * 0.3, Math.sin(a) * 0.5), V(-0.75, Math.cos(a) * 0.22 - 0.05 * (i % 3), Math.sin(a) * 0.42)], 0.05, m, 0.35)); } put(c, g, at(c.head.p.clone().add(V(0, -c.H * 0.25, 0)), c.head.ang)); },
  umbrella: (c) => { const m = new THREE.MeshPhysicalMaterial({ color: "#d8f4ff", transparent: true, opacity: 0.55, roughness: 0.1, emissive: "#8ad8f0", emissiveIntensity: 0.3, side: THREE.DoubleSide }); put(c, G(M(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.05, 0), rot(M(tor(0.45, 0.025), lit("#ffffff"), 0, 0.05, 0), Math.PI / 2)), c.head); },
  ingot: (c) => put(c, G(M(box(0.55, 0.3, 0.6), gold(), 0.08, -0.02, 0), M(box(0.4, 0.06, 0.45), gold(), 0.08, 0.16, 0)), c.head),
  patch: (c) => { const bl = std("#141418", { roughness: 0.7 }), p = c.side(0.82, 1, c.H * 0.12); c.g.add(scl(M(sph(0.5, 10, 8), bl, p.x, p.y, p.z + c.H * 0.02), c.H * 0.26, c.H * 0.26, c.H * 0.06)); const st = rot(M(tor(c.W * 0.5, c.H * 0.02), bl), 0, Math.PI / 2, 0); st.position.set(p.x, p.y + c.H * 0.03, 0); st.rotation.x = 0.5; st.scale.set(1, c.H / c.W * 0.9, 1); c.g.add(st); },
  bigeye: (c) => { for (const s of [-1, 1]) { const p = c.side(0.8, s, c.H * 0.1), e = G(M(sph(0.5, 14, 10), std("#ffffff", { roughness: 0.15, emissive: "#ffffff", emissiveIntensity: 0.2 })), M(sph(0.32, 12, 8), lit(c.accent), 0, 0, s * 0.28), M(sph(0.17, 10, 8), std("#0a0a10"), 0, 0, s * 0.43)); e.position.copy(p); e.scale.setScalar(c.H * 0.42); c.g.add(e); } },
  cyclops: (c) => { const k = c.accent, e = G(M(sph(0.5, 20, 14), std("#f4f0ff", { roughness: 0.12, emissive: "#b8a8ff", emissiveIntensity: 0.35 })), M(sph(0.34, 16, 12), lit(k), 0.24, 0, 0), M(sph(0.2, 12, 10), std("#08060e"), 0.36, 0, 0), rot(M(tor(0.56, 0.03), lit(k)), 0, Math.PI / 2, 0)); e.position.copy(c.nose).add(V(-c.H * 0.1, c.H * 0.05, 0)); e.scale.setScalar(c.H * 0.95); c.g.add(e); const er = e.children[3]; c.anim.push((t) => { er.rotation.z = t * 0.6; }); },
  // ---- 주둥이 ----
  fangs: (c) => { const w = std("#fff8ec", { roughness: 0.25 }); for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, k = Math.floor(i / 2), f = M(cone(0.035, 0.26 - k * 0.05, 6), w); f.position.copy(c.nose).add(V(-c.H * (0.06 + k * 0.12), -c.H * 0.2, s * c.H * (0.07 + k * 0.05))); f.scale.setScalar(c.H); f.rotation.z = Math.PI + 0.25; c.g.add(f); } },
  beak: (c) => { const m = std("#ffd24a", { roughness: 0.3 }); for (const s of [1, -1]) { const b = scl(M(sph(0.5, 10, 8), m), c.H * 0.34, c.H * 0.2, c.H * 0.3); b.position.copy(c.nose).add(V(-c.H * 0.02, s * c.H * 0.07 - c.H * 0.05, 0)); c.g.add(b); } },
  trumpet: (c) => { const t = rot(M(cyl(0.3, 0.07, 0.5, 14, true), std(c.accent, { side: THREE.DoubleSide, emissive: c.accent, emissiveIntensity: 0.2 })), 0, 0, -Math.PI / 2); t.position.copy(c.nose).add(V(c.H * 0.2, 0, 0)); t.scale.setScalar(c.H); c.g.add(t); },
  spear: (c) => { const s = rot(M(cone(0.07, 1.6, 8), std("#e8f0f8", { metalness: 0.6, roughness: 0.25, emissive: c.accent, emissiveIntensity: 0.25 })), 0, 0, -Math.PI / 2); s.position.copy(c.nose).add(V(c.H * 0.72, 0, 0)); s.scale.setScalar(c.H); c.g.add(s); },
  trident: (c) => { const gd = gold(), g = G(rot(M(cyl(0.045, 0.045, 1.2, 8), gd, 0.6, 0, 0), 0, 0, Math.PI / 2), rot(M(cone(0.07, 0.4, 8), gd, 1.38, 0, 0), 0, 0, -Math.PI / 2), M(box(0.06, 0.06, 0.6), gd, 1.05, 0, 0)); for (const s of [-1, 1]) g.add(rot(M(cone(0.055, 0.42, 8), gd, 1.28, 0, s * 0.28), 0, 0, -Math.PI / 2)); g.position.copy(c.nose); g.scale.setScalar(c.H); c.g.add(g); },
  saber: (c) => { const s = scl(tube([V(0, 0, 0), V(0.6, 0.06, 0), V(1.1, 0.3, 0), V(1.4, 0.7, 0)], 0.1, std("#dfe6ee", { metalness: 0.7, roughness: 0.2 }), 0.15), 1, 1, 0.35); s.position.copy(c.nose); s.scale.multiplyScalar(c.H); c.g.add(s); },
  hook: (c) => { const h = tube([V(0, 0, 0), V(0.45, 0.02, 0), V(0.62, -0.2, 0), V(0.45, -0.42, 0), V(0.25, -0.34, 0)], 0.06, iron("#b8c0c8"), 0.5); h.position.copy(c.nose); h.scale.setScalar(c.H); c.g.add(h); },
  whisk: (c) => { for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const w = tube([V(0, -0.1, s * 0.08), V(0.3, -0.25 - i * 0.1, s * (0.3 + i * 0.15)), V(-0.2, -0.6 - i * 0.15, s * (0.55 + i * 0.2)), V(-0.9, -0.75 - i * 0.2, s * (0.6 + i * 0.25))], 0.035, c.skin, 0.3); w.position.copy(c.nose).add(V(-c.H * 0.05, 0, 0)); w.scale.setScalar(c.H); c.g.add(w); } },
  tripod: (c) => { const m = std(c.base.clone().lerp(new THREE.Color("#ffffff"), 0.4)); for (const [u, s] of [[0.7, 1], [0.7, -1], [0.12, 0]] as const) { const l = tube([V(0, 0, 0), V(0.05, -0.9, s * 0.3), V(0.1, -1.8, s * 0.5)], 0.03, m, 0.5); l.position.copy(c.side(u, s || 1, -c.H * 0.4)); if (!s) l.position.z = 0; l.scale.setScalar(c.H); c.g.add(l); } },
  // ---- 등 ----
  coral: (c) => row(c, 5, 0.3, 0.72, (i) => rot(coralBranch(CORAL[i % 5], 0.42 + (i % 3) * 0.14, i % 2 ? 1 : -1), 0, i * 1.3, 0), 0.8),
  garden: (c) => { const n = 9; for (let i = 0; i < n; i++) { const a = c.back(0.22 + (0.56 * i) / (n - 1)), col = FLOWER[i % 5], g = G(M(cyl(0.035, 0.05, 0.22, 6), std("#5ab860"), 0, 0.11, 0)); for (let k = 0; k < 6; k++) { const q = (k / 6) * Math.PI * 2; g.add(scl(M(sph(0.5, 6, 5), std(col, { emissive: col, emissiveIntensity: 0.25 }), Math.cos(q) * 0.09, 0.26, Math.sin(q) * 0.09), 0.14, 0.09, 0.14)); } g.add(M(sph(0.05, 6, 5), lit("#fff0a0"), 0, 0.27, 0)); const o = put(c, g, a, 0.9 + (i % 3) * 0.25); o.position.z += ((i % 3) - 1) * c.W * 0.22; } },
  crystals: (c, col) => row(c, 6, 0.25, 0.75, (i) => { const k = crystal(0.32 + (i % 3) * 0.14, 0.06, col ?? c.accent, col ?? c.accent); k.position.y = 0.16; return rot(G(k), ((i % 3) - 1) * 0.35, 0, (i % 2 ? 1 : -1) * 0.25); }),
  spikes: (c, col) => row(c, 7, 0.2, 0.8, (i) => G(M(cone(0.08, 0.34 + (i % 2) * 0.16, 7), std(col ?? "#d8d0c0", { roughness: 0.8 }), 0, 0.15, 0))),
  gems: (c, col) => { const m = gem(col ?? c.accent); row(c, 6, 0.24, 0.76, (i) => G(scl(M(new THREE.OctahedronGeometry(0.11), m, 0, 0.06, ((i % 3) - 1) * 0.16), 1, 1.25, 1))); },
  plates: (c, col) => { const m = std(col ?? "#c8d0d8", { metalness: 0.7, roughness: 0.3, emissive: col ?? "#000000", emissiveIntensity: 0.15 }); row(c, 8, 0.15, 0.82, () => G(scl(M(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, -0.06, 0), 0.34, 0.22, 0.7))); },
  barnacles: (c) => { const m = std("#e8e0d0", { roughness: 0.9 }); for (let i = 0; i < 12; i++) { const a = c.back(0.2 + (i / 11) * 0.6), b = G(M(cyl(0.035, 0.08, 0.1, 7), m, 0, 0.03, 0), M(sph(0.03, 6, 4), std("#3a3028"), 0, 0.08, 0)); const o = put(c, b, a); o.position.z += (((i * 7) % 5) - 2) * c.W * 0.13; } },
  sail: (c, col) => { const sh = new THREE.Shape(); sh.moveTo(-0.9, 0); sh.bezierCurveTo(-0.7, 0.7, -0.2, 1.25, 0.3, 1.3); sh.bezierCurveTo(0.45, 0.8, 0.6, 0.3, 0.7, 0); sh.closePath(); const f = softFin(sh, std(col ?? c.accent, { side: THREE.DoubleSide, roughness: 0.6 }), 0.03); const a = c.back(0.52); put(c, G(f), at(a.p.clone().add(V(0, -c.H * 0.08, 0)), a.ang), Math.max(0.45, (0.42 * c.L) / c.S)); c.anim.push((t) => { f.rotation.x = Math.sin(t * 1.6) * 0.08; }); },
  shell: (c) => { const m = std(c.base.clone().multiplyScalar(0.6), { roughness: 0.45, emissive: c.accent, emissiveIntensity: 0.08 }), a = c.back(0.48); const g = G(scl(M(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m), 1, 0.75, 1), rot(M(tor(0.5, 0.045), std(c.accent, { roughness: 0.4 })), Math.PI / 2)); g.scale.set(c.L * 0.62 / c.S, 0.9 * c.H / c.S, c.W * 1.02 / c.S); put(c, g, at(a.p.clone().add(V(0, -c.H * 0.2, 0)), a.ang)); },
  conch: (c) => { const m = std("#ffe0c0", { roughness: 0.4, emissive: "#ff9a70", emissiveIntensity: 0.15 }), g = G(); for (let i = 0; i < 7; i++) { const r = 0.3 - i * 0.036, a = i * 1.15; g.add(M(sph(r, 10, 8), m, -i * 0.11 + Math.cos(a) * 0.04, 0.1 + i * 0.07, Math.sin(a) * 0.05)); } g.add(rot(M(cone(0.05, 0.24, 7), m, -0.82, 0.62, 0), 0, 0, 0.9)); put(c, g, c.back(0.5), 1.15); },
  tower: (c) => { const m = std("#f0d898", { roughness: 0.9 }), g = G(M(cyl(0.2, 0.26, 0.3, 10), m, 0, 0.1, 0)); for (const [x, h] of [[0, 0.5], [-0.3, 0.32], [0.3, 0.32]] as const) g.add(M(cyl(0.09, 0.11, h, 8), m, x, 0.1 + h / 2, 0), M(cone(0.13, 0.18, 8), std("#e87a5a"), x, 0.19 + h, 0)); put(c, g, c.back(0.5)); },
  lid: (c) => { const wd = std("#7a4a22", { roughness: 0.7 }), gd = gold(), g = G(rot(M(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 12, 1, false, 0, Math.PI), wd), 0, 0, Math.PI / 2), M(box(0.12, 0.2, 0.08), gd, 0, 0.05, 0.34)); (g.children[0] as THREE.Mesh).rotation.set(Math.PI / 2, 0, Math.PI / 2); for (const x of [-0.3, 0, 0.3]) g.add(rot(M(tor(0.35, 0.03, Math.PI), gd, x, 0, 0), 0, Math.PI / 2, 0)); const a = c.back(0.48); put(c, g, at(a.p.clone().add(V(0, -c.H * 0.12, 0)), a.ang), 1.1); },
  harp: (c) => { const gd = gold(), g = G(tube([V(-0.5, 0, 0), V(-0.45, 0.6, 0), V(0.1, 0.9, 0), V(0.5, 0.55, 0)], 0.04, gd, 0.9)); for (let i = 0; i < 6; i++) { const x = -0.38 + i * 0.15, h = 0.5 + Math.sin((i / 5) * Math.PI) * 0.3; g.add(M(cyl(0.008, 0.008, h, 4), lit("#fff4c0"), x, h / 2, 0)); } put(c, g, c.back(0.5)); },
  wheel: (c) => { const wd = std("#8a5a2a", { roughness: 0.6 }), w = G(M(tor(0.4, 0.05), wd), M(sph(0.09), gold())); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; w.add(rot(M(cyl(0.025, 0.025, 1.0, 5), wd, 0, 0, 0), 0, 0, a)); } w.position.y = 0.5; put(c, G(w), c.back(0.5)); c.anim.push((t) => { w.rotation.z = t * 0.5; }); },
  cannon: (c) => { const ir = iron("#22262c"), g = G(rot(M(cyl(0.13, 0.17, 0.9, 12), ir, 0.1, 0.3, 0), 0, 0, -Math.PI / 2 + 0.25), rot(M(tor(0.15, 0.03), ir, 0.5, 0.4, 0), 0, Math.PI / 2, 0.25), M(box(0.5, 0.14, 0.4), std("#6a4424", { roughness: 0.8 }), -0.05, 0.1, 0)); for (const s of [-1, 1]) g.add(rot(M(cyl(0.14, 0.14, 0.05, 10), std("#4a2f18"), -0.05, 0.12, s * 0.24), Math.PI / 2)); put(c, g, c.back(0.6), 1.1); },
  wreck: (c) => { const wd = std("#6a4a2c", { roughness: 0.85 }), g = G(); for (let i = 0; i < 6; i++) g.add(rot(M(box(0.9 - (i % 3) * 0.2, 0.05, 0.16), wd, -0.2 + (i % 2) * 0.25, 0.06 + i * 0.04, ((i % 3) - 1) * 0.3), (i % 3 - 1) * 0.15, i * 0.5, (i % 2 ? 1 : -1) * 0.12)); g.add(rot(M(cyl(0.035, 0.05, 1.3, 6), wd, -0.25, 0.65, 0), 0, 0, 0.18), rot(M(box(0.5, 0.03, 0.03), wd, -0.33, 1.0, 0), 0, 0.3, 0.18), M(new THREE.PlaneGeometry(0.45, 0.4), std("#d8cca8", { side: THREE.DoubleSide, roughness: 0.9 }), -0.34, 0.78, 0.02)); put(c, g, c.back(0.4), 1.2); },
  island: (c) => { const sand = std("#f0dca0", { roughness: 0.95 }), a = c.back(0.5), g = G(scl(M(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), sand), 1.25, 0.42, 1.05), scl(M(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std("#6ab850", { roughness: 0.9 }), -0.1, 0.1, 0), 0.7, 0.22, 0.6), scl(M(sph(0.12, 7, 6), std("#8a8a88", { roughness: 0.9 }), 0.4, 0.14, 0.25), 1.2, 0.8, 1), scl(M(sph(0.09, 7, 6), std("#9a9a98", { roughness: 0.9 }), -0.45, 0.12, -0.25), 1.2, 0.8, 1)); const p1 = palm(0.9, 0.25), p2 = palm(0.65, -0.3); p1.position.set(-0.05, 0.18, 0.05); p2.position.set(0.28, 0.15, -0.18); g.add(p1, p2); g.scale.set(c.L * 0.5 / c.S, 1.1 * c.H / c.S, c.W * 0.62 / c.S); put(c, g, at(a.p.clone().add(V(0, -c.H * 0.06, 0)), a.ang)); c.anim.push((t) => { p1.rotation.z = Math.sin(t * 0.9) * 0.05; p2.rotation.z = Math.sin(t * 0.9 + 1) * 0.06; }); },
  starmark: (c) => { const m = std(c.accent, { emissive: c.accent, emissiveIntensity: 0.3 }), g = G(M(sph(0.12, 8, 6), m)); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(rot(scl(M(cone(0.1, 0.42, 6), m, Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24), 1, 1, 0.5), Math.PI / 2, 0, 0)); (g.children[g.children.length - 1] as THREE.Mesh).rotation.set(0, -a, -Math.PI / 2); } g.scale.y = 0.35; put(c, g, c.back(0.5), 1.5); },
  skull: (c) => { const w = std("#f4f0e8", { roughness: 0.6 }), bl = std("#141418"), g = G(scl(M(sph(0.3, 12, 8), w), 1, 0.3, 0.9), scl(M(box(0.22, 0.1, 0.34), w, 0.26, 0, 0), 1, 0.6, 1)); for (const s of [-1, 1]) g.add(scl(M(sph(0.08, 8, 6), bl, 0.06, 0.07, s * 0.12), 1, 0.4, 1)); put(c, g, c.back(0.52), 1.6); },
  compass: (c) => { const g = G(rot(M(tor(0.3, 0.035), gold()), Math.PI / 2), scl(M(cyl(0.29, 0.29, 0.03, 16), std("#fff8e8")), 1, 1, 1), rot(scl(M(cone(0.06, 0.26, 4), std("#e8302a", { emissive: "#e8302a", emissiveIntensity: 0.3 }), 0.13, 0.03, 0), 1, 1, 0.4), 0, 0, -Math.PI / 2), rot(scl(M(cone(0.06, 0.26, 4), std("#3a4048"), -0.13, 0.03, 0), 1, 1, 0.4), 0, 0, Math.PI / 2)); put(c, g, c.back(0.52), 1.5); },
  map: (c) => { const red = std("#d8302a", { emissive: "#d8302a", emissiveIntensity: 0.3 }), g = G(rot(M(box(0.34, 0.03, 0.07), red, 0.2, 0, 0.1), 0, 0.78, 0), rot(M(box(0.34, 0.03, 0.07), red, 0.2, 0, 0.1), 0, -0.78, 0)); for (let i = 0; i < 6; i++) g.add(M(box(0.07, 0.025, 0.035), std("#5a3a20"), -0.5 + i * 0.11, 0, -0.2 + Math.sin(i * 1.1) * 0.12 + i * 0.05)); put(c, g, c.back(0.5), 1.8); },
  fuse: (c) => { const sp = M(sph(0.07), lit("#ffb030"), 0.12, 0.42, 0); put(c, G(tube([V(0, 0, 0), V(0.02, 0.25, 0), V(0.12, 0.42, 0)], 0.03, std("#c8b890"), 0.8), sp), c.back(0.55)); c.anim.push((t) => sp.scale.setScalar(1 + Math.sin(t * 9) * 0.35)); },
  // ---- 몸통 ----
  bands: (c, col) => { const m = std(col ?? "#ffd060", { metalness: 0.7, roughness: 0.3 }); for (const u of [0.3, 0.5, 0.7]) { const a = c.back(u), b = c.side(u, 1), ry = Math.max(0.05, a.p.y - (a.p.y - c.H * 0.46 * Math.sqrt(Math.max(0.05, 1 - (2 * u - 1) ** 2)))), r = M(tor(1, 0.045), m); r.position.set(a.p.x, a.p.y - ry, 0); r.rotation.set(0, Math.PI / 2, 0); r.scale.set(Math.abs(b.z) * 1.03, ry * 1.03, Math.max(c.H, 0.3)); const w = new THREE.Group(); w.add(r); w.rotation.z = a.ang; c.g.add(w); } },
  necklace: (c) => { const gd = gold(); for (const [u, k] of [[0.74, 1], [0.7, 1.12], [0.66, 1.24]] as const) { const a = c.back(u), b = c.side(u, 1), ry = c.H * 0.46 * Math.sqrt(Math.max(0.05, 1 - (2 * u - 1) ** 2)), r = M(tor(1, 0.05), gd); r.position.set(a.p.x, a.p.y - ry, 0); r.rotation.set(0, Math.PI / 2, 0.25); r.scale.set(Math.abs(b.z) * k, ry * k, Math.max(c.H, 0.3)); c.g.add(r); } const pd = M(new THREE.OctahedronGeometry(0.1), gem("#ff3a5a")); pd.position.copy(c.side(0.68, 1, -c.H * 0.5)); pd.position.z = 0; pd.scale.setScalar(c.H * 1.2); c.g.add(pd); },
  chain: (c) => { const m = iron("#8a929c"); for (let i = 0; i < 14; i++) { const u = 0.15 + (i / 13) * 0.7, s = Math.sin(i * 0.9) > 0 ? 1 : -1, p = c.side(u, s, c.H * (0.25 + 0.2 * Math.cos(i * 0.9))), l = M(tor(0.085, 0.028), m); l.position.copy(p).multiplyScalar(1.03); l.rotation.set(i % 2 ? 0 : Math.PI / 2, i * 0.4, 0); l.scale.setScalar(Math.max(c.H, 0.3)); c.g.add(l); } },
  runes: (c) => { const m = lit(c.accent); for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const p = c.side(0.2 + i * 0.1, s, c.H * 0.06), r = M(i % 2 ? tor(0.07, 0.018) : box(0.03, 0.16, 0.02), m); r.position.copy(p).multiplyScalar(1.02); r.rotation.y = i % 2 ? 0 : 0; r.scale.setScalar(Math.max(c.H, 0.3)); c.g.add(r); } },
  dots: (c, col) => { const m = lit(col ?? c.accent); for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const d = M(sph(0.045, 6, 5), m); d.position.copy(c.side(0.16 + i * 0.11, s, -c.H * 0.05)).multiplyScalar(1.02); d.scale.setScalar(Math.max(c.H, 0.3)); c.g.add(d); } },
  stars: (c) => { const m = lit("#ffffff"); for (let i = 0; i < 44; i++) { const u = 0.08 + (((i * 0.618) % 1) * 0.84), s = i % 2 ? 1 : -1, k = ((i * 0.377) % 1), a = c.back(u), b = c.side(u, s), d = M(sph(i % 5 ? 0.022 : 0.04, 5, 4), m); d.position.set(a.p.x, a.p.y - (1 - Math.sqrt(1 - k * k)) * c.H * 0.3 + 0.01, b.z * k); d.scale.setScalar(Math.max(c.H, 0.4)); c.g.add(d); } },
  coins: (c) => { const gd = gold(); for (const s of [-1, 1]) for (let i = 0; i < 8; i++) { const d = rot(M(cyl(0.085, 0.085, 0.02, 10), gd), Math.PI / 2); d.position.copy(c.side(0.18 + i * 0.09, s, c.H * (((i * 3) % 4) - 1.5) * 0.12)).multiplyScalar(1.03); d.scale.setScalar(Math.max(c.H, 0.3)); c.g.add(d); } },
  wings: (c) => { for (const s of [-1, 1]) { const w = sideFin(1.0, std("#fff8e8", { side: THREE.DoubleSide, emissive: "#ffe0a0", emissiveIntensity: 0.25, roughness: 0.4 })), h = new THREE.Group(); h.add(w); h.position.copy(c.side(0.6, s, c.H * 0.25)); w.rotation.set(s * 0.5, 0, 0.9); w.scale.setScalar(Math.max(c.H, 0.3)); c.g.add(h); c.anim.push((t) => { h.rotation.x = s * (0.2 + Math.sin(t * 4) * 0.35); }); } },
  petals: (c) => { const m = std(c.accent, { side: THREE.DoubleSide, emissive: c.accent, emissiveIntensity: 0.15 }), a = c.back(0.62); for (let i = 0; i < 9; i++) { const q = (i / 9) * Math.PI * 2, p = scl(M(sph(0.5, 8, 6), m), 0.2, 0.75, 0.04), h = new THREE.Group(); p.position.y = 0.45; h.add(p); h.rotation.set(q, 0, 0.55); h.position.set(a.p.x, a.p.y - c.H * 0.46, 0); h.scale.setScalar(c.H); c.g.add(h); } },
  leaves: (c) => { const m = std("#4ab860", { side: THREE.DoubleSide, roughness: 0.6 }); for (let i = 0; i < 8; i++) { const u = 0.2 + (i / 7) * 0.55, s = i % 2 ? 1 : -1, l = scl(M(sph(0.5, 8, 5), m), 0.75, 0.04, 0.17), h = new THREE.Group(); l.position.x = -0.36; h.add(l); h.position.copy(i % 3 ? c.side(u, s, c.H * 0.2) : c.back(u).p); h.rotation.set(0, s * 0.5, 0.5 - (i % 3) * 0.4); h.scale.setScalar(Math.max(c.H, 0.3) * 1.2); c.g.add(h); c.anim.push((t) => { h.rotation.y = s * 0.5 + Math.sin(t * 1.8 + i) * 0.18; }); } },
  handles: (c) => { const m = std(c.base.clone().multiplyScalar(0.8)); for (const s of [-1, 1]) { const h = M(tor(0.2, 0.045, Math.PI), m); h.position.copy(c.side(0.55, s, c.H * 0.12)); h.rotation.set(Math.PI / 2, 0, s * -Math.PI / 2); h.scale.setScalar(c.H); c.g.add(h); } },
  // ---- 꼬리 ----
  anchor: (c) => { const ir = iron("#4a525c"), g = G(rot(M(cyl(0.05, 0.05, 0.8, 8), ir, -0.4, 0, 0), 0, 0, Math.PI / 2), M(tor(0.09, 0.03), ir, 0.02, 0, 0), M(box(0.06, 0.5, 0.06), ir, -0.18, 0, 0), rot(M(tor(0.34, 0.055, Math.PI), ir, -0.62, 0, 0), 0, 0, Math.PI / 2)); for (const s of [-1, 1]) g.add(rot(M(cone(0.09, 0.2, 4), ir, -0.62, s * 0.36, 0), 0, 0, s > 0 ? 0 : Math.PI)); g.position.copy(c.tail).add(V(-c.H * 0.25, 0, 0)); g.scale.setScalar(c.H * 1.1); c.g.add(g); },
  key: (c) => { const gd = gold(), g = G(rot(M(cyl(0.045, 0.045, 0.9, 8), gd, -0.45, 0, 0), 0, 0, Math.PI / 2), M(tor(0.16, 0.045), gd, -1.02, 0, 0), M(box(0.07, 0.22, 0.05), gd, -0.12, -0.12, 0), M(box(0.07, 0.16, 0.05), gd, -0.26, -0.1, 0)); g.position.copy(c.tail).add(V(-c.H * 0.3, 0, 0)); g.scale.setScalar(c.H); c.g.add(g); },
  leaftail: (c) => { const m = std("#4ab860", { side: THREE.DoubleSide, roughness: 0.6 }); for (let i = 0; i < 3; i++) { const l = scl(M(sph(0.5, 8, 5), m), 1.3, 0.05, 0.22), h = new THREE.Group(); l.position.x = -0.7; h.add(l); h.position.copy(c.tail); h.rotation.set((i - 1) * 0.5, 0, (i - 1) * 0.35); h.scale.setScalar(Math.max(c.H, 0.3)); c.g.add(h); c.anim.push((t) => { h.rotation.y = Math.sin(t * 2.2 + i) * 0.3; }); } },
  tentacles: (c, col) => { for (let i = 0; i < 7; i++) { const v = veil(c.H * 3.2, c.H * 0.3, col ?? c.accent, 0.5, c.anim, i * 1.3); v.position.set(c.tail.x * 0.3 + c.nose.x * 0.2, c.tail.y - c.H * 0.35, ((i % 3) - 1) * c.W * 0.3); v.rotation.set((i - 3) * 0.3, 0, 0.6 + (i % 3) * 0.2); c.g.add(v); } },
  school: (c) => { const sw = new THREE.Group(), m = std(c.accent, { emissive: c.accent, emissiveIntensity: 0.3 }); for (let i = 0; i < 10; i++) { const f = G(scl(M(sph(0.5, 8, 6), m), 0.3, 0.14, 0.08), rot(M(cone(0.07, 0.14, 4), m, -0.2, 0, 0), 0, 0, -Math.PI / 2)); f.userData.ph = (i / 10) * Math.PI * 2; sw.add(f); } sw.scale.setScalar(c.H); c.g.add(sw); c.anim.push((t) => sw.children.forEach((f, i) => { const a = (f.userData.ph as number) + t * 0.5, r = (c.L / c.H) * (0.42 + (i % 3) * 0.08); f.position.set(Math.cos(a) * r, Math.sin(a * 1.7 + i) * 0.5 + 0.2, Math.sin(a) * (0.9 + (i % 2) * 0.3)); f.rotation.y = -a - Math.PI / 2; })); },
  glassy: (c) => { c.skin.transparent = true; c.skin.opacity = 0.55; c.skin.emissive = c.accent.clone(); c.skin.emissiveIntensity = 0.3; },
};

export function addUwParts(c: PartCtx) {
  for (const f of c.feats) {
    const [name, arg] = f.split(":");
    PARTS[name]?.(c, arg ? new THREE.Color(arg) : null);
  }
}

/** 물고기 모양이 아닌 체형. 만들었으면 몸의 치수와 머리 자리 등을 돌려준다(아니면 null) */
export interface BodyOut { cx: number; cy: number; hx: number; hy: number; hz: number; head?: Anchor; nose?: THREE.Vector3; tail?: THREE.Vector3; back?: (u: number) => Anchor }
export function buildUwBody(kind: string, o: { g: THREE.Group; skin: THREE.MeshPhysicalMaterial; finMat: THREE.Material; base: THREE.Color; accent: THREE.Color; anim: Anim; bead: (r: number, x: number, y: number, z: number) => void }): BodyOut | null {
  const { g, skin, finMat, anim } = o;
  if (kind === "turtle") {
    const flesh = std(o.base.clone().lerp(new THREE.Color("#fff4c8"), 0.45), { roughness: 0.45 });
    g.add(scl(M(sph(0.5, 28, 18), skin), 1.05, 0.5, 0.86), scl(M(sph(0.5, 20, 10), flesh, 0, -0.07, 0), 0.98, 0.3, 0.8), rot(scl(M(tor(0.5, 0.035), std(o.base.clone().multiplyScalar(0.7))), 1.05, 0.86, 1), Math.PI / 2));
    (g.children[g.children.length - 1] as THREE.Mesh).position.y = -0.02;
    g.add(scl(M(sph(0.5, 16, 12), flesh, 0.66, 0.04, 0), 0.36, 0.3, 0.3), rot(M(cyl(0.1, 0.12, 0.2, 10), flesh, 0.5, 0.0, 0), 0, 0, Math.PI / 2), rot(M(cone(0.06, 0.24, 6), flesh, -0.58, -0.03, 0), 0, 0, Math.PI / 2));
    for (const s of [-1, 1]) {
      o.bead(0.045, 0.74, 0.09, s * 0.12);
      const f = sideFin(0.62, flesh), h = new THREE.Group(); f.rotation.set(s * 1.25, 0.2, -0.5); h.add(f); h.position.set(0.3, -0.05, s * 0.36); g.add(h);
      const r = sideFin(0.34, flesh), hr = new THREE.Group(); r.rotation.set(s * 1.3, 0.2, -1.1); hr.add(r); hr.position.set(-0.36, -0.06, s * 0.32); g.add(hr);
      anim.push((t) => { h.rotation.x = s * Math.sin(t * 1.6) * 0.35; hr.rotation.x = -s * Math.sin(t * 1.6) * 0.2; });
    }
    return { cx: 0, cy: 0, hx: 0.5, hy: 0.25, hz: 0.42, head: at(V(0.66, 0.19, 0)), nose: V(0.84, 0.03, 0), tail: V(-0.6, -0.03, 0) };
  }
  if (kind === "jelly") {
    skin.transparent = true; skin.opacity = 0.78; skin.side = THREE.DoubleSide; skin.emissive = o.accent.clone(); skin.emissiveIntensity = 0.55;
    const bell = scl(M(new THREE.SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), skin, 0, 0.1, 0), 1, 0.85, 1), core = M(sph(0.2, 12, 10), lit(o.accent.clone().lerp(new THREE.Color("#ffffff"), 0.5)), 0, 0.2, 0);
    const legs = new THREE.Group(), tm = std(o.accent, { emissive: o.accent, emissiveIntensity: 0.5, roughness: 0.4 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r = 0.36, L = 0.9 + (i % 3) * 0.35; legs.add(tube([V(Math.cos(a) * r, 0.02, Math.sin(a) * r), V(Math.cos(a) * r * 0.9 - 0.1, -L * 0.45, Math.sin(a) * r * 0.9), V(Math.cos(a) * r * 0.6 - 0.3, -L, Math.sin(a) * r * 0.6)], 0.022, tm, 0.3)); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; legs.add(tube([V(Math.cos(a) * 0.1, 0.05, Math.sin(a) * 0.1), V(Math.cos(a) * 0.16 - 0.1, -0.4, Math.sin(a) * 0.16), V(Math.cos(a) * 0.1 - 0.25, -0.8, Math.sin(a) * 0.1)], 0.07, skin, 0.4)); }
    g.add(bell, core, legs);
    anim.push((t) => { const k = Math.sin(t * 1.8); bell.scale.set(1 + k * 0.06, 0.85 - k * 0.07, 1 + k * 0.06); legs.scale.y = 1 + k * 0.08; });
    return { cx: 0, cy: 0.13, hx: 0.48, hy: 0.38, hz: 0.48, head: at(V(0, 0.5, 0)), nose: V(0.5, 0.15, 0), tail: V(-0.2, -0.3, 0) };
  }
  if (kind === "seahorse") {
    // 서 있는 S자 몸: 꼬리 끝(말린 고리)에서 배, 가슴, 목, 머리까지 구슬을 이어 만든다
    const pts: Array<[number, number, number]> = [[0.16, -0.78, 0.035], [0.26, -0.84, 0.045], [0.34, -0.78, 0.05], [0.33, -0.68, 0.055], [0.24, -0.62, 0.06], [0.12, -0.6, 0.07], [0.02, -0.52, 0.085], [-0.04, -0.4, 0.105], [-0.05, -0.26, 0.13], [-0.02, -0.1, 0.165], [0.03, 0.04, 0.185], [0.05, 0.18, 0.17], [0.02, 0.32, 0.14], [-0.02, 0.44, 0.115], [0.0, 0.56, 0.12], [0.08, 0.64, 0.14]];
    for (const [x, y, r] of pts) g.add(scl(M(sph(r, 12, 10), skin, x, y, 0), 1, 1, 0.85));
    g.add(tube([V(0.16, 0.62, 0), V(0.32, 0.58, 0), V(0.46, 0.55, 0)], 0.055, skin, 0.75));
    for (const s of [-1, 1]) { o.bead(0.04, 0.13, 0.69, s * 0.105); const f = sideFin(0.22, finMat); f.position.set(0.04, 0.44, s * 0.1); f.rotation.set(s * 1.1, 0, -0.4); g.add(f); }
    const sh = new THREE.Shape(); sh.moveTo(0, -0.16); sh.bezierCurveTo(-0.2, -0.1, -0.22, 0.12, 0, 0.18); sh.closePath();
    const df = softFin(sh, finMat, 0.02); df.position.set(-0.13, 0.05, 0); g.add(df);
    for (let i = 0; i < 4; i++) g.add(rot(M(cone(0.03, 0.12, 5), finMat, -0.06 + i * 0.05, 0.76 + (i % 2) * 0.02, 0), 0, 0, 0.5 - i * 0.3));
    anim.push((t) => { df.rotation.y = Math.sin(t * 9) * 0.5; });
    const spine = (u: number): Anchor => { const k = 5 + u * 9, i = Math.min(pts.length - 2, Math.floor(k)), f = k - i, a = pts[i], b = pts[i + 1], r = a[2] + (b[2] - a[2]) * f; return at(V(a[0] + (b[0] - a[0]) * f - r * 0.9, a[1] + (b[1] - a[1]) * f, 0), Math.PI / 2); };
    return { cx: 0.05, cy: 0, hx: 0.3, hy: 0.16, hz: 0.14, head: at(V(0.06, 0.78, 0)), nose: V(0.48, 0.55, 0), tail: V(0.2, -0.8, 0), back: spine };
  }
  return null;
}
