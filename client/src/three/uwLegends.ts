import * as THREE from "three";
import { auraShell, buildFish, crystal, dorsalFin, profileBody, sideFin, softFin, sparkField, tailFin, tube, veil } from "./fishModel";
import type { Anim } from "./fishModel";
import { C, finish, flat, glass, glow, grad, phys } from "./legendKit";
import type { Maker } from "./legendKit";
import { dragonHead, eyeBall, finishMythic, glowTex, raysTex, ring, serpent } from "./mythModels";

// 수중 탐험의 전설(구역마다 3종)과 신화(구역마다 1종): 스물네 종이 모두 다른 생물이고, 저마다 전용 모델과 오라를 가진다.
// 길이 방향은 +x(머리), 위는 +y, 폭은 z.
type P3 = [number, number, number];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), PI = Math.PI, PI2 = PI * 2;
const sph = (r = 0.5, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (a: number, b: number, h: number, n = 12, open = false) => new THREE.CylinderGeometry(a, b, h, n, 1, open);
const cone = (r: number, h: number, n = 8) => new THREE.ConeGeometry(r, h, n);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const tor = (r: number, t: number, arc = PI2, seg = 28) => new THREE.TorusGeometry(r, t, 8, seg, arc);
const dome = (r = 0.5, w = 24, h = 10) => new THREE.SphereGeometry(r, w, h, 0, PI2, 0, PI / 2);
const M = (geo: THREE.BufferGeometry, mat: THREE.Material, p: P3 = [0, 0, 0], r: P3 = [0, 0, 0], s: P3 | number = 1) => {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(...p); o.rotation.set(...r);
  if (typeof s === "number") o.scale.setScalar(s); else o.scale.set(...s);
  return o;
};
const G = (p: P3 = [0, 0, 0], ...kids: THREE.Object3D[]) => { const g = new THREE.Group(); g.position.set(...p); if (kids.length) g.add(...kids); return g; };
const lit = (c: string) => new THREE.MeshBasicMaterial({ color: c });
const add = (c: string, op = 0.5) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const gold = (c = "#ffcf40") => phys(c, { metalness: 0.8, roughness: 0.22, emissive: C("#b87a00"), emissiveIntensity: 0.5 });
const gem = (c: string) => phys(c, { roughness: 0.08, emissive: C(c), emissiveIntensity: 0.9 });
const iron = (c = "#2a2e36") => phys(c, { metalness: 0.7, roughness: 0.45, clearcoat: 0.2 });
const wood = (c = "#6a4426") => phys(c, { roughness: 0.85, clearcoat: 0 });
const cloth = (c: string, op = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide, transparent: op < 1, opacity: op });

/** 부드러운 빛 덩어리(오라용) */
function spr(color: string, size: number, op = 0.4, map = glowTex()) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1); s.name = "fx";
  return s;
}
/** 떠오르거나 흘러가는 빛 알갱이. colors 를 여러 개 주면 섞인다. vel: 초당 움직임 */
function motes(g: THREE.Group, anim: Anim, colors: string[], n: number, half: P3, vel: P3, size = 0.09, center: P3 = [0, 0, 0]) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed: number[] = [];
  for (let i = 0; i < n; i++) { seed.push(Math.random(), Math.random(), Math.random()); const c = C(colors[i % colors.length]); col.set([c.r, c.g, c.b], i * 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.name = "fx"; pts.frustumCulled = false;
  g.add(pts);
  const wrap = (v: number) => ((v % 1) + 1) % 1;
  anim.push((t) => {
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = center[k] + (wrap(seed[i * 3 + k] + (t * vel[k]) / (2 * half[k] || 1)) * 2 - 1) * half[k] + (k !== 1 ? Math.sin(t * 1.3 + i) * 0.05 : 0);
    geo.attributes.position.needsUpdate = true;
  });
}
/** 그림을 그려 만든 몸 재질(무늬가 어두운 물속에서도 보이게 스스로 조금 빛난다) */
function painted(draw: (x: CanvasRenderingContext2D, W: number, H: number) => void, o: THREE.MeshPhysicalMaterialParameters = {}, W = 512, H = 256) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  draw(c.getContext("2d")!, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshPhysicalMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.22, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.16, ...o });
}
const vgrad = (x: CanvasRenderingContext2D, W: number, H: number, stops: Array<[number, string]>) => { const g = x.createLinearGradient(0, 0, 0, H); stops.forEach(([p, c]) => g.addColorStop(p, c)); x.fillStyle = g; x.fillRect(0, 0, W, H); };
const rnd = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
/** 점들을 부드럽게 이은 지느러미(끝점은 처음으로 닫힌다) */
function fin(pts: Array<[number, number]>, mat: THREE.Material, depth = 0.03) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  sh.splineThru(pts.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
  sh.closePath();
  return softFin(sh, mat, depth);
}
/** 원점에서 -x 로 뻗는 길고 하늘거리는 지느러미 잎 */
const petal = (len: number, wid: number, mat: THREE.Material) => fin([[0, 0], [-len * 0.3, wid * 0.5], [-len * 0.75, wid * 0.42], [-len, 0], [-len * 0.75, -wid * 0.42], [-len * 0.3, -wid * 0.5]], mat, 0.015);
/** 축을 따라 흔들리게 한다 */
const sway = (anim: Anim, o: THREE.Object3D, axis: "x" | "y" | "z", amp: number, sp: number, ph = 0, base = o.rotation[axis]) => anim.push((t) => { o.rotation[axis] = base + Math.sin(t * sp + ph) * amp; });
const eyesOn = (g: THREE.Object3D, r: number, x: number, y: number, z: number, rim: string, pupil: "round" | "slit" = "round", turn = 0.45) => { for (const s of [-1, 1]) { const e = eyeBall(r, rim, pupil); e.position.set(x, y, s * z); e.rotation.y = -s * turn; g.add(e); } };
/** 구슬을 이어 만든 휘는 팔·촉수. at(u, t): 뿌리(u=0)에서 끝(u=1)까지의 위치 */
function arm(g: THREE.Object3D, anim: Anim, n: number, r0: number, r1: number, mat: THREE.Material, at: (u: number, t: number) => THREE.Vector3, tip?: THREE.Object3D) {
  const geo = sph(1, 12, 9), segs: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Mesh(geo, mat); s.scale.setScalar(r0 + ((r1 - r0) * i) / (n - 1)); g.add(s); segs.push(s); }
  if (tip) g.add(tip);
  anim.push((t) => { for (let i = 0; i < n; i++) segs[i].position.copy(at(i / (n - 1), t)); if (tip) tip.position.copy(at(1, t)); });
}
/** 가지가 갈라진 산호 한 그루 */
function coral(color: string, h: number, lean = 0.2) {
  const m = phys(color, { roughness: 0.6, clearcoat: 0.2, emissive: C(color), emissiveIntensity: 0.3 });
  return G([0, 0, 0],
    tube([V(0, 0, 0), V(lean * 0.3 * h, h * 0.5, 0), V(lean * h, h, 0)], h * 0.085, m, 0.6),
    tube([V(lean * 0.2 * h, h * 0.38, 0), V(0.22 * h, h * 0.62, 0.08 * h), V(0.3 * h, h * 0.92, 0.1 * h)], h * 0.06, m, 0.6),
    tube([V(lean * 0.1 * h, h * 0.28, 0), V(-0.2 * h, h * 0.5, -0.1 * h), V(-0.26 * h, h * 0.8, -0.12 * h)], h * 0.055, m, 0.6),
    tube([V(0.2 * h, h * 0.6, 0.07 * h), V(0.36 * h, h * 0.7, 0.2 * h), V(0.4 * h, h * 0.86, 0.24 * h)], h * 0.04, m, 0.6));
}
/** 꽃처럼 핀 말미잘 */
function anemone(color: string, r = 0.12) {
  const g = G([0, 0, 0], M(cyl(r * 0.35, r * 0.5, r * 1.2, 8), phys("#5ab860", { clearcoat: 0 }), [0, r * 0.6, 0]), M(sph(r * 0.4, 8, 6), lit("#fff0a0"), [0, r * 1.35, 0]));
  const m = phys(color, { emissive: C(color), emissiveIntensity: 0.35, roughness: 0.5 });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * PI2; g.add(M(sph(0.5, 8, 6), m, [Math.cos(a) * r * 0.75, r * 1.3, Math.sin(a) * r * 0.75], [0, -a, 0.5], [r * 1.1, r * 0.35, r * 0.6])); }
  return g;
}
/** 왕관: 테와 뾰족한 살, 보석 */
function crown(r = 0.2, n = 7, gemColors = ["#ff3a5a", "#3ad8ff"]) {
  const gd = gold(), g = G([0, 0, 0], M(cyl(r, r * 0.86, r * 0.7, 20, true), Object.assign(gold(), { side: THREE.DoubleSide }), [0, r * 0.35, 0]), M(tor(r * 0.88, r * 0.07), gd, [0, 0, 0], [PI / 2, 0, 0]));
  for (let i = 0; i < n; i++) { const a = (i / n) * PI2; g.add(M(cone(r * 0.22, r * 0.85, 5), gd, [Math.cos(a) * r, r * 1.05, Math.sin(a) * r]), M(sph(r * 0.13, 8, 6), gem(gemColors[i % gemColors.length]), [Math.cos(a) * r, r * 1.52, Math.sin(a) * r]), M(new THREE.OctahedronGeometry(r * 0.13), gem(gemColors[(i + 1) % gemColors.length]), [Math.cos(a + 0.3) * r * 1.02, r * 0.38, Math.sin(a + 0.3) * r * 1.02])); }
  return g;
}
/** 전설 마무리: 두 겹 후광, 부드러운 빛, 도는 고리, 빛 알갱이 */
function finL(g: THREE.Group, anim: Anim, k: number, c1: string, c2: string, halo: P3, spark = 30) {
  const s2 = auraShell(sph(0.5, 28, 20), C(c2));
  s2.scale.set(halo[0] * 1.25, halo[1] * 1.3, halo[2] * 1.3); s2.name = "fx";
  const gs = spr(c1, halo[0] * 2.3, 0.26);
  g.add(s2, gs);
  ring(g, anim, Math.max(halo[1], halo[2]) * 0.62, 1.25, 0.45, c2, 6);
  sparkField(g, anim, C(c2), Math.floor(spark * 0.5), halo[0] * 0.9, halo[1] * 1.1);
  anim.push((t) => { (gs.material as THREE.SpriteMaterial).opacity = 0.22 + 0.08 * Math.sin(t * 1.6); });
  return finish(g, anim, k, c1, halo, spark);
}

