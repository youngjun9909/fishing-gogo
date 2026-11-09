import * as THREE from "three";
import { crystal, dorsalFin, profileBody, sideFin, softFin, tailFin, tube } from "./fishModel";
import type { Anim } from "./fishModel";
import { C, eyes, finish, flat, glass, glow, grad, phys } from "./legendKit";
import type { Maker } from "./legendKit";

// 이전부터 있던 전설 물고기를 설명서(실루엣·색·장식·움직임)에 맞게 다시 만든 모델들.
// 길이 방향은 +x(머리), 위는 +y, 폭은 z.

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 원형 궤도: 흰 고리 + 황금 구슬이 천천히 돈다 */
function orbit(g: THREE.Group, anim: Anim, radius: number, tilt: number, speed: number, beadColor = "#ffd860", beads = 5) {
  const grp = new THREE.Group();
  grp.name = "fx";
  grp.rotation.x = tilt;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ring.rotation.x = Math.PI / 2;
  grp.add(ring);
  const spin = new THREE.Group();
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: beadColor }));
    b.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    spin.add(b);
  }
  grp.add(spin);
  g.add(grp);
  anim.push((t) => (spin.rotation.y = t * speed));
}

/** 방사형으로 뻗은 문어 다리. 길이와 휘어짐이 조금씩 다르고 차례로 꿈틀거린다 */
function legs(g: THREE.Group, anim: Anim, skin: THREE.Material, n: number, len: (i: number) => number, radius: number, tipGlow?: string) {
  for (let i = 0; i < n; i++) {
    const L = len(i);
    const a = (i / n) * Math.PI * 2;
    const leg = new THREE.Group();
    leg.rotation.y = a;
    const curl = (i % 2 ? 1 : -1) * (0.25 + (i % 3) * 0.12);
    const pts = [V(0.18, -0.05, 0), V(0.45 * L, -0.28, curl * 0.3), V(0.85 * L, -0.5 - (i % 3) * 0.08, curl * 0.8), V(1.15 * L, -0.28 + (i % 2) * 0.2, curl * 1.2)];
    leg.add(tube(pts, radius, skin, 0.8));
    if (tipGlow) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), glow(tipGlow, 1.5));
      o.position.copy(pts[3]);
      leg.add(o);
    }
    g.add(leg);
    anim.push((t) => { leg.rotation.z = Math.sin(t * 1.7 - i * 0.8) * 0.16; leg.rotation.x = Math.sin(t * 1.3 - i * 0.8) * 0.1; });
  }
}

/** 안개의여왕어: 머리가 크고 몸이 짧은 둥근 모양, 양쪽 안개 결정 뿔, 몸 주변 안개 조각과 물방울 */
// 안개의여왕어는 이전 모양(리본 꼬리가 있는 기본 전설 모델)이 더 낫다고 해서 쓰지 않는다
export const fogQueen: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(new THREE.Mesh(profileBody(1.0, 0.85, 0.8, 0.7, false, 1.1), grad("#e2d4ff", "#ffffff", { mid: "#c8b4f4", emissive: "#d8c8ff", ei: 0.18 })));
  eyes(g, 0.075, 0.34, 0.12, 0.3);
  g.add(flat(phys("#d8b8f0"), [0.52, -0.1, 0], [0.12, 0.05, 0.16])); // 작은 입
  for (const s of [-1, 1]) {
    const horn = crystal(0.24, 0.05, C("#e8dcff"), C("#b090ff"));
    horn.position.set(0.18, 0.46, s * 0.2);
    horn.rotation.set(s * 0.45, 0, -0.35);
    g.add(horn);
    const f = sideFin(0.26, glass("#b494ff", 0.6));
    f.position.set(0.12, -0.12, s * 0.38);
    f.rotation.set(s * 1.1, 0.2, -0.3);
    g.add(f);
  }
  const dors = dorsalFin(0.26, 0.2, glass("#b494ff", 0.55));
  dors.position.set(-0.18, 0.4, 0);
  g.add(dors);
  const tail = new THREE.Group();
  tail.position.set(-0.46, -0.02, 0);
  tail.rotation.z = -0.5; // 아래로 살짝 휜 작은 꼬리
  tail.add(tailFin(0.3, glass("#b494ff", 0.65), "fan"));
  g.add(tail);
  const mist = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i % 3) * 0.04, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    mist.add(m);
  }
  g.add(mist);
  anim.push((t) => {
    g.rotation.y = Math.sin(t * 0.9) * 0.18; // 좌우로 천천히 흔들림
    tail.rotation.y = Math.sin(t * 2.2) * 0.3;
    mist.children.forEach((m, i) => m.position.set(-0.4 - ((t * 0.12 + i * 0.13) % 1) * 1.2, Math.sin(i * 2.1) * 0.35, Math.cos(i * 1.7) * 0.4));
  });
  return finish(g, anim, 2.4, "#d4c0ff", [1.8, 1.5, 1.5], 14);
};

