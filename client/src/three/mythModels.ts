import * as THREE from "three";
import { auraShell, crystal, dorsalFin, profileBody, sideFin, softFin, sparkField, tailFin, tube, veil } from "./fishModel";
import type { Anim } from "./fishModel";
import { C, flat, glass, glow, grad, phys } from "./legendKit";
import type { Maker } from "./legendKit";

// 신화 물고기: 전설보다 훨씬 많은 부품과 화려한 오라(겹 후광, 빛 줄기, 도는 고리, 많은 입자)를 가진 모델.
// 길이 방향은 +x(머리), 위는 +y, 폭은 z.
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const PI2 = Math.PI * 2;

let _glow: THREE.CanvasTexture | null = null, _rays: THREE.CanvasTexture | null = null;
function glowTex() {
  if (!_glow) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    _glow = new THREE.CanvasTexture(c);
  }
  return _glow;
}
function raysTex() {
  if (!_rays) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d")!;
    x.translate(128, 128);
    for (let i = 0; i < 12; i++) {
      x.rotate(PI2 / 12);
      const g = x.createLinearGradient(0, 0, 0, -128);
      g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.beginPath(); x.moveTo(-5, 0); x.lineTo(0, -128); x.lineTo(5, 0); x.fill();
    }
    _rays = new THREE.CanvasTexture(c);
  }
  return _rays;
}

/** 도는 고리(흰 선 + 색 구슬) */
function ring(g: THREE.Group, anim: Anim, radius: number, tilt: number, speed: number, color: string, beads = 6) {
  const grp = new THREE.Group();
  grp.name = "fx";
  grp.rotation.set(tilt, 0, tilt * 0.5);
  const r = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.014, 8, 80), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  r.rotation.x = Math.PI / 2;
  grp.add(r);
  const spin = new THREE.Group();
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * PI2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color }));
    b.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    spin.add(b);
  }
  grp.add(spin);
  g.add(grp);
  anim.push((t) => (spin.rotation.y = t * speed));
}

/** 신화 전용 마무리: 겹 후광 2겹, 부드러운 빛 덩어리, 회전하는 빛 줄기, 도는 고리 3개, 많은 입자 */
function finishMythic(g: THREE.Group, anim: Anim, k: number, c1: string, c2: string, halo: [number, number, number], spark = 46) {
  const s1 = auraShell(new THREE.SphereGeometry(0.5, 36, 24), C(c1));
  s1.scale.set(...halo);
  const s2 = auraShell(new THREE.SphereGeometry(0.5, 36, 24), C(c2));
  s2.scale.set(halo[0] * 1.3, halo[1] * 1.3, halo[2] * 1.3);
  s1.name = s2.name = "fx";
  g.add(s1, s2);
  sparkField(g, anim, C(c1), spark, halo[0] * 0.8, halo[1]);
  sparkField(g, anim, C(c2), Math.floor(spark * 0.6), halo[0] * 1.0, halo[1] * 1.15);
  const gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c1, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
  gs.scale.set(halo[0] * 2.6, halo[0] * 2.6, 1);
  const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTex(), color: c2, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  rays.scale.set(halo[0] * 3.6, halo[0] * 3.6, 1);
  gs.name = rays.name = "fx";
  g.add(gs, rays);
  ring(g, anim, halo[0] * 0.62, 0.35, 0.5, c1);
  ring(g, anim, halo[0] * 0.8, -0.6, -0.4, c2, 7);
  ring(g, anim, halo[0] * 0.98, 1.1, 0.3, "#ffffff", 8);
  anim.push((t) => {
    const p = 1 + 0.07 * Math.sin(t * 1.8);
    s1.scale.set(halo[0] * p, halo[1] * p, halo[2] * p);
    (rays.material as THREE.SpriteMaterial).rotation = t * 0.22;
    (gs.material as THREE.SpriteMaterial).opacity = 0.26 + 0.08 * Math.sin(t * 1.5);
  });
  g.scale.setScalar(k);
  g.userData.designScale = k;
  g.userData.mythic = true;
  g.userData.update = (t: number) => anim.forEach((f) => f(t));
  return g;
}

/** 크고 둥근 눈: 테두리 + 눈동자(둥글거나 세로로 가는) + 반사광 */
function eyeBall(r: number, rim: string, pupil: "round" | "slit" = "round", emissive = 0.9) {
  const e = new THREE.Group();
  e.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), new THREE.MeshPhysicalMaterial({ color: rim, emissive: rim, emissiveIntensity: emissive, roughness: 0.2, clearcoat: 1 })));
  const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.66, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0x07040c, roughness: 0.06, clearcoat: 1 }));
  p.position.x = r * 0.4;
  p.scale.set(0.5, 1, pupil === "slit" ? 0.3 : 1);
  e.add(p);
  const h = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  h.position.set(r * 0.82, r * 0.34, r * 0.2);
  e.add(h);
  return e;
}