// ================================================================ 0 산호 숲
/** 산호왕관만타: 날개를 물결치듯 젓는 큰 쥐가오리. 머리에 산호로 엮은 왕관, 등줄기에 산호 능선, 날개 끝에 진주 */
const coralCrownManta: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const NX = 12, NZ = 30, P: number[] = [], UV: number[] = [], I: number[] = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const zn = (j / NZ) * 2 - 1, s = Math.abs(zn), u = i / NX, le = 0.62 - 0.78 * Math.pow(s, 1.4), te = -0.55 + 0.37 * Math.pow(s, 1.2);
    P.push(le + (te - le) * u, 0.11 * Math.pow(1 - s, 1.2) * Math.sin(PI * u), zn * 1.55); UV.push(u, j / NZ);
    if (i < NX && j < NZ) { const k = j * (NX + 1) + i; I.push(k, k + NX + 1, k + 1, k + 1, k + NX + 1, k + NX + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I);
  const top = painted((x, W, H) => { vgrad(x, W, H, [[0, "#ff9ac0"], [0.5, "#e85a8a"], [1, "#ff9ac0"]]); for (let i = 0; i < 90; i++) { x.fillStyle = i % 3 ? "#ffd8e6" : "#ffe07a"; x.beginPath(); x.arc(rnd(i) * W, rnd(i + 50) * H, 3 + rnd(i + 9) * 7, 0, 7); x.fill(); } }, { side: THREE.DoubleSide });
  const wings = Object.assign(new THREE.Mesh(geo, top), { userData: { live: true } }), base = Float32Array.from(P), pos = geo.attributes.position as THREE.BufferAttribute;
  g.add(wings, M(sph(0.5, 24, 16), top, [0.02, 0.03, 0], [0, 0, 0], [1.15, 0.26, 0.5]), M(sph(0.5, 20, 12), phys("#fff4f6"), [0, -0.05, 0], [0, 0, 0], [1.05, 0.14, 0.46]));
  for (const s of [-1, 1]) g.add(tube([V(0.5, 0, s * 0.16), V(0.78, -0.04, s * 0.24), V(0.92, -0.14, s * 0.2), V(0.88, -0.22, s * 0.12)], 0.06, top, 0.6)); // 머리 지느러미(말린 뿔)
  eyesOn(g, 0.06, 0.5, 0.05, 0.27, "#ffd24a");
  g.add(tube([V(-0.5, 0, 0), V(-1.1, 0.04, 0.06), V(-1.8, -0.02, -0.06), V(-2.4, 0.06, 0)], 0.035, top, 0.25));
  const cr = G([0.3, 0.13, 0], M(tor(0.2, 0.03), gold(), [0, 0, 0], [PI / 2, 0, 0])); // 산호 왕관
  ["#ff5a7a", "#ff9a5a", "#ffd0e0", "#ff7aa8", "#ffb040", "#ff5a7a", "#ffd0e0"].forEach((c, i) => { const a = (i / 7) * PI2, k = coral(c, 0.34 + (i % 2) * 0.14, 0.3); k.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); k.rotation.y = -a; cr.add(k); });
  cr.add(M(sph(0.07, 12, 10), gem("#ffffff"), [0.2, 0.06, 0]));
  g.add(cr);
  for (let i = 0; i < 6; i++) { const k = coral(i % 2 ? "#ff8aa8" : "#ffb86a", 0.2 + (i % 3) * 0.05); k.position.set(0.05 - i * 0.1, 0.12, 0); k.rotation.y = i; g.add(k); }
  const pearls: THREE.Mesh[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const p = M(sph(0.035, 10, 8), gem("#fff4ff")); p.userData = { s, i }; pearls.push(p); g.add(p); }
  anim.push((t) => {
    for (let k = 0; k < pos.count; k++) { const s = Math.abs(base[k * 3 + 2]) / 1.55; pos.setY(k, base[k * 3 + 1] + Math.sin(t * 1.7 - s * 1.7) * 0.42 * Math.pow(s, 1.6) + 0.12 * s * s); }
    pos.needsUpdate = true; geo.computeVertexNormals();
    for (const p of pearls) { const s = 0.45 + p.userData.i * 0.12; p.position.set(0.3 - 0.6 * Math.pow(s, 1.4), Math.sin(t * 1.7 - s * 1.7) * 0.42 * Math.pow(s, 1.6) + 0.12 * s * s + 0.03, p.userData.s * s * 1.55); }
  });
  motes(g, anim, ["#ffd0e0", "#ff8ab0", "#ffe07a"], 40, [1.6, 0.8, 1.8], [-0.25, 0.12, 0], 0.11);
  return finL(g, anim, 1.25, "#ff8ab0", "#ffe07a", [2.6, 1.0, 3.4], 34);
};

/** 칠색비단고기: 몸보다 몇 배 큰 일곱 빛깔 비단 지느러미를 펼치고 흔드는 베타. 꼬리 일곱 장, 등과 배의 부채 지느러미 */
const rainbowBetta: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [], RB = ["#ff5a7a", "#ffa040", "#ffe04a", "#5ae07a", "#4ac8ff", "#7a7aff", "#c87aff"];
  const skin = painted((x, W, H) => { const gr = x.createLinearGradient(0, 0, W / 2, 0); RB.forEach((c, i) => gr.addColorStop(i / 6, c)); x.fillStyle = gr; x.fillRect(0, 0, W, H); x.globalAlpha = 0.35; vgrad(x, W, H, [[0, "#2a1a5a"], [0.5, "rgba(255,255,255,0)"], [1, "#ffffff"]]); });
  g.add(M(profileBody(1.25, 0.5, 0.38, 0.6, false, 0.7), skin));
  eyesOn(g, 0.07, 0.42, 0.06, 0.15, "#ffffff");
  g.add(M(sph(0.5, 12, 8), phys("#ff8ab0"), [0.62, -0.04, 0], [0, 0, 0], [0.1, 0.07, 0.14]));
  const silk = (c: string) => phys(c, { side: THREE.DoubleSide, transparent: true, opacity: 0.86, emissive: C(c), emissiveIntensity: 0.45, roughness: 0.35 });
  RB.forEach((c, i) => { // 꼬리 일곱 장: 부채처럼 위아래로 펼쳐진다
    const a = (i - 3) * 0.3, f = petal(1.7 - Math.abs(i - 3) * 0.14, 0.5, silk(c)), h = G([-0.55, 0, 0], f);
    h.rotation.z = -a; g.add(h); sway(anim, h, "y", 0.3, 2.1, i * 0.6); sway(anim, f, "x", 0.25, 1.7, i);
  });
  for (let i = 0; i < 6; i++) { // 등 부채와 배 부채
    const d = petal(0.95 - i * 0.06, 0.3, silk(RB[i])), hd = G([0.2 - i * 0.13, 0.2, 0], d); hd.rotation.z = -1.25 + i * 0.16; g.add(hd); sway(anim, hd, "x", 0.3, 2.3, i);
    const b = petal(0.8 - i * 0.05, 0.28, silk(RB[6 - i])), hb = G([0.12 - i * 0.12, -0.2, 0], b); hb.rotation.z = 1.2 - i * 0.14; g.add(hb); sway(anim, hb, "x", 0.3, 2.0, i + 2);
  }
  for (const s of [-1, 1]) { const p = petal(0.75, 0.2, silk("#ffffff")), h = G([0.25, -0.05, s * 0.17], p); h.rotation.set(s * 0.5, s * 0.7, 0.5); g.add(h); sway(anim, h, "y", 0.35, 3, s, s * 0.7); }
  const cr = crown(0.1, 5, RB); cr.position.set(0.3, 0.23, 0); cr.rotation.z = 0.2; g.add(cr);
  motes(g, anim, RB, 60, [1.8, 1.0, 0.9], [-0.5, 0.05, 0], 0.1, [-0.6, 0, 0]);
  ring(g, anim, 1.0, 0.3, 0.6, "#ff8ac0", 7); ring(g, anim, 1.25, -0.7, -0.5, "#7ad8ff", 7);
  return finL(g, anim, 1.2, "#ff8ac0", "#7ad8ff", [3.0, 1.9, 1.6], 30);
};

