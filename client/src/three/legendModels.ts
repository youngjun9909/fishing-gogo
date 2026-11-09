import * as THREE from "three";
import { crystal, dorsalFin, profileBody, sideFin, softFin, tailFin, tube, veil } from "./fishModel";
import type { Anim } from "./fishModel";
import { C, eyes, finish, flat, glass, glow, grad, phys } from "./legendKit";
import type { Maker } from "./legendKit";
import { CUSTOM2 } from "./legendModels2";
import { CUSTOM3 } from "./legendModels3";
import { MYTH_MODELS } from "./mythModels";

// 새로 만든 전설 물고기들의 개별 모델. 길이 방향은 +x(머리), 위는 +y, 폭은 z.
// 각 함수는 buildFish와 같은 규칙으로 Group을 돌려준다(userData.update, designScale).

// ---------------------------------------------------------------- 호수
/** 연화등불메기: 이마의 연꽃 봉오리, 구슬 달린 긴 수염, 연꽃잎 등지느러미, 배 아래 등불 */
const lotusCatfish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#ffd470", "#ffe8c0", { mid: "#f6b858", emissive: "#ffb870" }), belly = phys("#fff0d0"), gold = glow("#ffd86a", 0.7), petalMat = phys("#ffb0c8", { emissive: C("#ff7aa8"), emissiveIntensity: 0.15 });
  g.add(new THREE.Mesh(profileBody(1.0, 0.7, 0.68, 0.6, false, 0.6), skin));
  g.add(flat(belly, [0.05, -0.2, 0], [0.8, 0.26, 0.5]));
  eyes(g, 0.05, 0.36, 0.1, 0.3);
  // 이마의 연꽃 봉오리
  const lotus = new THREE.Group();
  lotus.position.set(0.3, 0.34, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = flat(petalMat, [Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05], [0.07, 0.24, 0.045], new THREE.SphereGeometry(0.5, 12, 10));
    petal.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    lotus.add(petal);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), gold);
    tip.position.set(Math.cos(a) * 0.1, 0.22, Math.sin(a) * 0.1);
    lotus.add(tip);
  }
  g.add(lotus);
  // 수염 2쌍, 끝에 황금 구슬
  const wh: THREE.Group[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const w = new THREE.Group();
    w.position.set(0.46, -0.1, s * (0.12 + i * 0.1));
    w.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, -0.18, s * 0.08), new THREE.Vector3(0.05, -0.5 - i * 0.12, s * 0.16)], 0.022, skin, 0.4));
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), gold);
    bead.position.set(0.05, -0.5 - i * 0.12, s * 0.16);
    w.add(bead);
    g.add(w);
    wh.push(w);
  }
  anim.push((t) => wh.forEach((w, i) => (w.rotation.z = Math.sin(t * 1.6 + i) * 0.12)));
  // 연꽃잎처럼 펼쳐진 등지느러미
  for (let i = 0; i < 5; i++) {
    const f = flat(phys("#ffd0a0", { emissive: C("#ffb070"), emissiveIntensity: 0.15 }), [0.2 - i * 0.14, 0.42, 0], [0.08, 0.3, 0.05]);
    f.rotation.z = (i - 2) * 0.22;
    f.position.y += 0.06;
    g.add(f);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.5, 0, 0);
  tail.add(tailFin(0.36, phys("#ffc070", { side: THREE.DoubleSide }), "round"));
  g.add(tail);
  anim.push((t) => (tail.rotation.y = Math.sin(t * 3) * 0.35));
  // 배 아래 등불
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), glow("#fff2a0", 1.6));
  lamp.position.set(0.1, -0.42, 0);
  g.add(lamp);
  // 떠다니는 연꽃잎
  const drift = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const p = flat(new THREE.MeshBasicMaterial({ color: 0xffb0c8 }), [0, 0, 0], [0.06, 0.02, 0.035]);
    p.userData.ph = i;
    drift.add(p);
  }
  g.add(drift);
  anim.push((t) => drift.children.forEach((p, i) => p.position.set(Math.cos(t * 0.5 + i * 0.9) * 0.9, 0.3 + Math.sin(t * 0.9 + i) * 0.35, Math.sin(t * 0.5 + i * 0.9) * 0.6)));
  return finish(g, anim, 2.5, "#ffc87a", [1.7, 1.4, 1.4], 16);
};

/** 비취가물치: 긴 몸에 비취색, 금빛 비늘 점, 이마 보석, 낮고 긴 금빛 등지느러미 */
const jadeSnakehead: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#0f7a62", "#8ef0c8", { mid: "#1fae8a", emissive: "#3affc0" }), belly = phys("#c8f4e0"), goldM = glow("#ffd24a", 0.6);
  const body = new THREE.Group();
  g.add(body);
  body.add(new THREE.Mesh(profileBody(1.7, 0.52, 0.56, 0.6, false, 0.75), skin));
  body.add(flat(belly, [0.05, -0.17, 0], [1.4, 0.2, 0.44]));
  // 넓적한 주둥이, 살짝 튀어나온 작은 입
  body.add(flat(skin, [0.8, 0.0, 0], [0.34, 0.26, 0.4]));
  eyes(body, 0.045, 0.62, 0.15, 0.22);
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), glow("#3affc0", 1.0));
  jewel.position.set(0.66, 0.26, 0);
  body.add(jewel);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
    const sc = flat(goldM, [0.55 - i * 0.22, 0.04 + (i % 2) * 0.05, s * (0.24 - i * 0.012)], [0.07, 0.07, 0.025]);
    body.add(sc);
  }
  const dorsal = dorsalFin(1.1, 0.14, glow("#ffd24a", 0.35));
  dorsal.scale.x = -1;
  dorsal.position.set(0.5, 0.25, 0);
  body.add(dorsal);
  const tail = new THREE.Group();
  tail.position.set(-0.88, 0, 0);
  tail.add(tailFin(0.4, phys("#2fc29a", { side: THREE.DoubleSide }), "fan"));
  body.add(tail);
  anim.push((t) => { body.rotation.y = Math.sin(t * 2.2) * 0.14; tail.rotation.y = Math.sin(t * 3.2) * 0.4; });
  return finish(g, anim, 2.2, "#52ffc0", [2.2, 0.9, 0.9], 18);
};

