import * as THREE from "three";
import { puff } from "./auras";

/**
 * 낚싯대 11단계(0 나무 ~ 10 전설). 단계가 오를수록 재질, 릴, 줄 걸이, 빛 효과가 화려해진다.
 * 좌표: 손잡이 쪽 끝이 y=-1.1, 끝(줄 나가는 쪽)이 y=+1.1, 길이 2.2. 줄 걸이와 릴은 아래쪽(+z)에 매단다.
 * update(t, reeling)는 매 프레임 부른다(t 초, reeling은 릴을 감는 중인지).
 */
export interface RodFx { group: THREE.Group; update: (t: number, reeling: boolean) => void }

const LEN = 2.2;
const Y0 = -1.1;
const tt = (u: number) => Y0 + u * LEN;
/** 위치 u(0 손잡이~1 끝)에서의 대 굵기 */
const R = (u: number) => 0.052 - 0.044 * Math.pow(u, 0.7);

const std = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, ...o });
const glowMat = (color: THREE.ColorRepresentation, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });

function lathe(mat: THREE.Material, u0: number, u1: number, radius: (u: number) => number, n = 20, seg = 14) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    pts.push(new THREE.Vector2(radius(u), tt(u)));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
}

/** 대 주위를 감은 고리(감김·마디) */
function band(mat: THREE.Material, u: number, thick = 0.008, extra = 0.004) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(R(u) + extra, thick, 6, 16), mat);
  m.rotation.x = Math.PI / 2;
  m.position.y = tt(u);
  return m;
}

/** 줄 걸이: 대 아래쪽에 매달린 작은 고리. 끝으로 갈수록 작아진다 */
function guide(mat: THREE.Material, u: number, insert?: THREE.Material) {
  const g = new THREE.Group();
  const gr = 0.042 - 0.028 * u;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(gr, 0.005 + 0.003 * (1 - u), 6, 14), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, tt(u), R(u) + gr);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, gr, 5), mat);
  foot.position.set(0, tt(u), R(u) + gr * 0.5);
  foot.rotation.x = Math.PI / 2;
  g.add(ring, foot);
  if (insert) {
    const ins = new THREE.Mesh(new THREE.TorusGeometry(gr * 0.8, 0.003, 5, 12), insert);
    ins.rotation.x = Math.PI / 2;
    ins.position.set(0, tt(u), R(u) + gr);
    g.add(ins);
  }
  return g;
}

interface ReelOpts {
  body: THREE.Material;
  spool: THREE.Material;
  handle: THREE.Material;
  size?: number;
  gem?: THREE.Material;
}
/** 스피닝 릴: 대 아래쪽에 달린 몸통, 감는 통(spool), 옆으로 나온 손잡이. 손잡이는 감을 때 돈다 */
function reel(o: ReelOpts) {
  const s = o.size ?? 1;
  const g = new THREE.Group();
  g.position.set(0, tt(0.3), R(0.3) + 0.05 * s);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.1 * s, 0.025 * s), o.body);
  foot.position.set(0, 0, -0.01);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05 * s, 0.07 * s, 4, 12), o.body);
  body.position.set(0, 0, 0.07 * s);
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.062 * s, 0.05 * s, 18), o.spool);
  spool.position.set(0, 0.075 * s, 0.07 * s);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.07 * s, 0.006 * s, 5, 18), o.body);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(0, 0.1 * s, 0.07 * s);
  const crank = new THREE.Group();
  crank.position.set(0.05 * s, -0.01, 0.07 * s);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.1 * s, 6), o.handle);
  arm.rotation.z = Math.PI / 2;
  arm.position.x = 0.05 * s;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 10, 8), o.handle);
  knob.position.set(0.1 * s, 0, 0);
  crank.add(arm, knob);
  g.add(foot, body, spool, lip, crank);
  if (o.gem) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.018 * s), o.gem);
    gem.position.set(-0.045 * s, 0.01, 0.07 * s);
    g.add(gem);
  }
  return { group: g, crank };
}