/** 꽃밭고래상어: 넓고 납작한 머리, 흰 점무늬의 순한 대형 상어. 등 위에 말미잘과 산호가 꽃밭처럼 피고 꽃잎이 흩날린다 */
const gardenWhaleShark: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = painted((x, W, H) => { vgrad(x, W, H, [[0, "#3a5e96"], [0.55, "#5a8ac8"], [0.8, "#f0f6ff"], [1, "#ffffff"]]); x.fillStyle = "#eaf4ff"; for (let i = 0; i < 150; i++) { x.beginPath(); x.arc(rnd(i) * W, rnd(i + 7) * H * 0.68, 2.5 + rnd(i + 3) * 4, 0, 7); x.fill(); } x.globalAlpha = 0.5; for (let i = 0; i < 9; i++) x.fillRect(i * (W / 9), 0, 3, H * 0.62); });
  const finM = phys("#4a74b0", { side: THREE.DoubleSide, emissive: C("#4a74b0"), emissiveIntensity: 0.15 });
  g.add(M(profileBody(3.1, 0.82, 1.0, 0.66, false, 0.7), skin), M(sph(0.5, 24, 16), skin, [1.18, -0.02, 0], [0, 0, 0], [0.9, 0.5, 1.02])); // 넓고 납작한 머리
  g.add(M(tor(0.42, 0.03, PI, 20), phys("#1c2a44"), [1.56, -0.08, 0], [PI / 2, 0, PI / 2], [1, 0.45, 1])); // 넓은 입
  eyesOn(g, 0.06, 1.3, 0.02, 0.5, "#ffe07a");
  for (const s of [-1, 1]) {
    const pf = sideFin(1.0, finM), h = G([0.7, -0.2, s * 0.44], pf); pf.rotation.set(s * 1.25, 0.2, -0.5); g.add(h); sway(anim, h, "x", 0.12, 1.2, s);
    for (let i = 0; i < 5; i++) g.add(M(box(0.014, 0.28, 0.014), phys("#1c2a44"), [0.92 - i * 0.06, 0, s * 0.5]));
    for (let i = 0; i < 3; i++) g.add(tube([V(1.2, 0.2 - i * 0.1, s * 0.3), V(0.2, 0.3 - i * 0.12, s * (0.46 - i * 0.02)), V(-1.0, 0.16 - i * 0.07, s * 0.2)], 0.012, phys("#7aa8e0"), 0.5)); // 몸 옆 능선
  }
  const d1 = dorsalFin(0.5, 0.52, finM); d1.position.set(-0.15, 0.36, 0); const d2 = dorsalFin(0.24, 0.24, finM); d2.position.set(-0.9, 0.24, 0); g.add(d1, d2);
  const tail = G([-1.5, 0, 0], tailFin(0.95, finM, "crescent")); g.add(tail); sway(anim, tail, "y", 0.3, 1.5);
  const FL = ["#ff8ac0", "#ffe04a", "#ffffff", "#c88aff", "#ff9a5a"]; // 등 위의 꽃밭
  for (let i = 0; i < 26; i++) { const u = 0.95 - (i / 25) * 1.7, w = ((i * 7) % 5 - 2) * 0.13, y = 0.4 * Math.sqrt(Math.max(0.05, 1 - Math.pow((u - 0.2) / 1.5, 2))) - Math.abs(w) * 0.25; const k = i % 4 === 0 ? coral(FL[i % 5] === "#ffffff" ? "#ff7a9a" : FL[i % 5], 0.3) : anemone(FL[i % 5], 0.08 + (i % 3) * 0.02); k.position.set(u, y - 0.02, w); k.rotation.y = i; g.add(k); }
  g.add(M(dome(0.5, 20, 8), phys("#5ab860", { clearcoat: 0, roughness: 0.9 }), [0.15, 0.3, 0], [0, 0, 0], [1.9, 0.26, 0.6])); // 이끼 풀밭
  const sw = new THREE.Group(); // 따라다니는 작은 물고기 떼
  for (let i = 0; i < 9; i++) { const f = G([0, 0, 0], M(sph(0.5, 8, 6), glow(FL[i % 5], 0.5), [0, 0, 0], [0, 0, 0], [0.18, 0.08, 0.05]), M(cone(0.04, 0.09, 4), glow(FL[i % 5], 0.5), [-0.12, 0, 0], [0, 0, -PI / 2])); f.userData.ph = (i / 9) * PI2; sw.add(f); }
  g.add(sw);
  anim.push((t) => sw.children.forEach((f, i) => { const a = (f.userData.ph as number) + t * 0.5; f.position.set(Math.cos(a) * 1.9, 0.75 + Math.sin(a * 2 + i) * 0.25, Math.sin(a) * 0.9); f.rotation.y = -a - PI / 2; }));
  motes(g, anim, ["#ffb0d0", "#fff0a0", "#ffffff"], 50, [2.0, 0.9, 1.0], [-0.3, 0.1, 0], 0.1, [0, 0.6, 0]);
  return finL(g, anim, 1.5, "#ff9ac8", "#8ad8ff", [3.6, 1.6, 1.9], 36);
};

