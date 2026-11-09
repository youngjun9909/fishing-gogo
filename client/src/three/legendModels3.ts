import * as THREE from "three";
import { softFin, tube } from "./fishModel";
import type { Anim } from "./fishModel";
import { C, finish, flat, glow, grad, phys } from "./legendKit";
import type { Maker } from "./legendKit";

// 참고 그림을 받아 다시 만든 전설: 블랙홀장어, 홍월흡혈오징어, 유령날개가오리, 해초왕해마
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 곡선을 따라 굵기가 변하는 몸통 관 */
function bodyTube(pts: THREE.Vector3[], radius: (t: number) => number, mat: THREE.Material, segs = 140) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segs, 1, 16, false);
  const pos = geo.attributes.position;
  const ring = 17;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.floor(i / ring) / segs);
    const c = curve.getPointAt(t);
    const r = radius(t);
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * r, c.y + (pos.getY(i) - c.y) * r, c.z + (pos.getZ(i) - c.z) * r);
  }
  geo.computeVertexNormals();
  return { mesh: new THREE.Mesh(geo, mat), curve };
}

/** 크고 둥근 귀여운 눈: 테두리 색 + 검은 동공 + 반사광 */
function bigEye(r: number, rim: string, glowRim = true) {
  const e = new THREE.Group();
  e.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), new THREE.MeshPhysicalMaterial({ color: rim, emissive: rim, emissiveIntensity: glowRim ? 0.9 : 0.1, roughness: 0.2, clearcoat: 1 })));
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.66, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0x07040c, roughness: 0.08, clearcoat: 1 }));
  pupil.position.x = r * 0.36;
  e.add(pupil);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  hl.position.set(r * 0.78, r * 0.32, r * 0.2);
  e.add(hl);
  return e;
}

/** 블랙홀장어: 검은 몸에 별가루처럼 반짝이는 점, 큰 주황 눈, 목을 세우고 몸을 소용돌이로 말고 있는 귀여운 뱀 모양 */
const blackholeEel: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const tex = (() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = "#07040e"; x.fillRect(0, 0, 512, 256);
    const cols = ["#ff9a3a", "#3ad0ff", "#ff5aa8", "#ffe06a", "#b070ff", "#ffffff"];
    for (let i = 0; i < 380; i++) {
      x.fillStyle = cols[i % cols.length];
      x.globalAlpha = 0.9;
      x.beginPath(); x.arc(Math.random() * 512, Math.random() * 256, 1.5 + Math.random() * 3.2, 0, 7); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 1);
    return t;
  })();
  const skin = new THREE.MeshPhysicalMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  // 목은 위로, 몸은 앞을 향한 소용돌이로 감긴다(머리 → 목 → 소용돌이 바깥 → 안쪽 꼬리)
  const pts: THREE.Vector3[] = [V(0.05, 1.18, 0), V(0.06, 0.9, 0.02), V(0.16, 0.6, 0.04), V(0.38, 0.32, 0.05)];
  const cx = -0.25, cy = 0.12, N = 28;
  for (let k = 0; k <= N; k++) {
    const ang = -0.45 - k * 0.27, r = 0.82 * (1 - (k / N) * 0.82);
    pts.push(V(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 0.05 + (k / N) * 0.1));
  }
  const { mesh } = bodyTube(pts, (t) => (0.13 + 0.07 * Math.min(1, t / 0.18)) * (1 - 0.9 * Math.pow(t, 1.5)) + 0.012, skin, 220);
  g.add(mesh);
  // 둥근 머리와 큰 주황 눈, 작은 콧구멍과 미소
  const head = new THREE.Group();
  head.position.set(0.05, 1.2, 0);
  head.add(flat(phys("#0a0614", { clearcoat: 1, roughness: 0.2 }), [0.04, 0, 0], [0.62, 0.46, 0.52]));
  for (const s of [-1, 1]) {
    const e = bigEye(0.12, "#ff9a3a");
    e.position.set(0.12, 0.1, s * 0.2);
    e.rotation.y = -s * 0.5;
    head.add(e);
    head.add(flat(phys("#05030a"), [0.3, 0.0, s * 0.06], [0.03, 0.03, 0.03]));
  }
  head.add(tube([V(0.28, -0.1, -0.16), V(0.32, -0.13, 0), V(0.28, -0.1, 0.16)], 0.012, phys("#05030a"), 0.2));
  g.add(head);
  anim.push((t) => { head.rotation.z = Math.sin(t * 1.4) * 0.07; head.rotation.y = Math.sin(t * 0.9) * 0.2; g.position.y = Math.sin(t * 1.0) * 0.03; });
  return finish(g, anim, 2.3, "#ff9a3a", [2.6, 3.0, 1.6], 20);
};