/** 호수의수호어: 둥글고 납작한 몸, 양옆으로 길게 뻗은 황금 수염, 황금 지느러미, 흰 궤도 2개 */
const lakeGuardian: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const gold = glow("#ffd24a", 0.5);
  g.add(flat(grad("#123a8c", "#8ad4ff", { mid: "#3a78d8", emissive: "#6aa8ff", ei: 0.1 }), [0, 0, 0], [1.25, 0.62, 1.05]));
  eyes(g, 0.075, 0.4, 0.14, 0.34);
  g.add(flat(phys("#2a5fb8"), [0.58, -0.06, 0], [0.16, 0.08, 0.22]));
  const wh: THREE.Object3D[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const w = tube([V(0.5, -0.05 - i * 0.04, s * 0.15), V(0.4, -0.02, s * (0.7 + i * 0.1)), V(0.05, 0.02 + i * 0.05, s * (1.25 + i * 0.1)), V(-0.4, 0.1, s * (1.45 + i * 0.1))], 0.025, gold, 0.8);
    g.add(w);
    wh.push(w);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), gold);
    tip.position.set(-0.4, 0.1, s * (1.45 + i * 0.1));
    g.add(tip);
  }
  for (const s of [-1, 1]) {
    const f = sideFin(0.34, phys("#ffd24a", { side: THREE.DoubleSide, emissive: C("#ffb020"), emissiveIntensity: 0.25 }));
    f.position.set(0.1, -0.12, s * 0.55);
    f.rotation.set(s * 1.1, 0.2, -0.3);
    g.add(f);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.6, 0, 0);
  tail.add(tailFin(0.34, phys("#ffd24a", { side: THREE.DoubleSide, emissive: C("#ffb020"), emissiveIntensity: 0.25 }), "round"));
  g.add(tail);
  orbit(g, anim, 1.35, 0.25, 0.5);
  orbit(g, anim, 1.7, -0.5, -0.38);
  anim.push((t) => { tail.rotation.y = Math.sin(t * 1.6) * 0.15; wh.forEach((w, i) => (w.rotation.y = Math.sin(t * 1.2 + i) * 0.04)); });
  return finish(g, anim, 2.5, "#7ab4ff", [2.0, 1.0, 1.8], 14);
};