/** 산호의 어머니(신화): 키가 큰 원반 몸의 천사고기. 이마에서 뻗은 산호 뿔과 부채산호 돛, 몸에 얹힌 살아 있는 암초, 비단 같은 긴 지느러미, 곁을 도는 새끼들과 빛나는 알 */
const reefMother: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = painted((x, W, H) => { vgrad(x, W, H, [[0, "#ff7aa8"], [0.5, "#ffb0c8"], [1, "#fff0d8"]]); for (let i = 0; i < 7; i++) { x.fillStyle = i % 2 ? "#ffe07a" : "#ffffff"; x.globalAlpha = 0.75; x.fillRect((i / 7) * W, 0, W / 26, H); } x.globalAlpha = 1; for (let i = 0; i < 60; i++) { x.fillStyle = "#ff4a7a"; x.beginPath(); x.arc(rnd(i) * W, rnd(i + 5) * H, 3 + rnd(i + 2) * 4, 0, 7); x.fill(); } }, { emissiveIntensity: 0.3 });
  g.add(M(sph(0.5, 36, 26), skin, [0, 0, 0], [0, 0, 0], [1.7, 1.9, 0.5]), M(sph(0.5, 20, 14), skin, [0.78, -0.12, 0], [0, 0, 0], [0.5, 0.5, 0.36]));
  g.add(M(sph(0.5, 12, 8), phys("#ff5a8a"), [1.02, -0.2, 0], [0, 0, 0], [0.12, 0.09, 0.2]));
  eyesOn(g, 0.11, 0.72, 0.05, 0.2, "#ffe07a");
  const silk = (c: string, op = 0.8) => phys(c, { side: THREE.DoubleSide, transparent: true, opacity: op, emissive: C(c), emissiveIntensity: 0.4 });
  for (const [y, rz, c] of [[0.9, -0.5, "#ff9ac0"], [-0.9, 0.5, "#ffe07a"]] as const) { // 등과 배에서 길게 끌리는 지느러미
    for (let i = 0; i < 4; i++) { const f = petal(2.4 - i * 0.35, 0.5, silk(c)), h = G([-0.2 - i * 0.12, y * (1 - i * 0.06), 0], f); h.rotation.z = rz * (1 - i * 0.2); g.add(h); sway(anim, h, "y", 0.22, 1.4, i); sway(anim, f, "x", 0.2, 1.1, i * 2); }
    g.add(tube([V(-0.3, y, 0), V(-1.6, y * 1.5, 0.1), V(-3.2, y * 1.2, -0.1), V(-4.4, y * 1.6, 0)], 0.03, glow(c, 0.9), 0.3));
  }
  for (let i = 0; i < 5; i++) { const f = petal(1.3, 0.5, silk(i % 2 ? "#ffffff" : "#ff9ac0", 0.7)), h = G([-0.8, 0, 0], f); h.rotation.z = (i - 2) * 0.32; g.add(h); sway(anim, h, "y", 0.35, 1.8, i); }
  for (const s of [-1, 1]) { const p = petal(1.0, 0.36, silk("#ffe07a")), h = G([0.35, -0.2, s * 0.24], p); h.rotation.set(s * 0.6, s * 0.8, 0.4); g.add(h); sway(anim, h, "y", 0.3, 2.2, s, s * 0.8); }
  ["#ff5a7a", "#ff9a5a", "#ffd0e0"].forEach((c, i) => { for (const s of [-1, 1]) { const k = coral(c, 0.9 - i * 0.2, 0.45); k.position.set(0.55 - i * 0.22, 0.75 + i * 0.1, s * (0.08 + i * 0.03)); k.rotation.set(0, s > 0 ? 0 : PI, -0.35 + i * 0.25); g.add(k); } }); // 이마의 산호 뿔
  for (let i = 0; i < 5; i++) { // 등의 부채산호 돛
    const fan = G([0.05 - i * 0.22, 0.86 - i * 0.05, 0], M(new THREE.CircleGeometry(0.42, 20, 0, PI), phys(i % 2 ? "#c86aff" : "#ff6a9a", { side: THREE.DoubleSide, transparent: true, opacity: 0.8, emissive: C(i % 2 ? "#c86aff" : "#ff6a9a"), emissiveIntensity: 0.4 })));
    for (let k = 0; k < 7; k++) fan.add(M(cyl(0.008, 0.008, 0.42, 4), lit("#ffe0f0"), [Math.cos((k / 6) * PI) * 0.21, Math.sin((k / 6) * PI) * 0.21, 0.01], [0, 0, (k / 6) * PI - PI / 2]));
    fan.rotation.z = 0.25 - i * 0.16; g.add(fan); sway(anim, fan, "x", 0.12, 1.3, i);
  }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * PI2, s = i % 2 ? 1 : -1, x0 = Math.cos(a) * 0.5, y0 = Math.sin(a) * 0.6, k = i % 3 === 0 ? M(sph(0.11, 12, 10), phys("#ffb0a0", { roughness: 0.8, emissive: C("#ff7a6a"), emissiveIntensity: 0.25 })) : i % 3 === 1 ? anemone(["#ff8ac0", "#ffe04a", "#c88aff"][i % 3], 0.09) : coral("#ff7a9a", 0.22); k.position.set(x0, y0, s * 0.22 * Math.sqrt(Math.max(0, 1 - (x0 / 0.85) ** 2 - (y0 / 0.95) ** 2))); k.rotation.x = s * 1.2; g.add(k); } // 옆구리의 암초
  for (let i = 0; i < 11; i++) { const a = -0.9 + (i / 10) * 1.8; g.add(M(sph(0.045, 10, 8), gem("#fff4ff"), [0.52 + Math.cos(a) * 0.1, -0.5 + Math.abs(a) * 0.1, Math.sin(a) * 0.27])); } // 진주 목걸이
  const kids = new THREE.Group(), eggs = new THREE.Group();
  for (let i = 0; i < 8; i++) { const c = ["#ff8ac0", "#ffe07a", "#ffffff"][i % 3], f = G([0, 0, 0], M(sph(0.5, 10, 8), glow(c, 0.5), [0, 0, 0], [0, 0, 0], [0.2, 0.24, 0.06]), M(cone(0.07, 0.12, 4), glow(c, 0.5), [-0.14, 0, 0], [0, 0, -PI / 2])); f.userData.ph = (i / 8) * PI2; kids.add(f); }
  for (let i = 0; i < 6; i++) { const e = G([0, 0, 0], M(sph(0.07, 12, 10), gem(i % 2 ? "#ffd0e8" : "#fff0a0")), spr("#ffd0e8", 0.5, 0.5)); e.userData.ph = (i / 6) * PI2; eggs.add(e); }
  g.add(kids, eggs);
  anim.push((t) => {
    kids.children.forEach((f, i) => { const a = (f.userData.ph as number) + t * 0.6; f.position.set(Math.cos(a) * 1.7, Math.sin(a * 1.6 + i) * 0.9, Math.sin(a) * 1.0); f.rotation.y = -a - PI / 2; });
    eggs.children.forEach((e, i) => { const a = (e.userData.ph as number) - t * 0.35; e.position.set(Math.cos(a) * 0.9, Math.sin(a) * 1.5, Math.cos(a * 2 + i) * 0.5); });
  });
  for (const x0 of [-0.6, 0.5]) g.add(Object.assign(M(cyl(0.5, 0.2, 5, 16, true), add("#ffd0e0", 0.1), [x0, 1.6, 0]), { name: "fx" })); // 위에서 내리는 빛기둥
  motes(g, anim, ["#ffb0d0", "#fff0a0", "#ffffff", "#ff7aa8"], 90, [2.6, 1.8, 1.4], [-0.3, 0.2, 0], 0.12);
  return finishMythic(g, anim, 1.6, "#ff8ab0", "#ffe07a", [4.4, 3.4, 2.4], 56);
};

// ================================================================ 1 아틀란티스 유적
/** 포세이돈의 창꼬치: 은빛 창처럼 길고 날카로운 몸, 주둥이 대신 금빛 삼지창, 푸른 유리 돛, 삼지창에서 튀는 번개 */
const poseidonPike: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = painted((x, W, H) => { vgrad(x, W, H, [[0, "#2a5a9a"], [0.35, "#8ab8e0"], [0.7, "#e8f4ff"], [1, "#ffffff"]]); x.strokeStyle = "#4ab8ff"; x.lineWidth = 4; for (let i = 0; i < 14; i++) { x.beginPath(); for (let k = 0; k <= 10; k++) x.lineTo(i * (W / 14) + Math.sin(k * 1.2 + i) * 9, (k / 10) * H * 0.6); x.stroke(); } });
  g.add(M(profileBody(2.9, 0.46, 0.36, 0.42, true, 0.85), skin), M(sph(0.5, 14, 10), skin, [1.12, -0.1, 0], [0, 0, 0.12], [0.6, 0.1, 0.16]));
  eyesOn(g, 0.065, 0.95, 0.04, 0.13, "#4ab8ff", "slit");
  const gd = gold(), tri = G([1.42, 0, 0], M(cyl(0.035, 0.045, 1.3, 10), gd, [0.6, 0, 0], [0, 0, PI / 2]), M(cone(0.07, 0.5, 8), gd, [1.5, 0, 0], [0, 0, -PI / 2]), M(box(0.07, 0.07, 0.7), gd, [1.08, 0, 0]), M(sph(0.07, 10, 8), gem("#4ab8ff"), [1.08, 0, 0]));
  for (const s of [-1, 1]) tri.add(M(cone(0.055, 0.5, 8), gd, [1.34, 0, s * 0.32], [0, 0, -PI / 2]), tube([V(1.08, 0, s * 0.3), V(1.0, 0, s * 0.42), V(0.86, 0, s * 0.4)], 0.025, gd, 0.5));
  g.add(tri);
  const sail = fin([[0.6, 0], [0.45, 0.5], [0.0, 0.85], [-0.5, 0.7], [-0.9, 0.3], [-1.0, 0]], glass("#4ab8ff", 0.6), 0.02); sail.position.set(0.25, 0.2, 0); g.add(sail); sway(anim, sail, "x", 0.1, 2);
  for (let i = 0; i < 8; i++) g.add(M(cyl(0.008, 0.012, 0.5 + Math.sin((i / 7) * PI) * 0.4, 5), gd, [0.75 - i * 0.2, 0.42 + Math.sin((i / 7) * PI) * 0.2, 0], [0, 0, 0.25 - i * 0.07]));
  const tail = G([-1.42, 0, 0], tailFin(0.75, glass("#8ad0ff", 0.75), "crescent")); g.add(tail); sway(anim, tail, "y", 0.4, 5);
  for (const s of [-1, 1]) { const pf = sideFin(0.5, glass("#8ad0ff", 0.7)); pf.position.set(0.55, -0.12, s * 0.16); pf.rotation.set(s * 1.1, 0.2, -0.5); g.add(pf); }
  for (const x0 of [0.5, -0.1, -0.7]) g.add(M(tor(0.5, 0.03), gd, [x0, 0, 0], [0, PI / 2, 0], [0.38 * (1 - Math.abs(x0) * 0.25), 0.48 * (1 - Math.abs(x0) * 0.25), 1]), M(new THREE.OctahedronGeometry(0.05), gem("#4ab8ff"), [x0, 0.24 * (1 - Math.abs(x0) * 0.25), 0]));
  const bolts: THREE.Line[] = []; // 삼지창에서 튀는 번개
  for (let i = 0; i < 4; i++) { const l = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(24), 3)), new THREE.LineBasicMaterial({ color: "#bfeaff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); l.name = "fx"; l.frustumCulled = false; g.add(l); bolts.push(l); }
  let last = -1;
  anim.push((t) => { const k = Math.floor(t * 9); if (k === last) return; last = k; bolts.forEach((l, i) => { const p = l.geometry.attributes.position as THREE.BufferAttribute, a = Math.random() * PI2, L = 0.5 + Math.random() * 0.9; for (let j = 0; j < 8; j++) p.setXYZ(j, 2.9 - (j / 7) * L * (i % 2 ? 1 : 1.6) + (Math.random() - 0.5) * 0.12, Math.cos(a) * (j / 7) * L * 0.6 + (Math.random() - 0.5) * 0.14, Math.sin(a) * (j / 7) * L * 0.6 + (Math.random() - 0.5) * 0.14); p.needsUpdate = true; l.visible = Math.random() > 0.25; }); });
  const tg = spr("#8ad8ff", 1.6, 0.55); tg.position.set(2.75, 0, 0); g.add(tg);
  ring(g, anim, 0.7, 1.4, 1.2, "#4ab8ff", 5);
  motes(g, anim, ["#bfeaff", "#ffffff", "#ffe07a"], 40, [2.2, 0.6, 0.6], [-1.2, 0, 0], 0.09);
  return finL(g, anim, 1.3, "#4ab8ff", "#ffe07a", [4.4, 1.2, 1.2], 30);
};

/** 대리석고래: 머리가 네모난 향유고래 석상. 흰 대리석 결에 금으로 이은 금줄, 등 위에 무너진 신전 기둥과 박공, 이마의 월계관 */
const marbleWhale: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const marble = painted((x, W, H) => { vgrad(x, W, H, [[0, "#f8f6f0"], [0.7, "#ece8e0"], [1, "#d8d2c8"]]); for (let i = 0; i < 26; i++) { x.strokeStyle = i % 4 ? "rgba(140,138,150,.45)" : "#e0b040"; x.lineWidth = i % 4 ? 2 : 4; x.beginPath(); x.moveTo(rnd(i) * W, 0); x.bezierCurveTo(rnd(i + 1) * W, H * 0.3, rnd(i + 2) * W, H * 0.6, rnd(i + 3) * W, H); x.stroke(); } }, { roughness: 0.18, emissiveIntensity: 0.3 });
  const gd = gold(), stone = phys("#f0ece4", { roughness: 0.5, clearcoat: 0.3 });
  g.add(M(profileBody(2.5, 0.95, 0.82, 0.72, false, 0.6), marble), M(sph(0.5, 24, 18), marble, [0.9, 0.06, 0], [0, 0, 0], [1.25, 0.98, 0.84]), M(box(0.5, 0.78, 0.72), marble, [1.36, 0.08, 0])); // 네모난 큰 머리
  g.add(M(sph(0.5, 14, 8), stone, [1.0, -0.42, 0], [0, 0, 0.06], [1.1, 0.1, 0.22])); // 가는 아래턱
  eyesOn(g, 0.07, 0.75, -0.14, 0.42, "#ffcf40");
  for (const s of [-1, 1]) { const pf = sideFin(0.55, stone); pf.position.set(0.45, -0.34, s * 0.38); pf.rotation.set(s * 1.2, 0.2, -0.5); g.add(pf); g.add(tube([V(1.5, 0.3, s * 0.3), V(0.6, 0.16, s * 0.43), V(-0.3, 0.3, s * 0.36), V(-1.1, 0.05, s * 0.12)], 0.022, glow("#ffcf40", 0.9), 0.6), tube([V(0.9, -0.2, s * 0.42), V(0.2, -0.3, s * 0.36), V(-0.5, -0.12, s * 0.26)], 0.016, glow("#ffcf40", 0.9), 0.6)); } // 금으로 이은 금
  const fl = G([-1.25, 0, 0], tailFin(0.9, stone, "crescent")); fl.children[0].rotation.x = PI / 2; g.add(fl); sway(anim, fl, "z", 0.22, 1.4);
  const temple = G([0.05, 0.44, 0], M(box(1.5, 0.08, 0.62), stone, [0, 0, 0]), M(box(1.36, 0.06, 0.52), stone, [0, 0.07, 0])); // 등 위의 무너진 신전
  [[-0.55, 0.62], [-0.3, 0.62], [-0.05, 0.36], [0.2, 0.62], [0.45, 0.2], [0.62, 0.62]].forEach(([x0, h], i) => { for (const s of [-1, 1]) { if (s < 0 && i % 3 === 1) continue; temple.add(M(cyl(0.05, 0.06, h, 10), stone, [x0, 0.1 + h / 2, s * 0.2]), M(box(0.15, 0.04, 0.15), stone, [x0, 0.1 + h + 0.02, s * 0.2]), M(box(0.15, 0.035, 0.15), stone, [x0, 0.11, s * 0.2])); } });
  temple.add(M(box(0.62, 0.07, 0.56), stone, [-0.42, 0.78, 0]), M(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 3), stone, [-0.42, 0.9, 0], [PI / 2, 0, 0], [1, 1, 0.45]), M(cyl(0.05, 0.06, 0.3, 10), stone, [0.3, 0.14, 0.34], [0, 0.4, PI / 2]), M(sph(0.06, 10, 8), gem("#4ad8ff"), [-0.42, 0.9, 0.27]));
  g.add(temple);
  const wr = G([1.3, 0.5, 0], M(tor(0.3, 0.025), gd, [0, 0, 0], [PI / 2, 0, 0])); for (let i = 0; i < 14; i++) { const a = (i / 14) * PI2; wr.add(M(sph(0.5, 8, 6), gd, [Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3], [0, -a, 0.6], [0.16, 0.04, 0.08])); } wr.rotation.z = -0.25; g.add(wr);
  const spout = G([1.1, 0.56, 0]); for (let i = 0; i < 6; i++) spout.add(Object.assign(M(sph(0.06, 8, 6), add("#ffffff", 0.6)), { name: "fx" })); g.add(spout); // 숨구멍에서 오르는 빛
  anim.push((t) => spout.children.forEach((b, i) => { const u = (t * 0.5 + i / 6) % 1; b.position.set(Math.sin(i * 2) * 0.12 * u, u * 1.1, Math.cos(i * 3) * 0.12 * u); b.scale.setScalar(0.6 + u * 2); (((b as THREE.Mesh).material) as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - u); }));
  ring(g, anim, 1.25, 0.2, 0.3, "#ffe07a", 8);
  motes(g, anim, ["#ffffff", "#ffe07a"], 40, [2.0, 1.0, 1.0], [-0.2, 0.15, 0], 0.09);
  return finL(g, anim, 1.55, "#ffffff", "#ffcf40", [3.6, 2.0, 1.8], 32);
};