/** 나비날개어: 작은 진주빛 몸에 나비 날개 같은 가슴지느러미 */
const butterflyFish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(flat(grad("#bfe4ff", "#ffe0f0", { mid: "#f6d8ff", emissive: "#ffc8e8" }), [0, 0, 0], [0.62, 0.52, 0.5]));
  eyes(g, 0.05, 0.22, 0.08, 0.2);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), glow("#9ad8ff", 1.0));
  gem.position.set(0.25, 0.22, 0);
  g.add(gem);
  const wing = (up: boolean) => {
    const sh = new THREE.Shape();
    const k = up ? 1 : 0.62;
    sh.moveTo(0, 0);
    sh.bezierCurveTo(-0.1 * k, 0.5 * k, -0.5 * k, 0.9 * k, -0.85 * k, 0.7 * k);
    sh.bezierCurveTo(-1.0 * k, 0.45 * k, -0.85 * k, 0.2 * k, -0.6 * k, 0.06 * k);
    sh.bezierCurveTo(-0.4 * k, -0.04 * k, -0.15 * k, -0.04 * k, 0, 0);
    return sh;
  };
  const wingMat = (c: string) => new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: 0.72, side: THREE.DoubleSide, roughness: 0.15, emissive: C(c), emissiveIntensity: 0.3, depthWrite: false });
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(0.05, 0.02, s * 0.2);
    const upper = softFin(wing(true), wingMat("#9fd8ff"), 0.015);
    upper.rotation.x = s * 0.75;
    const lower = softFin(wing(false), wingMat("#ffb0e0"), 0.015);
    lower.rotation.x = s * 0.75;
    lower.rotation.z = -0.55;
    w.add(upper, lower);
    for (let i = 0; i < 5; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      dot.position.set(-0.2 - i * 0.1, 0.18 + (i % 2) * 0.12, s * 0.16 + s * i * 0.08);
      w.add(dot);
    }
    g.add(w);
    wings.push(w);
  }
  // 세 갈래 꼬리
  for (let i = -1; i <= 1; i++) {
    const t = flat(phys("#d8c0ff", { emissive: C("#c0a0ff"), emissiveIntensity: 0.2 }), [-0.42, i * 0.07, 0], [0.26, 0.05, 0.03]);
    t.rotation.z = i * 0.35;
    g.add(t);
  }
  anim.push((t) => wings.forEach((w, i) => (w.rotation.x = (i ? 1 : -1) * Math.sin(t * 2.2) * 0.5)));
  return finish(g, anim, 3.0, "#ffc8f0", [1.9, 1.6, 2.4], 20);
};

/** 황금등껍질어: 거북 등껍질을 진 물고기. 금색 조각 6개와 가운데 둥근 문양 */
const goldShellFish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#0e7f78", "#5fe0c8", { mid: "#1aa595" }), shellDark = phys("#0e6b63"), goldM = phys("#ffc83a", { metalness: 0.5, emissive: C("#ffb020"), emissiveIntensity: 0.25 });
  g.add(flat(skin, [0.05, -0.02, 0], [0.9, 0.42, 0.7]));
  // 머리와 짧은 삼각 꼬리
  g.add(flat(skin, [0.5, 0.0, 0], [0.34, 0.3, 0.3]));
  eyes(g, 0.04, 0.62, 0.08, 0.14);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 4), skin);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.62, -0.02, 0);
  g.add(tail);
  // 등껍질
  const shell = new THREE.Group();
  shell.position.set(-0.05, 0.1, 0);
  shell.add(new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), shellDark));
  for (let i = 0; i < 6; i++) {
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12, (i / 6) * Math.PI * 2 + 0.05, Math.PI / 3 - 0.1, 0.25, Math.PI / 2 - 0.55), goldM);
    shell.add(plate);
  }
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), glow("#ffe080", 0.9));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.595;
  shell.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 8, 32), glow("#fff0b0", 1));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.585;
  shell.add(ring);
  g.add(shell);
  // 지느러미 4개(물고기 모양)
  const fins: THREE.Object3D[] = [];
  for (const s of [-1, 1]) for (const fx of [0.3, -0.35]) {
    const f = sideFin(fx > 0 ? 0.36 : 0.26, phys("#30d0b8", { side: THREE.DoubleSide }));
    f.position.set(fx, -0.1, s * 0.4);
    f.rotation.set(s * 1.1, 0.2, -0.3);
    g.add(f);
    fins.push(f);
  }
  anim.push((t) => { g.rotation.z = Math.sin(t * 1.4) * 0.05; shell.rotation.y = Math.sin(t * 0.8) * 0.25; });
  return finish(g, anim, 2.7, "#ffd860", [1.7, 1.2, 1.4], 18);
};