/** 용잉어: 청록 잉어 몸에 용 뿔과 긴 흰 수염, 길게 솟은 등지느러미, 갈기 같은 꼬리, 황금 비늘 */
const dragonCarp: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(new THREE.Mesh(profileBody(1.3, 0.9, 0.72, 0.5, false, 0.8), grad("#14b896", "#ffeeb0", { mid: "#1fd0a0", emissive: "#40ffc0", ei: 0.1 })));
  eyes(g, 0.065, 0.46, 0.14, 0.3, "#ffd24a");
  g.add(flat(phys("#16a886"), [0.66, -0.04, 0], [0.18, 0.12, 0.3]));
  const gold = glow("#ffd24a", 0.7);
  const white = phys("#ffffff", { emissive: C("#c8fff0"), emissiveIntensity: 0.2 });
  for (const s of [-1, 1]) {
    g.add(tube([V(0.45, 0.28, s * 0.14), V(0.52, 0.55, s * 0.18), V(0.34, 0.82, s * 0.22)], 0.04, gold, 0.65)); // 용 뿔
    const whiskers = [] as THREE.Object3D[];
    for (let i = 0; i < 2; i++) {
      const w = tube([V(0.62, -0.06, s * 0.1), V(0.82, -0.2 - i * 0.1, s * (0.35 + i * 0.2)), V(0.5, -0.5 - i * 0.2, s * (0.7 + i * 0.25)), V(0.0, -0.7 - i * 0.2, s * (0.8 + i * 0.3))], 0.02, white, 0.7);
      g.add(w);
      whiskers.push(w);
    }
    anim.push((t) => whiskers.forEach((w, i) => (w.rotation.z = Math.sin(t * 1.5 + i + s) * 0.06)));
  }
  const dors = dorsalFin(1.0, 0.55, phys("#fff6d0", { side: THREE.DoubleSide, emissive: C("#ffd860"), emissiveIntensity: 0.25 }));
  dors.position.set(-0.35, 0.4, 0);
  g.add(dors);
  const tail = new THREE.Group();
  tail.position.set(-0.62, 0, 0);
  const mane = [["#18c8a0", 0], ["#ffffff", 0.35], ["#ffd24a", -0.35]] as const;
  mane.forEach(([c, rz], i) => {
    const f = tailFin(0.7 - i * 0.08, phys(c, { side: THREE.DoubleSide, emissive: C(c), emissiveIntensity: 0.12 }), i === 0 ? "fork" : "ribbon");
    f.rotation.z = rz;
    tail.add(f);
  });
  g.add(tail);
  for (let i = 0; i < 14; i++) {
    const sc = flat(glow("#ffd24a", 0.9), [0.4 - i * 0.12, 0.06 + (i % 3) * 0.08, 0.3 - Math.abs(i - 7) * 0.012], [0.07, 0.06, 0.02]);
    g.add(sc);
    const sc2 = sc.clone();
    sc2.position.z *= -1;
    g.add(sc2);
  }
  for (const s of [-1, 1]) {
    const f = sideFin(0.3, phys("#18c8a0", { side: THREE.DoubleSide }));
    f.position.set(0.2, -0.2, s * 0.4);
    f.rotation.set(s * 1.1, 0.2, -0.3);
    g.add(f);
  }
  anim.push((t) => { tail.rotation.y = Math.sin(t * 3) * 0.35; g.position.y = Math.sin(t * 0.6) * 0.1; g.rotation.z = Math.sin(t * 0.6) * 0.05; });
  return finish(g, anim, 2.6, "#ffd860", [2.2, 1.6, 1.4], 22);
};

/** 대왕문어: 몸보다 큰 주황 머리(작은 돌기와 금빛 반점), 작은 검은 눈, 서로 다르게 휜 긴 다리 8개 */
const giantOctopus: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#ff7a30", "#ffd2a8", { mid: "#ff9a50", emissive: "#ff9a50", ei: 0.1 });
  const head = flat(skin, [-0.02, 0.28, 0], [1.1, 1.2, 1.05]);
  g.add(head);
  for (let i = 0; i < 40; i++) { // 작은 돌기와 금빛 반점
    const th = Math.acos(1 - Math.random() * 0.9), ph = Math.random() * Math.PI * 2;
    const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.02 + Math.random() * 0.025, 8, 6), i % 3 === 0 ? glow("#ffd860", 0.9) : skin);
    b.position.set(x * 0.55 - 0.02, y * 0.6 + 0.28, z * 0.52);
    g.add(b);
  }
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0x120d18, roughness: 0.1, clearcoat: 1 }));
    e.position.set(0.5, 0.18, s * 0.28);
    g.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.53, 0.21, s * 0.3);
    g.add(hl);
  }
  legs(g, anim, skin, 8, (i) => 1.0 + (i % 3) * 0.18, 0.11);
  anim.push((t) => (g.position.y = Math.sin(t * 1.2) * 0.06));
  return finish(g, anim, 2.4, "#ffb060", [2.2, 1.8, 2.2], 16);
};

/** 크라켄: 위가 뾰족한 청록 머리, 작은 발광 눈, 길이와 휨이 다른 촉수 8개와 끝의 빛 구슬 */
const kraken: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#0a4a62", "#7affe0", { mid: "#1a9aa8", emissive: "#3affd0", ei: 0.14 });
  g.add(flat(skin, [-0.05, 0.4, 0], [0.9, 1.3, 0.9]));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 14), skin);
  tip.position.set(-0.18, 1.2, 0);
  tip.rotation.z = 0.2;
  g.add(tip);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), glow("#8affea", 1.8));
    e.position.set(0.4, 0.3, s * 0.26);
    g.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.44, 0.34, s * 0.28);
    g.add(hl);
  }
  legs(g, anim, skin, 8, (i) => 1.3 + (i % 4) * 0.25, 0.1, "#9affff");
  anim.push((t) => (g.position.y = Math.sin(t * 1.0) * 0.07));
  return finish(g, anim, 2.6, "#5affd8", [2.8, 2.2, 2.8], 18);
};