/** 고대왕의 앵무조개: 금과 흰 줄무늬의 큰 나선 껍데기에 고대 문양이 새겨져 있고, 앞으로 뻗은 촉수와 큰 눈, 껍데기 위의 왕관, 둘레를 도는 금화 */
const kingNautilus: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [], gd = gold(), ivory = phys("#fff6e0", { roughness: 0.25 });
  for (let i = 0; i < 26; i++) { // 나선 껍데기: 안쪽에서 바깥으로 커지는 방
    const a = i * 0.42, r = 0.045 * Math.exp(a * 0.21), R = r * 2.3, m = M(sph(0.5, 18, 14), i % 2 ? gd : ivory, [-0.12 + Math.cos(a + 2.2) * R, 0.1 + Math.sin(a + 2.2) * R, 0], [0, 0, a + 2.2], [r * 2.6, r * 2.3, r * 2.0 + 0.12]);
    g.add(m);
    if (i > 12 && i % 2) for (const s of [-1, 1]) g.add(M(tor(r * 0.5, r * 0.07), lit("#fff0a0"), [m.position.x, m.position.y, s * (r + 0.07)], [0, 0, 0])); // 방마다 새긴 고리 문양
  }
  g.add(M(sph(0.5, 20, 14), phys("#e8a060", { roughness: 0.5 }), [0.5, -0.32, 0], [0, 0, -0.3], [0.62, 0.5, 0.52]), M(sph(0.5, 18, 12), phys("#c87840", { roughness: 0.6 }), [0.42, -0.08, 0], [0, 0, 0.5], [0.7, 0.3, 0.56])); // 살과 두건
  eyesOn(g, 0.11, 0.56, -0.26, 0.24, "#ffe07a", "slit", 0.3);
  const tm = phys("#ffc890", { roughness: 0.5, emissive: C("#ff9a50"), emissiveIntensity: 0.2 });
  for (let i = 0; i < 16; i++) { const a = (i / 16) * PI2, ph = i * 1.7; arm(g, anim, 9, 0.045, 0.014, tm, (u, t) => V(0.72 + u * (0.75 + (i % 3) * 0.12), -0.36 + Math.cos(a) * (0.1 + u * 0.16) + Math.sin(t * 2 + ph + u * 3) * 0.06 * u, Math.sin(a) * (0.12 + u * 0.2) + Math.cos(t * 1.7 + ph + u * 3) * 0.06 * u)); }
  const cr = crown(0.2, 7, ["#3ad8ff", "#ffffff"]); cr.position.set(-0.3, 0.92, 0); cr.rotation.z = 0.25; g.add(cr);
  const coins = new THREE.Group(); for (let i = 0; i < 12; i++) { const c = M(cyl(0.07, 0.07, 0.016, 12), gd); c.userData.ph = (i / 12) * PI2; coins.add(c); } g.add(coins);
  anim.push((t) => coins.children.forEach((c, i) => { const a = (c.userData.ph as number) + t * 0.7; c.position.set(Math.cos(a) * 1.25, 0.1 + Math.sin(a * 2 + i) * 0.12, Math.sin(a) * 0.9); c.rotation.set(t * 2 + i, a, 0); }));
  for (const [r, c] of [[1.0, "#ffe07a"], [1.2, "#3ad8ff"]] as const) { const rr = Object.assign(M(tor(r, 0.012, PI2, 60), add(c, 0.8), [0, 0.1, 0]), { name: "fx" }); g.add(rr); anim.push((t) => { rr.rotation.set(t * 0.3 * (r > 1.1 ? -1 : 1), t * 0.2, 0); }); }
  motes(g, anim, ["#ffe07a", "#ffffff"], 36, [1.3, 1.0, 0.8], [-0.1, 0.12, 0], 0.09);
  return finL(g, anim, 1.4, "#ffcf40", "#3ad8ff", [3.0, 2.4, 1.8], 30);
};