/** 홍월흡혈오징어: 솜털 인형 같은 둥근 보라-붉은 머리, 고양이 귀, 까만 큰 눈, 물결 모양 가장자리에 크림색 구슬이 달린 망토 */
const vampireSquid: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const fur = (c1: string, c2: string, mid?: string) => {
    const m = grad(c1, c2, { mid, bump: false });
    m.roughness = 0.95; m.clearcoat = 0; m.sheen = 1; m.sheenColor = new THREE.Color("#ff9a8a");
    return m;
  };
  const head = flat(fur("#f0583c", "#7a3a9a", "#b84a6a"), [0, 0.74, 0], [1.28, 1.28, 1.28], new THREE.SphereGeometry(0.5, 40, 30));
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 4), fur("#ff6a4a", "#d04a5a"));
    ear.position.set(-0.06, 1.3, s * 0.38);
    ear.rotation.set(s * 0.5, 0.7, 0);
    g.add(ear);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0x07040c, roughness: 0.05, clearcoat: 1 }));
    e.position.set(0.55, 0.74, s * 0.25);
    e.scale.setScalar(1.25);
    g.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.63, 0.8, s * 0.21);
    g.add(hl);
  }
  // 망토(치마): 물결 가장자리, 안쪽은 보라, 가장자리는 붉은 주황
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    prof.push(new THREE.Vector2(0.3 + Math.sin(u * Math.PI * 0.5) * 0.62, 0.34 - u * 0.04 - Math.pow(u, 1.6) * 0.0));
  }
  for (let i = 1; i <= 12; i++) {
    const u = i / 12;
    prof.push(new THREE.Vector2(0.92 - u * 0.35, 0.3 - Math.sin(u * Math.PI * 0.5) * 0.7));
  }
  prof.push(new THREE.Vector2(0.0, -0.42));
  const geo = new THREE.LatheGeometry(prof, 72);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const cRim = new THREE.Color("#ff6a4a"), cIn = new THREE.Color("#5a2a8a");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const th = Math.atan2(z, x), r = Math.hypot(x, z);
    const rim = Math.max(0, (y - 0.12) / 0.2); // 위쪽 가장자리일수록 1
    pos.setY(i, y + Math.sin(th * 8) * 0.07 * Math.min(1, rim + 0.15));
    const k = THREE.MathUtils.clamp(rim, 0, 1);
    const c = cIn.clone().lerp(cRim, k * k);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    void r;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const cape = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  g.add(cape);
  // 가장자리 봉우리마다 크림색 구슬, 몸을 따라 내려가는 주름
  const beads: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const th = (i / 8) * Math.PI * 2 + Math.PI / 16;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshPhysicalMaterial({ color: "#ffe9b0", emissive: "#ffd890", emissiveIntensity: 0.4, roughness: 0.5 }));
    b.position.set(Math.cos(th) * 0.92, 0.3 + Math.sin(th * 8) * 0.07 * 0.9 - 0.02, Math.sin(th) * 0.92);
    g.add(b);
    beads.push(b);
    const rib = tube([V(Math.cos(th) * 0.9, 0.22, Math.sin(th) * 0.9), V(Math.cos(th) * 0.74, -0.12, Math.sin(th) * 0.74), V(Math.cos(th) * 0.36, -0.4, Math.sin(th) * 0.36)], 0.02, phys("#4a2078", { roughness: 0.9, clearcoat: 0 }), 0.3);
    g.add(rib);
  }
  anim.push((t) => {
    const p = 1 + 0.06 * Math.sin(t * 1.7);
    cape.scale.set(p, 1, p);
    beads.forEach((b, i) => (b.position.y += Math.sin(t * 1.7 + i) * 0.0008));
    g.position.y = Math.sin(t * 0.9) * 0.06;
  });
  return finish(g, anim, 2.4, "#ff5a6a", [2.2, 2.2, 2.2], 14);
};