/** 리바이어던: 둥근 머리와 긴 몸의 용 모양, 머리의 황금 돌기, 등의 황금 가시, 길고 뾰족한 꼬리, 흰 궤도 */
const leviathan: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const body = new THREE.Group();
  g.add(body);
  body.scale.x = 1.4; // 더 길고 커 보이게
  body.add(new THREE.Mesh(profileBody(2.5, 0.95, 0.85, 0.7, false, 0.62), grad("#3a8a98", "#cfe8ec", { mid: "#2a6a7a", emissive: "#4ab8c8", ei: 0.1 })));
  eyes(body, 0.06, 0.86, 0.2, 0.3);
  body.add(flat(phys("#2a6a7a"), [1.1, -0.05, 0], [0.4, 0.2, 0.5])); // 넓은 주둥이
  const gold = phys("#ffd24a", { metalness: 0.5, emissive: C("#ffb020"), emissiveIntensity: 0.4 });
  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2 + (i % 2) * 0.08, 8), gold);
    h.position.set(0.75 - i * 0.12, 0.42 + (i % 2) * 0.03, (i % 3 - 1) * 0.16);
    body.add(h);
  }
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.32 - i * 0.02, 8), gold);
    sp.position.set(0.1 - i * 0.18, 0.44 - i * 0.02, 0);
    sp.rotation.z = 0.35;
    body.add(sp);
  }
  for (const s of [-1, 1]) {
    const f = sideFin(0.5, phys("#2a7a8a", { side: THREE.DoubleSide }));
    f.position.set(0.3, -0.25, s * 0.5);
    f.rotation.set(s * 1.1, 0.25, -0.4);
    body.add(f);
  }
  const tail = new THREE.Group();
  tail.position.set(-1.25, 0, 0);
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 16), phys("#2a6a7a"));
  spike.rotation.z = Math.PI / 2;
  spike.position.x = -0.5;
  tail.add(spike, tailFin(0.5, phys("#2a7a8a", { side: THREE.DoubleSide }), "crescent"));
  body.add(tail);
  orbit(g, anim, 2.0, 0.3, 0.45);
  orbit(g, anim, 2.5, -0.45, -0.3);
  anim.push((t) => { body.rotation.y = Math.sin(t * 1.3) * 0.12; tail.rotation.y = Math.sin(t * 1.9) * 0.35; });
  return finish(g, anim, 2.0, "#6ad8e8", [4.6, 1.8, 1.8], 18);
};

/** 빙하고래: 둥글고 통통한 몸, 둥근 이마, 등의 얼음 결정, 작은 지느러미와 넓은 꼬리, 눈송이 입자 */
const glacierWhale: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const W = new THREE.Group(); // 몸 쪽만 길게 늘인다(눈송이는 그대로)
  g.add(W);
  W.scale.x = 1.35;
  W.add(new THREE.Mesh(profileBody(1.5, 1.05, 0.98, 0.64, false, 0.7), grad("#7ac8ff", "#f6fcff", { mid: "#b8e4ff", emissive: "#bfe8ff", ei: 0.14 })));
  eyes(W, 0.065, 0.55, 0.12, 0.42);
  W.add(tube([V(0.7, -0.12, 0.2), V(0.6, -0.17, 0.42), V(0.4, -0.12, 0.52)], 0.015, phys("#2a4a70"), 0.2));
  for (let i = 0; i < 5; i++) {
    const c = crystal(0.35 - Math.abs(i - 2) * 0.06, 0.07, C("#e0f6ff"), C("#7ac8ff"));
    c.position.set(0.28 - i * 0.2, 0.55 - Math.abs(i - 2) * 0.03, (i % 2 ? 0.06 : -0.06));
    c.rotation.z = -0.15 - i * 0.07;
    W.add(c);
  }
  for (const s of [-1, 1]) {
    const f = flat(phys("#9ad8ff"), [0.15, -0.34, s * 0.55], [0.4, 0.1, 0.22]);
    f.rotation.set(s * 0.5, s * 0.3, -0.4);
    W.add(f);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.68, 0, 0);
  const fl = tailFin(0.4, phys("#a8e0ff", { side: THREE.DoubleSide }), "crescent");
  fl.rotation.x = Math.PI / 2;
  tail.add(fl);
  W.add(tail);
  const snow = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.04 + (i % 3) * 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    snow.add(s);
  }
  g.add(snow);
  anim.push((t) => {
    g.position.y = Math.sin(t * 0.8) * 0.15; // 위아래로 천천히
    tail.rotation.z = Math.sin(t * 1.6) * 0.2;
    snow.children.forEach((s, i) => { const a = t * 0.5 + i * 0.9; s.position.set(Math.cos(a) * 1.3, Math.sin(a * 1.4 + i) * 0.7, Math.sin(a) * 0.9); s.rotation.y = t + i; });
  });
  return finish(g, anim, 2.6, "#c8ecff", [2.4, 1.8, 1.7], 16);
};