// ---------------------------------------------------------------- 바닷가
/** 천공비행어: 넓은 삼각 날개 가슴지느러미, 금빛 등지느러미, 갈라진 긴 꼬리 */
const skyFlyer: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(flat(grad("#0a3f78", "#2fc8c0", { mid: "#0f5a8a" }), [0, 0.03, 0], [0.9, 0.55, 0.5]));
  g.add(flat(phys("#e4f0f8", { metalness: 0.3 }), [0.02, -0.14, 0], [0.8, 0.3, 0.44]));
  eyes(g, 0.05, 0.33, 0.1, 0.22);
  const dors = dorsalFin(0.6, 0.55, glow("#ffc83a", 0.4));
  dors.scale.x = -1;
  dors.position.set(0.2, 0.26, 0);
  g.add(dors);
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(0.08, 0.02, s * 0.22);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(-0.2, 0.25);
    sh.bezierCurveTo(-0.55, 0.75, -0.9, 1.2, -1.1, 1.3); // 끝이 위로 올라간 날개
    sh.bezierCurveTo(-1.15, 0.8, -0.95, 0.35, -0.55, 0.05);
    sh.lineTo(0, 0);
    const wing = softFin(sh, new THREE.MeshPhysicalMaterial({ color: "#2fc8c0", emissive: C("#ffd24a"), emissiveIntensity: 0.1, side: THREE.DoubleSide, roughness: 0.25 }), 0.02);
    wing.rotation.x = s * 1.0;
    w.add(wing);
    const edge = tube([new THREE.Vector3(0, 0.02, s * 0.02), new THREE.Vector3(-0.55, 0.0, s * 0.74), new THREE.Vector3(-1.1, 0.02, s * 1.3)], 0.012, glow("#ffd24a", 0.9), 0.3);
    w.add(edge);
    g.add(w);
    wings.push(w);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.45, 0, 0);
  tail.add(tailFin(0.7, phys("#1fb0c8", { side: THREE.DoubleSide }), "fork"));
  g.add(tail);
  anim.push((t) => {
    const fold = 0.12 * Math.sin(t * 0.9);
    wings.forEach((w, i) => (w.rotation.x = (i ? 1 : -1) * fold));
    tail.rotation.y = Math.sin(t * 3) * 0.25;
  });
  return finish(g, anim, 2.6, "#7affe8", [2.4, 1.2, 2.8], 18);
};

/** 산호불꽃쏠배감펭: 주황·빨강 줄무늬, 방사형으로 펼쳐진 긴 가시 지느러미, 불꽃 끝 */
const flameLionfish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const orange = grad("#ff6a1a", "#ffd0a0", { mid: "#ff8a2a" }), red = phys("#d62a1a");
  g.add(new THREE.Mesh(profileBody(1.0, 0.62, 0.55, 0.55, false, 0.7), orange));
  g.add(flat(phys("#ffd8b0"), [0.03, -0.18, 0], [0.8, 0.24, 0.44]));
  for (let i = 0; i < 6; i++) {
    const x = -0.35 + i * 0.16;
    const r = 0.5 * 0.62 * Math.max(0.35, Math.sin(((x + 0.5) / 1.0) * Math.PI) ** 0.7) * 0.98;
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 8, 28), red);
    band.rotation.y = Math.PI / 2;
    band.position.x = x;
    band.scale.set(1, 1, 0.9);
    g.add(band);
  }
  eyes(g, 0.05, 0.36, 0.1, 0.22);
  const flame = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
  const spines: THREE.Group[] = [];
  const ray = (len: number, ang: number, z: number, x: number, y: number) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.z = ang;
    grp.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, len * 0.5, z * 0.4), new THREE.Vector3(-0.05, len, z * 0.8)], 0.012, phys("#ffc04a"), 0.5));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), flame);
    tip.position.set(-0.05, len + 0.04, z * 0.8);
    grp.add(tip);
    g.add(grp);
    spines.push(grp);
  };
  for (let i = 0; i < 9; i++) ray(0.5 + (i % 3) * 0.12, (i - 4) * 0.13 + 0.15, 0, 0.3 - i * 0.1, 0.28); // 등
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { // 가슴
    const grp = new THREE.Group();
    grp.position.set(0.15, -0.05, s * 0.24);
    grp.rotation.set(s * (0.7 + i * 0.08), 0, 0);
    grp.rotation.z = -0.5 - i * 0.12;
    grp.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.2, 0.25, 0), new THREE.Vector3(-0.35, 0.5 + i * 0.03, 0)], 0.011, phys("#ffc04a"), 0.5));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.08, 6), flame);
    tip.position.set(-0.35, 0.54 + i * 0.03, 0);
    grp.add(tip);
    g.add(grp);
    spines.push(grp);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.48, 0, 0);
  tail.add(tailFin(0.55, phys("#ff6a2a", { side: THREE.DoubleSide }), "fan"));
  g.add(tail);
  anim.push((t) => { spines.forEach((s, i) => (s.rotation.x += Math.sin(t * 1.5 + i) * 0.0015)); tail.rotation.y = Math.sin(t * 2.6) * 0.3; });
  return finish(g, anim, 2.6, "#ff9a3a", [1.9, 1.7, 1.5], 22);
};

/** 고대나선어: 작은 은빛 몸에 암모나이트 같은 나선 껍질 */
const ancientSpiral: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const body = grad("#cfdcff", "#ffffff", { mid: "#e8eef8", emissive: "#c8d8ff" });
  g.add(flat(body, [0.35, 0, 0], [0.5, 0.36, 0.34]));
  eyes(g, 0.04, 0.52, 0.08, 0.15);
  for (const s of [-1, 1]) {
    const f = sideFin(0.25, glass("#c8e0ff", 0.55));
    f.position.set(0.4, -0.08, s * 0.2);
    f.rotation.set(s * 1.1, 0.2, -0.3);
    g.add(f);
  }
  const tail = flat(phys("#d8e4ff"), [0.04, -0.02, 0], [0.22, 0.2, 0.1]);
  g.add(tail);
  // 나선 껍질(점점 커지는 구슬을 나선으로 쌓는다)
  const shell = new THREE.Group();
  shell.position.set(-0.1, 0.06, 0);
  const shellMat = phys("#b8c8f0", { emissive: C("#8aa8ff"), emissiveIntensity: 0.15, metalness: 0.15 });
  const N = 34;
  for (let i = 0; i < N; i++) {
    const th = i * 0.28;
    const r = 0.05 + (i / N) * 0.5;
    const rr = 0.04 + (i / N) * 0.12;
    const b = new THREE.Mesh(new THREE.SphereGeometry(rr, 12, 10), i % 6 === 0 ? glow("#a0b8ff", 0.7) : shellMat);
    b.position.set(Math.cos(th) * r * 0.55, Math.sin(th) * r * 0.55, 0);
    shell.add(b);
  }
  shell.scale.setScalar(1.15);
  g.add(shell);
  anim.push((t) => { shell.rotation.z = Math.sin(t * 0.7) * 0.2; g.rotation.z = Math.sin(t * 1.1) * 0.04; });
  return finish(g, anim, 2.7, "#b0c8ff", [1.8, 1.5, 1.1], 16);
};