/** 유령날개가오리: 청록-파랑으로 비치는 넓은 마름모 날개(가는 살 줄무늬), 가운데 머리와 눈, 아주 긴 가는 꼬리 */
const ghostRay: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const wingMat = new THREE.MeshPhysicalMaterial({ color: "#4ab8ff", transparent: true, opacity: 0.88, roughness: 0.2, clearcoat: 1, emissive: C("#2a9aff"), emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(0.3, 0.02);
    sh.bezierCurveTo(0.2, 0.3, -0.05, 0.75, -0.35, 1.3); // 앞쪽 가장자리가 둥글게 뻗다가
    sh.bezierCurveTo(-0.5, 1.45, -0.7, 1.3, -0.72, 1.1); // 뒤쪽 끝으로 살짝 휜 날개 끝
    sh.bezierCurveTo(-0.6, 0.7, -0.75, 0.3, -0.7, 0.05); // 뒤 가장자리
    sh.lineTo(0.3, 0.02);
    const m = softFin(sh, wingMat, 0.02);
    m.rotation.x = s * 1.25;
    w.add(m);
    g.add(w);
    wings.push(w);
  }
  g.add(flat(grad("#e8f8e8", "#8ae0e8", { mid: "#c8f0e0", emissive: "#a8ffe0", ei: 0.15 }), [0.1, 0.05, 0], [0.62, 0.26, 0.4]));
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0x120d18, roughness: 0.1, clearcoat: 1 }));
    e.position.set(0.34, 0.1, s * 0.15);
    g.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.37, 0.13, s * 0.14);
    g.add(hl);
    g.add(flat(phys("#3a4a40", { roughness: 0.5 }), [-0.02, 0.14, s * 0.22], [0.1, 0.03, 0.1])); // 등의 숨구멍 무늬
  }
  g.add(tube([V(-0.2, 0.03, 0), V(-0.9, 0.05, 0.04), V(-1.8, 0.0, -0.06), V(-2.6, -0.04, 0.02)], 0.05, phys("#5ac8ff", { emissive: C("#2a9aff"), emissiveIntensity: 0.3 }), 0.95));
  anim.push((t) => { wings.forEach((w, i) => (w.rotation.x = (i ? 1 : -1) * Math.sin(t * 1.5) * 0.3)); g.position.y = Math.sin(t * 0.9) * 0.07; });
  return finish(g, anim, 2.4, "#5ac8ff", [2.4, 1.0, 3.2], 16);
};