/** 아틀라스 수호룡(신화): 금 갑옷 비늘의 날개 달린 바다용. 삼지창 뿔과 금 투구, 둘레를 도는 문양 석판과 물의 고리, 심장처럼 뛰는 푸른 균열 */
const atlasDragon: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#0a5a6a", "#ffe07a", { mid: "#1a9aa8", emissive: "#4ae8ff", ei: 0.14 });
  const head = dragonHead({ skin, belly: phys("#fff0c0"), horn: "#ffcf40", eye: "#4ae8ff", slit: true, whisker: "#ffe07a", mane: "#bff6ff", hornSweep: 1.3 });
  const gd = gold();
  head.add(M(dome(0.5, 20, 8), gd, [0.02, 0.2, 0], [0, 0, 0], [0.9, 0.5, 0.86]), M(box(0.5, 0.05, 0.1), gd, [0.4, 0.2, 0], [0, 0, -0.25]), M(cyl(0.03, 0.04, 0.8, 8), gd, [0.3, 0.75, 0], [0, 0, -0.3]), M(cone(0.06, 0.3, 8), gd, [0.46, 1.26, 0], [0, 0, -0.3]), M(sph(0.08, 12, 10), gem("#4ae8ff"), [0.38, 0.36, 0])); // 금 투구와 삼지창 뿔
  for (const s of [-1, 1]) head.add(M(cone(0.045, 0.34, 8), gd, [0.34 + s * 0.0, 1.06, s * 0.2], [s * 0.5, 0, -0.3]));
  head.scale.setScalar(1.6);
  serpent(g, anim, { N: 66, length: 5.0, amp: 1.15, radius: 0.34, waves: 7.5, skin, spine: "#ffcf40", spineH: 0.3, head, scales: { color: "#ffcf40", big: true }, tailColor: "#1a9aa8", tailCrystal: "#4ae8ff", wings: { color: "#4ae8ff" }, cracks: "#4ae8ff" });
  const slabs = new THREE.Group(); // 문양이 빛나는 석판
  for (let i = 0; i < 6; i++) { const sl = G([0, 0, 0], M(box(0.3, 0.46, 0.06), phys("#e8e4dc", { roughness: 0.6 })), M(tor(0.08, 0.016), lit("#4ae8ff"), [0, 0.08, 0.035]), M(box(0.03, 0.16, 0.01), lit("#4ae8ff"), [0, -0.1, 0.035]), M(box(0.14, 0.03, 0.01), lit("#4ae8ff"), [0, -0.08, 0.035])); sl.userData.ph = (i / 6) * PI2; slabs.add(sl); }
  g.add(slabs);
  const swirl: THREE.Mesh[] = []; for (let i = 0; i < 4; i++) { const w = Object.assign(M(tor(1.4 + i * 0.25, 0.02, PI * 1.4, 60), add(i % 2 ? "#ffe07a" : "#4ae8ff", 0.7)), { name: "fx" }); g.add(w); swirl.push(w); }
  anim.push((t) => {
    slabs.children.forEach((s, i) => { const a = (s.userData.ph as number) + t * 0.35; s.position.set(Math.cos(a) * 2.5, Math.sin(t * 0.9 + i) * 0.4 + 0.3, Math.sin(a) * 1.7); s.rotation.y = -a + PI / 2; });
    swirl.forEach((w, i) => { w.rotation.set(PI / 2 + Math.sin(t * 0.4 + i) * 0.3, 0, t * (0.7 + i * 0.15) * (i % 2 ? -1 : 1)); });
  });
  motes(g, anim, ["#4ae8ff", "#ffe07a", "#ffffff"], 90, [3.0, 1.2, 2.0], [-0.4, 0.25, 0], 0.12);
  return finishMythic(g, anim, 1.9, "#4ae8ff", "#ffe07a", [5.0, 2.0, 3.2], 60);
};

// ================================================================ 2 난파선
/** 유령선장곰치: 속이 비치는 유령 곰치. 선장 모자와 금 견장, 드러난 등뼈의 빛, 찢어진 망토 지느러미, 곁을 떠도는 도깨비불 등잔, 끌고 다니는 끊어진 사슬 */
const ghostCaptainEel: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [], N = 34;
  const ghost = new THREE.MeshPhysicalMaterial({ color: "#d8f6ff", transparent: true, opacity: 0.5, roughness: 0.15, emissive: new THREE.Color("#5ae8ff"), emissiveIntensity: 0.45, depthWrite: false });
  const path = (u: number, t: number) => V(1.7 - u * 3.6, Math.sin(u * 5 - t * 1.8) * 0.28 * (0.3 + u), Math.sin(u * 4.2 - t * 1.5) * 0.5 * (0.2 + u));
  arm(g, anim, N, 0.24, 0.05, ghost, path);
  arm(g, anim, N, 0.05, 0.015, lit("#bff6ff"), path); // 비쳐 보이는 등뼈
  const head = G([0, 0, 0], M(sph(0.5, 20, 14), ghost, [0.12, 0, 0], [0, 0, 0], [0.8, 0.52, 0.5]), M(sph(0.5, 16, 10), ghost, [0.3, -0.14, 0], [0, 0, -0.2], [0.62, 0.16, 0.4]));
  eyesOn(head, 0.075, 0.3, 0.1, 0.2, "#5affd0", "slit");
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) head.add(M(cone(0.022, 0.13, 5), lit("#ffffff"), [0.2 + i * 0.05, -0.05, s * 0.15], [PI, 0, 0]), M(cone(0.02, 0.1, 5), lit("#ffffff"), [0.2 + i * 0.05, -0.2, s * 0.14]));
  const bl = cloth("#14141c"), gd = gold(); // 선장 모자
  head.add(M(sph(0.5, 16, 10), bl, [0.02, 0.32, 0], [0, 0, 0.12], [0.5, 0.36, 0.95]), M(sph(0.5, 16, 8), bl, [0.02, 0.2, 0], [0, 0, 0.12], [0.62, 0.1, 1.15]), M(tor(0.3, 0.018), gd, [0.02, 0.22, 0], [PI / 2, 0, 0.12], [0.95, 1.8, 1]), M(sph(0.07, 10, 8), lit("#ffffff"), [0.25, 0.34, 0]), tube([V(-0.1, 0.42, 0.12), V(-0.3, 0.75, 0.2), V(-0.62, 0.86, 0.26)], 0.05, glow("#ff4a5a", 0.6), 0.2));
  for (const s of [-1, 1]) { head.add(M(sph(0.5, 12, 8), gd, [-0.28, 0.02, s * 0.27], [0, 0, 0], [0.26, 0.09, 0.2])); for (let i = 0; i < 5; i++) head.add(M(cyl(0.008, 0.008, 0.14, 4), gd, [-0.36 + i * 0.04, -0.08, s * 0.3])); } // 견장
  g.add(head);
  const cape: THREE.Mesh[] = []; for (let i = 0; i < 6; i++) { const v = veil(0.9, 0.5, C("#5ae8ff"), 0.4, anim, i * 1.3); g.add(v); cape.push(v); } // 찢어진 망토 지느러미
  const lamps = new THREE.Group(); for (let i = 0; i < 4; i++) { const l = G([0, 0, 0], M(cyl(0.05, 0.06, 0.12, 6, true), iron("#3a4048")), M(cone(0.07, 0.07, 6), iron("#3a4048"), [0, 0.09, 0]), M(sph(0.045, 10, 8), lit("#7affc8")), spr("#5affb0", 0.6, 0.6)); l.userData.ph = (i / 4) * PI2; lamps.add(l); } g.add(lamps);
  const links: THREE.Mesh[] = []; for (let i = 0; i < 10; i++) { const l = M(tor(0.07, 0.022, PI2, 12), iron("#7a828c")); g.add(l); links.push(l); }
  anim.push((t) => {
    const p0 = path(0, t), p1 = path(0.06, t), d = p0.clone().sub(p1);
    head.position.copy(p0); head.rotation.y = Math.atan2(-d.z, d.x); head.rotation.z = Math.atan2(d.y, Math.hypot(d.x, d.z));
    cape.forEach((v, i) => { const u = 0.12 + i * 0.13, p = path(u, t); v.position.set(p.x, p.y + 0.24 - u * 0.15, p.z); });
    lamps.children.forEach((l, i) => { const a = (l.userData.ph as number) + t * 0.6; l.position.set(Math.cos(a) * 1.4, 0.3 + Math.sin(t * 1.5 + i) * 0.25, Math.sin(a) * 1.0); });
    links.forEach((l, i) => { const p = path(0.5, t); l.position.set(p.x - i * 0.03, p.y - 0.2 - i * 0.12, p.z + Math.sin(t * 1.5 + i * 0.5) * 0.06 * i); l.rotation.set(i % 2 ? 0 : PI / 2, i * 0.5, 0); });
  });
  motes(g, anim, ["#7affc8", "#bff6ff"], 50, [2.0, 0.8, 1.0], [-0.3, 0.2, 0], 0.1);
  return finL(g, anim, 1.35, "#5ae8ff", "#7affc8", [4.2, 1.6, 2.0], 30);
};