// ---------------------------------------------------------------- 용 머리와 긴 용 몸
interface DragonOpts {
  skin: THREE.Material; belly?: THREE.Material; horn: string; eye: string; slit?: boolean; whisker?: string; fang?: boolean; hornSweep?: number; mane?: string;
}
function dragonHead(o: DragonOpts) {
  const h = new THREE.Group();
  const hornM = glow(o.horn, 0.5);
  h.add(flat(o.skin, [0, 0, 0], [0.95, 0.72, 0.85]));
  h.add(flat(o.skin, [0.45, -0.08, 0], [0.6, 0.36, 0.52])); // 짧고 넓은 주둥이
  h.add(flat(o.belly ?? o.skin, [0.4, -0.22, 0], [0.5, 0.15, 0.44])); // 턱
  for (const s of [-1, 1]) {
    h.add(flat(phys("#06030a"), [0.72, -0.02, s * 0.12], [0.04, 0.04, 0.04])); // 콧구멍
    h.add(flat(o.skin, [0.2, 0.2, s * 0.28], [0.34, 0.1, 0.18])); // 눈두덩
    const e = eyeBall(0.13, o.eye, o.slit ? "slit" : "round");
    e.position.set(0.22, 0.12, s * 0.31);
    e.rotation.y = -s * 0.55;
    h.add(e);
    const sw = o.hornSweep ?? 1;
    h.add(tube([V(0.08, 0.3, s * 0.16), V(-0.08, 0.5, s * 0.22), V(-0.4 * sw, 0.58, s * 0.2), V(-0.7 * sw, 0.4, s * 0.16)], 0.065, hornM, 0.85)); // 뿔
    // 사슴뿔처럼 갈라지는 가지
    h.add(tube([V(-0.1, 0.5, s * 0.22), V(-0.1, 0.78, s * 0.3), V(-0.22, 1.0, s * 0.32)], 0.04, hornM, 0.8));
    h.add(tube([V(-0.3 * sw, 0.57, s * 0.2), V(-0.35 * sw, 0.85, s * 0.26), V(-0.5 * sw, 1.02, s * 0.26)], 0.035, hornM, 0.8));
    if (o.whisker) {
      const w = tube([V(0.6, -0.1, s * 0.2), V(0.5, -0.3, s * 0.6), V(0.1, -0.5, s * 1.0), V(-0.45, -0.35, s * 1.25), V(-0.75, -0.1, s * 1.05)], 0.02, phys(o.whisker, { emissive: C(o.whisker), emissiveIntensity: 0.25 }), 0.5);
      w.userData.sway = s;
      h.add(w);
    }
    if (o.fang !== false) for (let i = 0; i < 3; i++) {
      const up = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.1, 6), phys("#f6f0e0"));
      up.rotation.z = Math.PI; up.position.set(0.52 + i * 0.07, -0.19, s * (0.16 + i * 0.01)); h.add(up);
      const lo = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 6), phys("#f6f0e0"));
      lo.position.set(0.5 + i * 0.07, -0.3, s * (0.15 + i * 0.01)); h.add(lo);
    }
  }
  if (o.mane) { // 목 뒤로 풍성하게 이어지는 갈기
    const mm = phys(o.mane, { emissive: C(o.mane), emissiveIntensity: 0.25, roughness: 0.7, clearcoat: 0 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 1.6 - 0.8;
      const t = flat(mm, [-0.45 - (i % 3) * 0.12, Math.sin(a) * 0.45, Math.cos(a) * 0.5], [0.5, 0.14, 0.12]);
      t.rotation.set(0, Math.cos(a) * 0.4, Math.sin(a) * 0.5);
      h.add(t);
    }
  }
  return h;
}

interface SerpentOpts {
  N: number; length: number; amp: number; radius: number; skin: THREE.Material; spine: string; spineH: number; head: THREE.Group;
  scales?: { color: string; big?: boolean }; tailColor: string; tailCrystal?: string; wings?: { color: string };
  cracks?: string; waves?: number;
}
/** 구슬을 이어 만든 긴 몸. 매 프레임 S자로 물결치고 머리·꼬리·장식이 따라간다 */
function serpent(g: THREE.Group, anim: Anim, o: SerpentOpts) {
  const sphG = new THREE.SphereGeometry(1, 18, 14);
  const segs: THREE.Mesh[] = [], spikes: THREE.Mesh[] = [], gems: THREE.Mesh[] = [], plates: THREE.Mesh[] = [], cracks: THREE.Mesh[] = [];
  const rOf = (u: number) => o.radius * (1 - 0.8 * Math.pow(u, 1.25)) + 0.025;
  for (let i = 0; i < o.N; i++) {
    const m = new THREE.Mesh(sphG, o.skin);
    m.scale.setScalar(rOf(i / (o.N - 1)) * 1.12);
    g.add(m);
    segs.push(m);
    if (i > 1 && i < o.N - 4) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05 * (1 - (i / o.N) * 0.5), o.spineH * (1 - (i / o.N) * 0.55), 6), glow(o.spine, 0.5));
      g.add(sp);
      spikes.push(sp);
      if (o.scales) {
        const gm = new THREE.Mesh(new THREE.SphereGeometry(o.scales.big ? 0.07 : 0.045, 10, 8), new THREE.MeshPhysicalMaterial({ color: o.scales.color, emissive: o.scales.color, emissiveIntensity: 0.5, roughness: 0.3 }));
        gm.userData.i = i;
        g.add(gm);
        gems.push(gm);
      }
      if (o.scales?.big && i % 2 === 0) {
        const pl = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), phys(o.scales.color, { metalness: 0.4, emissive: C(o.scales.color), emissiveIntensity: 0.12 }));
        pl.scale.set(0.12, 0.05, 0.1);
        g.add(pl);
        plates.push(pl);
      }
      if (o.cracks && i % 3 === 0) {
        const cr = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), new THREE.MeshBasicMaterial({ color: o.cracks, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        cr.userData.i = i;
        g.add(cr);
        cracks.push(cr);
      }
    }
  }
  g.add(o.head);
  // 꼬리(갈라진 지느러미 두 겹, 끝의 결정)
  const tail = new THREE.Group();
  const tf1 = tailFin(0.9, phys(o.tailColor, { side: THREE.DoubleSide, emissive: C(o.tailColor), emissiveIntensity: 0.15 }), "fork");
  const tf2 = tailFin(0.7, glass(o.tailColor, 0.55), "ribbon");
  tf2.rotation.z = 0.35;
  tail.add(tf1, tf2);
  if (o.tailCrystal) for (let i = -1; i <= 1; i++) {
    const c = crystal(0.34, 0.05, C(o.tailCrystal), C(o.tailCrystal));
    c.position.set(-0.9, i * 0.32, 0);
    c.rotation.z = Math.PI / 2 + i * 0.5;
    tail.add(c);
  }
  g.add(tail);
  const wings: THREE.Group[] = [];
  if (o.wings) for (const s of [-1, 1]) {
    const w = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.bezierCurveTo(-0.3, 0.9, -0.9, 1.6, -1.6, 1.7);
    sh.bezierCurveTo(-1.3, 1.2, -1.45, 0.95, -1.15, 0.6);
    sh.bezierCurveTo(-1.1, 0.3, -0.8, 0.15, -0.5, 0.1);
    sh.bezierCurveTo(-0.45, -0.1, -0.2, -0.15, 0, 0);
    const wing = softFin(sh, glass(o.wings.color, 0.7), 0.03);
    wing.rotation.x = s * 0.9;
    w.add(wing);
    g.add(w);
    wings.push(w);
  }
  const path = (u: number, t: number) => V(o.length * (0.45 - u), 0.1 * Math.sin(u * 3 - t * 1.4), o.amp * (0.25 + 0.75 * u) * Math.sin(u * (o.waves ?? 6.5) - t * 2.2));
  const P: THREE.Vector3[] = Array.from({ length: o.N }, () => V(0, 0, 0));
  anim.push((t) => {
    for (let i = 0; i < o.N; i++) { P[i] = path(i / (o.N - 1), t); segs[i].position.copy(P[i]); }
    let si = 0, gi = 0, pi = 0, ci = 0;
    for (let i = 2; i < o.N - 4; i++) {
      const top = P[i].clone(); top.y += rOf(i / (o.N - 1)) * 1.0;
      spikes[si].position.copy(top).add(V(0, o.spineH * (1 - (i / o.N) * 0.55) * 0.5 - 0.02, 0));
      si++;
      if (o.scales) {
        const gm = gems[gi++];
        gm.position.copy(top).add(V(0, 0.01, 0));
        (gm.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.35 + 0.9 * Math.max(0, Math.sin(i * 0.4 - t * 3.2)); // 비늘이 차례로 빛남
      }
      if (o.scales?.big && i % 2 === 0) { const pl = plates[pi++]; pl.position.copy(P[i]).add(V(0, rOf(i / (o.N - 1)) * 0.95, 0)); }
      if (o.cracks && i % 3 === 0) {
        const cr = cracks[ci++];
        cr.position.copy(P[i]).add(V(0, 0.02, rOf(i / (o.N - 1)) * 1.05));
        cr.rotation.y = 0;
        (cr.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 5.2 - i * 0.05)), 3); // 심장 박동
      }
    }
    const hd = P[0].clone().sub(P[2]);
    o.head.position.copy(P[0]);
    o.head.rotation.y = Math.atan2(-hd.z, hd.x);
    o.head.rotation.z = Math.sin(t * 1.3) * 0.06;
    const tl = P[o.N - 1].clone().sub(P[o.N - 4]);
    tail.position.copy(P[o.N - 1]);
    tail.rotation.y = Math.atan2(-tl.z, tl.x);
    wings.forEach((w, i) => {
      const s = i ? 1 : -1;
      const q = P[Math.floor(o.N * 0.16)];
      w.position.set(q.x, q.y + 0.1, q.z);
      w.rotation.x = s * Math.sin(t * 2.2) * 0.35;
    });
    o.head.children.forEach((c) => { if (c.userData.sway) c.rotation.y = Math.sin(t * 2 + c.userData.sway) * 0.12; });
  });
  return P;
}