/** 가는 비단 무늬(탄소 섬유) 그림 */
function twillTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#15171c";
  g.fillRect(0, 0, 64, 64);
  for (let i = -64; i < 64; i += 8) {
    g.strokeStyle = i % 16 ? "#2c3038" : "#3a3f49";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 64, 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 손잡이: 아래 끝 마개와 감김 무늬를 포함 */
function grip(main: THREE.Material, accent: THREE.Material, bands = 4) {
  const g = new THREE.Group();
  g.add(lathe(main, 0, 0.24, (u) => 0.047 + 0.012 * Math.sin((u / 0.24) * Math.PI), 14, 14));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), accent);
  cap.position.y = tt(0) - 0.004;
  cap.scale.y = 0.7;
  g.add(cap);
  for (let i = 0; i < bands; i++) g.add(band(accent, 0.035 + (i * 0.17) / bands, 0.007, 0.012));
  return g;
}

function tipLoop(mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 6, 12), mat);
  m.position.set(0, tt(1) + 0.012, 0);
  return m;
}

// ---------------------------------------------------------------------------------------------

function basicRod(level: number): RodFx {
  const g = new THREE.Group();
  const wood = std("#9a6a3a", { roughness: 0.85 });
  const dark = std("#5d3d20", { roughness: 0.9 });
  const metal = std("#c9ced6", { metalness: 0.6, roughness: 0.35, emissive: "#4a4e55", emissiveIntensity: 0.25 });

  if (level === 0) {
    // 나무 막대에 줄만 묶은 기본 낚싯대
    g.add(lathe(wood, 0, 1, (u) => R(u) * 0.95, 24));
    for (const u of [0.08, 0.14, 0.2]) g.add(band(dark, u, 0.008, 0.005)); // 손잡이를 감은 끈
    g.add(tipLoop(dark));
    for (const u of [0.45, 0.7]) g.add(band(dark, u, 0.006, 0.004)); // 이은 자리 묶음
    return { group: g, update: () => undefined };
  }

  // 1단계: 대나무. 마디와 마디 사이는 연한 초록, 마디마다 짙은 고리
  const bamboo = std("#c9bf63", { roughness: 0.55, emissive: "#6f6a2a", emissiveIntensity: 0.18 });
  const node = std("#6f7a2c", { roughness: 0.6 });
  g.add(lathe(bamboo, 0, 1, (u) => R(u), 28));
  for (const u of [0.28, 0.4, 0.51, 0.61, 0.7, 0.78, 0.85, 0.91, 0.96]) g.add(band(node, u, 0.007, 0.003));
  const rattan = std("#8a5a2b", { roughness: 0.9 });
  for (let i = 0; i < 12; i++) g.add(band(rattan, 0.02 + i * 0.018, 0.0065, 0.007)); // 등나무 감김 손잡이
  const knobEnd = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), rattan);
  knobEnd.position.y = tt(0) - 0.004;
  knobEnd.scale.y = 0.7;
  g.add(knobEnd);
  for (const u of [0.44, 0.62, 0.78, 0.9]) g.add(guide(metal, u));
  g.add(tipLoop(metal));
  const r = reel({ body: std("#7a5230", { roughness: 0.7 }), spool: std("#e8d9a8", { roughness: 0.6 }), handle: std("#4a3320"), size: 0.85 });
  g.add(r.group);
  return { group: g, update: (t, reeling) => { if (reeling) r.crank.rotation.y = t * 14; } };
}

function glassRod(): RodFx {
  const g = new THREE.Group();
  const blank = std("#3fb7e6", { roughness: 0.28, metalness: 0.1, emissive: "#1c6f96", emissiveIntensity: 0.4 });
  const white = std("#ffffff", { roughness: 0.4, emissive: "#9fb8c6", emissiveIntensity: 0.3 });
  const metal = std("#d9dde4", { metalness: 0.7, roughness: 0.25, emissive: "#5a6068", emissiveIntensity: 0.3 });
  g.add(lathe(blank, 0.2, 1, R, 30));
  for (const u of [0.3, 0.45, 0.6, 0.74, 0.86, 0.95]) {
    g.add(band(white, u, 0.0075, 0.003));
    g.add(band(white, u + 0.02, 0.004, 0.003));
  }
  g.add(grip(std("#ff9a2e", { roughness: 0.7 }), std("#2b2f3a", { roughness: 0.6 }), 5));
  const stripe = std("#2b2f3a", { roughness: 0.7 });
  for (let i = 0; i < 3; i++) g.add(band(stripe, 0.05 + i * 0.06, 0.009, 0.014));
  for (const u of [0.4, 0.55, 0.68, 0.8, 0.9]) g.add(guide(metal, u));
  g.add(tipLoop(metal));
  const r = reel({ body: std("#8b95a6", { metalness: 0.6, roughness: 0.3, emissive: "#3c424c", emissiveIntensity: 0.35 }), spool: std("#2b2f3a"), handle: metal, size: 1 });
  g.add(r.group);
  return { group: g, update: (t, reeling) => { if (reeling) r.crank.rotation.y = t * 16; } };
}