/** 대포기뢰복: 바다 기뢰처럼 둥근 쇠 몸에 뇌관 뿔과 대포가 사방으로 돋은 복어. 머리 위 도화선의 불꽃, 끊어진 닻사슬, 대포에서 피어오르는 연기 방울 */
const minePuffer: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = painted((x, W, H) => { vgrad(x, W, H, [[0, "#2a2e38"], [0.6, "#4a505c"], [1, "#8a6a4a"]]); x.fillStyle = "#12141a"; for (let i = 0; i < 9; i++) x.fillRect(0, (i / 9) * H, W, 3); for (let i = 0; i < 120; i++) { x.fillStyle = i % 5 ? "#8a929c" : "#c8643a"; x.beginPath(); x.arc(rnd(i) * W, rnd(i + 3) * H, i % 5 ? 3 : 7, 0, 7); x.fill(); } }, { metalness: 0.5, roughness: 0.45, emissiveIntensity: 0.18 });
  const ir = iron(), gd = gold("#e8b030");
  g.add(M(sph(0.5, 32, 24), skin, [0, 0, 0], [0, 0, 0], [1.5, 1.45, 1.45]), M(tor(0.74, 0.04), ir, [0, 0, 0], [0, 0, 0]), M(tor(0.74, 0.04), ir, [0, 0, 0], [PI / 2, 0, 0]));
  for (let i = 0; i < 14; i++) { // 뇌관 뿔과 대포
    const th = Math.acos(1 - (2 * (i + 0.5)) / 14), ph = PI * (1 + Math.sqrt(5)) * i, d = V(Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph));
    if (d.x > 0.55) continue; // 얼굴 자리
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d), h = i % 3 === 0 ? G([0, 0, 0], M(cyl(0.085, 0.11, 0.42, 12), ir, [0, 0.16, 0]), M(tor(0.1, 0.025), gd, [0, 0.36, 0], [PI / 2, 0, 0]), M(cyl(0.06, 0.06, 0.02, 12), phys("#0a0a0e"), [0, 0.375, 0])) : G([0, 0, 0], M(cyl(0.04, 0.06, 0.22, 8), ir, [0, 0.08, 0]), M(sph(0.06, 10, 8), glow("#ff5a3a", 0.8), [0, 0.2, 0]));
    h.position.copy(d).multiplyScalar(0.7); h.quaternion.copy(q); g.add(h);
  }
  eyesOn(g, 0.16, 0.52, 0.16, 0.34, "#ffb030", "round", 0.6);
  for (const s of [-1, 1]) g.add(M(box(0.3, 0.05, 0.06), phys("#12141a"), [0.6, 0.36, s * 0.3], [0, s * -0.5, s > 0 ? -0.4 : -0.4]));
  g.add(M(sph(0.5, 14, 10), phys("#ff8a7a"), [0.74, -0.14, 0], [0, 0, 0], [0.14, 0.12, 0.3]));
  const tail = G([-0.72, 0, 0], tailFin(0.4, phys("#c8643a", { side: THREE.DoubleSide }), "round")); g.add(tail); sway(anim, tail, "y", 0.6, 6);
  for (const s of [-1, 1]) { const pf = sideFin(0.34, phys("#c8643a", { side: THREE.DoubleSide })), h = G([0.2, -0.1, s * 0.74], pf); pf.rotation.set(s * 1.2, 0.2, -0.3); g.add(h); sway(anim, h, "x", 0.5, 8, s); }
  const spark = G([0.22, 1.12, 0], M(sph(0.07, 10, 8), lit("#fff0a0")), spr("#ffb030", 0.9, 0.8)); // 도화선
  g.add(tube([V(0, 0.72, 0), V(0.05, 0.95, 0.04), V(0.22, 1.12, 0)], 0.03, phys("#c8b890", { clearcoat: 0 }), 0.9), spark);
  anim.push((t) => spark.scale.setScalar(1 + Math.sin(t * 11) * 0.3));
  motes(g, anim, ["#ffb030", "#ff5a3a", "#fff0a0"], 26, [0.25, 0.4, 0.25], [0, 0.5, 0], 0.09, [0.22, 1.4, 0]);
  const links: THREE.Object3D[] = []; for (let i = 0; i < 9; i++) { const l = M(tor(0.09, 0.03, PI2, 12), ir); g.add(l); links.push(l); } // 끊어진 닻사슬
  const anchor = G([0, 0, 0], M(cyl(0.035, 0.035, 0.5, 8), ir, [0, -0.25, 0]), M(tor(0.2, 0.04, PI, 14), ir, [0, -0.5, 0], [0, 0, PI]), M(box(0.3, 0.04, 0.04), ir, [0, -0.1, 0])); g.add(anchor);
  anim.push((t) => { links.forEach((l, i) => { l.position.set(-0.1 - Math.sin(t * 1.3) * 0.03 * i, -0.78 - i * 0.15, Math.sin(t * 1.3 + i * 0.3) * 0.05 * i); l.rotation.set(0, i % 2 ? PI / 2 : 0, 0); }); anchor.position.copy(links[8].position); anchor.rotation.z = Math.sin(t * 1.3) * 0.3; });
  motes(g, anim, ["#c8d0d8", "#ffffff"], 30, [1.0, 0.8, 1.0], [0, 0.3, 0], 0.12);
  return finL(g, anim, 1.35, "#ff7a3a", "#ffd24d", [2.6, 2.6, 2.6], 30);
};

/** 검은돛상어: 등에 돛대 셋과 찢어진 검은 돛, 해골 깃발을 단 해적선 같은 상어. 옆구리의 선체 널빤지와 포문, 흉터와 금니, 돛대의 등불 */
const blackSailShark: Maker = (sp) => {
  const g = new THREE.Group(), anim: Anim = [];
  const base = buildFish({ ...sp, id: sp.id + "-b", name: "돛대상어", rarity: "veryRare", look: { base: "#3a4048", accent: "#e8e8f0", pattern: "plain", body: "shark", features: [] } });
  const k = 1 / (base.userData.designScale as number ?? 1); base.scale.multiplyScalar(k);
  g.add(base); anim.push((t) => (base.userData.update as (t: number) => void)(t));
  const wd = wood(), sailM = cloth("#16161c", 0.95), rope = phys("#c8b890", { clearcoat: 0 });
  [[0.25, 1.5, 1.0], [-0.3, 1.1, 0.8], [0.72, 0.95, 0.7]].forEach(([x0, h, w], i) => { // 돛대 셋
    const mast = G([x0, 0.25, 0], M(cyl(0.03, 0.045, h, 8), wd, [0, h / 2, 0]), M(cyl(0.02, 0.02, w, 6), wd, [0, h * 0.86, 0], [PI / 2, 0, 0]), M(cyl(0.02, 0.02, w * 0.8, 6), wd, [0, h * 0.4, 0], [PI / 2, 0, 0]));
    const sg = new THREE.PlaneGeometry(w * 0.95, h * 0.44, 8, 6), sp0 = Float32Array.from(sg.attributes.position.array as Float32Array), sail = new THREE.Mesh(sg, sailM); sail.userData.live = true;
    for (let v = 0; v < sp0.length / 3; v++) if (sp0[v * 3 + 1] < -h * 0.2 && v % 2) sp0[v * 3 + 1] += h * 0.07; // 찢어진 아랫단
    sail.position.set(0, h * 0.63, 0); sail.rotation.y = PI / 2; mast.add(sail);
    anim.push((t) => { const p = sg.attributes.position as THREE.BufferAttribute; for (let v = 0; v < p.count; v++) p.setXYZ(v, sp0[v * 3], sp0[v * 3 + 1], Math.sin(sp0[v * 3 + 1] * 4 + t * 2 + i) * 0.06 + 0.12 * Math.cos(sp0[v * 3] * 2.2)); p.needsUpdate = true; });
    if (i === 0) { mast.add(M(sph(0.16, 14, 10), lit("#f4f0e8"), [0.07, h * 0.66, 0], [0, 0, 0], [0.3, 1, 0.95])); for (const s of [-1, 1]) mast.add(M(sph(0.04, 8, 6), lit("#16161c"), [0.11, h * 0.68, s * 0.06]), M(box(0.02, 0.34, 0.05), lit("#f4f0e8"), [0.09, h * 0.6, 0], [s * 0.8, 0, 0])); mast.add(M(cyl(0.11, 0.08, 0.1, 10, true), wd, [0, h * 0.98, 0])); const flag = M(new THREE.PlaneGeometry(0.34, 0.2), cloth("#b01c2c"), [-0.18, h + 0.16, 0]); mast.add(flag, M(cyl(0.012, 0.012, 0.3, 5), wd, [0, h + 0.13, 0])); sway(anim, flag, "y", 0.4, 4); }
    mast.add(tube([V(0, h, 0), V(-0.3, h * 0.5, 0.12), V(-0.5, 0.02, 0.2)], 0.008, rope, 1), tube([V(0, h, 0), V(0.3, h * 0.5, -0.12), V(0.5, 0.02, -0.2)], 0.008, rope, 1), G([0.05, h * 0.3, 0.1], M(sph(0.04, 8, 6), lit("#ffd24d")), spr("#ffb030", 0.5, 0.6)));
    g.add(mast);
  });
  for (const s of [-1, 1]) { for (let i = 0; i < 4; i++) g.add(M(box(1.2, 0.07, 0.03), wd, [0.2, 0.12 - i * 0.085, s * (0.3 - i * 0.012)], [0, 0, 0])); for (let i = 0; i < 3; i++) g.add(M(cyl(0.035, 0.045, 0.16, 8), iron(), [0.55 - i * 0.35, 0.02, s * 0.36], [PI / 2, 0, 0])); } // 선체와 포문
  g.add(M(sph(0.5, 10, 8), cloth("#101014"), [0.52, 0.09, 0.24], [0, 0, 0], [0.16, 0.14, 0.05]), tube([V(0.7, 0.2, 0.2), V(0.5, 0.26, 0.24), V(0.3, 0.2, 0.22)], 0.012, cloth("#101014"), 1)); // 안대
  for (let i = 0; i < 3; i++) g.add(M(box(0.26, 0.012, 0.012), lit("#ff4a5a"), [0.1 + i * 0.05, 0.02 - i * 0.06, -0.33], [0, 0, 0.5]));
  motes(g, anim, ["#ffb030", "#ff5a3a"], 30, [1.6, 1.0, 0.7], [-0.4, 0.15, 0], 0.09, [0, 0.7, 0]);
  return finL(g, anim, 1.5, "#b03a5a", "#ffb030", [3.0, 2.6, 1.6], 26);
};