/** 해초왕해마: 서 있는 해마 몸, 해초 잎 왕관, 말린 꼬리, 산호 장식 */
const seaweedSeahorse: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#1fa880", "#c8f87a", { mid: "#3fc89a", emissive: "#5affb0" }), lime = phys("#a8e868");
  const body = new THREE.Group();
  g.add(body);
  // 몸통(위로 갈수록 굵고 아래는 말린 꼬리)
  const spine = [new THREE.Vector3(0.05, 0.62, 0), new THREE.Vector3(0.12, 0.35, 0), new THREE.Vector3(0.1, 0.05, 0), new THREE.Vector3(0.0, -0.25, 0), new THREE.Vector3(-0.12, -0.5, 0), new THREE.Vector3(-0.3, -0.62, 0), new THREE.Vector3(-0.38, -0.5, 0), new THREE.Vector3(-0.3, -0.4, 0), new THREE.Vector3(-0.22, -0.46, 0)];
  body.add(tube(spine, 0.18, skin, 0.85));
  body.add(flat(lime, [0.1, 0.12, 0], [0.2, 0.55, 0.3])); // 배
  // 머리와 긴 주둥이
  body.add(flat(skin, [0.08, 0.72, 0], [0.34, 0.3, 0.3]));
  body.add(tube([new THREE.Vector3(0.2, 0.7, 0), new THREE.Vector3(0.42, 0.66, 0), new THREE.Vector3(0.62, 0.62, 0)], 0.06, skin, 0.3));
  eyes(body, 0.04, 0.18, 0.78, 0.13);
  // 해초 왕관
  const crown: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const leaf = flat(phys("#58d870", { emissive: C("#38b850"), emissiveIntensity: 0.3 }), [0.0 - i * 0.04, 0.95 + (i % 2) * 0.04, (i - 1.5) * 0.1], [0.07, 0.32, 0.035]);
    leaf.rotation.z = (i - 1.5) * 0.18;
    body.add(leaf);
    crown.push(leaf);
  }
  // 등 뒤 물결 지느러미
  const fin = flat(glass("#9af0b8", 0.6), [-0.1, 0.25, 0], [0.04, 0.42, 0.3]);
  body.add(fin);
  // 산호 장식과 녹색 발광 점
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 6), phys("#ff8a9a"));
    c.position.set(0.18, 0.5 - i * 0.2, 0.14 - (i % 2) * 0.28);
    body.add(c);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), glow("#a0ff8a", 1.2));
    d.position.set(0.19, 0.4 - i * 0.18, -0.15 + (i % 2) * 0.3);
    body.add(d);
  }
  anim.push((t) => { body.position.y = Math.sin(t * 1.4) * 0.05; body.rotation.z = Math.sin(t * 1.0) * 0.06; crown.forEach((l, i) => (l.rotation.x = Math.sin(t * 2 + i) * 0.2)); });
  return finish(g, anim, 2.6, "#7affa0", [1.2, 1.9, 1.2], 18);
};

// ---------------------------------------------------------------- 얼음 호수
/** 은빛빙어: 가늘고 작은 은빛 몸에 얼음 결정 지느러미 */
const silverSmelt: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(new THREE.Mesh(profileBody(1.3, 0.3, 0.26, 0.4, false, 0.9), grad("#cfe6f6", "#ffffff", { mid: "#e8f2fa", emissive: "#c8e8ff" })));
  eyes(g, 0.035, 0.45, 0.06, 0.1);
  const iceM = glass("#bfe8ff", 0.6);
  const dors = dorsalFin(0.3, 0.32, iceM);
  dors.scale.x = -1;
  dors.position.set(0.1, 0.13, 0);
  g.add(dors);
  const tail = new THREE.Group();
  tail.position.set(-0.62, 0, 0);
  tail.add(tailFin(0.34, iceM, "fork"));
  g.add(tail);
  for (const s of [-1, 1]) {
    const f = sideFin(0.18, iceM);
    f.position.set(0.25, -0.05, s * 0.1);
    f.rotation.set(s * 1.1, 0.2, -0.3);
    g.add(f);
  }
  const shards = new THREE.Group();
  for (let i = 0; i < 4; i++) shards.add(crystal(0.12, 0.03, C("#d8f4ff"), C("#8ad0ff")));
  g.add(shards);
  anim.push((t) => {
    tail.rotation.y = Math.sin(t * 7) * 0.5;
    shards.children.forEach((c, i) => { const a = t * 1.1 + i * 1.6; c.position.set(Math.cos(a) * 0.9, Math.sin(a * 1.3) * 0.3, Math.sin(a) * 0.5); c.rotation.z = a; });
  });
  return finish(g, anim, 3.0, "#d8f6ff", [1.9, 1.1, 1.0], 14);
};