/** 프로스트드래곤피쉬: 둥근 고래형 몸, 작은 뿔, 위로 펼쳐진 얼음 날개 지느러미, 아래로 휜 긴 용 꼬리 */
const frostDragon: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(new THREE.Mesh(profileBody(1.35, 0.9, 0.82, 0.62, false, 0.8), grad("#a8dcff", "#ffffff", { mid: "#d0eeff", emissive: "#bfe8ff", ei: 0.18 })));
  eyes(g, 0.07, 0.5, 0.14, 0.36, "#ffffff");
  for (const s of [-1, 1]) {
    g.add(tube([V(0.42, 0.34, s * 0.14), V(0.44, 0.58, s * 0.2), V(0.3, 0.74, s * 0.22)], 0.04, phys("#e8f6ff", { emissive: C("#bfe8ff"), emissiveIntensity: 0.3 }), 0.7));
  }
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(0.0, 0.4, s * 0.1);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.bezierCurveTo(-0.1, 0.5, -0.3, 0.95, -0.7, 1.15);
    sh.bezierCurveTo(-0.65, 0.8, -0.8, 0.5, -1.0, 0.25);
    sh.bezierCurveTo(-0.8, 0.2, -0.4, 0.05, 0, 0);
    const wing = softFin(sh, glass("#bfe8ff", 0.7), 0.025);
    wing.rotation.x = s * 0.35;
    w.add(wing);
    g.add(w);
    wings.push(w);
  }
  // 아래로 휜 긴 꼬리
  const tail = new THREE.Group();
  tail.position.set(-0.62, -0.05, 0);
  tail.add(tube([V(0, 0, 0), V(-0.45, -0.1, 0), V(-0.9, -0.4, 0), V(-1.25, -0.85, 0)], 0.17, phys("#cfeaff", { emissive: C("#bfe8ff"), emissiveIntensity: 0.15 }), 0.85));
  const tf = tailFin(0.4, glass("#bfe8ff", 0.7), "fork");
  tf.position.set(-1.25, -0.85, 0);
  tf.rotation.z = -1.0;
  tail.add(tf);
  g.add(tail);
  for (let i = 0; i < 6; i++) {
    const c = crystal(0.1 + (i % 3) * 0.04, 0.03, C("#e8f8ff"), C("#7ac8ff"));
    c.position.set(0.25 - i * 0.18, -0.05 + (i % 2) * 0.2, 0.4 - (i % 3) * 0.02);
    c.rotation.z = i;
    g.add(c);
    const c2 = c.clone();
    c2.position.z *= -1;
    g.add(c2);
  }
  anim.push((t) => { wings.forEach((w, i) => (w.rotation.x = (i ? 1 : -1) * Math.sin(t * 1.4) * 0.12)); tail.rotation.z = Math.sin(t * 1.3) * 0.12; });
  return finish(g, anim, 2.5, "#c8ecff", [2.2, 2.0, 1.7], 20);
};