/** 침몰선 크라켄(신화): 두 동강 난 배를 움켜쥔 거대 문어. 꿈틀대는 여덟 팔과 빛나는 빨판, 머리에 박힌 배의 고물과 돛대, 몸을 감은 사슬과 닻, 먹물 구름과 번개 */
const wreckKraken: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = painted((x, W, H) => { vgrad(x, W, H, [[0, "#2a1a4a"], [0.6, "#4a2a6a"], [1, "#1a6a6a"]]); for (let i = 0; i < 140; i++) { x.fillStyle = i % 3 ? "#5affd0" : "#b08aff"; x.globalAlpha = 0.5 + rnd(i) * 0.5; x.beginPath(); x.arc(rnd(i + 1) * W, rnd(i + 2) * H, 2 + rnd(i + 3) * 6, 0, 7); x.fill(); } }, { emissiveIntensity: 0.45 });
  const wd = wood(), ir = iron("#7a828c");
  const mantle = M(sph(0.5, 32, 24), skin, [-0.35, 0.75, 0], [0, 0, 0.35], [1.5, 2.3, 1.4]); g.add(mantle, M(sph(0.5, 24, 18), skin, [0.1, 0.05, 0], [0, 0, 0], [1.3, 1.0, 1.3]));
  anim.push((t) => mantle.scale.set(1.5 + Math.sin(t * 1.6) * 0.06, 2.3 - Math.sin(t * 1.6) * 0.08, 1.4 + Math.sin(t * 1.6) * 0.06));
  for (const s of [-1, 1]) { const e = eyeBall(0.2, "#ffd24d", "slit", 1.2); e.position.set(0.42, 0.22, s * 0.5); e.rotation.y = -s * 0.7; g.add(e, M(sph(0.5, 12, 8), skin, [0.38, 0.42, s * 0.5], [0, 0, -0.3], [0.5, 0.14, 0.34])); }
  const suck = lit("#5affd0");
  for (let i = 0; i < 8; i++) { // 여덟 팔
    const a = (i / 8) * PI2 + 0.2, dx = Math.cos(a), dz = Math.sin(a), L = 2.4 + (i % 3) * 0.4, ph = i * 1.3;
    const at = (u: number, t: number) => V(0.15 + dx * (0.35 + u * L) + Math.sin(t * 1.3 + ph + u * 4) * 0.35 * u * dz, -0.25 - Math.sin(u * PI) * 0.6 + Math.pow(u, 3) * 1.1 + Math.cos(t * 1.1 + ph + u * 3) * 0.25 * u, dz * (0.35 + u * L) - Math.sin(t * 1.3 + ph + u * 4) * 0.35 * u * dx);
    arm(g, anim, 20, 0.2, 0.03, skin, at);
    arm(g, anim, 10, 0.045, 0.015, suck, (u, t) => at(u, t).add(V(0, -0.2 * (1 - u) - 0.03, 0)));
  }
  for (const s of [-1, 1]) arm(g, anim, 18, 0.07, 0.04, skin, (u, t) => V(0.5 + u * 3.6, -0.1 + Math.sin(u * 5 - t * 2) * 0.3 * u + u * 0.5, s * (0.3 + u * 0.9) + Math.cos(u * 4 - t * 1.7) * 0.3 * u), M(sph(0.16, 12, 10), skin, [0, 0, 0], [0, 0, 0], [1.6, 0.7, 1]));
  const hull = (len: number) => { const h = G([0, 0, 0], M(new THREE.CylinderGeometry(0.4, 0.4, len, 14, 1, true, 0, PI), Object.assign(wood(), { side: THREE.DoubleSide }), [0, 0, 0], [0, 0, PI / 2], [1, 1, 0.7]), M(box(len, 0.04, 0.5), wd, [0, 0, 0])); for (let i = 0; i < 5; i++) h.add(M(tor(0.4, 0.025, PI, 12), wood("#4a2f18"), [-len / 2 + (i + 0.5) * (len / 5), 0, 0], [0, PI / 2, PI], [0.7, 1, 1])); return h; };
  const bow = hull(1.5); bow.add(M(cone(0.28, 0.6, 4), wd, [1.0, -0.12, 0], [0, 0, -PI / 2], [1, 1, 0.7]), M(cyl(0.035, 0.05, 1.3, 8), wd, [0.1, 0.65, 0], [0, 0, -0.3]), M(new THREE.PlaneGeometry(0.7, 0.6, 4, 4), cloth("#d8cca8", 0.9), [0.0, 0.8, 0.02], [0, 0, -0.3])); bow.position.set(2.3, 0.9, 0.9); bow.rotation.set(0.3, -0.5, 0.5); g.add(bow); sway(anim, bow, "z", 0.08, 1.1, 0, 0.5);
  const stern = hull(1.2); stern.add(M(box(0.5, 0.5, 0.52), wd, [-0.4, 0.26, 0]), M(box(0.1, 0.16, 0.12), lit("#ffd24d"), [-0.66, 0.3, 0.1]), M(box(0.1, 0.16, 0.12), lit("#ffd24d"), [-0.66, 0.3, -0.1]), M(cyl(0.03, 0.045, 1.5, 8), wd, [0.2, 0.75, 0], [0, 0, 0.15]), M(cyl(0.11, 0.08, 0.1, 10, true), wd, [0.09, 1.4, 0])); stern.position.set(-0.75, 1.75, 0); stern.rotation.set(0, 0.4, -0.55); g.add(stern); // 머리에 박힌 고물
  for (let i = 0; i < 22; i++) { const a = (i / 22) * PI2 * 1.6; g.add(M(tor(0.085, 0.028, PI2, 10), ir, [-0.2 + Math.cos(a) * 0.78, 0.5 + i * 0.045, Math.sin(a) * 0.72], [i % 2 ? PI / 2 : 0, a, 0])); } // 몸을 감은 사슬
  const anchor = G([0.55, -0.55, 0.75], M(cyl(0.04, 0.04, 0.7, 8), ir), M(tor(0.26, 0.05, PI, 14), ir, [0, -0.35, 0], [0, 0, PI]), M(box(0.4, 0.05, 0.05), ir, [0, 0.2, 0]), M(tor(0.08, 0.025), ir, [0, 0.4, 0])); g.add(anchor); sway(anim, anchor, "z", 0.3, 1.2);
  for (let i = 0; i < 5; i++) { const ink = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#0a0612", transparent: true, opacity: 0.55, depthWrite: false })); ink.name = "fx"; ink.userData.ph = i; g.add(ink); anim.push((t) => { const u = (t * 0.12 + i / 5) % 1; ink.position.set(-1.2 - u * 2.2, 0.6 + Math.sin(i * 2) * 0.8, Math.cos(i * 3) * 0.9); ink.scale.setScalar(1.2 + u * 3); (ink.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - u); }); } // 먹물 구름
  motes(g, anim, ["#5affd0", "#b08aff", "#ffffff"], 90, [3.2, 1.8, 3.2], [0, 0.3, 0], 0.12);
  return finishMythic(g, anim, 1.5, "#5affd0", "#b08aff", [6.4, 3.6, 6.4], 56);
};

export const UW_LEGENDS_A: Record<string, Maker> = {
  산호왕관만타: coralCrownManta, 칠색비단고기: rainbowBetta, 꽃밭고래상어: gardenWhaleShark, "산호의 어머니": reefMother,
  "포세이돈의 창꼬치": poseidonPike, 대리석고래: marbleWhale, "고대왕의 앵무조개": kingNautilus, "아틀라스 수호룡": atlasDragon,
  유령선장곰치: ghostCaptainEel, 대포기뢰복: minePuffer, 검은돛상어: blackSailShark, "침몰선 크라켄": wreckKraken,
};
export const kit = { V, PI, PI2, sph, cyl, cone, box, tor, dome, M, G, lit, add, gold, gem, iron, wood, cloth, spr, motes, painted, vgrad, rnd, fin, petal, sway, eyesOn, arm, coral, anemone, crown, finL };
export { crystal, dorsalFin, sideFin, tailFin, tube, veil, profileBody, sparkField, auraShell, raysTex, glowTex, eyeBall, ring, finishMythic, dragonHead, C, flat, glass, glow, grad, phys };
export type { Anim, Maker };