function carbonRod(): RodFx {
  const g = new THREE.Group();
  const carbon = std("#ffffff", { roughness: 0.3, metalness: 0.25, map: twillTexture(), emissive: "#1a1c22", emissiveIntensity: 0.5 });
  const red = std("#e03a3a", { roughness: 0.3, emissive: "#8a1c1c", emissiveIntensity: 0.5 });
  const silver = std("#e6e9ef", { metalness: 0.8, roughness: 0.2, emissive: "#6a6f78", emissiveIntensity: 0.35 });
  g.add(lathe(carbon, 0.18, 1, R, 30));
  for (const u of [0.28, 0.5, 0.68, 0.82, 0.93]) {
    g.add(band(red, u, 0.0085, 0.003));
    g.add(band(silver, u + 0.016, 0.003, 0.003));
  }
  g.add(grip(std("#c89a62", { roughness: 0.95 }), std("#15171c", { roughness: 0.5 }), 3)); // 코르크 손잡이
  for (let i = 0; i < 2; i++) g.add(band(red, 0.07 + i * 0.1, 0.006, 0.014));
  for (const u of [0.38, 0.52, 0.64, 0.75, 0.85, 0.93]) g.add(guide(silver, u, red));
  g.add(tipLoop(silver));
  const r = reel({
    body: std("#1c1f27", { metalness: 0.7, roughness: 0.25, emissive: "#23272f", emissiveIntensity: 0.6 }),
    spool: std("#e6e9ef", { metalness: 0.8, roughness: 0.2, emissive: "#6a6f78", emissiveIntensity: 0.4 }),
    handle: red,
    size: 1.1,
    gem: red,
  });
  g.add(r.group);
  return { group: g, update: (t, reeling) => { if (reeling) r.crank.rotation.y = t * 18; } };
}

function goldRod(): RodFx {
  const g = new THREE.Group();
  const gold = std("#ffcf4a", { metalness: 0.55, roughness: 0.22, emissive: "#9a6a0a", emissiveIntensity: 0.65 });
  const deep = std("#c98a12", { metalness: 0.5, roughness: 0.3, emissive: "#6a4208", emissiveIntensity: 0.5 });
  const ruby = std("#ff3a5a", { roughness: 0.15, emissive: "#d11a3a", emissiveIntensity: 1 });
  const leather = std("#f4ecdc", { roughness: 0.75, emissive: "#6a6456", emissiveIntensity: 0.25 });
  g.add(lathe(gold, 0.18, 1, R, 32));
  for (const u of [0.26, 0.38, 0.5, 0.62, 0.72, 0.81, 0.89, 0.96]) g.add(band(deep, u, 0.009, 0.003));
  for (const u of [0.32, 0.56, 0.77]) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), ruby);
    gem.position.set(0, tt(u), R(u) + 0.012);
    g.add(gem);
  }
  g.add(grip(leather, gold, 5));
  for (let i = 0; i < 3; i++) g.add(band(deep, 0.05 + i * 0.07, 0.006, 0.014));
  for (const u of [0.36, 0.5, 0.62, 0.73, 0.83, 0.91, 0.97]) g.add(guide(gold, u, ruby));
  g.add(tipLoop(gold));
  const r = reel({ body: gold, spool: deep, handle: gold, size: 1.2, gem: ruby });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.007, 6, 28), deep);
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 0.07, 0.07);
  r.group.add(halo);
  g.add(r.group);
  // 반짝이는 빛 알갱이가 대를 따라 흐른다
  const sparks = Array.from({ length: 10 }, (_, i) => {
    const s = puff(0xfff0a0, 0.1);
    g.add(s);
    return { s, off: i / 10 };
  });
  return {
    group: g,
    update: (t, reeling) => {
      if (reeling) r.crank.rotation.y = t * 18;
      for (const p of sparks) {
        const k = (p.off + t * 0.35) % 1;
        p.s.position.set(Math.sin(t * 3 + p.off * 20) * 0.04, tt(k), R(k) + 0.03);
        (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
      }
    },
  };
}