// ---------------------------------------------------------------- 호수
/** 천년이무기: 비취색 긴 용 뱀, 황금 뿔·눈·수염, 머리 위의 여의주, 차례로 빛나는 비늘 */
const imugi: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#0a6a50", "#ffd860", { mid: "#12906a", emissive: "#30ffa0", ei: 0.1 });
  const head = dragonHead({ skin, belly: phys("#fff0c0"), horn: "#ffcc3a", eye: "#ffd24a", whisker: "#ffffff", mane: "#fff8e8" });
  head.scale.setScalar(1.5);
  serpent(g, anim, { N: 64, length: 4.6, amp: 1.15, radius: 0.3, waves: 8, skin, spine: "#ffcc3a", spineH: 0.2, head, scales: { color: "#ffd24a" }, tailColor: "#12906a" });
  // 여의주: 머리 위에 떠서 황금빛 파동을 퍼뜨린다
  const orb = new THREE.Group();
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), new THREE.MeshPhysicalMaterial({ color: "#ffd24a", emissive: "#ffb020", emissiveIntensity: 1.5, roughness: 0.1, clearcoat: 1 })));
  const og = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#ffd860", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  og.scale.set(1.4, 1.4, 1);
  orb.add(og);
  const waves: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.01, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffd860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    orb.add(w);
    waves.push(w);
  }
  g.add(orb);
  anim.push((t) => {
    orb.position.copy(head.position).add(V(0.1, 1.0 + Math.sin(t * 2) * 0.08, 0));
    waves.forEach((w, i) => { const u = (t * 0.6 + i / 3) % 1; w.scale.setScalar(1 + u * 3); (w.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - u); w.rotation.x = Math.PI / 2 + u; });
  });
  return finishMythic(g, anim, 1.9, "#ffd860", "#30ffa0", [4.6, 1.8, 3.0], 60);
};

/** 연화봉황어: 진주빛 둥근 몸, 붉은 봉황 볏 3개, 넓은 깃털 가슴지느러미, 불꽃 끝의 깃털 꼬리, 연꽃잎 */
const lotusPhoenix: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const body = new THREE.Group();
  g.add(body);
  body.add(new THREE.Mesh(profileBody(1.55, 0.95, 0.85, 0.52, false, 0.8), grad("#ffb040", "#fff0e0", { mid: "#ffd890", emissive: "#ffe0b0", ei: 0.18 })));
  for (const s of [-1, 1]) {
    const e = eyeBall(0.11, "#ff5a3a", "round", 0.8);
    e.position.set(0.5, 0.13, s * 0.34);
    e.rotation.y = -s * 0.4;
    body.add(e);
  }
  body.add(flat(phys("#ff9a8a"), [0.68, -0.08, 0], [0.14, 0.1, 0.24]));
  const feather = (len: number, w: number, base: string, tip: string, tipCount = 1) => {
    const f = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.bezierCurveTo(len * 0.25, w, len * 0.75, w * 0.9, len, 0);
    sh.bezierCurveTo(len * 0.75, -w * 0.9, len * 0.25, -w, 0, 0);
    const m = softFin(sh, phys(base, { side: THREE.DoubleSide, emissive: C(base), emissiveIntensity: 0.12 }), 0.02);
    f.add(m);
    for (let i = 0; i < tipCount; i++) { // 끝이 불꽃처럼 갈라진다
      const t = new THREE.Mesh(new THREE.ConeGeometry(w * 0.45, len * 0.28, 5), glow(tip, 0.8));
      t.rotation.z = -Math.PI / 2 + (i - (tipCount - 1) / 2) * 0.5;
      t.position.set(len * 0.98, (i - (tipCount - 1) / 2) * w * 0.7, 0);
      f.add(t);
    }
    return f;
  };
  // 붉은 봉황 볏 3개
  for (let i = 0; i < 3; i++) {
    const c = feather(0.55 - Math.abs(i - 1) * 0.1, 0.07, "#ff3a2a", "#ffb020", 2);
    c.position.set(0.34 - i * 0.1, 0.42, (i - 1) * 0.09);
    c.rotation.z = Math.PI / 2 + 0.2 - i * 0.15;
    body.add(c);
  }
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), glow("#ffd24a", 0.8)); // 작은 금관
  crown.position.set(0.34, 0.4, 0);
  crown.rotation.x = Math.PI / 2;
  body.add(crown);
  // 넓은 깃털 가슴지느러미(깃털 여러 장)
  const pecs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(0.2, -0.12, s * 0.42);
    for (let i = 0; i < 6; i++) {
      const f = feather(1.2 - i * 0.08, 0.14, i % 2 ? "#ffb890" : "#fff0c8", i % 2 ? "#ff5a7a" : "#ff9a3a", 1);
      f.rotation.set(s * (0.9 + i * 0.05), 0, -0.4 - i * 0.18);
      p.add(f);
    }
    body.add(p);
    pecs.push(p);
  }
  // 등지느러미: 뒤로 길게 흐르는 깃털
  for (let i = 0; i < 5; i++) {
    const f = feather(1.7 - i * 0.14, 0.12, "#ffd890", "#ff5a7a", 1);
    f.position.set(0.15 - i * 0.2, 0.44, 0);
    f.rotation.z = Math.PI + 0.5 - i * 0.12;
    f.rotation.y = 0;
    body.add(f);
  }
  // 꼬리: 긴 깃털 5개
  const tail = new THREE.Group();
  tail.position.set(-0.72, 0, 0);
  const tf: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const f = feather(2.3 - Math.abs(i - 2) * 0.35, 0.17, i % 2 ? "#ffd070" : "#fff0c8", ["#ff3a2a", "#ff7a2a", "#ffb020", "#ff7a2a", "#ff3a2a"][i], 3);
    f.rotation.z = Math.PI + (i - 2) * 0.28;
    tail.add(f);
    tf.push(f);
  }
  body.add(tail);
  const petals = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const p = flat(new THREE.MeshBasicMaterial({ color: i % 3 ? 0xffb0c8 : 0xffe080, transparent: true, opacity: 0.9 }), [0, 0, 0], [0.09, 0.025, 0.05]);
    petals.add(p);
  }
  g.add(petals);
  anim.push((t) => {
    tf.forEach((f, i) => (f.rotation.z = Math.PI + (i - 2) * (0.28 + 0.1 * Math.sin(t * 1.4)) + Math.sin(t * 2.4 + i) * 0.04)); // 깃털을 펼쳤다 접음
    pecs.forEach((p, i) => (p.rotation.x = (i ? 1 : -1) * Math.sin(t * 2) * 0.15));
    body.position.y = Math.sin(t * 1.2) * 0.07;
    const spin = Math.max(0, Math.sin(t * 0.55));
    body.rotation.y = spin > 0.97 ? (spin - 0.97) * 60 * Math.PI : 0; // 가끔 한 바퀴 돈다
    petals.children.forEach((p, i) => p.position.set(Math.cos(t * 0.5 + i * 0.7) * (1.4 + (i % 3) * 0.3), Math.sin(t * 0.9 + i) * 0.9, Math.sin(t * 0.5 + i * 0.7) * 1.1));
  });
  return finishMythic(g, anim, 2.2, "#ffc060", "#ff7a8a", [3.6, 2.4, 3.0], 56);
};

