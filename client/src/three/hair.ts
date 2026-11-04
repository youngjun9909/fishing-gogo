import * as THREE from "three";

/** 머리카락 결 무늬: 세로 줄무늬를 요철 맵으로 써서 가닥의 결이 보이게 한다 */
let strandTex: THREE.CanvasTexture | null = null;
function strandBump() {
  if (strandTex) return strandTex;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 190; i++) {
    const x = Math.random() * 512;
    const w = 1 + Math.random() * 4;
    const v = 90 + Math.random() * 110;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, 0, w, 256);
  }
  strandTex = new THREE.CanvasTexture(c);
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  return strandTex;
}

function hairMat(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
    bumpMap: strandBump(),
    bumpScale: 1.6,
  });
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface CapOpts {
  /** 앞머리선이 올라가는 정도 (클수록 이마가 많이 보임) */
  front?: number;
  /** 뒤와 옆머리가 내려오는 정도 */
  back?: number;
  /** 가르마 쪽으로 기울이는 정도 (-1 ~ 1) */
  part?: number;
  r?: number;
  cover?: number;
}

/** 두피를 감싸는 머리카락 덩어리. 가장자리를 올리고 내려서 자연스러운 머리선을 만든다 */
export function hairCap(color: string, o: CapOpts = {}): THREE.Mesh {
  const r = o.r ?? 0.65;
  const cover = o.cover ?? Math.PI * 0.64;
  const geo = new THREE.SphereGeometry(r, 56, 40, 0, Math.PI * 2, 0, cover);
  const pos = geo.attributes.position;
  const front = o.front ?? 0.3;
  const back = o.back ?? 0.22;
  const part = o.part ?? 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const theta = Math.acos(Math.min(1, Math.max(-1, y / r)));
    const rim = smooth(cover - 0.55, cover, theta);
    if (rim <= 0) continue;
    const phi = Math.atan2(z, -x); // 앞(+z)이 PI/2
    const f = Math.max(0, Math.sin(phi));
    const side = Math.cos(phi);
    // 앞쪽 머리선은 올라가고(이마), 옆과 뒤는 내려간다
    const lift = front * Math.pow(f, 1.4) * (1 + part * side * 0.8);
    const drop = back * (1 - Math.pow(f, 0.8)) * (0.6 + 0.4 * Math.abs(side));
    pos.setY(i, y + rim * (lift - drop));
    // 이마 쪽은 안으로 살짝 들어가 머리에 붙게 한다
    const squeeze = 1 - rim * f * 0.04;
    pos.setX(i, x * squeeze);
    pos.setZ(i, z * squeeze);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, hairMat(color));
  m.castShadow = true;
  return m;
}

/** 부드럽게 끝이 가는 가닥(앞머리, 땋은 머리, 꼬리에 쓴다) */
export function lock(color: string, from: THREE.Vector3[], radius: number, taper = 0.7, segs = 22): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(from);
  const radial = 14;
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const pos = geo.attributes.position;
  const ring = radial + 1;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / ring) / segs;
    const c = curve.getPointAt(Math.min(1, t));
    const k = 1 - taper * Math.pow(t, 1.3);
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, hairMat(color));
  m.castShadow = true;
  return m;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 이마를 덮는 앞머리: 중앙에서 양옆으로 쓸어내린 굵은 가닥들 */
function fringe(color: string, kind: "full" | "side" | "split" | "none"): THREE.Group {
  const g = new THREE.Group();
  if (kind === "none") return g;
  const make = (sx: number, top: number, len0: number, bend: number, thick: number) => {
    const len = len0 * 0.55;
    const m = lock(color, [V(sx * 0.05, 0.62, 0.38), V(sx * 0.2, 0.58, 0.52), V(sx * (0.34 + bend), 0.45, 0.58), V(sx * (0.5 + bend), 0.45 - len, 0.5)], thick, 0.85, 18);
    m.position.y = top + 0.08;
    g.add(m);
  };
  if (kind === "full") {
    for (const [sx, top, len, bend, th] of [[0, 0, 0.2, 0, 0.13], [-1, 0, 0.3, 0.06, 0.12], [1, 0, 0.3, 0.06, 0.12], [-1, 0.02, 0.42, 0.2, 0.1], [1, 0.02, 0.42, 0.2, 0.1]] as number[][]) make(sx, top, len, bend, th);
  } else if (kind === "split") {
    for (const [sx, top, len, bend, th] of [[-1, 0, 0.36, 0.05, 0.13], [1, 0, 0.36, 0.05, 0.13], [-1, 0.03, 0.5, 0.22, 0.1], [1, 0.03, 0.5, 0.22, 0.1]] as number[][]) make(sx, top, len, bend, th);
  } else {
    for (const [sx, top, len, bend, th] of [[1, 0, 0.45, 0.1, 0.14], [1, 0.02, 0.58, 0.28, 0.1], [-1, 0, 0.18, 0, 0.1]] as number[][]) make(sx, top, len, bend, th);
  }
  return g;
}