function legendRod(): RodFx {
  const g = new THREE.Group();
  const N = 30;
  const geo = lathe(std("#ffffff"), 0.18, 1, R, N, 16).geometry as THREE.LatheGeometry;
  const posAttr = geo.getAttribute("position");
  const colors = new Float32Array(posAttr.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const blank = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }));
  g.add(blank);
  const c = new THREE.Color();
  const paint = (t: number) => {
    for (let i = 0; i < posAttr.count; i++) {
      const u = (posAttr.getY(i) - Y0) / LEN;
      c.setHSL((u * 1.4 + t * 0.15) % 1, 0.95, 0.62);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.getAttribute("color").needsUpdate = true;
  };
  paint(0);

  const crystal = std("#bfe6ff", { roughness: 0.1, emissive: "#6ab0ff", emissiveIntensity: 0.9 });
  g.add(grip(std("#2a1d4a", { roughness: 0.5, emissive: "#3a2670", emissiveIntensity: 0.6 }), crystal, 6));
  const orbit = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), new THREE.MeshBasicMaterial({ color: "#d8f0ff", fog: false, toneMapped: false }));
  orbit.position.set(0, tt(0) - 0.12, 0);
  g.add(orbit);
  const orbitGlow = puff(0x9fd8ff, 0.22);
  orbitGlow.position.copy(orbit.position);
  g.add(orbitGlow);

  // 줄 걸이는 빛나는 고리(무지개색)
  const guides = [0.36, 0.48, 0.6, 0.71, 0.81, 0.9, 0.97].map((u, i) => {
    const gm = glowMat(new THREE.Color().setHSL(i / 7, 1, 0.65));
    const gd = guide(gm, u, undefined);
    g.add(gd);
    return gm;
  });
  g.add(tipLoop(glowMat(0xffffff)));

  // 릴: 빛나는 구슬과 도는 고리
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: "#e8d8ff", fog: false, toneMapped: false }));
  const orbRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 28), glowMat(0x9fe8ff));
  const orbRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 28), glowMat(0xffa0f0));
  const reelG = new THREE.Group();
  reelG.position.set(0, tt(0.3), R(0.3) + 0.12);
  reelG.add(orb, orbRing, orbRing2);
  g.add(reelG);

  const halo = puff(0xfff0ff, 0.32);
  halo.position.set(0, tt(1) + 0.02, 0);
  g.add(halo);
  const trail = Array.from({ length: 16 }, (_, i) => {
    const s = puff(0xffffff, 0.06);
    g.add(s);
    return { s, off: i / 16 };
  });
  const col = new THREE.Color();
  return {
    group: g,
    update: (t, reeling) => {
      paint(t);
      orbit.rotation.y = t * 1.6;
      orbit.rotation.x = t * 0.9;
      orbit.position.y = tt(0) - 0.12 + Math.sin(t * 2.2) * 0.02;
      orbitGlow.position.copy(orbit.position);
      guides.forEach((m, i) => m.color.setHSL(((i / 7) + t * 0.2) % 1, 1, 0.65));
      orbRing.rotation.set(t * (reeling ? 9 : 1.4), t * 0.7, 0);
      orbRing2.rotation.set(t * 0.8, t * (reeling ? 9 : 1.7), 1);
      (halo.material as THREE.SpriteMaterial).opacity = 0.6 + 0.4 * Math.sin(t * 4);
      for (const p of trail) {
        const k = (p.off + t * 0.4) % 1;
        p.s.position.set(Math.sin(t * 2 + p.off * 18) * 0.05, tt(0.2 + k * 0.8), R(0.2 + k * 0.8) + 0.02);
        col.setHSL((k + t * 0.3) % 1, 1, 0.7);
        (p.s.material as THREE.SpriteMaterial).color.copy(col);
        (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
      }
    },
  };
}