// ---------------------------------------------------------------- 바닷가
/** 용왕의 해신수: 거북 등껍질(산호 조각 8개)에 용 머리·꼬리, 황금 용왕 문양 */
const dragonKingTurtle: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#0f7a86", "#9af0d0", { mid: "#14a0a0", emissive: "#38e0c8", ei: 0.1 });
  const coral = phys("#ff8a6a", { emissive: C("#ff5a4a"), emissiveIntensity: 0.2, metalness: 0.2 });
  const gold = glow("#ffd24a", 0.7);
  g.add(flat(skin, [0, -0.05, 0], [1.3, 0.5, 1.05]));
  g.add(flat(phys("#c8fff0"), [0, -0.3, 0], [1.1, 0.2, 0.9])); // 배 갑판
  // 등껍질: 둥근 지붕 + 산호 조각 8개 + 산호 가시
  const shell = new THREE.Group();
  shell.position.y = 0.1;
  shell.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 40, 24, 0, PI2, 0, Math.PI / 2), phys("#0c4f64", { metalness: 0.3 })));
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * PI2;
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.78, 18, 12, a0 + 0.04, PI2 / 8 - 0.08, 0.28, Math.PI / 2 - 0.5), coral);
    shell.add(plate);
    const a = a0 + PI2 / 16;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 7), gold);
    spike.position.set(Math.cos(a) * 0.5, 0.52, Math.sin(a) * 0.5);
    spike.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    shell.add(spike);
  }
  // 용왕 문양: 금 원판 + 새긴 고리 + 빛나는 점
  const emblem = new THREE.Group();
  emblem.position.y = 0.76;
  emblem.add(new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), glow("#ffd24a", 0.9)));
  for (const r of [0.2, 0.12]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 32), glow("#fff2b0", 1.2)); emblem.add(t); }
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glow("#fff2b0", 1.4)); b.position.set(Math.cos(i * 1.047) * 0.24, Math.sin(i * 1.047) * 0.24, 0.02); emblem.add(b); }
  emblem.rotation.x = -Math.PI / 2;
  shell.add(emblem);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.045, 10, 48), glow("#ffd24a", 0.6)); // 등껍질 가장자리의 황금 테두리
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  g.add(rim);
  for (let i = 0; i < 3; i++) { // 등 위에 자란 산호 가지
    const a = i * 2.1 + 0.4;
    g.add(tube([V(Math.cos(a) * 0.4, 0.85, Math.sin(a) * 0.4), V(Math.cos(a) * 0.5, 1.2, Math.sin(a) * 0.5), V(Math.cos(a) * 0.62, 1.5, Math.sin(a) * 0.62)], 0.04, coral, 0.7));
    g.add(tube([V(Math.cos(a) * 0.5, 1.2, Math.sin(a) * 0.5), V(Math.cos(a) * 0.7, 1.35, Math.sin(a) * 0.4), V(Math.cos(a) * 0.82, 1.55, Math.sin(a) * 0.36)], 0.028, coral, 0.7));
  }
  g.add(shell);
  // 용 머리(작은 입, 앞으로 살짝 튀어나온 주둥이, 산호 뿔)와 짧은 용 꼬리
  const head = new THREE.Group();
  head.position.set(1.1, 0.05, 0);
  head.add(flat(skin, [0, 0, 0], [0.7, 0.55, 0.58]));
  head.add(flat(skin, [0.3, -0.06, 0], [0.4, 0.26, 0.36]));
  for (const s of [-1, 1]) {
    const e = eyeBall(0.1, "#ffd24a");
    e.position.set(0.16, 0.12, s * 0.22);
    e.rotation.y = -s * 0.5;
    head.add(e);
    head.add(flat(glass("#38e0c8", 0.7), [0.14, 0.2, s * 0.24], [0.2, 0.05, 0.1])); // 눈 주변 청록 장식
    head.add(tube([V(0.04, 0.3, s * 0.14), V(0.0, 0.62, s * 0.2), V(-0.12, 0.92, s * 0.24)], 0.05, coral, 0.7)); // 산호 뿔과 가지
    for (const b of [[0.0, 0.62, 0.34, 0.86], [-0.06, 0.78, 0.3, 1.0]]) head.add(tube([V(b[0], b[1], s * 0.2), V(b[0] + 0.12, b[3] * 0.9, s * b[2]), V(b[0] + 0.2, b[3] + 0.14, s * (b[2] + 0.04))], 0.028, coral, 0.7));
  }
  g.add(head);
  const tail = new THREE.Group();
  tail.position.set(-1.25, 0, 0);
  tail.add(tube([V(0, 0, 0), V(-0.3, 0.05, 0), V(-0.55, 0.2, 0)], 0.16, skin, 0.8), tailFin(0.4, phys("#38e0c8", { side: THREE.DoubleSide }), "fork"));
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), coral); c.position.set(-0.6 - i * 0.04, 0.22 + (i - 1) * 0.1, (i - 1) * 0.08); c.rotation.z = Math.PI / 2; tail.add(c); }
  g.add(tail);
  // 넓고 둥근 지느러미 4개(끝에 황금 장식)
  const fins: THREE.Group[] = [];
  for (const s of [-1, 1]) for (const fx of [0.6, -0.6]) {
    const f = new THREE.Group();
    f.position.set(fx, -0.18, s * 0.78);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.bezierCurveTo(-0.2, 0.55, -0.9, 0.7, -1.0, 0.1); sh.bezierCurveTo(-0.8, -0.2, -0.3, -0.15, 0, 0);
    const m = softFin(sh, phys("#14a0a0", { side: THREE.DoubleSide, emissive: C("#38e0c8"), emissiveIntensity: 0.15 }), 0.05);
    m.rotation.set(s * 1.3, fx > 0 ? 0.3 : -0.2, 0);
    f.add(m);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), gold);
    tip.position.set(-0.95, 0.08 * s, s * 0.55);
    f.add(tip);
    g.add(f);
    fins.push(f);
  }
  const bub = new THREE.Group();
  for (let i = 0; i < 12; i++) bub.add(new THREE.Mesh(new THREE.SphereGeometry(0.04 + (i % 3) * 0.02, 10, 8), new THREE.MeshPhysicalMaterial({ color: "#e0fff8", transparent: true, opacity: 0.5, roughness: 0.05 })));
  g.add(bub);
  anim.push((t) => {
    fins.forEach((f, i) => (f.rotation.z = Math.sin(t * 1.3 + i * 1.6) * 0.18));
    head.rotation.y = Math.sin(t * 0.8) * 0.12;
    tail.rotation.y = Math.sin(t * 1.4) * 0.25;
    emblem.children.forEach((c) => ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity !== undefined && (((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + 0.8 * Math.max(0, Math.sin(t * 1.5)))); // 문양이 주기적으로 빛남
    bub.children.forEach((b, i) => b.position.set(Math.cos(i * 1.3) * 1.4, ((t * 0.4 + i * 0.2) % 2) - 0.6, Math.sin(i * 1.3) * 1.1));
  });
  return finishMythic(g, anim, 2.0, "#38e0c8", "#ffd24a", [3.7, 2.2, 3.0], 50);
};

/** 무지개유니콘피쉬: 진주빛 둥근 몸, 이마의 무지개 나선 뿔, 하늘색 큰 눈, 3갈래 무지개 꼬리 */
const unicornFish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const tex = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 256;
    const x = c.getContext("2d")!;
    const g2 = x.createLinearGradient(0, 0, 0, 256);
    g2.addColorStop(0, "#d8c8ff"); g2.addColorStop(0.35, "#fff4fa"); g2.addColorStop(1, "#fffaf2");
    x.fillStyle = g2; x.fillRect(0, 0, 64, 256);
    const rb = ["#ff8a9a", "#ffc07a", "#fff08a", "#9aff9a", "#8ad8ff", "#b09aff"];
    rb.forEach((col, i) => { x.fillStyle = col; x.globalAlpha = 0.42; x.fillRect(0, 10 + i * 12, 64, 12); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  g.add(new THREE.Mesh(profileBody(1.25, 1.0, 0.9, 0.62, false, 0.8), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.2, clearcoat: 1, emissive: C("#ffe8f8"), emissiveIntensity: 0.15 })));
  for (const s of [-1, 1]) {
    const e = eyeBall(0.13, "#7ad0ff", "round", 0.6);
    e.position.set(0.48, 0.16, s * 0.36);
    e.rotation.y = -s * 0.4;
    g.add(e);
    const f = sideFin(1.1, new THREE.MeshPhysicalMaterial({ color: s > 0 ? "#ffb0e8" : "#c8a0ff", transparent: true, opacity: 0.7, side: THREE.DoubleSide, emissive: C("#ff90e0"), emissiveIntensity: 0.2, roughness: 0.2 }));
    f.position.set(0.1, 0.0, s * 0.45);
    f.rotation.set(s * 0.8, 0.2, -0.2);
    g.add(f);
    const f2 = sideFin(0.75, new THREE.MeshPhysicalMaterial({ color: s > 0 ? "#9ae8ff" : "#fff0a0", transparent: true, opacity: 0.7, side: THREE.DoubleSide, emissive: C("#c8f0ff"), emissiveIntensity: 0.2, roughness: 0.2 }));
    f2.position.set(0.0, -0.1, s * 0.45);
    f2.rotation.set(s * 0.9, 0.5, -0.9);
    g.add(f2);
  }
  g.add(flat(phys("#ffb0c8"), [0.62, -0.1, 0], [0.12, 0.08, 0.2]));
  // 이마의 나선 뿔: 무지개 줄무늬를 비스듬히 그려 나선처럼 보이게
  const hornTex = (() => {
    const c = document.createElement("canvas"); c.width = 128; c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff6fb"; x.fillRect(0, 0, 128, 256);
    const rb = ["#ff7a9a", "#ffb070", "#fff070", "#8aff9a", "#7ad0ff", "#a88aff"];
    for (let k = -4; k < 12; k++) { x.fillStyle = rb[((k % 6) + 6) % 6]; x.globalAlpha = 0.8; x.beginPath(); x.moveTo(0, k * 30); x.lineTo(128, k * 30 - 70); x.lineTo(128, k * 30 - 40); x.lineTo(0, k * 30 + 30); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.0, 24, 1), new THREE.MeshPhysicalMaterial({ map: hornTex, emissiveMap: hornTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.35, roughness: 0.2, clearcoat: 1 }));
  horn.position.set(0.42, 0.82, 0);
  horn.rotation.z = -0.55;
  g.add(horn);
  const hr = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 24), glow("#ffd860", 0.8)); // 뿔 밑동의 금빛 고리
  hr.position.set(0.42 - Math.sin(0.55) * 0.3, 0.82 - Math.cos(0.55) * 0.3, 0);
  hr.rotation.set(Math.PI / 2, 0, -0.55);
  g.add(hr);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), glow("#ffffff", 2));
  tip.position.set(0.42 + Math.sin(0.55) * 0.5, 0.82 + Math.cos(0.55) * 0.5, 0);
  g.add(tip);
  const dors = dorsalFin(0.55, 0.4, new THREE.MeshPhysicalMaterial({ color: "#d8b0ff", transparent: true, opacity: 0.7, side: THREE.DoubleSide, emissive: C("#c890ff"), emissiveIntensity: 0.25 }));
  dors.position.set(-0.3, 0.46, 0);
  g.add(dors);
  const tail = new THREE.Group();
  tail.position.set(-0.62, 0, 0);
  const lobes: THREE.Object3D[] = [];
  ["#ff7aa8", "#ffe070", "#7ad8ff"].forEach((c, i) => {
    const f = tailFin(0.85, new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, emissive: C(c), emissiveIntensity: 0.3 }), "fan");
    f.rotation.z = (i - 1) * 0.5;
    tail.add(f);
    lobes.push(f);
  });
  g.add(tail);
  for (let i = 0; i < 3; i++) { // 꼬리 잔상
    const v = veil(1.4, 0.5, C(["#ff7aa8", "#ffe070", "#7ad8ff"][i]), 0.45, anim, i * 2);
    v.position.set(-0.8, (i - 1) * 0.15, 0);
    g.add(v);
  }
  const orbs = new THREE.Group();
  ["#ff7aa8", "#ffb070", "#ffe070", "#8aff9a", "#7ad8ff", "#b09aff"].forEach((c, i) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: c })); o.userData.i = i; orbs.add(o); });
  g.add(orbs);
  anim.push((t) => {
    tail.rotation.y = Math.sin(t * 3.2) * 0.35;
    lobes.forEach((l, i) => (l.rotation.z = (i - 1) * (0.5 + 0.12 * Math.sin(t * 3.2))));
    orbs.children.forEach((o, i) => { const a = t * 0.8 + i * 1.05; o.position.set(Math.cos(a) * 1.6, Math.sin(a * 1.3 + i) * 0.8, Math.sin(a) * 1.2); });
    g.position.y = Math.sin(t * 1.3) * 0.06;
  });
  return finishMythic(g, anim, 2.3, "#ffb0f0", "#8ad8ff", [3.4, 2.6, 2.6], 54);
};