/** 오로라연어: 통통한 몸에 오로라색 그라데이션, 빛나는 긴 등지느러미와 흐르는 빛의 띠 */
const auroraSalmon: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const tex = (() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const x = c.getContext("2d")!;
    const gr = x.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, "#9af0d0"); gr.addColorStop(0.35, "#c8a0ff"); gr.addColorStop(0.7, "#9ad0ff"); gr.addColorStop(1, "#f4fbff");
    x.fillStyle = gr; x.fillRect(0, 0, 256, 64);
    x.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 40; i++) { x.beginPath(); x.ellipse(Math.random() * 256, 12 + Math.random() * 40, 5, 3, 0, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  })();
  const skinMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, emissive: C("#a0f0e0"), emissiveIntensity: 0.12 });
  const body = new THREE.Mesh(profileBody(1.15, 0.62, 0.5, 0.48, false, 0.8), skinMat);
  body.rotation.x = Math.PI; // 그라데이션이 몸 길이를 따라 흐르도록
  g.add(body);
  eyes(g, 0.05, 0.42, 0.1, 0.2);
  const dors = dorsalFin(0.75, 0.3, glass("#c8a0ff", 0.55));
  dors.scale.x = -1;
  dors.position.set(0.3, 0.29, 0);
  g.add(dors);
  const tail = new THREE.Group();
  tail.position.set(-0.55, 0, 0);
  tail.add(tailFin(0.6, glass("#8af0d0", 0.65), "fan"));
  g.add(tail);
  for (const s of [-1, 1]) {
    const f = sideFin(0.3, glass("#a8d8ff", 0.6));
    f.position.set(0.2, -0.15, s * 0.22);
    f.rotation.set(s * 1.05, 0.15, -0.35);
    g.add(f);
  }
  for (let i = 0; i < 2; i++) {
    const v = veil(1.3, 0.5, C(i ? "#b08aff" : "#5affc0"), 0.5, anim, i * 2.5);
    v.position.set(0.2, 0.3, 0);
    v.rotation.x = (i - 0.5) * 1.3;
    g.add(v);
  }
  anim.push((t) => { tail.rotation.y = Math.sin(t * 4) * 0.35; skinMat.map!.offset.x = t * 0.08; });
  return finish(g, anim, 2.6, "#7affd8", [1.9, 1.4, 1.5], 22);
};

/** 빙정창어: 창처럼 긴 주둥이, 푸른 발광 눈, 얼음 결정 등지느러미, 갈라진 결정 꼬리 */
const iceLance: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(new THREE.Mesh(profileBody(1.0, 0.62, 0.55, 0.5, false, 0.75), grad("#1a3f96", "#8ac8f0", { mid: "#2a5fb0" })));
  g.add(flat(phys("#e4f4ff", { emissive: C("#bfe8ff"), emissiveIntensity: 0.15 }), [0.02, -0.17, 0], [0.82, 0.28, 0.46]));
  const lance = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 12), phys("#c8ecff", { emissive: C("#8ad0ff"), emissiveIntensity: 0.35 }));
  lance.rotation.z = -Math.PI / 2;
  lance.position.set(0.9, 0, 0);
  g.add(lance);
  eyes(g, 0.05, 0.3, 0.12, 0.25, "#58b8ff");
  const ice = glass("#bfe8ff", 0.7);
  for (let i = 0; i < 4; i++) {
    const c = crystal(0.28 - Math.abs(i - 1.5) * 0.05, 0.05, C("#d8f4ff"), C("#58b8ff"));
    c.position.set(0.2 - i * 0.18, 0.36, 0);
    c.rotation.z = -0.25 - i * 0.08;
    g.add(c);
  }
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(-0.22, 0.12); sh.lineTo(-0.05, 0.32); sh.lineTo(0, 0);
    const f = softFin(sh, ice, 0.02);
    f.position.set(0.25, -0.1, s * 0.25);
    f.rotation.set(s * 1.2, 0.2, -0.2);
    g.add(f);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.5, 0, 0);
  tail.add(tailFin(0.62, glass("#9ad8ff", 0.6), "fan")); // 투명한 얼음빛 부채 꼬리
  const dfan = dorsalFin(0.5, 0.42, glass("#9ad8ff", 0.55));
  dfan.position.set(-0.2, 0.3, 0);
  g.add(dfan);
  for (const s of [-1, 1]) {
    const c = crystal(0.45, 0.045, C("#d8f4ff"), C("#58b8ff"));
    c.position.set(-0.18, s * 0.2, 0);
    c.rotation.z = Math.PI / 2 + s * 0.6;
    tail.add(c);
  }
  g.add(tail);
  anim.push((t) => { tail.rotation.y = Math.sin(t * 3) * 0.3; g.position.x = Math.sin(t * 0.9) * 0.05; });
  return finish(g, anim, 2.6, "#7ac8ff", [2.4, 1.2, 1.1], 18);
};

/** 설화유영어: 작은 구형 몸에 눈꽃 가지처럼 방사형으로 펼쳐진 지느러미 6개 */
const snowflakeFish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  g.add(flat(phys("#f8fcff", { emissive: C("#d8f0ff"), emissiveIntensity: 0.15 }), [0, 0, 0], [0.55, 0.5, 0.5]));
  eyes(g, 0.045, 0.22, 0.06, 0.2);
  const tail = new THREE.Group();
  tail.add(tube([new THREE.Vector3(-0.25, 0, 0), new THREE.Vector3(-0.6, 0.05, 0), new THREE.Vector3(-1.0, -0.04, 0)], 0.05, phys("#e8f6ff"), 0.9));
  g.add(tail);
  const arms: THREE.Group[] = [];
  const flake = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const arm = new THREE.Group();
    arm.rotation.x = a; // 몸 축(x)을 둘러싸고 방사형으로
    arm.add(tube([new THREE.Vector3(-0.05, 0.2, 0), new THREE.Vector3(-0.1, 0.55, 0), new THREE.Vector3(-0.15, 0.95, 0)], 0.04, glass("#bfe8ff", 0.8), 0.5));
    for (const sd of [-1, 1]) {
      arm.add(tube([new THREE.Vector3(-0.1, 0.6, 0), new THREE.Vector3(-0.2, 0.74, sd * 0.1), new THREE.Vector3(-0.28, 0.86, sd * 0.16)], 0.025, glass("#bfe8ff", 0.8), 0.5));
    }
    const sn = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), flake);
    sn.position.set(-0.15, 1.0, 0);
    arm.add(sn);
    g.add(arm);
    arms.push(arm);
  }
  anim.push((t) => { arms.forEach((a, i) => { const k = 0.78 + 0.22 * Math.sin(t * 1.3 + i * 0.3); a.scale.set(1, k, k); }); tail.rotation.y = Math.sin(t * 3) * 0.3; g.rotation.x = t * 0.3; });
  return finish(g, anim, 2.5, "#e0f4ff", [2.2, 2.2, 2.2], 16);
};