/** 해초왕해마: 마디진 주황-노랑 몸에 청록 등지느러미와 가시 돌기, 말린 꼬리, 큰 눈, 머리 위 해초 잎 왕관 */
const seaweedSeahorse: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const orange = phys("#ff9a2a", { emissive: C("#ff8a1a"), emissiveIntensity: 0.1 }), yellow = phys("#ffd25a"), teal = phys("#1fb8b0", { emissive: C("#18a8a0"), emissiveIntensity: 0.15 });
  // 몸 중심선: 머리 → 목 → 배 → 꼬리의 나선
  const pts: THREE.Vector3[] = [V(0.04, 1.0, 0), V(0.1, 0.78, 0), V(0.18, 0.5, 0), V(0.2, 0.18, 0), V(0.12, -0.14, 0), V(-0.02, -0.4, 0), V(-0.2, -0.56, 0)];
  const cx = -0.3, cy = -0.8;
  for (let k = 1; k <= 18; k++) {
    const ang = 1.3 - k * 0.38, r = 0.26 * (1 - k / 22);
    pts.push(V(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const r = 0.2 * (1 - 0.82 * Math.pow(t, 1.3)) + 0.04 + (t < 0.3 ? 0.08 * Math.sin((t / 0.3) * Math.PI) : 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.075, 18), i % 2 ? yellow : orange); // 마디
    band.position.copy(p);
    band.quaternion.setFromUnitVectors(V(0, 1, 0), tan);
    g.add(band);
    const side = V(-tan.y, tan.x, 0).normalize(); // 곡선의 바깥쪽(등 쪽)
    if (t > 0.04 && t < 0.92) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03 * (1 - t * 0.5), 0.1 * (1 - t * 0.5), 6), teal);
      sp.position.copy(p).addScaledVector(side, -r * 1.05);
      sp.quaternion.setFromUnitVectors(V(0, 1, 0), side.clone().multiplyScalar(-1));
      g.add(sp);
    }
  }
  // 머리, 주둥이, 큰 눈
  const hp = curve.getPointAt(0);
  g.add(flat(teal, [hp.x + 0.03, hp.y - 0.02, 0], [0.5, 0.46, 0.4]));
  g.add(tube([V(hp.x + 0.12, hp.y - 0.04, 0), V(hp.x + 0.36, hp.y - 0.07, 0), V(hp.x + 0.6, hp.y - 0.1, 0)], 0.06, phys("#3fd0b0"), 0.3));
  for (const s of [-1, 1]) {
    const e = bigEye(0.11, "#ff8a2a", false);
    e.position.set(hp.x + 0.14, hp.y + 0.05, s * 0.18);
    e.rotation.y = -s * 0.4;
    g.add(e);
  }
  // 등지느러미(부채): 청록-노랑, 살 줄무늬
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(-0.1, 0.35, -0.5, 0.55, -0.62, 0.2);
  sh.bezierCurveTo(-0.66, 0.0, -0.5, -0.3, -0.2, -0.3);
  sh.bezierCurveTo(-0.1, -0.2, 0, -0.1, 0, 0);
  const fin = softFin(sh, new THREE.MeshPhysicalMaterial({ color: "#35c8c0", transparent: true, opacity: 0.9, side: THREE.DoubleSide, emissive: C("#ffd25a"), emissiveIntensity: 0.12, roughness: 0.3 }), 0.025);
  const fp = curve.getPointAt(0.42);
  fin.position.set(fp.x - 0.12, fp.y, 0);
  fin.rotation.y = 0.2;
  g.add(fin);
  // 해초 잎 왕관, 산호 장식, 초록 발광 점
  const crown: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const leaf = flat(phys("#58d870", { emissive: C("#38b850"), emissiveIntensity: 0.35 }), [hp.x - i * 0.04, hp.y + 0.28 + (i % 2) * 0.05, (i - 1.5) * 0.1], [0.07, 0.34, 0.035]);
    leaf.rotation.z = (i - 1.5) * 0.18;
    g.add(leaf);
    crown.push(leaf);
  }
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 6), phys("#ff7a8a"));
    const p = curve.getPointAt(0.2 + i * 0.1);
    c.position.set(p.x + 0.1, p.y, 0.1 - (i % 2) * 0.2);
    g.add(c);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), glow("#a0ff8a", 1.3));
    d.position.set(p.x + 0.12, p.y + 0.06, -0.1 + (i % 2) * 0.2);
    g.add(d);
  }
  anim.push((t) => { g.position.y = Math.sin(t * 1.4) * 0.05; g.rotation.z = Math.sin(t * 1.0) * 0.05; crown.forEach((l, i) => (l.rotation.x = Math.sin(t * 2 + i) * 0.2)); fin.rotation.y = 0.2 + Math.sin(t * 5) * 0.12; });
  return finish(g, anim, 2.6, "#7affa0", [1.4, 2.2, 1.4], 18);
};

export const CUSTOM3: Record<string, Maker> = { 블랙홀장어: blackholeEel, 홍월흡혈오징어: vampireSquid, 유령날개가오리: ghostRay, 해초왕해마: seaweedSeahorse };