// ---------------------------------------------------------------- 얼음 호수
/** 설령빙호어: 눈처럼 하얀 둥근 물고기 + 여우 얼굴·귀, 얼음 결정으로 갈라지는 풍성한 꼬리 */
const snowFox: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const fur = grad("#bfe4ff", "#ffffff", { mid: "#f4fbff", emissive: "#d8f0ff", ei: 0.2, bump: false });
  g.add(new THREE.Mesh(profileBody(1.25, 0.95, 0.85, 0.58, false, 0.8), fur));
  g.add(flat(fur, [0.62, -0.08, 0], [0.4, 0.3, 0.4])); // 짧고 작은 여우 주둥이
  g.add(flat(phys("#2a2a4a"), [0.82, -0.04, 0], [0.07, 0.06, 0.08])); // 코
  for (const s of [-1, 1]) {
    const e = eyeBall(0.12, "#4a9aff", "round", 0.55);
    e.position.set(0.46, 0.16, s * 0.34);
    e.rotation.y = -s * 0.4;
    g.add(e);
    g.add(flat(glass("#c8a8ff", 0.6), [0.42, 0.26, s * 0.34], [0.18, 0.05, 0.1])); // 눈 주변 연보라 무늬
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 4), fur);
    ear.position.set(0.12, 0.62, s * 0.3);
    ear.rotation.set(s * 0.3, 0.7, -0.15);
    g.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), phys("#d8b8ff", { emissive: C("#c8a0ff"), emissiveIntensity: 0.3 }));
    inner.position.set(0.15, 0.6, s * 0.3);
    inner.rotation.set(s * 0.3, 0.7, -0.15);
    g.add(inner);
    // 풍성한 가슴지느러미(여우 꼬리처럼 털뭉치)
    const pf = new THREE.Group();
    pf.position.set(0.2, -0.2, s * 0.45);
    for (let i = 0; i < 6; i++) {
      const tuft = flat(i % 2 ? fur : phys("#cfe8ff", { emissive: C("#bfe0ff"), emissiveIntensity: 0.2 }), [-0.1 - i * 0.07, -0.05 - i * 0.02, s * (0.08 + i * 0.03)], [0.45 - i * 0.04, 0.12, 0.14]);
      tuft.rotation.z = -0.3 - i * 0.1;
      pf.add(tuft);
    }
    g.add(pf);
    s > 0 && anim.push((t) => (pf.rotation.x = Math.sin(t * 2) * 0.1));
  }
  // 얼음 결정 등지느러미 3개(귀 모양)
  for (let i = 0; i < 3; i++) {
    const c = crystal(0.32 - Math.abs(i - 1) * 0.07, 0.06, C("#e8f8ff"), C("#7ac8ff"));
    c.position.set(-0.1 - i * 0.2, 0.56 - Math.abs(i - 1) * 0.03, 0);
    c.rotation.z = -0.25 - i * 0.12;
    g.add(c);
  }
  // 풍성한 꼬리 7갈래: 굵은 털 꼬리들이 부채처럼 펼쳐지고 끝은 얼음 결정
  const tail = new THREE.Group();
  tail.position.set(-0.6, 0, 0);
  const tails: THREE.Group[] = [];
  for (let i = 0; i < 7; i++) {
    const tg = new THREE.Group();
    tg.rotation.z = (i - 3) * 0.27;
    tg.rotation.y = (i % 2 ? 1 : -1) * Math.abs(i - 3) * 0.09;
    const L = 1.5 - Math.abs(i - 3) * 0.14;
    tg.add(tube([V(0, 0, 0), V(-L * 0.4, 0.1, 0), V(-L * 0.8, 0.0, 0), V(-L, -0.08, 0)], 0.2 - Math.abs(i - 3) * 0.015, i % 2 ? fur : phys("#d8ecff", { emissive: C("#bfe0ff"), emissiveIntensity: 0.25 }), 0.88));
    const c = crystal(0.3, 0.05, C("#e8f8ff"), C("#58b8ff"));
    c.position.set(-L - 0.02, -0.08, 0);
    c.rotation.z = Math.PI / 2;
    tg.add(c);
    tail.add(tg);
    tails.push(tg);
  }
  g.add(tail);
  const snow = new THREE.Group();
  for (let i = 0; i < 18; i++) snow.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.035 + (i % 3) * 0.02), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xffffff : 0x8ad0ff })));
  g.add(snow);
  anim.push((t) => {
    g.rotation.y = Math.sin(t * 1.6) * 0.12;
    tails.forEach((tg, i) => (tg.rotation.z = (i - 3) * 0.27 + Math.sin(t * 1.8 + i * 0.7) * 0.08));
    tail.rotation.y = Math.sin(t * 2.0) * 0.2;
    snow.children.forEach((s, i) => s.position.set(-1.0 - ((t * 0.2 + i * 0.11) % 1) * 1.2 + Math.cos(i) * 0.3, Math.sin(i * 2 + t * 0.8) * 0.8, Math.cos(i * 1.7) * 0.8));
  });
  return finishMythic(g, anim, 2.4, "#bfe8ff", "#c8a8ff", [3.4, 2.2, 2.4], 52);
};