/** 눈의여왕대구: 둥글고 머리가 큰 대구, 머리의 얼음 무늬, 짧고 투명한 지느러미, 주위의 크고 작은 얼음 결정 */
const snowQueenCod: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(new THREE.Mesh(profileBody(1.55, 0.85, 0.75, 0.55, false, 0.85), grad("#ffffff", "#d8efff", { mid: "#eaf6ff", emissive: "#d8efff", ei: 0.16 })));
  eyes(g, 0.075, 0.55, 0.14, 0.32);
  for (const p of [[0.38, 0.32, 0], [0.28, 0.22, 0.28], [0.28, 0.22, -0.28], [0.1, 0.35, 0.18], [0.1, 0.35, -0.18]] as const) {
    const m = flat(glass("#8ad0f0", 0.65), [p[0], p[1], p[2]], [0.13, 0.04, 0.09]);
    m.rotation.z = -0.5;
    g.add(m);
  }
  g.add(flat(phys("#c8e4f8"), [0.76, -0.08, 0], [0.14, 0.1, 0.3]));
  g.add(tube([V(0.7, -0.2, 0), V(0.73, -0.34, 0)], 0.02, phys("#d8efff"), 0.3)); // 턱수염
  for (const s of [-1, 1]) {
    const f = sideFin(0.3, glass("#cfeeff", 0.55));
    f.position.set(0.14, -0.15, s * 0.36);
    f.rotation.set(s * 1.1, 0.2, -0.3);
    g.add(f);
  }
  const dors = dorsalFin(0.45, 0.25, glass("#cfeeff", 0.55));
  dors.position.set(-0.4, 0.38, 0);
  g.add(dors);
  const tail = new THREE.Group();
  tail.position.set(-0.76, 0, 0);
  tail.add(tailFin(0.38, glass("#cfeeff", 0.6), "round"));
  g.add(tail);
  const ice = new THREE.Group();
  for (let i = 0; i < 9; i++) ice.add(crystal(0.1 + (i % 4) * 0.08, 0.025 + (i % 3) * 0.015, C("#e0f6ff"), C("#7ac8ff")));
  g.add(ice);
  anim.push((t) => {
    g.rotation.z = Math.sin(t * 0.9) * 0.1; // 몸을 살짝 기울이며
    tail.rotation.y = Math.sin(t * 2) * 0.25;
    ice.children.forEach((c, i) => { const a = t * 0.5 + i * 0.7; c.position.set(Math.cos(a) * 1.0, Math.sin(a * 1.3 + i) * 0.55, Math.sin(a) * 0.7); c.rotation.z = a; });
  });
  return finish(g, anim, 2.5, "#cfeeff", [1.9, 1.6, 1.5], 14);
};

/** 북극광철갑상어: 긴 주둥이, 등의 큰 갑옷 판, 민트-보라 오로라 몸, 보라 발광 무늬 */
const auroraSturgeon: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(new THREE.Mesh(profileBody(1.9, 0.72, 0.7, 0.5, true, 0.8), grad("#4ae8c0", "#b890ff", { mid: "#8ac8f0", emissive: "#7affd0", ei: 0.2 })));
  eyes(g, 0.05, 0.62, 0.12, 0.2);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++)
    g.add(tube([V(0.82, -0.18, s * (0.04 + i * 0.05)), V(0.86, -0.32, s * (0.06 + i * 0.07)), V(0.84, -0.4, s * (0.05 + i * 0.07))], 0.014, phys("#b890ff"), 0.4));
  const plate = phys("#c8b4ff", { metalness: 0.4, emissive: C("#8a5aff"), emissiveIntensity: 0.35 });
  for (let i = 0; i < 9; i++) { // 등의 큰 갑옷 판
    const p = flat(plate, [0.55 - i * 0.17, 0.3 - Math.abs(i - 3) * 0.012, 0], [0.18, 0.1, 0.22 - i * 0.012]);
    p.rotation.z = -0.15;
    g.add(p);
    const gl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16), glow("#b070ff", 1.2));
    gl.position.set(0.55 - i * 0.17, 0.38, 0);
    gl.rotation.x = Math.PI / 2;
    g.add(gl);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) g.add(flat(plate, [0.5 - i * 0.18, 0.04, s * (0.3 - i * 0.012)], [0.1, 0.07, 0.05]));
  const dfin = dorsalFin(0.35, 0.4, glass("#b890ff", 0.65));
  dfin.position.set(-0.55, 0.3, 0);
  g.add(dfin);
  for (const s of [-1, 1]) {
    const f = sideFin(0.34, glass("#8ad0ff", 0.65));
    f.position.set(0.3, -0.18, s * 0.34);
    f.rotation.set(s * 1.05, 0.2, -0.35);
    g.add(f);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.92, 0, 0);
  tail.rotation.z = 0.15;
  const sh = new THREE.Shape();
  const L = 0.5;
  sh.moveTo(0.04, 0);
  sh.bezierCurveTo(-L * 0.2, L * 0.35, -L * 0.6, L * 1.1, -L * 1.1, L * 1.3);
  sh.bezierCurveTo(-L, L * 0.7, -L * 0.75, L * 0.25, -L * 0.7, 0);
  sh.bezierCurveTo(-L * 0.85, -L * 0.2, -L * 0.9, -L * 0.45, -L * 0.75, -L * 0.55);
  sh.bezierCurveTo(-L * 0.4, -L * 0.35, -L * 0.15, -L * 0.15, 0.04, 0);
  tail.add(softFin(sh, glass("#9a7aff", 0.7), 0.04));
  g.add(tail);
  const orbs = new THREE.Group();
  for (let i = 0; i < 12; i++) orbs.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9affd8 : 0xb890ff })));
  g.add(orbs);
  anim.push((t) => {
    g.rotation.x = Math.sin(t * 0.5) * 0.18; // 천천히 돌며
    tail.rotation.y = Math.sin(t * 2.4) * 0.3;
    orbs.children.forEach((o, i) => { const a = t * 0.7 + i * 0.55; o.position.set(Math.cos(a) * 1.2, Math.sin(a * 1.2 + i) * 0.4, Math.sin(a) * 0.7); });
  });
  return finish(g, anim, 2.3, "#8affd8", [2.8, 1.2, 1.4], 14);
};