// ---------------------------------------------------------------- 크루즈(깊은 바다)
const deepMat = () => grad("#080e30", "#1c2a60", { mid: "#0f1a40" });

/** 심연등불아귀: 큰 머리, 크게 벌어진 이빨 입, 발광 구슬 달린 촉수 */
const lanternAngler: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = deepMat(), white = phys("#f4f4ff");
  g.add(flat(skin, [0.1, 0.05, 0], [0.95, 0.8, 0.8]));
  g.add(flat(skin, [-0.55, -0.05, 0], [0.5, 0.36, 0.32]));
  const jaw = flat(skin, [0.38, -0.34, 0], [0.7, 0.2, 0.62]);
  jaw.rotation.z = -0.22;
  g.add(jaw);
  g.add(flat(new THREE.MeshStandardMaterial({ color: 0x300818 }), [0.36, -0.18, 0], [0.62, 0.16, 0.5]));
  for (let i = 0; i < 12; i++) {
    const th = ((i / 11) * 2 - 1) * 1.15;
    const px = 0.2 + 0.28 * Math.cos(th), pz = 0.3 * Math.sin(th);
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.13, 6), white);
    up.rotation.z = Math.PI; up.position.set(px, -0.1, pz); g.add(up);
    const lo = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 6), white);
    lo.position.set(px - 0.05, -0.24, pz * 0.9); g.add(lo);
  }
  eyes(g, 0.05, 0.4, 0.22, 0.32, "#34ffd8");
  const lure = new THREE.Group();
  lure.position.set(0.25, 0.4, 0);
  lure.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 0.4, 0), new THREE.Vector3(0.55, 0.45, 0)], 0.018, skin, 0.3));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), glow("#b86aff", 1.8));
  orb.position.set(0.55, 0.45, 0);
  lure.add(orb);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xa04aff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(orb.position);
  lure.add(halo);
  g.add(lure);
  const tail = new THREE.Group();
  tail.position.set(-0.85, -0.05, 0);
  tail.add(tailFin(0.35, phys("#1a2a60", { side: THREE.DoubleSide }), "fan"));
  g.add(tail);
  anim.push((t) => { lure.rotation.z = Math.sin(t * 1.8) * 0.18; tail.rotation.y = Math.sin(t * 2.6) * 0.3; });
  return finish(g, anim, 2.5, "#8a5aff", [2.2, 1.7, 1.8], 16);
};

/** 유령날개가오리: 반투명한 푸른 삼각 날개, 가는 실 꼬리, 푸른 발광선 */
const ghostRay: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const wingMat = new THREE.MeshPhysicalMaterial({ color: "#5a90ff", transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.15, emissive: C("#3a70ff"), emissiveIntensity: 0.4, depthWrite: false });
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(0.25, 0);
    sh.bezierCurveTo(0.2, 0.2, -0.2, 0.6, -0.55, 1.15); // 끝이 부드럽게 휘어진 날개
    sh.bezierCurveTo(-0.7, 1.2, -0.75, 0.9, -0.62, 0.55);
    sh.bezierCurveTo(-0.5, 0.2, -0.5, 0, -0.45, -0.05);
    sh.lineTo(0.25, 0);
    const m = softFin(sh, wingMat, 0.015);
    m.rotation.x = s * 0.95;
    w.add(m);
    for (let i = 0; i < 3; i++) {
      w.add(tube([new THREE.Vector3(0.15 - i * 0.12, 0.02, s * 0.02), new THREE.Vector3(-0.2 - i * 0.05, 0.02, s * (0.35 + i * 0.1)), new THREE.Vector3(-0.55 + i * 0.05, 0.02, s * (0.95 - i * 0.12))], 0.01, glow("#7ad8ff", 1.2), 0.5));
    }
    g.add(w);
    wings.push(w);
  }
  g.add(flat(new THREE.MeshPhysicalMaterial({ color: "#7aa8ff", transparent: true, opacity: 0.75, emissive: C("#4a78ff"), emissiveIntensity: 0.3 }), [0.12, 0.02, 0], [0.46, 0.22, 0.3]));
  eyes(g, 0.035, 0.28, 0.1, 0.1, "#a8e8ff");
  g.add(tube([new THREE.Vector3(-0.35, 0, 0), new THREE.Vector3(-0.9, 0.04, 0.05), new THREE.Vector3(-1.5, -0.02, -0.05)], 0.018, glow("#8ab8ff", 0.5), 0.9));
  anim.push((t) => wings.forEach((w, i) => (w.rotation.x = (i ? 1 : -1) * Math.sin(t * 1.5) * 0.35)));
  return finish(g, anim, 2.7, "#6aa8ff", [1.8, 0.9, 2.6], 18);
};