/** 빙하거신수: 몸통보다 큰 육각 얼음 결정 등껍질을 진 거대한 거북 */
const glacierTitan: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#0f3a9a", "#b8d8f0", { mid: "#2a78d0", emissive: "#4a9aff", ei: 0.1 });
  g.add(flat(skin, [0, -0.1, 0], [1.5, 0.55, 1.3]));
  g.add(flat(phys("#d0dce8"), [0, -0.38, 0], [1.3, 0.22, 1.1]));
  const iceM = new THREE.MeshPhysicalMaterial({ color: "#a8e0ff", transparent: true, opacity: 0.78, roughness: 0.08, clearcoat: 1, emissive: C("#3a9aff"), emissiveIntensity: 0.55, side: THREE.DoubleSide });
  g.add(flat(phys("#16407a", { metalness: 0.3 }), [0, 0.12, 0], [1.5, 0.6, 1.3])); // 껍질 바닥
  const hexes: THREE.Group[] = [];
  const hex = (x: number, z: number, h: number, r: number, tilt: number) => {
    const c = new THREE.Group();
    c.position.set(x, 0.3, z);
    c.rotation.set(Math.sin(tilt) * 0.2, tilt, Math.cos(tilt) * 0.2);
    const prism = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 6), iceM);
    prism.position.y = h / 2;
    const top = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.45, 6), iceM);
    top.position.y = h + h * 0.22;
    c.add(prism, top);
    g.add(c);
    hexes.push(c);
  };
  hex(0, 0, 2.1, 0.36, 0);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI2; hex(Math.cos(a) * 0.55, Math.sin(a) * 0.5, 1.3 + (i % 3) * 0.3, 0.24, a + 0.4); }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI2 + 0.2; hex(Math.cos(a) * 1.0, Math.sin(a) * 0.85, 0.7 + (i % 3) * 0.2, 0.17, a); }
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), new THREE.MeshBasicMaterial({ color: 0x3a9aff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
  inner.position.y = 0.5;
  g.add(inner);
  // 거북 머리(이마의 얼음 뿔 2개, 푸른 발광 눈)
  const head = new THREE.Group();
  head.position.set(1.5, 0.0, 0);
  head.add(flat(skin, [0, 0, 0], [0.8, 0.62, 0.68]));
  head.add(flat(skin, [0.35, -0.08, 0], [0.4, 0.3, 0.42]));
  for (const s of [-1, 1]) {
    const e = eyeBall(0.1, "#58b8ff", "round", 1.4);
    e.position.set(0.2, 0.12, s * 0.26);
    e.rotation.y = -s * 0.5;
    head.add(e);
    const h = crystal(0.28, 0.05, C("#e0f6ff"), C("#7ac8ff"));
    h.position.set(0.04, 0.38, s * 0.14);
    h.rotation.z = -0.4;
    head.add(h);
  }
  g.add(head);
  const tail = new THREE.Group();
  tail.position.set(-1.45, -0.05, 0);
  tail.add(tube([V(0, 0, 0), V(-0.3, 0.02, 0), V(-0.5, 0.1, 0)], 0.22, skin, 0.8));
  const tc = crystal(0.3, 0.07, C("#e0f6ff"), C("#7ac8ff"));
  tc.position.set(-0.55, 0.12, 0);
  tc.rotation.z = Math.PI / 2;
  tail.add(tc);
  g.add(tail);
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) for (const fx of [0.8, -0.8]) {
    const l = new THREE.Group();
    l.position.set(fx, -0.25, s * 1.0);
    l.add(flat(skin, [0, -0.05, s * 0.1], [0.55, 0.3, 0.45]));
    for (let k = 0; k < 3; k++) { const c = crystal(0.2, 0.05, C("#e0f6ff"), C("#7ac8ff")); c.position.set(0.1 - k * 0.14, -0.2, s * (0.28 + k * 0.04)); c.rotation.z = Math.PI + (k - 1) * 0.3; l.add(c); }
    g.add(l);
    legs.push(l);
  }
  const shards = new THREE.Group();
  for (let i = 0; i < 12; i++) shards.add(crystal(0.14 + (i % 3) * 0.08, 0.04, C("#e8f8ff"), C("#58b8ff")));
  g.add(shards);
  anim.push((t) => {
    legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 0.9 + i * 1.5) * 0.1));
    head.rotation.y = Math.sin(t * 0.6) * 0.1;
    hexes.forEach((h, i) => ((h.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.45 + 0.35 * Math.sin(t * 1.4 + i)); // 결정이 서로 반짝임
    (inner.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.12 * Math.sin(t * 1.1);
    shards.children.forEach((c, i) => { const a = t * 0.4 + i * 0.52; c.position.set(Math.cos(a) * 2.4, 0.4 + Math.sin(a * 1.7 + i) * 0.6, Math.sin(a) * 1.9); c.rotation.set(a, a * 0.5, a); });
    g.position.y = Math.sin(t * 0.7) * 0.05;
  });
  return finishMythic(g, anim, 1.9, "#7ac8ff", "#e0f6ff", [4.4, 2.8, 3.6], 56);
};