function steelRod(): RodFx {
  const g = new THREE.Group();
  const steel = std("#aab4c4", { metalness: 0.9, roughness: 0.22, emissive: "#3a4150", emissiveIntensity: 0.4 });
  const dark = std("#2a2f3a", { metalness: 0.8, roughness: 0.3, emissive: "#14171d", emissiveIntensity: 0.5 });
  const orange = std("#ff8a2a", { roughness: 0.35, emissive: "#a8480a", emissiveIntensity: 0.55 });
  g.add(lathe(steel, 0.16, 1, R, 30));
  for (const u of [0.24, 0.34, 0.45, 0.56, 0.66, 0.75, 0.83, 0.9, 0.96]) {
    g.add(band(dark, u, 0.0085, 0.003));
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6), orange); // 이음새의 볼트
    bolt.position.set(0, tt(u + 0.02), R(u + 0.02) + 0.004);
    bolt.rotation.x = Math.PI / 2;
    g.add(bolt);
  }
  g.add(grip(std("#1b1e26", { roughness: 0.55 }), orange, 5));
  for (let i = 0; i < 4; i++) g.add(band(steel, 0.04 + i * 0.045, 0.007, 0.015));
  for (const u of [0.34, 0.48, 0.6, 0.72, 0.83, 0.92]) g.add(guide(steel, u, dark));
  g.add(tipLoop(steel));
  const r = reel({ body: dark, spool: steel, handle: orange, size: 1.15, gem: orange });
  g.add(r.group);
  return { group: g, update: (t, reeling) => { if (reeling) r.crank.rotation.y = t * 18; } };
}

function silverRod(): RodFx {
  const g = new THREE.Group();
  const silver = std("#eef3ff", { metalness: 0.85, roughness: 0.14, emissive: "#8ab4ff", emissiveIntensity: 0.38 });
  const ice = std("#9ad8ff", { roughness: 0.12, emissive: "#4aa8ff", emissiveIntensity: 0.9 });
  const navy = std("#1d2c58", { roughness: 0.4, emissive: "#101a3a", emissiveIntensity: 0.5 });
  g.add(lathe(silver, 0.16, 1, R, 30));
  // 대를 감싸며 오르는 푸른 빛 고리(나선처럼)
  for (let i = 0; i < 12; i++) {
    const u = 0.22 + i * 0.062;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R(u) + 0.004, 0.0035, 6, 18), glowMat(0x7ac8ff, 0.8));
    ring.rotation.x = Math.PI / 2 + Math.sin(i) * 0.25;
    ring.position.y = tt(u);
    g.add(ring);
  }
  g.add(grip(navy, silver, 5));
  for (const u of [0.34, 0.47, 0.59, 0.7, 0.8, 0.89, 0.96]) g.add(guide(silver, u, ice));
  g.add(tipLoop(silver));
  const r = reel({ body: silver, spool: navy, handle: silver, size: 1.15, gem: ice });
  g.add(r.group);
  const sparks = Array.from({ length: 8 }, (_, i) => { const sp = puff(0xcfeaff, 0.09); g.add(sp); return { sp, off: i / 8 }; });
  return {
    group: g,
    update: (t, reeling) => {
      if (reeling) r.crank.rotation.y = t * 18;
      for (const p of sparks) {
        const k = (p.off + t * 0.3) % 1;
        p.sp.position.set(Math.sin(t * 2.4 + p.off * 17) * 0.05, tt(k), R(k) + 0.03);
        (p.sp.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
      }
    },
  };
}