/** 블랙홀장어: 몸을 S자로 흔드는 긴 뱀 모양, 보라색 발광 고리와 눈 */
const blackholeEel: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const N = 34;
  const skin = phys("#15101c", { roughness: 0.4 });
  const segs: THREE.Mesh[] = [];
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1); // 0=머리, 1=꼬리
    const r = i === 0 ? 0.24 : 0.15 * Math.pow(1 - t, 0.7) + 0.015;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), skin);
    g.add(s);
    segs.push(s);
    if (i > 2 && i % 4 === 0 && i < N - 4) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.012, 6, 18), glow("#a04aff", 1.3));
      g.add(ring);
      rings.push(ring);
      ring.userData.i = i;
    }
  }
  const head = segs[0];
  head.scale.set(1.5, 0.9, 1.1);
  const jaw = flat(skin, [0, 0, 0], [0.3, 0.07, 0.18]);
  g.add(jaw);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glow("#c070ff", 1.6));
  const eyeR = eyeL.clone();
  g.add(eyeL, eyeR);
  const fins = new THREE.Group();
  for (let i = 3; i < N - 3; i += 2) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 4), glow("#8a4aff", 0.7));
    f.userData.i = i;
    fins.add(f);
  }
  g.add(fins);
  const pos = (i: number, t: number) => {
    const u = i / (N - 1);
    const x = 0.85 - u * 2.6;
    const z = Math.sin(u * 7 - t * 2.4) * 0.28 * (0.2 + u);
    return new THREE.Vector3(x, 0, z);
  };
  anim.push((t) => {
    segs.forEach((s, i) => s.position.copy(pos(i, t)));
    rings.forEach((r) => { const i = r.userData.i as number; const p = pos(i, t); const q = pos(i - 1, t); r.position.copy(p); r.rotation.y = Math.PI / 2 + Math.atan2(p.z - q.z, p.x - q.x) * -1; });
    const h = pos(0, t);
    jaw.position.set(h.x + 0.1, -0.06, h.z);
    eyeL.position.set(h.x + 0.14, 0.09, h.z + 0.09);
    eyeR.position.set(h.x + 0.14, 0.09, h.z - 0.09);
    fins.children.forEach((f) => { const p = pos(f.userData.i as number, t); f.position.set(p.x, 0.1, p.z); });
  });
  return finish(g, anim, 2.4, "#b060ff", [3.2, 0.9, 1.6], 16);
};

/** 홍월흡혈오징어: 짙은 붉은 둥근 머리, 막으로 이어진 짧고 두꺼운 촉수 8개(우산처럼 펼침) */
const vampireSquid: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = phys("#6a0a22", { emissive: C("#400010"), emissiveIntensity: 0.3 });
  g.add(flat(skin, [0, 0.15, 0], [0.8, 0.85, 0.8]));
  eyes(g, 0.08, 0.28, 0.2, 0.28, "#ff2a3a");
  const arms: THREE.Group[] = [];
  const web = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.8, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: "#5a1048", transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: C("#800a40"), emissiveIntensity: 0.3, depthWrite: false }));
  web.rotation.z = Math.PI / 2;
  web.position.set(0.62, -0.1, 0);
  g.add(web);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const arm = new THREE.Group();
    arm.rotation.x = a;
    arm.add(tube([new THREE.Vector3(0.2, 0.15, 0), new THREE.Vector3(0.5, 0.35, 0), new THREE.Vector3(0.85, 0.45, 0)], 0.12, skin, 0.75));
    for (let j = 0; j < 4; j++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), glow("#ff3a4a", 1.3));
      dot.position.set(0.3 + j * 0.17, 0.2 + j * 0.08, 0.04);
      arm.add(dot);
    }
    g.add(arm);
    arms.push(arm);
  }
  anim.push((t) => { const o = 0.8 + 0.25 * Math.sin(t * 1.6); web.scale.set(1, o, o); arms.forEach((a) => a.scale.set(1, o, o)); g.position.y = Math.sin(t * 0.8) * 0.05; });
  return finish(g, anim, 2.5, "#ff3a5a", [1.8, 1.8, 1.6], 16);
};

/** 심해갑옷어: 작고 둥근 청회색 몸에 겹쳐진 금속판, 금빛 균열 */
const armorFish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const steel = phys("#566a86", { metalness: 0.7, roughness: 0.35 }), dark = grad("#2c394e", "#566a86", { mid: "#3a4c68" });
  g.add(flat(dark, [0, 0, 0], [0.85, 0.6, 0.55]));
  g.add(flat(steel, [0.4, -0.02, 0], [0.4, 0.38, 0.36]));
  eyes(g, 0.04, 0.5, 0.1, 0.2);
  g.add(flat(new THREE.MeshStandardMaterial({ color: 0x120d18 }), [0.62, -0.08, 0], [0.08, 0.06, 0.1]));
  for (let i = 0; i < 6; i++) {
    const p = flat(steel, [0.3 - i * 0.14, 0.1 + (i < 3 ? i * 0.03 : (5 - i) * 0.03), 0], [0.3, 0.42, 0.62 - i * 0.03]);
    p.rotation.z = -0.15;
    g.add(p);
    const crack = tube([new THREE.Vector3(0.3 - i * 0.14 - 0.07, 0.34, -0.12), new THREE.Vector3(0.3 - i * 0.14 - 0.04, 0.3, 0), new THREE.Vector3(0.3 - i * 0.14 - 0.07, 0.34, 0.14)], 0.01, glow("#ffc83a", 1.1), 0.3);
    g.add(crack);
  }
  const mark = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 20), glow("#ffd860", 1.2));
  mark.position.set(0.05, 0.4, 0);
  mark.rotation.x = Math.PI / 2;
  g.add(mark);
  for (const s of [-1, 1]) {
    const f = sideFin(0.24, phys("#44566e", { side: THREE.DoubleSide }));
    f.position.set(0.35, -0.2, s * 0.3);
    f.rotation.set(s * 1.1, 0.2, -0.3);
    g.add(f);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.45, 0, 0);
  tail.add(tailFin(0.3, phys("#44566e", { side: THREE.DoubleSide }), "fan"));
  g.add(tail);
  anim.push((t) => { tail.rotation.y = Math.sin(t * 1.8) * 0.2; g.position.y = Math.sin(t * 0.7) * 0.03; });
  return finish(g, anim, 2.6, "#ffcf50", [1.6, 1.3, 1.2], 14);
};