/** 머리 모양 15종 */
export function buildHair(style: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const add = (m: THREE.Object3D, x = 0, y = 0, z = 0) => {
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const sphere = (r: number, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), hairMat(color));
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    return m;
  };

  switch (style % 15) {
    case 0: // 짧은 머리
      g.add(hairCap(color, { front: 0.5, back: 0.12 }));
      g.add(fringe(color, "full"));
      break;
    case 1: // 단정한 앞머리
      g.add(hairCap(color, { front: 0.42, back: 0.2 }));
      g.add(fringe(color, "full"));
      break;
    case 2: // 뾰족머리
      g.add(hairCap(color, { front: 0.38, back: 0.1 }));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 12), hairMat(color));
        c.position.set(Math.sin(a) * 0.42, 0.52, Math.cos(a) * 0.42);
        c.rotation.set(Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55);
        g.add(c);
      }
      break;
    case 3: { // 긴 머리
      g.add(hairCap(color, { front: 0.44, back: 0.5 }));
      g.add(fringe(color, "split"));
      for (const s of [-1, 1]) add(lock(color, [V(s * 0.55, 0.1, -0.05), V(s * 0.62, -0.3, -0.12), V(s * 0.55, -0.75, -0.2), V(s * 0.45, -1.1, -0.2)], 0.2, 0.55));
      add(lock(color, [V(0, 0.2, -0.6), V(0, -0.3, -0.7), V(0, -0.8, -0.65), V(0, -1.15, -0.55)], 0.4, 0.5));
      break;
    }
    case 4: // 포니테일
      g.add(hairCap(color, { front: 0.46, back: 0.14 }));
      g.add(fringe(color, "side"));
      add(lock(color, [V(0, 0.5, -0.52), V(0, 0.6, -0.9), V(0, 0.2, -1.12), V(0, -0.35, -1.0), V(0.02, -0.75, -0.82)], 0.19, 0.78));
      add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 10, 18), new THREE.MeshStandardMaterial({ color: "#f2c94c", roughness: 0.5 })), 0, 0.52, -0.58).rotation.x = 0.6;
      break;
    case 5: // 양갈래
      g.add(hairCap(color, { front: 0.46, back: 0.12 }));
      g.add(fringe(color, "full"));
      for (const s of [-1, 1]) {
        add(lock(color, [V(s * 0.5, 0.35, -0.15), V(s * 0.85, 0.28, -0.3), V(s * 0.95, -0.1, -0.3), V(s * 0.85, -0.55, -0.2)], 0.17, 0.8));
        add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 10, 18), new THREE.MeshStandardMaterial({ color: "#ff8fb3", roughness: 0.5 })), s * 0.55, 0.35, -0.14).rotation.y = 1.2;
      }
      break;
    case 6: // 올림머리 (똥머리)
      g.add(hairCap(color, { front: 0.34, back: 0.1 }));
      g.add(fringe(color, "side"));
      add(sphere(0.27), 0, 0.78, -0.12);
      break;
    case 7: // 아프로
      add(sphere(0.76, 1.02, 0.92, 1), 0, 0.14, -0.1);
      break;
    case 8: { // 모히칸
      g.add(hairCap(color, { front: 0.4, back: 0.0, cover: Math.PI * 0.5 }));
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.95), hairMat(color));
      m.castShadow = true;
      add(m, 0, 0.55, -0.05);
      break;
    }
    case 9: // 옆가르마
      g.add(hairCap(color, { front: 0.46, back: 0.2, part: 0.7 }));
      g.add(fringe(color, "side"));
      break;
    case 10: // 단발
      g.add(hairCap(color, { front: 0.44, back: 0.42 }));
      g.add(fringe(color, "full"));
      for (const s of [-1, 1]) add(lock(color, [V(s * 0.58, 0.1, 0.0), V(s * 0.62, -0.2, -0.05), V(s * 0.56, -0.48, -0.08)], 0.19, 0.4));
      break;
    case 11: // 곱슬
      g.add(hairCap(color, { front: 0.46, back: 0.2 }));
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        add(sphere(0.16 + (i % 3) * 0.02), Math.sin(a) * 0.56, 0.12 + (i % 2) * 0.12, Math.cos(a) * 0.56 - 0.04).castShadow = true;
      }
      break;
    case 12: // 머리 한 가닥
      g.add(hairCap(color, { front: 0.4, back: 0.06, cover: Math.PI * 0.5 }));
      add(lock(color, [V(0, 0.64, 0.1), V(0.02, 0.9, 0.12), V(0.12, 1.02, 0.1)], 0.05, 0.3));
      break;
    case 13: // 땋은 머리
      g.add(hairCap(color, { front: 0.46, back: 0.16 }));
      g.add(fringe(color, "split"));
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) add(sphere(0.15 - i * 0.015), s * 0.58, 0.05 - i * 0.2, -0.1 - i * 0.02);
      break;
    default: { // 리본
      g.add(hairCap(color, { front: 0.46, back: 0.14 }));
      g.add(fringe(color, "full"));
      const bow = new THREE.MeshStandardMaterial({ color: "#ff8fb3", roughness: 0.45 });
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), bow);
        w.scale.set(1.1, 0.8, 0.5);
        w.position.set(s * 0.18, 0.72, 0.1);
        w.rotation.z = -s * 0.5;
        g.add(w);
      }
      add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), bow), 0, 0.72, 0.1);
    }
  }
  return g;
}