function platinumRod(): RodFx {
  const g = new THREE.Group();
  const plat = std("#f6f8fc", { metalness: 0.95, roughness: 0.1, emissive: "#aab4c8", emissiveIntensity: 0.35 });
  const trim = std("#c8d0e0", { metalness: 0.9, roughness: 0.2, emissive: "#6a748a", emissiveIntensity: 0.4 });
  const diamond = std("#ffffff", { roughness: 0.02, emissive: "#d8f0ff", emissiveIntensity: 1 });
  const sapphire = std("#3a6aff", { roughness: 0.1, emissive: "#1c3ad8", emissiveIntensity: 0.9 });
  const leather = std("#1c2650", { roughness: 0.65, emissive: "#0c1230", emissiveIntensity: 0.4 });
  g.add(lathe(plat, 0.15, 1, (u) => R(u) * 1.06, 32));
  for (const u of [0.22, 0.32, 0.43, 0.54, 0.64, 0.73, 0.81, 0.88, 0.94]) {
    g.add(band(trim, u, 0.0095, 0.004));
    g.add(band(trim, u + 0.014, 0.004, 0.004));
  }
  for (const u of [0.28, 0.48, 0.68, 0.86]) { // 보석 박음
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), u > 0.6 ? diamond : sapphire);
    gem.position.set(0, tt(u), R(u) + 0.014);
    g.add(gem);
  }
  g.add(grip(leather, plat, 6));
  for (let i = 0; i < 3; i++) g.add(band(sapphire, 0.05 + i * 0.07, 0.006, 0.016));
  for (const u of [0.34, 0.47, 0.59, 0.7, 0.8, 0.89, 0.96]) g.add(guide(plat, u, sapphire));
  g.add(tipLoop(plat));
  const r = reel({ body: plat, spool: leather, handle: plat, size: 1.25, gem: diamond });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 28), trim);
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 0.07, 0.07);
  r.group.add(halo);
  g.add(r.group);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false, toneMapped: false }));
  star.position.set(0, tt(1) + 0.09, 0);
  g.add(star);
  return {
    group: g,
    update: (t, reeling) => {
      if (reeling) r.crank.rotation.y = t * 18;
      star.rotation.y = t * 2;
      star.scale.setScalar(0.85 + 0.25 * Math.sin(t * 5));
    },
  };
}

function dragonRod(): RodFx {
  const g = new THREE.Group();
  const jade = std("#14a89a", { metalness: 0.45, roughness: 0.22, emissive: "#0a6a62", emissiveIntensity: 0.6 });
  const gold = std("#ffcf4a", { metalness: 0.6, roughness: 0.22, emissive: "#9a6a0a", emissiveIntensity: 0.6 });
  const coral = std("#ff6a5a", { roughness: 0.3, emissive: "#a8281a", emissiveIntensity: 0.6 });
  const pearl = std("#ffffff", { roughness: 0.08, emissive: "#d8f8ff", emissiveIntensity: 0.9 });
  g.add(lathe(jade, 0.16, 1, R, 32));
  for (const u of [0.24, 0.34, 0.45, 0.55, 0.64, 0.72, 0.8, 0.87, 0.93]) { // 용 비늘 같은 금 마디
    g.add(band(gold, u, 0.0095, 0.004));
    const scale = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 5), gold);
    scale.position.set(0, tt(u + 0.025), R(u + 0.025) + 0.012);
    scale.rotation.x = -Math.PI / 2.6;
    g.add(scale);
  }
  g.add(grip(coral, gold, 6));
  for (let i = 0; i < 3; i++) g.add(band(gold, 0.05 + i * 0.07, 0.007, 0.016));
  for (const u of [0.34, 0.47, 0.59, 0.7, 0.8, 0.89, 0.96]) g.add(guide(gold, u, coral));
  // 끝: 용의 뿔 두 개와 여의주
  for (const sd of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 6), gold);
    horn.position.set(sd * 0.018, tt(1) + 0.05, 0);
    horn.rotation.z = -sd * 0.5;
    g.add(horn);
  }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), pearl);
  orb.position.set(0, tt(1) + 0.065, 0);
  g.add(orb);
  const orbGlow = puff(0xbff4ff, 0.2);
  orbGlow.position.copy(orb.position);
  g.add(orbGlow);
  const r = reel({ body: gold, spool: jade, handle: gold, size: 1.2, gem: coral });
  g.add(r.group);
  const bubbles = Array.from({ length: 9 }, (_, i) => { const sp = puff(0x9ff0ff, 0.08); g.add(sp); return { sp, off: i / 9 }; });
  return {
    group: g,
    update: (t, reeling) => {
      if (reeling) r.crank.rotation.y = t * 18;
      orb.position.y = tt(1) + 0.065 + Math.sin(t * 3) * 0.012;
      orbGlow.position.copy(orb.position);
      (orbGlow.material as THREE.SpriteMaterial).opacity = 0.6 + 0.4 * Math.sin(t * 4);
      for (const p of bubbles) {
        const k = (p.off + t * 0.28) % 1;
        p.sp.position.set(Math.sin(t * 2 + p.off * 21) * 0.05, tt(0.3 + k * 0.7), R(0.3 + k * 0.7) + 0.03);
        (p.sp.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
      }
    },
  };
}