/** 심해수정해파리: 투명한 수정 종, 안의 떠다니는 결정, 길게 늘어진 촉수 */
const crystalJelly: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const bellMat = new THREE.MeshPhysicalMaterial({ color: "#6af0d8", transparent: true, opacity: 0.45, roughness: 0.1, emissive: C("#3ac8c0"), emissiveIntensity: 0.3, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
  const bell = new THREE.Group();
  bell.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), bellMat));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), bellMat);
  tip.position.y = 0.62;
  bell.add(tip);
  bell.add(flat(new THREE.MeshPhysicalMaterial({ color: "#b090ff", transparent: true, opacity: 0.35, emissive: C("#8a6aff"), emissiveIntensity: 0.4 }), [0, 0.12, 0], [0.5, 0.18, 0.5]));
  g.add(bell);
  const cr: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), glow(i % 2 ? "#a8f0ff" : "#d0b0ff", 0.9));
    c.userData.p = i;
    bell.add(c);
    cr.push(c);
  }
  const tents: THREE.Group[] = [];
  const cols = ["#3ad8c8", "#6ab8ff", "#a88aff"];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = new THREE.Group();
    t.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
    t.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, -0.4, 0), new THREE.Vector3(-0.04, -0.8, 0.05), new THREE.Vector3(0.03, -1.2 - (i % 3) * 0.2, 0)], 0.022, glow(cols[i % 3], 0.5), 0.9));
    g.add(t);
    tents.push(t);
  }
  anim.push((time) => {
    const p = 1 + 0.12 * Math.sin(time * 1.8);
    bell.scale.set(p, 1 / p, p);
    g.position.y = Math.sin(time * 0.9) * 0.12;
    cr.forEach((c, i) => c.position.set(Math.cos(time * 0.7 + i) * 0.25, 0.15 + Math.sin(time * 1.1 + i * 1.3) * 0.12, Math.sin(time * 0.7 + i) * 0.25));
    tents.forEach((t, i) => (t.rotation.z = Math.sin(time * 1.4 + i) * 0.12));
  });
  return finish(g, anim, 2.5, "#6af0e0", [1.5, 2.4, 1.5], 16);
};

/** 황금송곳니어: 큰 머리와 돌출한 아래턱, 위아래 황금 송곳니 4개, 입 속 금빛 */
const goldFang: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#14121a", "#3a3846", { mid: "#1c1a22" });
  g.add(flat(skin, [0.15, 0.05, 0], [0.95, 0.75, 0.75]));
  g.add(flat(skin, [-0.5, 0, 0], [0.55, 0.38, 0.34]));
  const jaw = new THREE.Group();
  jaw.position.set(0.22, -0.22, 0);
  jaw.add(flat(skin, [0.25, -0.02, 0], [0.8, 0.2, 0.62]));
  g.add(jaw);
  g.add(flat(glow("#ffb020", 1.2), [0.42, -0.14, 0], [0.5, 0.12, 0.4])); // 입 속 빛
  const fang = new THREE.MeshPhysicalMaterial({ color: "#ffd24a", emissive: C("#ffb020"), emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.55, 8), fang);
    up.rotation.z = Math.PI; up.position.set(0.58, -0.02, s * 0.2); g.add(up);
    const lo = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.55, 8), fang);
    lo.position.set(0.7, -0.22, s * 0.18); jaw.add(lo); lo.position.set(0.5, 0.22, s * 0.18);
  }
  for (let i = 0; i < 18; i++) { // 작고 날카로운 이빨들
    const th = ((i / 17) * 2 - 1) * 1.2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 6), phys("#f4f0e8"));
    t.rotation.z = Math.PI;
    t.position.set(0.5 + 0.2 * Math.cos(th), -0.06, 0.3 * Math.sin(th));
    g.add(t);
    const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.08, 6), phys("#f4f0e8"));
    t2.position.set(0.52 + 0.2 * Math.cos(th), 0.1, 0.3 * Math.sin(th) * 0.9);
    jaw.add(t2);
  }
  eyes(g, 0.085, 0.42, 0.27, 0.3, "#ffd24a");
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.36 - i * 0.03, 6), skin);
    sp.position.set(0.3 - i * 0.16, 0.52 - i * 0.03, 0);
    sp.rotation.z = 0.2 + i * 0.05;
    g.add(sp);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.8, 0, 0);
  tail.add(tailFin(0.45, phys("#2a2630", { side: THREE.DoubleSide }), "round"));
  g.add(tail);
  anim.push((t) => { jaw.rotation.z = -0.1 - 0.12 * (0.5 + 0.5 * Math.sin(t * 2.2)); tail.rotation.y = Math.sin(t * 4) * 0.3; });
  return finish(g, anim, 2.5, "#ffc040", [2.3, 1.7, 1.7], 14);
};

export const CUSTOM_MODELS: Record<string, Maker> = {
  연화등불메기: lotusCatfish, 비취가물치: jadeSnakehead, 나비날개어: butterflyFish, 황금등껍질어: goldShellFish,
  천공비행어: skyFlyer, 산호불꽃쏠배감펭: flameLionfish, 고대나선어: ancientSpiral, 해초왕해마: seaweedSeahorse,
  은빛빙어: silverSmelt, 오로라연어: auroraSalmon, 빙정창어: iceLance, 설화유영어: snowflakeFish,
  심연등불아귀: lanternAngler, 유령날개가오리: ghostRay, 블랙홀장어: blackholeEel, 홍월흡혈오징어: vampireSquid,
  심해갑옷어: armorFish, 심해수정해파리: crystalJelly, 황금송곳니어: goldFang,
  ...CUSTOM2,
  ...MYTH_MODELS,
  ...CUSTOM3, // 참고 그림을 받아 다시 만든 모델이 같은 이름의 이전 모델을 대신한다(맨 뒤에 둬야 덮어쓴다)
};
void veil;