// ---------------------------------------------------------------- 크루즈
/** 심연의 흑룡: 짙은 남색 긴 용, 뒤로 휜 황금 뿔, 보라 발광 눈·균열, 날개 지느러미, 세 갈래 꼬리 */
const abyssDragon: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = grad("#0a1030", "#3a1a5a", { mid: "#141c4a", emissive: "#6a2aff", ei: 0.06 });
  const head = dragonHead({ skin, belly: phys("#2a1448"), horn: "#ffc83a", eye: "#b060ff", slit: true, hornSweep: 1.3, mane: "#6a3aa8" });
  head.scale.setScalar(1.25);
  serpent(g, anim, { N: 70, length: 5.2, amp: 0.7, radius: 0.28, skin, spine: "#9a5aff", spineH: 0.34, head, scales: { color: "#2a3a8a", big: true }, tailColor: "#2a1a60", tailCrystal: "#a060ff", wings: { color: "#5a2aa0" }, cracks: "#b070ff", waves: 5.5 });
  const dark = new THREE.Group();
  for (let i = 0; i < 24; i++) dark.add(new THREE.Mesh(new THREE.SphereGeometry(0.035 + (i % 3) * 0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0x120820, transparent: true, opacity: 0.85 })));
  g.add(dark);
  anim.push((t) => dark.children.forEach((d, i) => d.position.set(Math.cos(i * 0.9 + t * 0.3) * 3.2, Math.sin(i * 1.7 + t * 0.5) * 1.1, Math.sin(i * 0.9 + t * 0.3) * 2.0)));
  return finishMythic(g, anim, 1.8, "#9a5aff", "#ffc83a", [5.2, 2.0, 3.2], 56);
};