function starRod(): RodFx {
  const g = new THREE.Group();
  const night = std("#1a1f5a", { metalness: 0.5, roughness: 0.2, emissive: "#2a2fa0", emissiveIntensity: 0.8 });
  const violet = std("#8a5aff", { roughness: 0.25, emissive: "#5a2ad8", emissiveIntensity: 0.8 });
  const starlight = std("#fff6c8", { roughness: 0.1, emissive: "#ffe27a", emissiveIntensity: 1 });
  g.add(lathe(night, 0.16, 1, R, 32));
  const stars: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) { // 대에 박힌 별 알갱이
    const u = 0.2 + i * 0.05;
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.011), starlight);
    st.position.set(Math.sin(i * 2.1) * (R(u) + 0.004), tt(u), Math.cos(i * 2.1) * (R(u) + 0.004));
    g.add(st);
    stars.push(st);
  }
  for (const u of [0.3, 0.52, 0.72, 0.88]) g.add(band(violet, u, 0.008, 0.003));
  g.add(grip(std("#2a1a6a", { roughness: 0.55, emissive: "#180e44", emissiveIntensity: 0.6 }), violet, 6));
  for (const u of [0.34, 0.47, 0.59, 0.7, 0.8, 0.89, 0.96]) g.add(guide(violet, u, starlight));
  const tipStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), new THREE.MeshBasicMaterial({ color: "#fff3b0", fog: false, toneMapped: false }));
  tipStar.position.set(0, tt(1) + 0.1, 0);
  g.add(tipStar);
  const tipGlow = puff(0xfff0b0, 0.28);
  tipGlow.position.copy(tipStar.position);
  g.add(tipGlow);
  // 릴: 초승달 모양 고리와 별
  const moon = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 24, Math.PI * 1.5), std("#ffe9a0", { metalness: 0.6, roughness: 0.2, emissive: "#c8981a", emissiveIntensity: 0.7 }));
  const reelG = new THREE.Group();
  reelG.position.set(0, tt(0.3), R(0.3) + 0.1);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), night);
  reelG.add(core, moon);
  g.add(reelG);
  const trail = Array.from({ length: 14 }, (_, i) => { const sp = puff(i % 2 ? 0xfff6c8 : 0xb09aff, 0.08); g.add(sp); return { sp, off: i / 14 }; });
  return {
    group: g,
    update: (t, reeling) => {
      moon.rotation.z = t * (reeling ? 9 : 0.6);
      tipStar.rotation.y = t * 1.8;
      tipStar.rotation.x = t * 1.1;
      tipStar.scale.setScalar(0.85 + 0.3 * Math.sin(t * 4));
      (tipGlow.material as THREE.SpriteMaterial).opacity = 0.6 + 0.4 * Math.sin(t * 3.2);
      stars.forEach((st, i) => st.scale.setScalar(0.7 + 0.6 * Math.max(0, Math.sin(t * 3 + i))));
      for (const p of trail) {
        const k = (p.off + t * 0.35) % 1;
        p.sp.position.set(Math.sin(t * 2 + p.off * 19) * 0.06, tt(0.25 + k * 0.75), R(0.25 + k * 0.75) + 0.03);
        (p.sp.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
      }
    },
  };
}

export function buildRod(level: number): RodFx {
  // 강화 단계(0~10)마다 이름에 맞는 모양이 따로 있다: 나무·대나무·유리섬유·카본·강철·은빛·황금·백금·용왕·별빛·전설
  switch (level) {
    case 0: return basicRod(0);
    case 1: return basicRod(1);
    case 2: return glassRod();
    case 3: return carbonRod();
    case 4: return steelRod();
    case 5: return silverRod();
    case 6: return goldRod();
    case 7: return platinumRod();
    case 8: return dragonRod();
    case 9: return starRod();
    default: return legendRod();
  }
}