/** 그린란드상어: 까치상어보다 길고 두꺼운 몸, 넓적한 머리, 작은 눈, 넓은 입의 작은 이빨 여러 개, 낮고 두꺼운 등지느러미, 묵직한 꼬리 */
const greenlandShark: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const noise = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#5a6878"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(${40 + Math.random() * 60},${50 + Math.random() * 60},${64 + Math.random() * 60},0.5)`; x.beginPath(); x.ellipse(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 6, 2 + Math.random() * 4, Math.random() * 3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const skin = new THREE.MeshPhysicalMaterial({ map: noise, bumpMap: noise, bumpScale: 0.4, roughness: 0.55, clearcoat: 0.3 });
  g.add(new THREE.Mesh(profileBody(2.2, 0.95, 0.95, 0.55, false, 0.7), skin));
  g.add(flat(skin, [0.85, 0.0, 0], [0.5, 0.45, 0.7])); // 넓적하고 둥근 머리
  eyes(g, 0.04, 0.8, 0.12, 0.36);
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 0.6 });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 6, 24, Math.PI), dark);
  mouth.position.set(0.98, -0.16, 0);
  mouth.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  g.add(mouth);
  const white = phys("#f4f0e8");
  for (let i = 0; i < 18; i++) {
    const th = ((i / 17) * 2 - 1) * 1.1;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 5), white);
    t.rotation.z = i % 2 ? Math.PI : 0;
    t.position.set(0.98 - 0.12 * (1 - Math.cos(th)) , -0.16 + (i % 2 ? 0.02 : -0.02), 0.32 * Math.sin(th));
    g.add(t);
  }
  const dfin = dorsalFin(0.5, 0.26, phys("#4a5868", { side: THREE.DoubleSide }));
  dfin.position.set(-0.15, 0.46, 0);
  g.add(dfin);
  for (const s of [-1, 1]) {
    const f = sideFin(0.5, phys("#4a5868", { side: THREE.DoubleSide }));
    f.position.set(0.3, -0.3, s * 0.5);
    f.rotation.set(s * 1.0, 0.2, -0.3);
    g.add(f);
  }
  const tail = new THREE.Group();
  tail.position.set(-1.1, 0, 0);
  tail.rotation.z = 0.1;
  tail.add(tailFin(0.7, phys("#4a5868", { side: THREE.DoubleSide }), "crescent"));
  g.add(tail);
  anim.push((t) => { g.rotation.y = Math.sin(t * 0.8) * 0.08; tail.rotation.y = Math.sin(t * 1.3) * 0.28; });
  return finish(g, anim, 2.2, "#9ab0c8", [3.4, 1.7, 1.9], 12);
};

export const CUSTOM2: Record<string, Maker> = {
  호수의수호어: lakeGuardian, 용잉어: dragonCarp, 대왕문어: giantOctopus,
  리바이어던: leviathan, 크라켄: kraken, 빙하고래: glacierWhale, 프로스트드래곤피쉬: frostDragon,
  눈의여왕대구: snowQueenCod, 북극광철갑상어: auroraSturgeon, 그린란드상어: greenlandShark,
};