/** 태초의 성운어: 별이 박힌 어두운 몸, 은하수 무늬, 별자리 지느러미, 공전하는 별과 행성 */
const nebulaFish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const tex = (() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256;
    const x = c.getContext("2d")!;
    const bg = x.createLinearGradient(0, 0, 0, 256);
    bg.addColorStop(0, "#14204e"); bg.addColorStop(1, "#05081c");
    x.fillStyle = bg; x.fillRect(0, 0, 512, 256);
    x.globalAlpha = 0.45;
    for (const [col, off] of [["#8a4aff", 0], ["#4ac8ff", 40]] as const) {
      x.strokeStyle = col; x.lineWidth = 26;
      x.beginPath(); x.moveTo(0, 80 + off); x.bezierCurveTo(140, 20 + off, 260, 200 - off, 512, 90 + off); x.stroke();
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 520; i++) { x.fillStyle = i % 9 === 0 ? "#ffe9a0" : "#ffffff"; x.globalAlpha = 0.4 + Math.random() * 0.6; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 256, Math.random() * 1.8 + 0.3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
  })();
  const bodyM = new THREE.MeshPhysicalMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.6, roughness: 0.25, clearcoat: 1 });
  g.add(new THREE.Mesh(profileBody(1.9, 1.05, 0.9, 0.6, false, 0.7), bodyM));
  g.add(flat(phys("#e8e4ff", { emissive: C("#c8c0ff"), emissiveIntensity: 0.2 }), [0.15, -0.32, 0], [1.3, 0.34, 0.78])); // 하얀 배
  for (const s of [-1, 1]) {
    const e = eyeBall(0.1, "#58e8d8", "round", 1.2);
    e.position.set(0.55, 0.14, s * 0.3);
    e.rotation.y = -s * 0.4;
    g.add(e);
  }
  // 이마의 별 장식
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.06 : 0.14, a = (i / 10) * PI2 + Math.PI / 2; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const st = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01 }), glow("#ffe9a0", 1.6));
  st.position.set(0.5, 0.42, -0.02);
  st.rotation.y = 0;
  g.add(st);
  // 별자리 지느러미: 반투명 지느러미 + 점들을 선으로 연결
  const constel = (x0: number, side: number) => {
    const grp = new THREE.Group();
    grp.position.set(x0, -0.1, side * 0.4);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.bezierCurveTo(-0.2, 0.5, -0.9, 0.8, -1.2, 0.3); sh.bezierCurveTo(-0.9, 0, -0.4, -0.1, 0, 0);
    const f = softFin(sh, glass("#7a6aff", 0.4), 0.02);
    f.rotation.set(side * 1.15, 0.2, -0.2);
    grp.add(f);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) { const p = V(-0.2 - i * 0.17, 0.12 + Math.sin(i * 1.7) * 0.15, side * (0.1 + i * 0.1)); pts.push(p); const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), glow("#c8e8ff", 1.6)); d.position.copy(p); grp.add(d); }
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.7 })));
    g.add(grp);
    return grp;
  };
  const fins = [constel(0.3, 1), constel(0.3, -1)];
  const tail = new THREE.Group();
  tail.position.set(-0.95, 0, 0);
  const tailM = new THREE.MeshPhysicalMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.55, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const fl = tailFin(0.9, tailM, "crescent");
  fl.rotation.x = Math.PI / 3; // 고래처럼 비스듬히 선 꼬리
  tail.add(fl);
  g.add(tail);
  const dors = dorsalFin(0.8, 0.5, glass("#7a8aff", 0.45));
  dors.position.set(-0.3, 0.4, 0);
  g.add(dors);
  // 공전하는 별과 행성
  const bodies = new THREE.Group();
  const mk = (r: number, col: string, ringed: boolean) => {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), phys(col, { emissive: C(col), emissiveIntensity: 0.5 })));
    if (ringed) { const rg = new THREE.Mesh(new THREE.TorusGeometry(r * 1.8, r * 0.1, 6, 40), glow("#ffe9a0", 0.8)); rg.rotation.x = 1.2; p.add(rg); }
    bodies.add(p);
  };
  mk(0.14, "#ff8a6a", true); mk(0.1, "#6ad8ff", false); mk(0.12, "#c08aff", true); mk(0.07, "#ffe9a0", false); mk(0.09, "#8aff9a", false);
  g.add(bodies);
  for (const [r, tilt] of [[1.6, 0.4], [2.0, -0.5]] as const) { // 금빛 고리 궤도
    const gr = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 10, 80), phys("#ffd24a", { metalness: 0.8, emissive: C("#ffb020"), emissiveIntensity: 0.4 }));
    gr.rotation.set(Math.PI / 2 + tilt, 0, 0.3);
    g.add(gr);
  }
  anim.push((t) => {
    tail.rotation.y = Math.sin(t * 2.6) * 0.3;
    fins.forEach((f, i) => (f.rotation.x = (i ? -1 : 1) * Math.sin(t * 1.8) * 0.12));
    g.rotation.z = Math.sin(t * 1.1) * 0.05;
    bodyM.map!.offset.x = t * 0.02;
    bodies.children.forEach((p, i) => { const a = t * (0.35 + i * 0.1) + i * 1.3; p.position.set(Math.cos(a) * (1.7 + i * 0.12), Math.sin(a * 0.9 + i) * 0.5, Math.sin(a) * (1.3 + i * 0.1)); p.rotation.y = t * 0.8; });
  });
  return finishMythic(g, anim, 2.2, "#8a6aff", "#4ac8ff", [3.8, 2.0, 2.8], 60);
};

export const MYTH_MODELS: Record<string, Maker> = {
  천년이무기: imugi, 연화봉황어: lotusPhoenix, "용왕의 해신수": dragonKingTurtle, 무지개유니콘피쉬: unicornFish,
  설령빙호어: snowFox, 빙하거신수: glacierTitan, "심연의 흑룡": abyssDragon, 태초의성운어: nebulaFish, "태초의 성운어": nebulaFish,
};
void glow;
