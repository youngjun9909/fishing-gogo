import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BASE_MAPS, CRUISE_HULL, CYCLE_MS, DAY_MS } from "@fishing/shared";
import type { MapDef, MapId } from "@fishing/shared";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** 맵 소품은 계단 음영 없이 부드럽게 칠한다 (이름은 기존 호출부 호환용) */
const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, ...extra });

const texRnd = mulberryTex(7);
function mulberryTex(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 회색조 질감 한 장을 캔버스로 그린다 (재질 색과 곱해진다) */
function paintTex(size: number, rep: [number, number], draw: (g: CanvasRenderingContext2D, n: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(rep[0], rep[1]);
  return t;
}
const gray = (v: number) => `rgb(${v},${v},${v})`;
/** 거친 껍질: 세로로 갈라진 줄무늬 */
const barkTex = () => paintTex(128, [2, 3], (g, n) => {
  g.fillStyle = gray(190); g.fillRect(0, 0, n, n);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = gray(90 + Math.floor(texRnd() * 150)); g.lineWidth = 1 + texRnd() * 3;
    const x = texRnd() * n; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= n; y += 16) g.lineTo(x + (texRnd() - 0.5) * 6, y);
    g.stroke();
  }
});
/** 낡은 판자: 결이 세로로 흐르고 군데군데 옹이 */
const woodTex = () => paintTex(128, [1, 1], (g, n) => {
  g.fillStyle = gray(215); g.fillRect(0, 0, n, n);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = gray(150 + Math.floor(texRnd() * 90)); g.lineWidth = 1 + texRnd() * 2;
    const x = texRnd() * n; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, n * 0.3, x - 6, n * 0.7, x + 2, n); g.stroke();
  }
  for (let i = 0; i < 3; i++) { g.fillStyle = gray(120); g.beginPath(); g.ellipse(texRnd() * n, texRnd() * n, 3, 6, 0, 0, 7); g.fill(); }
});
/** 솔잎 뭉치: 짧은 획이 빽빽하게 */
const needleTex = () => paintTex(128, [4, 2], (g, n) => {
  g.fillStyle = gray(240); g.fillRect(0, 0, n, n);
  for (let i = 0; i < 700; i++) {
    g.strokeStyle = gray(212 + Math.floor(texRnd() * 43)); g.lineWidth = 1 + texRnd();
    const x = texRnd() * n, y = texRnd() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (texRnd() - 0.5) * 10, y + 4 + texRnd() * 8); g.stroke();
  }
});
/** 땅 위 잔무늬: 눈 결정/풀 얼룩처럼 보이는 아주 옅은 얼룩 */
const groundTex = () => paintTex(256, [70, 70], (g, n) => {
  g.fillStyle = gray(235); g.fillRect(0, 0, n, n);
  for (let i = 0; i < 160; i++) {
    const x = texRnd() * n, y = texRnd() * n, r = 4 + texRnd() * 16, v = 205 + Math.floor(texRnd() * 50);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.55)`); gr.addColorStop(1, "rgba(235,235,235,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
});

// 월드 소품은 윤곽선 없이 부드러운 음영으로만 그린다 (멀리서 검은 선이 굵어 보이지 않게)
const addOutline = <T,>(m: T, _t?: number): T => m;
/** 모서리를 둥글린 상자 */
const rbox = (w: number, h: number, d: number) => new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.24);
/** 둥근 지붕: 반구를 납작하게 눌러서 만든다 */
const dome = (r: number, h: number) => {
  const g = new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, h / r, 1);
  return g;
};
/** 울퉁불퉁하지만 모서리가 없는 둥근 바위 */
const roundRockGeo = () => {
  const g = new THREE.IcosahedronGeometry(0.7, 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + 0.12 * Math.sin(x * 5.1 + z * 3.3) + 0.08 * Math.cos(y * 6.2 - x * 2.7);
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
};

/** 크루즈 불꽃놀이 한 발 (점 입자 묶음) */
interface Firework {
  g: THREE.BufferGeometry;
  m: THREE.PointsMaterial;
  col: THREE.BufferAttribute;
  dirs: Float32Array;
  N: number;
  x: number; y: number; z: number;
  t0: number; dur: number; rf: number; sf: number;
}
const FW_SHAPES = ["sphere", "willow"] as const;
/** 색, 위치, 크기, 타이밍을 모두 무작위로 다시 정한다 (시각 효과라 Math.random을 쓴다) */
function rollFirework(f: Firework, t: number) {
  const R = Math.random;
  const kind = FW_SHAPES[Math.floor(R() * FW_SHAPES.length)];
  const d = f.dirs, N = f.N;
  for (let i = 0; i < N; i++) {
    const v = R() * 2 - 1, b = R() * Math.PI * 2, sq = Math.sqrt(1 - v * v);
    d[i * 3] = sq * Math.cos(b); d[i * 3 + 1] = v; d[i * 3 + 2] = sq * Math.sin(b);
  }
  // 색: 무지개 / 두 색 번갈아 / 한 색
  const mode = Math.floor(R() * 3), h0 = R(), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const h = mode === 0 ? (h0 + i / N) % 1 : mode === 1 ? (i % 2 ? h0 : (h0 + 0.45) % 1) : (h0 + (R() - 0.5) * 0.06 + 1) % 1;
    c.setHSL(h, 1, 0.62);
    f.col.setXYZ(i, c.r, c.g, c.b);
  }
  f.col.needsUpdate = true;
  f.x = -40 + R() * 80; f.y = 12 + R() * 12; f.z = -150 + R() * 40;
  f.rf = 10 + R() * 5;
  f.sf = kind === "willow" ? 12 : 5;
  f.dur = 3.2 + R() * 2;
  f.t0 = t + R() * 1.8;
}

export interface World {
  group: THREE.Group;
  waterY: number;
  /** serverNowMs: 서버 시계 기준 현재 시각 */
  update(t: number, serverNowMs: number): void;
  /** 물결 파문을 만든다 */
  ripple(x: number, z: number): void;
}

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const fbm = (x: number, z: number) =>
  Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.7) * 0.5 + Math.sin(x * 0.23 + z * 0.17 + 2.1) * 0.25 + Math.sin(x * 0.41 - z * 0.37) * 0.12;

const RING_COUNT = 6;

interface Theme {
  groundA: string;
  groundB: string;
  sand: string;
  hill: string;
  shallow: string;
  mid: string;
  deep: string;
  skyTop: string;
  skyHorizon: string;
}

const THEMES: Record<MapId, Theme> = {
  lake: { groundA: "#82c070", groundB: "#62aa6a", sand: "#eedcaa", hill: "#3f8458", shallow: "#a4ece0", mid: "#5cc4e0", deep: "#3a88c8", skyTop: "#4aa0ec", skyHorizon: "#d6ecf4" },
  pier: { groundA: "#f2e0b0", groundB: "#e4cf9a", sand: "#f6e8c0", hill: "#79b266", shallow: "#a8efe6", mid: "#58c4e0", deep: "#3a82c0", skyTop: "#54a8ec", skyHorizon: "#e0f0f2" },
  cruise: { groundA: "#c9a070", groundB: "#c9a070", sand: "#c9a070", hill: "#c9a070", shallow: "#6fd6e6", mid: "#2f9fd8", deep: "#0f5a96", skyTop: "#3b86dd", skyHorizon: "#cfe6f4" },
  ice: { groundA: "#cbdaef", groundB: "#b3c8e4", sand: "#d8e6f6", hill: "#9db8d8", shallow: "#a8dcee", mid: "#6cb0dc", deep: "#4a86bc", skyTop: "#3a7fd4", skyHorizon: "#c4dcf0" },
};

export function buildWorld(mapId: MapId | string, scene: THREE.Scene): World {
  const map: MapDef = BASE_MAPS[mapId as MapId] ?? BASE_MAPS.lake;
  const id = (mapId in BASE_MAPS ? mapId : "lake") as MapId;
  const rnd = mulberry(id.length * 977 + id.charCodeAt(0));
  const th = THEMES[id];
  const OCEAN = id === "cruise";
  const group = new THREE.Group();
  scene.add(group);

  // 호수 중심과 반지름 (lake, ice)
  const LAKE = id === "lake" ? { cx: 0, cz: -8, r: 22 } : id === "ice" ? { cx: 0, cz: -5, r: 20 } : null;

  // ---- 지형 높이 ------------------------------------------------------
  const heightAt = (x: number, z: number): number => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    const edge = smooth(36, 80, d);
    const hills = edge * (5 + 11 * (0.5 + 0.5 * fbm(x * 0.7 + 3, z * 0.7 - 5)));
    let h = fbm(x, z) * (id === "ice" ? 0.3 : 0.16) * (1 - edge * 0.6) + hills;
    if (LAKE) {
      const r = Math.hypot(x - LAKE.cx, z - LAKE.cz);
      if (r < LAKE.r) h = -0.24 - 3.0 * Math.pow(1 - r / LAKE.r, 0.9);
      else if (r < LAKE.r + 4) h = h * smooth(LAKE.r, LAKE.r + 4, r) + -0.24 * (1 - smooth(LAKE.r, LAKE.r + 4, r));
    } else if (id === "pier") {
      if (z < -2) {
        const beach = smooth(-2, -7, z);
        h = h * (1 - beach) + -0.26 * beach;
        h += -4.5 * smooth(-8, -34, z);
      }
        }
    return h;
  };

  // ---- 하늘, 빛 --------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(th.skyTop) },
      uHorizon: { value: new THREE.Color(th.skyHorizon) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
      uSunColor: { value: new THREE.Color(0xfff0c8) },
      uTime: { value: 0 },
      uCloud: { value: 0.85 },
      uCloudCol: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime; uniform float uCloud; uniform vec3 uCloudCol; varying vec3 vDir;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      float fb(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
        float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += uSunColor * (pow(s, 600.0) * 2.0 + pow(s, 24.0) * 0.28);
        // 구름: 하늘 위를 평면에 투영한 잡음. 해 쪽 가장자리가 밝고 반대쪽은 푸른 그늘
        vec2 cp = vDir.xz / max(vDir.y + 0.12, 0.06) * 0.7 + vec2(uTime * 0.006, 0.0);
        float c = fb(cp * 1.4);
        float cov = smoothstep(0.46, 0.78, c) * smoothstep(0.02, 0.3, vDir.y);
        float lit = fb(cp * 1.4 + normalize(uSunDir.xz + 0.001) * 0.12);
        vec3 cc = mix(uCloudCol * vec3(0.62, 0.72, 0.9), uCloudCol, clamp((c - lit) * 4.0 + 0.65, 0.0, 1.0));
        col = mix(col, cc, cov * uCloud);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(330, 32, 20), skyMat);
  sky.renderOrder = -10;
  group.add(sky);

  // 그늘이 하늘색을 머금게 한다 (겨울은 푸른 그림자)
  const hemiCols = OCEAN ? [0xdcecff, 0x9ab8d8] : id === "ice" ? [0xb0cef6, 0x7088b4] : id === "pier" ? [0xe0f0ff, 0xd8c8a0] : [0xd4ecff, 0x86b478];
  const hemi = new THREE.HemisphereLight(hemiCols[0], hemiCols[1], 1.0);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(30, 45, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 150;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  group.add(hemi, sun, sun.target);

  // ---- 땅 --------------------------------------------------------------
  if (!OCEAN) {
  const SIZE = 380;
  const SEG = 230;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cA = new THREE.Color(th.groundA), cB = new THREE.Color(th.groundB), cSand = new THREE.Color(th.sand), cHill = new THREE.Color(th.hill);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const patch = 0.5 + 0.5 * fbm(x * 1.7, z * 1.7);
    tmp.copy(cA).lerp(cB, patch);
    const d = Math.max(Math.abs(x), Math.abs(z));
    tmp.lerp(cHill, smooth(34, 70, d) * 0.85);
    if (LAKE) {
      const r = Math.hypot(x - LAKE.cx, z - LAKE.cz);
      tmp.lerp(cSand, 1 - smooth(LAKE.r - 1, LAKE.r + 4.5, r));
    } else if (id === "pier") {
      // 부두 맵: 위쪽은 풀밭, 해변으로 갈수록 모래
      const grass = new THREE.Color("#8fcf7c");
      tmp.lerp(grass, smooth(8, 30, z) * 0.9);
      if (z < -2) tmp.lerp(cSand, smooth(-1, -6, z));
      if (z < -8) tmp.lerp(new THREE.Color("#cdb98a"), smooth(-8, -22, z));
    }
    if (id === "ice") {
      // 바람에 쓸린 결: 비스듬한 줄무늬로 밝고 어두운 띠를 만든다
      const rip = Math.sin(x * 0.55 + z * 0.22 + fbm(x * 2.2, z * 2.2) * 6) * 0.5 + 0.5;
      tmp.multiplyScalar(0.95 + 0.07 * rip);
      tmp.b += 0.015 * (1 - rip);
    }
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, toon("#ffffff", { vertexColors: true, map: groundTex() }));
  ground.receiveShadow = true;
  group.add(ground);
  }

  // ---- 물 --------------------------------------------------------------
  const waterY = OCEAN ? -6 : -0.2;
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(th.shallow) },
      uMid: { value: new THREE.Color(th.mid) },
      uDeep: { value: new THREE.Color(th.deep) },
      uSky: { value: new THREE.Color(th.skyTop) },
      uRipple: { value: Array.from({ length: RING_COUNT }, () => new THREE.Vector4(0, 0, -10, 0)) },
      uNight: { value: 0 },
      uMode: { value: id === "pier" ? 1 : OCEAN ? 3 : 0 },
      uHull: { value: new THREE.Vector4(CRUISE_HULL.cx, CRUISE_HULL.cz, CRUISE_HULL.hx, CRUISE_HULL.hz) },
      uFogCol: { value: new THREE.Color(th.skyHorizon) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
      uCenter: { value: new THREE.Vector2(LAKE?.cx ?? 0, LAKE?.cz ?? 0) },
      uRadius: { value: LAKE?.r ?? 20 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uSky;
      uniform vec4 uRipple[${RING_COUNT}]; uniform float uNight; uniform float uMode; uniform vec3 uFogCol; uniform vec4 uHull; uniform vec3 uSunDir; uniform vec2 uCenter; uniform float uRadius;
      varying vec3 vWorld;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float wave(vec2 p, float t) {
        return sin(p.x*0.9 + t*1.2) * 0.5 + sin(p.y*1.3 - t*0.9) * 0.5 + sin((p.x+p.y)*0.6 + t*0.7) * 0.5;
      }
      // 얼음 균열: 가장 가까운 두 점의 거리 차이로 갈라진 선을 만든다
      float cracks(vec2 p){
        vec2 g = floor(p); vec2 f = fract(p);
        float d1 = 8.0, d2 = 8.0;
        for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++) {
          vec2 o = vec2(float(x), float(y));
          vec2 r = o + vec2(hash(g+o), hash(g+o+7.0)) - f;
          float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
        }
        return 1.0 - smoothstep(0.0, 0.06, sqrt(d2) - sqrt(d1));
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        float w = wave(p, t);
        vec3 col;
        float alpha = 0.9;
        float foam = 0.0;
        if (uMode < 0.5) {
          float r = distance(p, uCenter) / uRadius;
          float depth = 1.0 - smoothstep(0.35, 1.0, r);
          col = mix(uShallow, uMid, smoothstep(0.0, 0.5, depth));
          col = mix(col, uDeep, smoothstep(0.45, 1.0, depth));
          foam = smoothstep(0.95, 1.0, r) * (0.5 + 0.4 * sin(r * 90.0 - t * 2.0 + noise(p * 2.0) * 6.0));
          alpha = mix(0.72, 0.95, depth) * (1.0 - smoothstep(0.99, 1.05, r));
        } else if (uMode < 1.5) {
          float d = clamp((-6.0 - p.y) / 40.0, 0.0, 1.0);
          col = mix(uShallow, uMid, smoothstep(0.0, 0.25, d));
          col = mix(col, uDeep, smoothstep(0.2, 0.9, d));
          float shore = smoothstep(14.0, 0.0, -6.0 - p.y);
          foam = shore * smoothstep(0.35, 0.85, sin((-6.0 - p.y) * 1.7 - t * 1.6 + noise(p * 0.6) * 5.0) * 0.5 + 0.5) * 0.75;
          foam += smoothstep(0.7, 0.0, abs(p.y + 6.6 - sin(p.x * 0.35 + t) * 0.2));
          alpha = mix(0.7, 0.96, d);
        } else if (uMode < 2.5) {
          float r = distance(p, uCenter) / uRadius;
          col = mix(vec3(0.62, 0.84, 0.95), vec3(0.38, 0.65, 0.86), noise(p * 0.25) * 0.8 + 0.1);
          col = mix(col, vec3(0.28, 0.55, 0.8), noise(p * 0.9 + 4.0) * 0.35);
          float c = cracks(p * 0.35) * 0.55 + cracks(p * 0.9 + 3.0) * 0.28;
          col = mix(col, vec3(0.88, 0.97, 1.0), c);
          col += smoothstep(0.88, 0.95, noise(p * 3.0 + t * 0.1)) * 0.12;
          alpha = 0.97 * (1.0 - smoothstep(0.96, 1.04, r));
          gl_FragColor = vec4(col * mix(1.0, 0.5, uNight), alpha);
          #include <colorspace_fragment>
          return;
        } else {
          // 망망대해: 배 윤곽에서 멀어질수록 깊고 짙은 파랑. 뱃전에는 하얀 물보라
          vec2 q = vec2(abs(p.x - uHull.x) - (uHull.z - uHull.w), abs(p.y - uHull.y));
          float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uHull.w;
          float d = clamp(sd / 70.0, 0.0, 1.0);
          col = mix(uShallow, uMid, smoothstep(0.0, 0.12, d));
          col = mix(col, uDeep, smoothstep(0.08, 0.8, d));
          col += (noise(p * 0.07 + t * 0.03) - 0.5) * 0.07;
          foam = smoothstep(2.6, 0.0, sd) * (0.45 + 0.5 * noise(p * 1.4 - t * 0.7 + sd * 3.0));
          foam += smoothstep(0.82, 0.95, noise(p * 0.8 + t * 0.2) * noise(p * 0.35 - t * 0.1) * 1.9) * 0.1;
          alpha = 0.98;
        }
        // 물결 높이 잡음을 미분해 잔물결 법선을 만든다
        float t1 = t * 0.12;
        vec2 e = vec2(0.1, 0.0);
        float h0 = noise(p * 0.7 + vec2(t1, t1 * 0.6)) * 0.55 + noise(p * 1.6 - vec2(t1 * 0.8, t1 * 1.2)) * 0.3 + noise(p * 3.4 + vec2(t * 0.2, -t * 0.15)) * 0.15;
        float hx = noise((p + e.xy) * 0.7 + vec2(t1, t1 * 0.6)) * 0.55 + noise((p + e.xy) * 1.6 - vec2(t1 * 0.8, t1 * 1.2)) * 0.3 + noise((p + e.xy) * 3.4 + vec2(t * 0.2, -t * 0.15)) * 0.15;
        float hz = noise((p + e.yx) * 0.7 + vec2(t1, t1 * 0.6)) * 0.55 + noise((p + e.yx) * 1.6 - vec2(t1 * 0.8, t1 * 1.2)) * 0.3 + noise((p + e.yx) * 3.4 + vec2(t * 0.2, -t * 0.15)) * 0.15;
        vec3 n = normalize(vec3((h0 - hx) * 3.2, 1.0, (h0 - hz) * 3.2));
        vec3 vd = normalize(cameraPosition - vWorld);
        // 얕은 곳 바닥에 어른거리는 빛무늬
        float cau = pow(noise(p * 1.9 + vec2(t * 0.35, t * 0.2)) * noise(p * 2.3 - vec2(t * 0.25, t * 0.3)) * 2.0, 3.0);
        float shallowK = (uMode > 2.5 ? 0.0 : uMode < 0.5 ? smoothstep(0.55, 0.0, 1.0 - smoothstep(0.35, 1.0, distance(p, uCenter) / uRadius)) : smoothstep(0.35, 0.0, clamp((-6.0 - p.y) / 40.0, 0.0, 1.0)));
        col += cau * 0.22 * shallowK * (1.0 - uNight);
        // 하늘 반사 (수평선에 가까운 색부터 머리 위 색까지) + 프레넬
        vec3 rf = reflect(-vd, n);
        vec3 skyRefl = mix(uFogCol, uSky, pow(clamp(rf.y, 0.0, 1.0), 0.5));
        float fr = pow(1.0 - clamp(dot(n, vd), 0.0, 1.0), 4.0);
        col = mix(col, skyRefl * mix(1.0, 0.3, uNight), clamp(0.08 + fr * 0.75, 0.0, 0.85));
        // 햇빛 반짝임
        vec3 hv = normalize(vd + normalize(uSunDir));
        float spec = pow(max(dot(n, hv), 0.0), 220.0);
        col += vec3(1.0, 0.95, 0.82) * spec * 1.6 * (1.0 - uNight);
        col *= 0.92 + 0.16 * max(dot(n, normalize(uSunDir)), 0.0);
        for (int i = 0; i < ${RING_COUNT}; i++) {
          vec4 rp = uRipple[i];
          float age = uTime - rp.z;
          if (age > 0.0 && age < 2.4) {
            float d = distance(p, rp.xy);
            float ring = smoothstep(0.14, 0.0, abs(d - age * 2.2)) * (1.0 - age / 2.4);
            col += ring * 0.75;
          }
        }
        col = mix(col, vec3(1.0), foam);
        col *= mix(1.0, 0.45, uNight);
        // 멀리 갈수록 하늘색 안개에 녹아든다 (수평선에 띠가 생기지 않게)
        float fd = smoothstep(70.0, 250.0, distance(cameraPosition, vWorld));
        col = mix(col, uFogCol, fd);
        gl_FragColor = vec4(col, mix(max(alpha, foam), 1.0, fd));
        #include <colorspace_fragment>
      }`,
  });
  let water: THREE.Mesh;
  if (OCEAN) {
    water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), waterMat);
    water.position.set(0, waterY, 0);
  } else if (id === "pier") {
    water = new THREE.Mesh(new THREE.PlaneGeometry(800, 520), waterMat);
    water.position.set(0, waterY, -6 - 260);
  } else {
    water = new THREE.Mesh(new THREE.CircleGeometry((LAKE?.r ?? 20) + 1.2, 96), waterMat);
    water.position.set(LAKE?.cx ?? 0, waterY, LAKE?.cz ?? 0);
  }
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 1;
  group.add(water);

  // ---- 인스턴스로 많이 뿌리는 장식 -----------------------------------------
  const dummy = new THREE.Object3D();
  const instanced = (geom: THREE.BufferGeometry, mat: THREE.Material, count: number, fill: (i: number, set: (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry?: number, color?: THREE.ColorRepresentation) => void) => void, shadows = true) => {
    const mesh = new THREE.InstancedMesh(geom, mat, count);
    const col = new THREE.Color();
    let used = 0;
    const set = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, color?: THREE.ColorRepresentation) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(used, dummy.matrix);
      if (color !== undefined) mesh.setColorAt(used, col.set(color));
      used++;
    };
    for (let i = 0; i < count; i++) fill(i, set);
    mesh.count = used;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const walkOK = (x: number, z: number) => map.isWalkable(x, z);
  const inPlay = (x: number, z: number) => Math.abs(x) < 40 && Math.abs(z) < 40;

  const windU = { value: 0 };
  if (!OCEAN) {
  // 풀 다발: 휘어진 풀잎 여러 장을 한 다발로 묶는다. 뿌리는 어둡고 끝은 밝으며 바람에 살랑인다
  const makeTuft = (loC: string, hiC: string, blades: number, hMin: number, hMax: number) => {
    const parts: THREE.BufferGeometry[] = [];
    const lo = new THREE.Color(loC), hi = new THREE.Color(hiC), c = new THREE.Color();
    for (let b = 0; b < blades; b++) {
      const h = hMin + rnd() * (hMax - hMin);
      const w = 0.03 + rnd() * 0.02;
      const bend = 0.1 + rnd() * 0.25;
      const segs = 3;
      const pos: number[] = [], col: number[] = [], idx: number[] = [];
      for (let i = 0; i <= segs; i++) {
        const k = i / segs;
        const half = w * (1 - k * 0.92);
        for (const sgn of [-1, 1]) {
          pos.push(sgn * half, k * h, bend * k * k * h);
          c.copy(lo).lerp(hi, Math.pow(k, 0.8));
          col.push(c.r, c.g, c.b);
        }
        if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.rotateY(rnd() * Math.PI * 2);
      g.translate((rnd() - 0.5) * 0.14, 0, (rnd() - 0.5) * 0.14);
      parts.push(g);
    }
    const m = mergeGeometries(parts)!;
    // 법선을 위로 맞춰 땅과 같은 밝기로 부드럽게 어우러지게 한다
    const nrm = new Float32Array(m.attributes.position.count * 3);
    for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;
    m.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    return m;
  };
  const grassMat = toon("#ffffff", { vertexColors: true, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windU;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n float sway = sin(uWind * 1.6 + instanceMatrix[3].x * 0.45 + instanceMatrix[3].z * 0.3) * position.y * 0.35; transformed.x += sway; transformed.z += sway * 0.5;");
  };
  {
    const tuft = id === "lake" ? makeTuft("#3c8a3e", "#c4ea82", 5, 0.2, 0.45) : id === "pier" ? makeTuft("#7f7344", "#e6da98", 5, 0.2, 0.5) : makeTuft("#6f7566", "#e8ecdf", 4, 0.15, 0.4);
    const tints = id === "lake" ? ["#ffffff", "#e6f4c8", "#d0eaa0", "#f0ffd8"] : id === "pier" ? ["#ffffff", "#f4ecc8", "#e6dcae"] : ["#ffffff", "#f4f8ff"];
    const n = id === "lake" ? 7000 : id === "pier" ? 3500 : 3200;
    instanced(tuft, grassMat, n, (i, set) => {
      const x = (rnd() - 0.5) * 84, z = (rnd() - 0.5) * 84;
      if (!walkOK(x, z)) return;
      if (id === "pier" && z < 2) return;
      if (Math.hypot(x - map.spawn.x, z - map.spawn.z) < 1.0) return;
      // 군데군데 풀이 빈 곳을 둬서 자연스러운 얼룩을 만든다
      if (fbm(x * 0.6 + 9, z * 0.6) < (id === "ice" ? -0.05 : -0.28)) return;
      const sc = 0.7 + rnd() * 0.7;
      set(x, heightAt(x, z) - 0.02, z, sc, sc * (0.8 + rnd() * 0.6), sc, rnd() * 6.28, tints[Math.floor(rnd() * tints.length)]);
    }, false);
    // 낮고 촘촘한 잔디층 (바닥이 비어 보이지 않게)
    if (id !== "ice") {
      const carpet = id === "lake" ? makeTuft("#3a8a40", "#a8dc6a", 3, 0.1, 0.22) : makeTuft("#a39656", "#e4d994", 3, 0.08, 0.18);
      instanced(carpet, grassMat, id === "lake" ? 38000 : 12000, (i, set) => {
        const x = (rnd() - 0.5) * 84, z = (rnd() - 0.5) * 84;
        if (!walkOK(x, z)) return;
        if (id === "pier" && z < 3) return;
        if (Math.hypot(x - map.spawn.x, z - map.spawn.z) < 0.6) return;
        const sc = 0.8 + rnd() * 0.6;
        set(x, heightAt(x, z) - 0.02, z, sc, sc * (0.8 + rnd() * 0.5), sc, rnd() * 6.28, tints[Math.floor(rnd() * tints.length)]);
      }, false);
    }
  }

  // 나무 (줄기+잎을 하나의 인스턴스 메시로 합쳐 그린다)
  const sphereAt = (r: number, x: number, y: number, z: number, sy = 1) => {
    const g = new THREE.SphereGeometry(r, 12, 9);
    g.scale(1, sy, 1);
    g.translate(x, y, z);
    return g;
  };
  const roundCanopy = mergeGeometries([sphereAt(1.5, 0, 0, 0, 0.9), sphereAt(1.05, 0.95, -0.2, 0.2), sphereAt(1.0, -0.9, -0.15, -0.3), sphereAt(0.95, 0.1, 0.75, 0.2), sphereAt(0.85, -0.2, -0.1, 1.0)])!;
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.34, 2.6, 8);
  trunkGeo.translate(0, 1.3, 0);
  // 키 큰 침엽수: 위로 갈수록 좁아지고 아래로 처지는 여러 겹. 꼭짓점 색으로 눈/그늘을 칠한다
  const makeConifer = (snowy: boolean) => {
    const parts: THREE.BufferGeometry[] = [];
    const tiers = 12;
    const cTop = new THREE.Color(snowy ? "#f4f9fd" : "#5f9a68");
    const cMid = new THREE.Color(snowy ? "#dcebf8" : "#4a8a62");
    const cLow = new THREE.Color(snowy ? "#a6bdd6" : "#2f5a4c");
    const c = new THREE.Color();
    for (let i = 0; i < tiers; i++) {
      const k = i / (tiers - 1);
      const r = 1.6 * Math.pow(1 - k, 0.9) + 0.2;
      const hgt = 1.5 + (1 - k) * 0.5;
      const g = new THREE.ConeGeometry(r, hgt, 14, 3);
      const pos = g.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
        const f = (y + hgt / 2) / hgt;
        const ang = Math.atan2(z, x);
        const ragged = 0.28 * Math.sin(ang * 3 + i * 1.7) + 0.16 * Math.sin(ang * 7 + i * 0.9) + 0.09 * Math.sin(ang * 13 + i * 2.3);
        const wob = 1 + (1 - f) * ragged;
        pos.setXYZ(v, x * wob, y - (1 - f) * 0.45 * (0.5 + 0.5 * Math.sin(ang * 5 + i * 2.1)), z * wob);
        c.copy(cLow).lerp(cMid, Math.min(1, f * 2)).lerp(cTop, Math.max(0, f * 2 - 1));
        c.offsetHSL(0, 0, Math.sin(ang * 9 + i * 5) * 0.045);
        col.set([c.r, c.g, c.b], v * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.translate(0, 3.4 + k * 7.2, 0);
      g.computeVertexNormals();
      parts.push(g);
    }
    return mergeGeometries(parts)!;
  };
  const pineTrunk = new THREE.CylinderGeometry(0.14, 0.4, 9, 8);
  pineTrunk.translate(0, 4.5, 0);
  // 잎이 다 떨어진 고사목
  const deadTreeGeo = (() => {
    const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.12, 0.3, 6.5, 6).translate(0, 3.25, 0)];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.CylinderGeometry(0.03, 0.1, 1.9, 5);
      b.translate(0, 0.95, 0);
      b.rotateZ(0.9 * (i % 2 ? 1 : -1));
      b.rotateY(i * 1.3);
      b.translate(0, 2.8 + i * 0.7, 0);
      parts.push(b);
    }
    return mergeGeometries(parts)!;
  })();
  const barkMat = toon(id === "ice" ? "#6a6478" : "#8a6a54", { map: barkTex() });
  const leafMat = toon("#ffffff");
  const coniferMat = toon("#ffffff", { vertexColors: true, map: needleTex() });

  const forest: Array<[number, number, number]> = [];
  const treeCount = id === "ice" ? 230 : id === "pier" ? 70 : 190;
  for (let i = 0, tries = 0; i < treeCount && tries < treeCount * 30; tries++) {
    const side = Math.floor(rnd() * 4);
    const out = 41 + rnd() * 52;
    const along = (rnd() - 0.5) * 190;
    const x = side < 2 ? (side ? out : -out) : along;
    const z = side < 2 ? along : side === 2 ? out : -out;
    if (id === "pier" && z < -4) continue;
    forest.push([x, heightAt(x, z), z]);
    i++;
  }
  // 놀이 구역 안쪽 가장자리에도 숲이 이어지게 (스폰과 호수 주변은 비워 둔다)
  const keepOut: Array<[number, number]> = [[-13, 14], [-24, 3], [9, 22], [-8, 12], [-6, 13], [-22, 28], [11, 4], [-6, 18]];
  for (let i = 0, tries = 0; i < (id === "pier" ? 8 : id === "ice" ? 70 : 34) && tries < 800; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = 25 + rnd() * 15;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (map.isWater(x, z) || (id === "pier" && z < 0)) continue;
    if (Math.hypot(x - map.spawn.x, z - map.spawn.z) < 9) continue;
    if (LAKE && Math.hypot(x - LAKE.cx, z - LAKE.cz) < LAKE.r + 4) continue;
    if (keepOut.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 6)) continue;
    forest.push([x, heightAt(x, z), z]);
    i++;
  }
  const pineFrac = id === "ice" ? 1 : id === "lake" ? 0.55 : 0.35;
  const pines: Array<[number, number, number]> = [];
  const broad: Array<[number, number, number]> = [];
  for (const f of forest) (rnd() < pineFrac ? pines : broad).push(f);
  // 어린 소나무: 놀이 구역 곳곳에 작게 흩어 숲이 이어지는 느낌을 준다
  const saps: Array<[number, number, number]> = [];
  if (id !== "pier") {
    for (let i = 0, tries = 0; i < (id === "ice" ? 70 : 40) && tries < 600; tries++) {
      const x = (rnd() - 0.5) * 80, z = (rnd() - 0.5) * 80;
      if (map.isWater(x, z) || Math.hypot(x - map.spawn.x, z - map.spawn.z) < 7) continue;
      if (LAKE && Math.hypot(x - LAKE.cx, z - LAKE.cz) < LAKE.r + 3) continue;
      if (keepOut.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 4)) continue;
      saps.push([x, heightAt(x, z), z]);
      i++;
    }
  }
  const pineAll = pines.concat(saps);
  const pineTints = id === "ice" ? ["#ffffff", "#f2f8ff", "#e6f0fb"] : ["#ffffff", "#e6f3e0", "#d4ecd6"];
  // 줄기와 잎이 같은 크기·방향을 쓰도록 미리 뽑아 둔다
  const pineLook = pineAll.map((_, i) => ({ s: i < pines.length ? 0.85 + rnd() * 0.65 : 0.28 + rnd() * 0.3, ry: rnd() * 6.28, tint: pineTints[Math.floor(rnd() * pineTints.length)] }));
  instanced(pineTrunk, barkMat, pineAll.length, (i, set) => { const [x, y, z] = pineAll[i]; const { s, ry } = pineLook[i]; set(x, y - 0.1, z, s, s, s, ry); });
  instanced(makeConifer(id === "ice"), coniferMat, pineAll.length, (i, set) => { const [x, y, z] = pineAll[i]; const { s, ry, tint } = pineLook[i]; set(x, y - 0.1, z, s, s, s, ry, tint); });
  if (id === "ice") {
    // 나무 밑동에 쌓인 눈더미
    const moundG = new THREE.SphereGeometry(1, 14, 8);
    instanced(moundG, toon("#e4eef9"), pineAll.length, (i, set) => { const [x, y, z] = pineAll[i]; const { s } = pineLook[i]; set(x, y + 0.05, z, 1.5 * s + 0.3, 0.32 * s + 0.1, 1.5 * s + 0.3, 0); }, false);
  }
  if (id !== "ice") {
    const leafCols = id === "lake" ? ["#3f9a5c", "#4aa564", "#58b06a", "#35885a", "#6cbf6c"] : ["#4f9f5a", "#5fb064", "#6dba66"];
    instanced(trunkGeo, barkMat, broad.length, (i, set) => { const [x, y, z] = broad[i]; const s = 0.9 + rnd() * 0.8; set(x, y - 0.1, z, s, s, s, rnd() * 6.28); });
    instanced(roundCanopy, leafMat, broad.length, (i, set) => { const [x, y, z] = broad[i]; const s = 0.95 + rnd() * 0.85; set(x, y + 3.2 * s, z, s, s, s, rnd() * 6.28, leafCols[Math.floor(rnd() * leafCols.length)]); });
  }
  // 쓰러진 통나무
  if (id !== "pier") {
    const logG = new THREE.CylinderGeometry(0.26, 0.3, 3.2, 8);
    logG.rotateZ(Math.PI / 2);
    const logs: Array<[number, number, number]> = [];
    for (let i = 0, tries = 0; i < 12 && tries < 300; tries++) {
      const x = (rnd() - 0.5) * 78, z = (rnd() - 0.5) * 78;
      if (map.isWater(x, z) || Math.hypot(x - map.spawn.x, z - map.spawn.z) < 8) continue;
      if (LAKE && Math.hypot(x - LAKE.cx, z - LAKE.cz) < LAKE.r + 3) continue;
      if (keepOut.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 4)) continue;
      logs.push([x, heightAt(x, z), z]);
      i++;
    }
    const logRy = logs.map(() => rnd() * 6.28);
    instanced(logG, barkMat, logs.length, (i, set) => { const [x, y, z] = logs[i]; set(x, y + 0.2, z, 1, 1, 1, logRy[i]); });
    if (id === "ice") instanced(logG, toon("#f2f8ff"), logs.length, (i, set) => { const [x, y, z] = logs[i]; set(x, y + 0.36, z, 0.96, 0.55, 0.9, logRy[i]); }, false);
  }
  // 고사목
  const deadSpots: Array<[number, number, number]> = [];
  for (let i = 0, tries = 0; i < (id === "pier" ? 4 : 12) && tries < 200; tries++) {
    const a = rnd() * Math.PI * 2, r = 26 + rnd() * 30;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (map.isWater(x, z) || (id === "pier" && z < 0) || Math.hypot(x - map.spawn.x, z - map.spawn.z) < 9) continue;
    deadSpots.push([x, heightAt(x, z), z]);
    i++;
  }
  instanced(deadTreeGeo, toon(id === "ice" ? "#58525f" : "#6e5a4a"), deadSpots.length, (i, set) => { const [x, y, z] = deadSpots[i]; const s = 0.8 + rnd() * 0.6; set(x, y - 0.1, z, s, s, s, rnd() * 6.28); });

  // 바위
  const rockGeo = roundRockGeo();
  instanced(rockGeo, toon("#ffffff"), 70, (i, set) => {
    const a = rnd() * Math.PI * 2, r = 10 + rnd() * 50;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (map.isWater(x, z) || (id === "pier" && z < -5) || Math.hypot(x - map.spawn.x, z - map.spawn.z) < 4) return;
    const s = 0.5 + rnd() * 1.6;
    set(x, heightAt(x, z) + 0.15 * s, z, s * (1 + rnd() * 0.5), s * (0.6 + rnd() * 0.3), s * (1 + rnd() * 0.5), rnd() * 6, id === "ice" ? ["#7d8cab", "#93a2bd", "#eef6fc"][Math.floor(rnd() * 3)] : id === "pier" ? "#a29d98" : ["#9a96a8", "#85819a", "#b3aec0"][Math.floor(rnd() * 3)]);
  });

  // 숲 가장자리의 큰 바위 (절벽 느낌)
  instanced(rockGeo, toon("#ffffff"), 9, (i, set) => {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.5, r = 46 + rnd() * 14;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (id === "pier" && z < 0) return;
    const s = 3 + rnd() * 3;
    set(x, heightAt(x, z) + 0.7 * s * 0.4, z, s * 1.2, s * 0.8, s, rnd() * 6, id === "ice" ? "#6c7a98" : id === "pier" ? "#8f8a86" : "#7b7790");
  });

  // 덤불
  if (id !== "ice") {
    const bushGeo = mergeGeometries([sphereAt(0.6, 0, 0.35, 0), sphereAt(0.45, 0.5, 0.25, 0.1), sphereAt(0.45, -0.45, 0.25, -0.1)])!;
    instanced(bushGeo, toon("#ffffff"), 90, (i, set) => {
      const x = (rnd() - 0.5) * 90, z = (rnd() - 0.5) * 90;
      if (!walkOK(x, z) || Math.hypot(x - map.spawn.x, z - map.spawn.z) < 3.5 || (id === "pier" && z < 4)) return;
      const s = 0.8 + rnd() * 0.9;
      set(x, heightAt(x, z), z, s, s, s, rnd() * 6, ["#58b066", "#6ec46f", "#4a9e5c"][Math.floor(rnd() * 3)]);
    });
  }

  // 꽃 무리: 가는 줄기 위에 꽃잎 다섯 장과 노란 꽃술
  if (id !== "ice") {
    const petals = ["#ff8fb3", "#ffd45a", "#ffffff", "#b69bff", "#ff9a6b", "#8fd3ff"];
    const centers = Array.from({ length: 34 }, () => [(rnd() - 0.5) * 76, (rnd() - 0.5) * 76, Math.floor(rnd() * petals.length)] as [number, number, number]);
    const fl: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 34 * 14; i++) {
      const c = centers[i % centers.length];
      const x = c[0] + (rnd() - 0.5) * 3.4, z = c[1] + (rnd() - 0.5) * 3.4;
      if (!walkOK(x, z) || (id === "pier" && z < 4)) continue;
      if (Math.hypot(x - map.spawn.x, z - map.spawn.z) < 1.2) continue;
      fl.push([x, z, 0.8 + rnd() * 0.6, (c[2] + (rnd() < 0.2 ? 1 : 0)) % petals.length]);
    }
    const stemG = new THREE.CylinderGeometry(0.01, 0.014, 0.3, 4);
    stemG.translate(0, 0.15, 0);
    const headParts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const pt = new THREE.SphereGeometry(0.045, 6, 5);
      pt.scale(1, 0.45, 1.5);
      pt.rotateY(-a);
      pt.translate(Math.cos(a) * 0.05, 0.31, Math.sin(a) * 0.05);
      headParts.push(pt);
    }
    const headG = mergeGeometries(headParts)!;
    const eyeG = new THREE.SphereGeometry(0.03, 6, 5);
    eyeG.translate(0, 0.32, 0);
    instanced(stemG, toon("#4f9a48"), fl.length, (i, set) => { const [x, z, sc] = fl[i]; set(x, heightAt(x, z), z, 1, sc, 1); }, false);
    instanced(headG, toon("#ffffff"), fl.length, (i, set) => { const [x, z, sc, ci] = fl[i]; set(x, heightAt(x, z) + 0.3 * (sc - 1), z, sc, sc, sc, i, petals[ci]); }, false);
    instanced(eyeG, toon("#ffcf3a"), fl.length, (i, set) => { const [x, z, sc] = fl[i]; set(x, heightAt(x, z) + 0.3 * (sc - 1), z, sc, sc, sc); }, false);
  }

  // 자갈: 호숫가와 풀밭에 흩어진 작은 돌
  {
    const pebG = roundRockGeo();
    pebG.scale(0.2, 0.12, 0.2);
    const pebCols = id === "ice" ? ["#8a97b2", "#a7b3c9", "#eef6fc"] : id === "pier" ? ["#b8b0a4", "#cfc6b6", "#a39c92"] : ["#a9a5b4", "#8e8a9e", "#c4bfce"];
    instanced(pebG, toon("#ffffff"), 420, (i, set) => {
      let x: number, z: number;
      if (LAKE && i % 2 === 0) { const a = rnd() * Math.PI * 2, r = LAKE.r + 0.5 + rnd() * 3; x = LAKE.cx + Math.cos(a) * r; z = LAKE.cz + Math.sin(a) * r; }
      else { x = (rnd() - 0.5) * 80; z = (rnd() - 0.5) * 80; }
      if (map.isWater(x, z) || (id === "pier" && z < -5) || Math.hypot(x - map.spawn.x, z - map.spawn.z) < 1.5) return;
      const sc = 0.5 + rnd() * 1.4;
      set(x, heightAt(x, z) + 0.02, z, sc * (1 + rnd() * 0.5), sc, sc * (1 + rnd() * 0.5), rnd() * 6, pebCols[Math.floor(rnd() * pebCols.length)]);
    }, false);
  }

  // 갈대 (호수 가장자리)
  const reedTops: THREE.Mesh[] = [];
  if (id === "lake" && LAKE) {
    const reedGeo = new THREE.CylinderGeometry(0.025, 0.04, 1.6, 5);
    reedGeo.translate(0, 0.8, 0);
    instanced(reedGeo, toon("#7fae5a"), 220, (i, set) => {
      const a = rnd() * Math.PI * 2;
      const r = LAKE.r + 0.3 + rnd() * 1.6;
      const x = LAKE.cx + Math.cos(a) * r, z = LAKE.cz + Math.sin(a) * r;
      if (Math.abs(a - Math.PI / 2) < 0.35) return; // 낚시 자리 앞은 비워 둔다
      const s = 0.7 + rnd() * 0.9;
      set(x, heightAt(x, z), z, 1, s, 1, 0, ["#7fae5a", "#93bf64", "#6b9c50"][Math.floor(rnd() * 3)]);
    }, false);
    const cat = new THREE.CapsuleGeometry(0.06, 0.28, 4, 8);
    cat.translate(0, 1.75, 0);
    instanced(cat, toon("#6b4a32"), 70, (i, set) => {
      const a = rnd() * Math.PI * 2;
      const r = LAKE.r + 0.4 + rnd() * 1.2;
      if (Math.abs(a - Math.PI / 2) < 0.35) return;
      const x = LAKE.cx + Math.cos(a) * r, z = LAKE.cz + Math.sin(a) * r;
      set(x, heightAt(x, z), z, 1, 0.85 + rnd() * 0.4, 1);
    }, false);
    // 연잎과 연꽃
    const pad = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 14, 1, false, 0.3, Math.PI * 1.85);
    instanced(pad, toon("#4fa860"), 40, (i, set) => {
      const a = rnd() * Math.PI * 2;
      const r = LAKE.r * (0.55 + rnd() * 0.35);
      if (Math.abs(a - Math.PI / 2) < 0.5) return;
      const x = LAKE.cx + Math.cos(a) * r, z = LAKE.cz + Math.sin(a) * r;
      const s = 0.7 + rnd() * 0.8;
      set(x, waterY + 0.03, z, s, 1, s, rnd() * 6);
    }, false);
    const lotus = new THREE.SphereGeometry(0.16, 10, 8);
    lotus.scale(1, 0.8, 1);
    lotus.translate(0, 0.14, 0);
    instanced(lotus, toon("#ffffff"), 16, (i, set) => {
      const a = rnd() * Math.PI * 2;
      const r = LAKE.r * (0.6 + rnd() * 0.3);
      if (Math.abs(a - Math.PI / 2) < 0.5) return;
      set(LAKE.cx + Math.cos(a) * r, waterY + 0.04, LAKE.cz + Math.sin(a) * r, 1, 1, 1, 0, rnd() < 0.5 ? "#ff9fc4" : "#fff4f8");
    }, false);
  }

  }

  // ---- 맵별 건물과 소품 -----------------------------------------------------
  // 속이 보이는 보트용 (양면)
  const bowlMat = (c: string) => { const m = toon(c); (m as THREE.Material).side = THREE.DoubleSide; return m; };
  const lights: THREE.PointLight[] = [];
  const glowMats: THREE.MeshBasicMaterial[] = [];
  const flames: THREE.Mesh[] = [];

  const lantern = (x: number, y: number, z: number, color = 0xffd98a) => {
    const g = new THREE.Group();
    const post = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.2, 14), toon("#6e4a30")), 0.03);
    post.position.y = 1.1;
    const cap = new THREE.Mesh(dome(0.3, 0.22), toon("#4a3b52"));
    cap.position.y = 2.32;
    const m = new THREE.MeshBasicMaterial({ color });
    glowMats.push(m);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), m);
    bulb.position.y = 2.2;
    g.add(post, cap, bulb);
    g.position.set(x, y, z);
    group.add(g);
    return g;
  };

  // 세로 판자를 붙여 만든 벽 하나. 판자마다 색이 조금씩 달라 낡은 느낌이 난다
  const planks = (w: number, h: number, d: number, pal: string[]) => {
    const n = Math.max(2, Math.round(w / 0.32));
    const parts: THREE.BufferGeometry[] = [];
    const cc = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const bw = w / n;
      const hh = h * (0.94 + rnd() * 0.06);
      const g = new THREE.BoxGeometry(bw * 0.94, hh, d);
      g.translate(-w / 2 + bw * (i + 0.5), hh / 2, 0);
      cc.set(pal[Math.floor(rnd() * pal.length)]).offsetHSL(0, 0, (rnd() - 0.5) * 0.04);
      const col = new Float32Array(g.attributes.position.count * 3);
      for (let v = 0; v < col.length; v += 3) { col[v] = cc.r; col[v + 1] = cc.g; col[v + 2] = cc.b; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      parts.push(g);
    }
    return mergeGeometries(parts)!;
  };
  const plankMat = toon("#ffffff", { vertexColors: true, map: woodTex() });
  const snowCap = (w: number, d: number) => new THREE.Mesh(rbox(w, 0.22, d), toon("#f2f8ff"));
  /** 박공지붕 판자 오두막 (앞면이 +z) */
  const woodHut = (w: number, h: number, d: number, rh: number, o: { pal: string[]; roof: string; snow: boolean }) => {
    const g = new THREE.Group();
    const front = new THREE.Mesh(planks(w, h, 0.14, o.pal), plankMat);
    front.position.z = d / 2;
    const back = new THREE.Mesh(planks(w, h, 0.14, o.pal), plankMat);
    back.position.z = -d / 2;
    const sideL = new THREE.Mesh(planks(d, h, 0.14, o.pal), plankMat);
    sideL.rotation.y = Math.PI / 2;
    sideL.position.x = -w / 2;
    const sideR = sideL.clone();
    sideR.position.x = w / 2;
    const tri = new THREE.Shape();
    tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, rh);
    const gableGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
    const gMat = toon(o.pal[0]);
    const gf = new THREE.Mesh(gableGeo, gMat);
    gf.position.set(0, h, d / 2 - 0.06);
    const gb = new THREE.Mesh(gableGeo, gMat);
    gb.position.set(0, h, -d / 2 - 0.06);
    const L = Math.hypot(w / 2, rh) + 0.4;
    const a = Math.atan2(rh, w / 2);
    const roofMat = toon(o.roof);
    for (const sgn of [-1, 1]) {
      const slab = new THREE.Mesh(rbox(L, 0.16, d + 0.6), roofMat);
      slab.rotation.z = -sgn * a;
      slab.position.set(sgn * (w / 4 + 0.05), h + rh / 2 + 0.06, 0);
      slab.castShadow = true;
      g.add(slab);
      if (o.snow) {
        const cap = snowCap(L * 0.98, d + 0.5);
        cap.rotation.z = -sgn * a;
        cap.position.set(sgn * (w / 4 + 0.05), h + rh / 2 + 0.2, 0);
        g.add(cap);
      }
    }
    const door = new THREE.Mesh(rbox(0.9, 1.7, 0.12), toon("#4a3020"));
    door.position.set(-w / 4, 0.85, d / 2 + 0.08);
    const winM = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    glowMats.push(winM);
    const win = new THREE.Mesh(rbox(0.7, 0.7, 0.1), winM);
    win.position.set(w / 4, 1.5, d / 2 + 0.08);
    for (const m of [front, back, sideL, sideR]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(front, back, sideL, sideR, gf, gb, door, win);
    return g;
  };
  /** 한쪽이 열린 간이 창고 (앞이 +z) */
  const leanTo = (w: number, h: number, d: number, pal: string[], snow: boolean) => {
    const g = new THREE.Group();
    const back = new THREE.Mesh(planks(w, h, 0.14, pal), plankMat);
    back.position.z = -d / 2;
    const sideL = new THREE.Mesh(planks(d, h * 0.82, 0.14, pal), plankMat);
    sideL.rotation.y = Math.PI / 2;
    sideL.position.x = -w / 2;
    const sideR = sideL.clone();
    sideR.position.x = w / 2;
    const tilt = 0.2;
    const roof = new THREE.Mesh(rbox(w + 0.6, 0.16, d + 0.7), toon("#5a4540"));
    roof.rotation.x = tilt;
    roof.position.set(0, h + 0.1, 0);
    g.add(back, sideL, sideR, roof);
    if (snow) {
      const cap = snowCap(w + 0.5, d + 0.6);
      cap.rotation.x = tilt;
      cap.position.set(0, h + 0.26, 0);
      g.add(cap);
    }
    for (const m of [back, sideL, sideR, roof]) { m.castShadow = true; m.receiveShadow = true; }
    return g;
  };

  if (id === "lake") {
    // 작은 나무 부두와 보트
    const wood = toon("#b98a5a");
    for (let i = 0; i < 9; i++) {
      const plank = addOutline(new THREE.Mesh(rbox(2.6, 0.14, 0.42), wood), 0.015);
      plank.position.set(0, 0.12, 15 - i * 0.46);
      plank.receiveShadow = true;
      plank.castShadow = true;
      group.add(plank);
    }
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 16), toon("#7a5232"));
      post.position.set(s * 1.25, -0.3, 14.7 - i * 1.1);
      group.add(post);
    }
    const boat = new THREE.Group();
    const hull = addOutline(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bowlMat("#f0a070")), 0.03);
    hull.scale.set(0.8, 0.5, 1.9);
    hull.position.y = 0.32;
    boat.add(hull);
    boat.position.set(-7, waterY + 0.05, 6);
    boat.rotation.y = 0.5;
    group.add(boat);
    (group as any)._boat = boat;
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), toon("#c9a070"));
    oar.rotation.z = Math.PI / 2; oar.position.y = 0.45;
    boat.add(oar);
    lantern(-1.4, 0.1, 15.4);
    const dockLight = new THREE.PointLight(0xffc977, 0, 16, 1.6);
    dockLight.position.set(-1.4, 2.4, 15.4);
    lights.push(dockLight);
    // 낡은 판자 오두막
    const cabin = woodHut(5, 3.2, 4, 1.8, { pal: ["#8a5a40", "#7b4e38", "#9a6a4a"], roof: "#5a3f3a", snow: false });
    cabin.position.set(-22, heightAt(-22, 28), 28);
    cabin.rotation.y = 0.5;
    group.add(cabin);
  }

  if (id === "pier") {
    const wood = toon("#b98a5a");
    const y0 = 0.05;
    for (let z = -4.5; z > -22; z -= 0.55) {
      const plank = addOutline(new THREE.Mesh(rbox(4.2, 0.18, 0.5), wood), 0.015);
      plank.position.set(0, y0, z);
      plank.receiveShadow = true;
      plank.castShadow = true;
      group.add(plank);
    }
    for (let z = -6; z > -22; z -= 3.2) for (const s of [-1, 1]) {
      const post = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.4, 16), toon("#8a5f3a")), 0.03);
      post.position.set(s * 2.0, -1.0, z);
      group.add(post);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5), toon("#e6d3a8"));
      rope.rotation.x = Math.PI / 2;
      rope.position.set(s * 2.0, 0.65, z - 1.6);
      group.add(rope);
    }
    for (let z = -6; z > -20; z -= 6.4) for (const s of [-1, 1]) lantern(s * 2.0, 0.1, z);
    const pl = new THREE.PointLight(0xffc977, 0, 22, 1.5);
    pl.position.set(0, 2.4, -14);
    lights.push(pl);
    // 바닷바람에 바랜 판자 창고
    const shed = woodHut(5, 3.2, 4, 1.5, { pal: ["#8a9aa0", "#7a8a92", "#9aa8ac", "#6f7f88"], roof: "#8a4b3a", snow: false });
    shed.position.set(11, heightAt(11, 4), 4);
    shed.rotation.y = -0.15;
    group.add(shed);
    for (let i = 0; i < 6; i++) {
      const barrel = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.9, 24), toon("#a8754a")), 0.03);
      barrel.position.set(5 + (i % 3) * 0.95, 0.45, 7 + Math.floor(i / 3) * 1.0);
      barrel.castShadow = true;
      group.add(barrel);
    }
    for (const [x, z, ry] of [[-11, -12, 0.3], [-18, -16, -0.2]] as number[][]) {
      const boat = addOutline(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bowlMat("#6fa0dc")), 0.03);
      boat.scale.set(0.9, 0.55, 2.2);
      boat.rotation.set(0, ry, 0);
      boat.position.set(x, waterY + 0.3, z);
      group.add(boat);
    }
    // 갈매기
    const gulls: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1.1, 0.15, -0.35), new THREE.Vector3(-1.1, 0.0, 0.25)]);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const l = new THREE.Mesh(wingGeo, mat);
      const r = new THREE.Mesh(wingGeo.clone().scale(-1, 1, 1), mat);
      r.geometry.index = null;
      g.add(l, r, new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat));
      g.userData = { l, r, a: rnd() * 6.28, rad: 14 + rnd() * 20, h: 12 + rnd() * 8, sp: 0.25 + rnd() * 0.2 };
      group.add(g);
      gulls.push(g);
    }
    (group as any)._gulls = gulls;
  }

  if (id === "ice") {
    const hut = woodHut(3.8, 2.5, 3.2, 1.4, { pal: ["#7b4e38", "#6a4030", "#8a5a40"], roof: "#4e3a36", snow: true });
    const chimney = new THREE.Mesh(rbox(0.5, 1.2, 0.5), toon("#6a6470"));
    chimney.position.set(-1.0, 3.4, -0.6);
    hut.add(chimney);
    // 벽에 기댄 장작더미
    const firewood = new THREE.MeshStandardMaterial({ color: "#9a7650", roughness: 1, map: barkTex() });
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4 - row; col++) {
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.2, 8), firewood);
      lg.rotation.x = Math.PI / 2;
      lg.position.set(2.25 + (rnd() - 0.5) * 0.04, 0.14 + row * 0.25, -0.75 + col * 0.3 + row * 0.15);
      hut.add(lg);
    }
    hut.position.set(-13, heightAt(-13, 14), 14);
    hut.rotation.y = 0.4;
    group.add(hut);
    // 굴뚝 연기
    hut.updateMatrixWorld(true);
    const smokeBase = chimney.getWorldPosition(new THREE.Vector3());
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xe6ecf4, transparent: true, opacity: 0.5, depthWrite: false });
    const puffs: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const pf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), smokeMat.clone());
      pf.userData.ph = i / 8;
      group.add(pf);
      puffs.push(pf);
    }
    (group as any)._smoke = { puffs, base: smokeBase };
    // 한쪽이 열린 간이 창고
    const shelter = leanTo(3.6, 2.4, 2.6, ["#7b4e38", "#6a4030", "#5e3a2c"], true);
    shelter.position.set(-24, heightAt(-24, 3), 3);
    shelter.rotation.y = 0.9;
    group.add(shelter);
    // 모닥불
    const fy = heightAt(-8, 12);
    const fire = new THREE.PointLight(0xffa24a, 0, 16, 1.4);
    fire.position.set(-8, 1.2, 12);
    lights.push(fire);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const log = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.75, 6, 12), toon("#6e4a30"));
      log.position.set(-8 + Math.cos(a) * 0.4, 0.2 + fy, 12 + Math.sin(a) * 0.4);
      log.rotation.set(Math.PI / 2 - 0.5, 0, a);
      group.add(log);
    }
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.05, 0.9 - i * 0.2, 7), new THREE.MeshBasicMaterial({ color: [0xff7a2a, 0xffa24a, 0xffd36a][i] }));
      flame.position.set(-8, 0.5 + fy + i * 0.05, 12);
      group.add(flame);
      flames.push(flame);
    }
    // 눈사람
    const sm = new THREE.Group();
    for (const [y, r] of [[0.55, 0.6], [1.35, 0.45], [2.0, 0.32]] as number[][]) {
      const s = addOutline(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), toon("#ffffff")), 0.03);
      s.position.y = y;
      sm.add(s);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), toon("#ff8a3a"));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 2.0, 0.34);
    sm.add(nose);
    sm.position.set(9, heightAt(9, 22), 22);
    sm.rotation.y = -0.7;
    group.add(sm);
    // 호수에 떠 있는 얼음 조각들 (천천히 흔들린다)
    const floeGeo = new THREE.CylinderGeometry(1, 1, 0.18, 24);
    floeGeo.translate(0, 0.02, 0);
    const floes: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 4 + rnd() * 15;
      if (Math.abs(a - Math.PI / 2) < 0.4 && r > 14) continue;
      const f = new THREE.Mesh(floeGeo, toon("#f3fbff"));
      const sc = 0.9 + rnd() * 1.8;
      f.scale.set(sc, 1, sc * (0.7 + rnd() * 0.4));
      f.position.set(Math.cos(a) * r, waterY + 0.02, -5 + Math.sin(a) * r);
      f.rotation.y = rnd() * 6;
      f.userData.p = rnd() * 6;
      f.receiveShadow = true;
      f.castShadow = true;
      group.add(f);
      floes.push(f);
    }
    (group as any)._floes = floes;
  }

  // ---- 낚시 스팟 표시 (바닥 고리 + 떠 있는 화살표) ---------------------------------
  const spotArrows: THREE.Mesh[] = [];
  const spotRings: THREE.Mesh[] = [];
  const fishSpot = (x: number, y: number, z: number) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 8, 40), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.85 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + 0.04, z);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffd45a }));
    arrow.rotation.x = Math.PI;
    arrow.position.set(x, y + 1.8, z);
    arrow.userData.y = y + 1.8;
    group.add(ring, arrow);
    spotRings.push(ring);
    spotArrows.push(arrow);
  };
  const signBoard = (x: number, y: number, z: number, ry: number, color = "#e8c9a0") => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 10), toon("#8a5f3a"));
    post.position.y = 0.75;
    const board = new THREE.Mesh(rbox(1.1, 0.7, 0.1), toon(color));
    board.position.y = 1.5;
    const fish = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), toon("#6fa8dc"));
    fish.scale.set(1.4, 0.8, 0.4);
    fish.position.set(0, 1.5, 0.08);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 3), toon("#6fa8dc"));
    tail.rotation.z = Math.PI / 2;
    tail.position.set(0.3, 1.5, 0.08);
    g.add(post, board, fish, tail);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    group.add(g);
  };
  const benchAt = (x: number, y: number, z: number, ry: number) => {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(rbox(1.8, 0.14, 0.5), toon("#b98a5a"));
    seat.position.y = 0.5;
    const back = new THREE.Mesh(rbox(1.8, 0.4, 0.1), toon("#b98a5a"));
    back.position.set(0, 0.85, -0.22);
    for (const s of [-0.7, 0.7]) {
      const l = new THREE.Mesh(rbox(0.12, 0.5, 0.4), toon("#8a5f3a"));
      l.position.set(s, 0.25, 0);
      g.add(l);
    }
    g.add(seat, back);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    seat.castShadow = true;
    group.add(g);
  };
  const onGround = (x: number, z: number) => heightAt(x, z);

  if (id === "lake") {
    fishSpot(0, 0.2, 11.6);
    signBoard(2.6, onGround(2.6, 16.5), 16.5, -0.3);
    benchAt(-6, onGround(-6, 18), 18, Math.PI + 0.15);
    // 버섯 무리
    const stemG = new THREE.CylinderGeometry(0.07, 0.09, 0.28, 8);
    stemG.translate(0, 0.14, 0);
    const capG = dome(0.2, 0.16);
    capG.translate(0, 0.27, 0);
    const mush: Array<[number, number, number]> = [];
    for (let k = 0; k < 14; k++) {
      const cx = (rnd() - 0.5) * 70, cz = (rnd() - 0.5) * 70;
      if (!walkOK(cx, cz) || Math.hypot(cx - map.spawn.x, cz - map.spawn.z) < 5) continue;
      for (let j = 0; j < 3; j++) mush.push([cx + (rnd() - 0.5) * 1.2, cz + (rnd() - 0.5) * 1.2, 0.8 + rnd() * 0.7]);
    }
    instanced(stemG, toon("#fff4e0"), mush.length, (i, set) => { const [x, z, s] = mush[i]; set(x, heightAt(x, z), z, s, s, s); }, false);
    instanced(capG, toon("#ffffff"), mush.length, (i, set) => { const [x, z, s] = mush[i]; set(x, heightAt(x, z), z, s, s, s, 0, ["#ff8f9f", "#ffb36b", "#d9a6ff"][i % 3]); }, false);
    // 징검돌
    const stepG = new THREE.CylinderGeometry(0.45, 0.5, 0.14, 12);
    instanced(stepG, toon("#ffffff"), 6, (i, set) => { const x = -3 + i * 1.1 + rnd() * 0.3, z = 24 + Math.sin(i * 1.7) * 0.8; set(x, heightAt(x, z) + 0.02, z, 1, 1, 1, 0, "#d9d4c8"); });
  }

  if (id === "pier") {
    fishSpot(0, 0.2, -19.4);
    signBoard(2.8, onGround(2.8, -3.6), -3.6, 0.2, "#fff1c9");
    // 비치 파라솔과 수건
    const um = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.3, 8), toon("#f4efe6"));
    pole.position.y = 1.15;
    const top = new THREE.Mesh(dome(1.5, 0.7), toon("#ff9bb3"));
    top.position.y = 2.2;
    const towel = new THREE.Mesh(rbox(1.2, 0.05, 2.0), toon("#8fd3ff"));
    towel.position.set(0.3, 0.03, 0.2);
    um.add(pole, top, towel);
    um.position.set(-7, onGround(-7, 4), 4);
    um.rotation.set(0, 0.6, 0.12);
    group.add(um);
    // 상자 더미와 부표
    const crateMat = toon("#c99a64");
    for (const [x, y, z, ry] of [[7.2, 0.35, 10.2, 0.2], [8.2, 0.35, 10.0, -0.1], [7.7, 1.05, 10.1, 0.3]] as number[][]) {
      const c = new THREE.Mesh(rbox(0.85, 0.7, 0.85), crateMat);
      c.position.set(x, y, z);
      c.rotation.y = ry;
      c.castShadow = true;
      group.add(c);
    }
    for (const [x, z, c] of [[4.2, 3, "#ff7f8f"], [4.9, 3.6, "#ffffff"], [-3, 6, "#ff7f8f"]] as Array<[number, number, string]>) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), toon(c));
      b.position.set(x, onGround(x, z) + 0.28, z);
      group.add(b);
    }
    // 조개
    const shellG = new THREE.SphereGeometry(0.14, 8, 6);
    shellG.scale(1, 0.4, 1);
    instanced(shellG, toon("#ffffff"), 70, (i, set) => {
      const x = (rnd() - 0.5) * 70, z = -4 + rnd() * 30;
      if (Math.hypot(x - map.spawn.x, z - map.spawn.z) < 1.5) return;
      const s = 0.7 + rnd() * 0.9;
      set(x, heightAt(x, z) + 0.02, z, s, 1, s, rnd() * 6, ["#ffd0dc", "#fff4e8", "#ffc79a", "#ffb0c0"][i % 4]);
    }, false);
  }

  if (id === "ice") {
    const smY = heightAt(9, 22);
    fishSpot(0, onGround(0, 16.3) + 0.05, 16.3);
    signBoard(2.8, onGround(2.8, 18), 18, -0.25, "#e8f4ff");
    benchAt(-6, onGround(-6, 13), 13, Math.PI / 2 + 0.2);
    // 얼음 낚시 구멍
    for (const [x, z] of [[-3.5, 12.5], [4, 11.5], [0.5, 8.5]] as number[][]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.04, 20), new THREE.MeshBasicMaterial({ color: 0x3f78b0 }));
      hole.position.set(x, waterY + 0.06, z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 24), toon("#ffffff"));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, waterY + 0.07, z);
      group.add(hole, rim);
    }
    // 눈사람 모자와 목도리
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 12), toon("#5a4f7a"));
    hat.position.set(9, 2.45 + smY, 22);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 14), toon("#5a4f7a"));
    brim.position.set(9, 2.3 + smY, 22);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 8, 16), toon("#ff8fa0"));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.set(9, 1.72 + smY, 22);
    group.add(hat, brim, scarf);
    // 선물 상자
    for (const [x, z, c] of [[-10.5, 11, "#ff9fb4"], [-9.6, 11.8, "#9fd8ff"]] as Array<[number, number, string]>) {
      const b = new THREE.Mesh(rbox(0.6, 0.5, 0.6), toon(c));
      b.position.set(x, onGround(x, z) + 0.2, z);
      b.castShadow = true;
      group.add(b);
    }
  }

  // ---- 크루즈선: 바다 한가운데 큰 배의 갑판 파티 ---------------------------------------
  const partyMats: THREE.MeshBasicMaterial[] = [];
  if (id === "cruise") {
    const H = CRUISE_HULL;
    const R = H.hz;
    const sx = H.hx - R;
    const PARTY = ["#ff6fa8", "#7fd8ff", "#ffd45a", "#b48cff", "#7dffb0", "#ff9a6b"];
    // 윤곽 위의 점들 (직선 + 양 끝 반원). nx,nz는 바깥쪽 방향
    const loop = (inset: number, step: number) => {
      const r = R - inset, L1 = 2 * sx, L2 = Math.PI * r, Lt = 2 * L1 + 2 * L2, n = Math.round(Lt / step);
      const out: Array<{ x: number; z: number; nx: number; nz: number }> = [];
      for (let i = 0; i < n; i++) {
        let u = (i / n) * Lt;
        if (u < L1) { out.push({ x: H.cx - sx + u, z: H.cz - r, nx: 0, nz: -1 }); continue; }
        u -= L1;
        if (u < L2) { const a = -Math.PI / 2 + u / r; out.push({ x: H.cx + sx + Math.cos(a) * r, z: H.cz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }); continue; }
        u -= L2;
        if (u < L1) { out.push({ x: H.cx + sx - u, z: H.cz + r, nx: 0, nz: 1 }); continue; }
        u -= L1;
        const a = Math.PI / 2 + u / r;
        out.push({ x: H.cx - sx + Math.cos(a) * r, z: H.cz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) });
      }
      return out;
    };
    // 선체: 윗면은 나무 갑판, 옆면은 흰색. 남색 띠와 금색 선, 붉은 바닥을 덧댄다
    const outline = new THREE.Shape();
    outline.moveTo(H.cx - sx, H.cz - R);
    outline.lineTo(H.cx + sx, H.cz - R);
    outline.absarc(H.cx + sx, H.cz, R, -Math.PI / 2, Math.PI / 2, false);
    outline.lineTo(H.cx - sx, H.cz + R);
    outline.absarc(H.cx - sx, H.cz, R, Math.PI / 2, Math.PI * 1.5, false);
    const hullGeo = (depth: number) => { const g = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: false, curveSegments: 40 }); g.rotateX(Math.PI / 2); return g; };
    const deckTex = woodTex();
    deckTex.repeat.set(0.3, 0.3);
    deckTex.center.set(0.5, 0.5);
    deckTex.rotation = Math.PI / 2;
    const hull = new THREE.Mesh(hullGeo(5), [toon("#c9a070", { map: deckTex }), toon("#f4f6fa")]);
    hull.receiveShadow = true;
    group.add(hull);
    const band = (y: number, depth: number, color: string, k: number) => {
      const m = new THREE.Mesh(hullGeo(depth), toon(color));
      m.scale.set(k, 1, k);
      m.position.set(H.cx * (1 - k), y, H.cz * (1 - k));
      group.add(m);
    };
    band(-1.0, 0.7, "#2a4a86", 1.004);
    band(-0.1, 0.12, "#e8c25a", 1.005);
    band(-5, 3.2, "#b8423e", 1.004);

    // 난간: 기둥과 가로대 두 줄
    const railMat = toon("#f4f6fa");
    const railPts = loop(0.45, 2.4);
    for (const [y, rad] of [[1.1, 0.05], [0.55, 0.03]] as number[][]) {
      const curve = new THREE.CatmullRomCurve3(railPts.map((p) => new THREE.Vector3(p.x, y, p.z)), true);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, railPts.length * 2, rad, 6, true), railMat));
    }
    const postG = new THREE.CylinderGeometry(0.045, 0.05, 1.1, 6);
    postG.translate(0, 0.55, 0);
    const posts = loop(0.45, 1.8);
    instanced(postG, railMat, posts.length, (i, set) => { set(posts[i].x, 0, posts[i].z, 1, 1, 1); }, false);
    // 불 켜진 둥근 창
    const portG = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 14);
    portG.rotateX(Math.PI / 2);
    const portMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    glowMats.push(portMat);
    const ports = loop(0, 2.4);
    instanced(portG, portMat, ports.length, (i, set) => { const p = ports[i]; set(p.x + p.nx * 0.02, -2.7, p.z + p.nz * 0.02, 1, 1, 1, Math.atan2(p.nx, p.nz)); }, false);
    // 구명 튜브
    for (const x of [-20, -6, 10, 22]) {
      const lb = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 8, 18), toon("#e5473f"));
      lb.position.set(x, 0.75, -11.75);
      group.add(lb);
    }

    // 선실 건물: 3단으로 쌓고 앞면에 불 켜진 창 줄을 단다
    const white = toon("#f6f8fb"), trim = toon("#cfd6e2");
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    partyMats.push(winMat);
    const winG = new THREE.BoxGeometry(1.2, 0.9, 0.08);
    const tier = (x0: number, x1: number, z0: number, z1: number, y0: number, h: number) => {
      const m = new THREE.Mesh(rbox(x1 - x0, h, z1 - z0), white);
      m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      const roof = new THREE.Mesh(rbox(x1 - x0 + 0.6, 0.22, z1 - z0 + 0.6), trim);
      roof.position.set(m.position.x, y0 + h + 0.11, m.position.z);
      roof.castShadow = true;
      group.add(m, roof);
      const xs: number[] = [];
      for (let x = x0 + 1.2; x < x1 - 0.8; x += 1.9) xs.push(x);
      instanced(winG, winMat, xs.length * 2, (i, set) => { set(xs[i % xs.length], y0 + (i < xs.length ? 1.0 : 2.5), z0 - 0.02, 1, 1, 1); }, false);
    };
    tier(-22, 22, 6.2, 15.2, 0, 3.6);
    tier(-18, 18, 8, 14.6, 3.82, 3.4);
    tier(-12, 12, 9.5, 14.2, 7.44, 3.2);
    // 굴뚝 두 개
    for (const fx of [-7, 7]) {
      const parts: Array<[number, number, string, number]> = [[5, 2.5, "#f2d9a0", 1.9], [0.5, 3.45, "#c0392b", 1.78], [1.1, 4.55, "#2a2a30", 1.72]];
      for (const [hgt, y, col, rad] of parts) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.92, rad, hgt, 20), toon(col));
        c.scale.z = 1.25;
        c.position.set(fx, 10.87 + y, 11.8);
        c.castShadow = true;
        group.add(c);
      }
    }
    // 구명보트 줄
    const boatG = rbox(3.2, 0.9, 1.1);
    const coverG = rbox(3.0, 0.25, 0.9);
    const bx: number[] = [];
    for (let x = -16; x <= 16; x += 4) bx.push(x);
    instanced(boatG, toon("#f08a3c"), bx.length, (i, set) => { set(bx[i], 4.32, 7.3, 1, 1, 1); });
    instanced(coverG, toon("#ffffff"), bx.length, (i, set) => { set(bx[i], 4.85, 7.3, 1, 1, 1); }, false);

    // 무대: 밴드 자리, LED 화면, 조명 트러스
    const stageG = new THREE.Group();
    stageG.position.set(-29.5, 0, -1);
    const plat = new THREE.Mesh(rbox(7.4, 0.9, 8.4), toon("#3b3550"));
    plat.position.y = 0.45;
    plat.receiveShadow = true;
    const edge = new THREE.Mesh(rbox(7.5, 0.1, 8.5), toon("#ff5fa8"));
    edge.position.y = 0.9;
    const back = new THREE.Mesh(rbox(0.3, 4.4, 7.4), toon("#26233a"));
    back.position.set(-3.6, 3.1, 0);
    const led = paintTex(256, [1, 1], (g, n) => {
      const gr = g.createLinearGradient(0, 0, n, n);
      gr.addColorStop(0, "#ff4fa0"); gr.addColorStop(0.5, "#7a5cff"); gr.addColorStop(1, "#27c8ff");
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
      g.fillStyle = "rgba(255,255,255,0.9)"; g.font = "bold 58px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("SEA", n / 2, n * 0.36); g.fillText("PARTY", n / 2, n * 0.64);
    });
    const ledMat = new THREE.MeshBasicMaterial({ map: led });
    partyMats.push(ledMat);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.8), ledMat);
    screen.rotation.y = Math.PI / 2;
    screen.position.set(-3.4, 3.0, 0);
    stageG.add(plat, edge, back, screen);
    for (const sz of [-3.7, 3.7]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.8, 8), toon("#9aa0b4"));
      pole.position.set(3.2, 2.4, sz);
      const spk = new THREE.Mesh(rbox(0.9, 1.5, 0.9), toon("#23202e"));
      spk.position.set(2.7, 1.65, sz * 0.82);
      stageG.add(pole, spk);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.6, 8), toon("#9aa0b4"));
    beam.rotation.x = Math.PI / 2;
    beam.position.set(3.2, 4.8, 0);
    stageG.add(beam);
    PARTY.slice(0, 5).forEach((c, k) => {
      const m = new THREE.MeshBasicMaterial({ color: c });
      partyMats.push(m);
      const spot = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 10), m);
      spot.position.set(3.2, 4.45, -3 + k * 1.5);
      spot.rotation.z = Math.PI / 2 - 0.5;
      stageG.add(spot);
    });
    // 드럼과 키보드
    const drumM = toon("#e5473f");
    for (const [dx, dz, r] of [[-1.2, 0, 0.55], [-0.6, -1.0, 0.36], [-0.6, 1.0, 0.36], [0.3, -1.6, 0.3]] as number[][]) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.45, 18), drumM);
      d.position.set(dx, 1.15, dz);
      stageG.add(d);
    }
    const keys = new THREE.Mesh(rbox(0.7, 0.1, 2.2), toon("#f4f6fa"));
    keys.position.set(-0.2, 1.5, 2.6);
    const keyStand = new THREE.Mesh(rbox(0.5, 0.6, 2.0), toon("#23202e"));
    keyStand.position.set(-0.2, 1.2, 2.6);
    stageG.add(keys, keyStand);
    group.add(stageG);
    const stageL = new THREE.PointLight(0xff7ad9, 0, 26, 1.5);
    stageL.position.set(-26, 4.2, -1);
    lights.push(stageL);

    // 댄스 플로어: 색색의 타일과 천장의 미러볼
    const tileG = new THREE.BoxGeometry(1.3, 0.05, 1.3);
    const tiles: Array<[number, number]> = [];
    for (let x = -11.5; x <= 3.6; x += 1.4) for (let z = -8.8; z <= -1; z += 1.4) tiles.push([x, z]);
    const tileMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    partyMats.push(tileMat);
    instanced(tileG, tileMat, tiles.length, (i, set) => { set(tiles[i][0], 0.03, tiles[i][1], 1, 1, 1, 0, ["#8fdcff", "#ffc0d9"][(i + Math.floor(i / 6)) % 2]); }, false);
    const disco = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 2), new THREE.MeshStandardMaterial({ color: "#dfe8ff", metalness: 0.9, roughness: 0.15, emissive: "#8890c0", emissiveIntensity: 0.5, flatShading: true }));
    disco.position.set(-4, 5.4, -5);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 4), toon("#555"));
    rod.position.set(-4, 7, -5);
    group.add(disco, rod);

    // 탁자와 의자
    const tableSpots: Array<[number, number]> = [[-19, -9.5], [-19, -4.5], [-19, 0.5], [8, -9.5], [8, -4.5], [8, 0.5]];
    instanced(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 20), toon("#ffffff"), tableSpots.length, (i, set) => { set(tableSpots[i][0], 0.95, tableSpots[i][1], 1, 1, 1); });
    const pedG = new THREE.CylinderGeometry(0.08, 0.12, 0.95, 8);
    pedG.translate(0, 0.475, 0);
    instanced(pedG, toon("#3b3550"), tableSpots.length, (i, set) => { set(tableSpots[i][0], 0, tableSpots[i][1], 1, 1, 1); }, false);
    const candleMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    glowMats.push(candleMat);
    instanced(new THREE.SphereGeometry(0.07, 8, 6), candleMat, tableSpots.length, (i, set) => { set(tableSpots[i][0], 1.05, tableSpots[i][1], 1, 1, 1); }, false);
    const chairG = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10);
    chairG.translate(0, 0.25, 0);
    instanced(chairG, toon("#ffffff"), tableSpots.length * 4, (i, set) => {
      const [tx, tz] = tableSpots[Math.floor(i / 4)];
      const a = (i % 4) * (Math.PI / 2) + 0.4;
      set(tx + Math.cos(a) * 1.1, 0, tz + Math.sin(a) * 1.1, 1, 1, 1, 0, PARTY[i % PARTY.length]);
    }, false);

    // 바: 선실 벽에 붙은 카운터, 술병 선반, 의자
    const counter = new THREE.Mesh(rbox(16, 1.1, 1.6), toon("#6a4430"));
    counter.position.set(1, 0.55, 4.7);
    counter.castShadow = true;
    const counterTop = new THREE.Mesh(rbox(16.3, 0.12, 1.9), toon("#f4f6fa"));
    counterTop.position.set(1, 1.14, 4.7);
    group.add(counter, counterTop);
    const bottleG = new THREE.CylinderGeometry(0.07, 0.09, 0.5, 8);
    bottleG.translate(0, 0.25, 0);
    instanced(bottleG, toon("#ffffff"), 14, (i, set) => { set(-5.5 + i * 1.05, 1.2, 4.4, 1, 1, 1, 0, PARTY[i % PARTY.length]); }, false);
    const stoolG = new THREE.CylinderGeometry(0.24, 0.2, 0.75, 10);
    stoolG.translate(0, 0.375, 0);
    instanced(stoolG, toon("#c0392b"), 6, (i, set) => { set(-4 + i * 2.2, 0, 3.3, 1, 1, 1); }, false);

    // 수영장과 선베드, 파라솔
    const poolRim = toon("#f4f6fa");
    for (const [w, d, px, pz] of [[10.6, 0.5, 17, -6.25], [10.6, 0.5, 17, 2.25], [0.5, 8.6, 11.75, -2], [0.5, 8.6, 22.25, -2]] as number[][]) {
      const r = new THREE.Mesh(rbox(w, 0.38, d), poolRim);
      r.position.set(px, 0.19, pz);
      group.add(r);
    }
    const poolMat = new THREE.MeshStandardMaterial({ color: "#43d3e8", emissive: "#1aa6c8", emissiveIntensity: 0.5, roughness: 0.1, transparent: true, opacity: 0.92 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(17, 0.2, -2);
    group.add(pool);
    const poolL = new THREE.PointLight(0x5ad8ff, 0, 18, 1.6);
    poolL.position.set(17, 1.6, -2);
    lights.push(poolL);
    const loungerG = mergeGeometries([rbox(0.8, 0.14, 1.5).translate(0, 0.28, 0.2), rbox(0.8, 0.14, 0.9).rotateX(0.9).translate(0, 0.55, -0.85)])!;
    instanced(loungerG, toon("#ffffff"), 6, (i, set) => { set(12.6 + i * 1.75, 0, -9.2, 1, 1, 1, 0, ["#ffffff", "#fff1c9", "#cdeaff"][i % 3]); });
    for (const [ux, col] of [[13.5, "#ff9bb3"], [17.2, "#ffd45a"], [20.8, "#8fd3ff"]] as Array<[number, string]>) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.3, 8), toon("#f4efe6"));
      pole.position.set(ux, 1.15, -10.2);
      const top = new THREE.Mesh(dome(1.4, 0.65), toon(col));
      top.position.set(ux, 2.2, -10.2);
      top.castShadow = true;
      group.add(pole, top);
    }

    // 전구 줄: 갑판을 가로질러 늘어뜨린 파티 조명
    const bulbG = new THREE.SphereGeometry(0.13, 8, 6);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    partyMats.push(bulbMat);
    const strings = [-18, -8, 2, 12];
    const bulbs: Array<[number, number, number]> = [];
    for (const sx2 of strings) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 18; k++) {
        const u = k / 18, z = -11.5 + u * 17.7, y = 3.6 - 0.9 * Math.sin(Math.PI * u);
        pts.push(new THREE.Vector3(sx2, y, z));
        if (k % 1 === 0 && k > 0 && k < 18) bulbs.push([sx2, y - 0.1, z]);
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x555566 })));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.6, 8), toon("#f4f6fa"));
      pole.position.set(sx2, 1.8, -11.5);
      group.add(pole);
    }
    instanced(bulbG, bulbMat, bulbs.length, (i, set) => { set(bulbs[i][0], bulbs[i][1], bulbs[i][2], 1, 1, 1, 0, PARTY[i % PARTY.length]); }, false);

    // 낚시 자리 표시 (난간 앞)
    for (const x of [-16, -4, 6]) fishSpot(x, 0.0, -10.6);
    fishSpot(34, 0.0, 2);

    // 밤하늘 불꽃놀이: 4발이 동시에 돌아가며 매번 다른 모양·색·자리로 터진다 (점 480개 상한)
    const sparkTex = paintTex(64, [1, 1], (g, n) => {
      const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = "#000"; g.fillRect(0, 0, n, n); g.fillStyle = gr; g.fillRect(0, 0, n, n);
    });
    const fw: Firework[] = Array.from({ length: 4 }, () => {
      const N = 120;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
      const col = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
      g.setAttribute("color", col);
      const m = new THREE.PointsMaterial({ vertexColors: true, map: sparkTex, size: 16, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      // 바다(renderOrder 1)보다 나중에 그려야 수평선 아래로만 가려져 자연스럽게 사라진다
      pts.renderOrder = 2;
      group.add(pts);
      // t0를 아주 먼 과거로 두면 첫 갱신에서 바로 새로 뽑힌다
      return { g, m, col, dirs: new Float32Array(N * 3), N, x: 0, y: 12, z: -45, t0: -1e9, dur: 1, rf: 8, sf: 2 };
    });
    // 갈매기: 낮에만 배 둘레를 크게 돈다 (최대 8마리, 날개 모양은 한 번만 만들어 함께 쓴다)
    const gullWing = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1.1, 0.15, -0.35), new THREE.Vector3(-1.1, 0.0, 0.25)]);
    const gullWingR = gullWing.clone().scale(-1, 1, 1);
    const gullBody = new THREE.SphereGeometry(0.18, 8, 6);
    const gullMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const gulls: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const l = new THREE.Mesh(gullWing, gullMat);
      const r = new THREE.Mesh(gullWingR, gullMat);
      g.add(l, r, new THREE.Mesh(gullBody, gullMat));
      g.scale.setScalar(1.7);
      g.userData = { l, r, day: true, cx: H.cx, cz: H.cz, zr: 0.62, a: rnd() * 6.28, rad: 50 + rnd() * 14, h: 5 + rnd() * 11, sp: 0.12 + rnd() * 0.12 };
      group.add(g);
      gulls.push(g);
    }
    (group as any)._gulls = gulls;
    // 무대 조명 빔: 밤에만 하늘로 흔들리며 쏘아 올린다 (5개)
    const beamG = new THREE.ConeGeometry(1.5, 14, 14, 1, true);
    beamG.rotateX(Math.PI);
    beamG.translate(0, 7, 0);
    const beams: THREE.Mesh[] = PARTY.slice(0, 5).map((c, k) => {
      const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const b = new THREE.Mesh(beamG, m);
      b.position.set(-26.3, 4.45, -4 + k * 1.5);
      b.userData.k = k;
      group.add(b);
      return b;
    });
    (group as any)._cruise = { disco, poolMat, fw, beams };
  }

  // 먼 산 (안개에 묻혀 깊이감을 준다)
  if (!OCEAN) {
  const mountainGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    const r = 175 + rnd() * 40;
    const h = 28 + rnd() * 46;
    const w = 28 + rnd() * 30;
    if (id === "pier" && Math.sin(a) < -0.2) continue; // 바다 쪽 수평선은 비워 둔다
    const g = new THREE.ConeGeometry(w, h, 6 + Math.floor(rnd() * 3));
    g.translate(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r);
    mountainGeos.push(g);
  }
  const mountains = new THREE.Mesh(mergeGeometries(mountainGeos)!, toon(id === "ice" ? "#cfe0f2" : id === "pier" ? "#9cc4d8" : "#8fcdb8"));
  group.add(mountains);
  }

  // 구름
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 0; i++) {
    const c = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.94 });
    for (let j = 0; j < 5; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(3 + rnd() * 2.6, 12, 10), mat);
      p.position.set(j * 3.4 - 6, rnd() * 1.4, rnd() * 2.4);
      p.scale.y = 0.62;
      c.add(p);
    }
    // 절반은 수평선 근처 낮은 곳에 둬서 게임 카메라에서도 보이게 한다
    if (i < 5) { c.position.set((rnd() - 0.5) * 360, 26 + rnd() * 12, -(90 + rnd() * 110)); c.scale.setScalar(1.6); }
    else c.position.set((rnd() - 0.5) * 260, 42 + rnd() * 16, (rnd() - 0.5) * 260);
    group.add(c);
    clouds.push(c);
  }

  // 별과 달 (밤)
  const starGeo = new THREE.BufferGeometry();
  const sv: number[] = [];
  for (let i = 0; i < 500; i++) {
    const a = rnd() * Math.PI * 2, e = rnd() * 1.2 + 0.1;
    sv.push(Math.cos(a) * Math.cos(e) * 300, Math.sin(e) * 300, Math.sin(a) * Math.cos(e) * 300);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sv, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, transparent: true, opacity: 0, sizeAttenuation: false, fog: false });
  group.add(new THREE.Points(starGeo, starsMat));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(8, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
  moon.position.set(-110, 120, -170);
  group.add(moon);

  // 얼음 맵의 오로라
  let aurora: THREE.Mesh | null = null;
  if (id === "ice") {
    const am = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; uniform float uAmount; varying vec2 vUv;
        void main(){ float w = sin(vUv.x * 14.0 + uTime * 0.5) * 0.5 + sin(vUv.x * 6.0 - uTime * 0.3) * 0.5;
          float band = smoothstep(0.0, 0.5, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y + w * 0.08));
          vec3 c = mix(vec3(0.2, 1.0, 0.6), vec3(0.6, 0.4, 1.0), vUv.y + w * 0.2);
          gl_FragColor = vec4(c, band * 0.55 * uAmount * (0.6 + 0.4 * sin(vUv.x * 30.0 + uTime))); }`,
    });
    aurora = new THREE.Mesh(new THREE.PlaneGeometry(380, 70, 1, 1), am);
    aurora.position.set(0, 80, -190);
    group.add(aurora);
  }

  // 떠다니는 입자: 호수는 나비와 반딧불이, 얼음은 눈, 부두는 반짝이는 먼지
  const PN = id === "ice" ? 700 : 70;
  const pGeo = new THREE.BufferGeometry();
  const pBase = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) {
    pBase[i * 3] = (rnd() - 0.5) * (id === "ice" ? 110 : 70);
    pBase[i * 3 + 1] = id === "ice" ? rnd() * 40 : 0.6 + rnd() * 3.5;
    pBase[i * 3 + 2] = (rnd() - 0.5) * (id === "ice" ? 110 : 70);
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pBase), 3));
  const pMat = new THREE.PointsMaterial({
    color: id === "ice" ? 0xffffff : 0xfff1a0, size: id === "ice" ? 0.12 : 0.3, transparent: true, opacity: id === "ice" ? 0.75 : 0,
    depthWrite: false, blending: id === "ice" ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  group.add(particles);

  // ---- 시간 보간용 색 ---------------------------------------------------
  const dayTop = new THREE.Color(th.skyTop);
  const dayHorizon = new THREE.Color(th.skyHorizon);
  const nightTop = new THREE.Color("#101734");
  const nightHorizon = new THREE.Color("#2b3665");
  const duskTop = new THREE.Color("#f08e86");
  const duskHorizon = new THREE.Color("#ffd2a0");
  const sunHigh = new THREE.Color(0xfff1d6);
  const moonCol = new THREE.Color(0x8fa6ff);
  const rippleSlots: THREE.Vector4[] = waterMat.uniforms.uRipple.value;
  let rippleIdx = 0;
  const fogColor = new THREE.Color();
  scene.background = null;
  scene.fog = OCEAN ? new THREE.Fog(0xffffff, 90, 300) : id === "ice" ? new THREE.Fog(0xffffff, 40, 200) : new THREE.Fog(0xffffff, 60, 240);
  for (const l of lights) group.add(l);

  let ambientAt = 2;
  const world: World = {
    group,
    waterY,
    ripple(x, z) {
      rippleSlots[rippleIdx].set(x, z, waterMat.uniforms.uTime.value, 0);
      rippleIdx = (rippleIdx + 1) % RING_COUNT;
    },
    update(t, serverNowMs) {
      waterMat.uniforms.uTime.value = t;
      windU.value = t;
      const phase = serverNowMs % CYCLE_MS;
      // 낮 12분과 밤 8분. 경계 1분 동안 노을이 지며 부드럽게 바뀐다
      const fade = 60_000;
      let night = 0;
      let dusk = 0;
      if (phase < DAY_MS - fade) night = 0;
      else if (phase < DAY_MS) { const k = (phase - (DAY_MS - fade)) / fade; night = k; dusk = Math.sin(k * Math.PI); }
      else if (phase < CYCLE_MS - fade) night = 1;
      else { const k = (phase - (CYCLE_MS - fade)) / fade; night = 1 - k; dusk = Math.sin(k * Math.PI); }

      const top = dayTop.clone().lerp(nightTop, night).lerp(duskTop, dusk * 0.5);
      const hor = dayHorizon.clone().lerp(nightHorizon, night).lerp(duskHorizon, dusk * 0.7);
      skyMat.uniforms.uTime.value = t;
      skyMat.uniforms.uCloud.value = 0.9 * (1 - night);
      skyMat.uniforms.uCloudCol.value.set(0xffffff).lerp(new THREE.Color(0xffc9a0), dusk * 0.6);
      skyMat.uniforms.uTop.value.copy(top);
      skyMat.uniforms.uHorizon.value.copy(hor);
      fogColor.copy(hor);
      (scene.fog as THREE.Fog).color.copy(fogColor);
      const ang = (phase / CYCLE_MS) * Math.PI * 2;
      const sunPos = new THREE.Vector3(Math.cos(ang) * 40 + 10, 24 + Math.sin(ang) * 20, 22);
      sun.position.copy(sunPos);
      skyMat.uniforms.uSunDir.value.copy(sunPos).normalize();
      waterMat.uniforms.uSunDir.value.copy(skyMat.uniforms.uSunDir.value);
      skyMat.uniforms.uSunColor.value.copy(sunHigh).lerp(new THREE.Color(0xff8a5a), dusk * 0.7).multiplyScalar(1 - night);
      hemi.intensity = (id === "ice" ? 1.9 : 1.4) - night * (OCEAN ? 0.3 : 1.0);
      hemi.color.set(hemiCols[0]).lerp(new THREE.Color(0x6a78c8), night);
      sun.intensity = (id === "ice" ? 2.1 : 2.5) * (1 - night) + 0.45 * night;
      sun.color.copy(sunHigh).lerp(moonCol, night).lerp(new THREE.Color(0xff9e6b), dusk * 0.6);
      starsMat.opacity = night;
      moon.visible = night > 0.3;
      waterMat.uniforms.uNight.value = night * 0.6;
      waterMat.uniforms.uFogCol.value.copy(hor);
      lights.forEach((l) => (l.intensity = night * 45));
      glowMats.forEach((m) => m.color.setScalar(0.5 + 0.5 * night).multiply(new THREE.Color(1, 0.85, 0.55)).multiplyScalar(1 + night));
      clouds.forEach((c, i) => {
        c.position.x += 0.008 * (1 + (i % 3));
        if (c.position.x > 200) c.position.x = -200;
        c.children.forEach((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setScalar(1 - night * 0.72));
      });
      if (aurora) (aurora.material as THREE.ShaderMaterial).uniforms.uTime.value = t, (aurora.material as THREE.ShaderMaterial).uniforms.uAmount.value = night;

      // 입자 움직임
      const arr = pGeo.attributes.position as THREE.BufferAttribute;
      if (id === "ice") {
        for (let i = 0; i < PN; i++) {
          const y = (pBase[i * 3 + 1] - t * (1.2 + (i % 5) * 0.2)) % 40;
          arr.setXYZ(i, pBase[i * 3] + Math.sin(t * 0.6 + i) * 1.2, y < 0 ? y + 40 : y, pBase[i * 3 + 2] + Math.cos(t * 0.5 + i * 1.3) * 1.2);
        }
      } else {
        for (let i = 0; i < PN; i++) {
          arr.setXYZ(i, pBase[i * 3] + Math.sin(t * 0.5 + i) * 2.2, pBase[i * 3 + 1] + Math.sin(t * 1.3 + i * 2.1) * 0.5, pBase[i * 3 + 2] + Math.cos(t * 0.4 + i * 1.7) * 2.2);
        }
        pMat.opacity = OCEAN ? 0 : id === "lake" ? night * 0.95 : 0.35 * (1 - night);
        pMat.size = id === "lake" ? 0.34 : 0.16;
      }
      arr.needsUpdate = true;

      ((group as any)._floes as THREE.Mesh[] | undefined)?.forEach((f) => {
        f.position.y = waterY + 0.02 + Math.sin(t * 0.9 + f.userData.p) * 0.03;
        f.rotation.y += 0.0008;
      });
      const boat = (group as any)._boat as THREE.Object3D | undefined;
      if (boat) { boat.position.y = waterY + 0.05 + Math.sin(t * 1.3) * 0.04; boat.rotation.z = Math.sin(t * 0.9) * 0.03; }
      const gs = (group as any)._gulls as THREE.Group[] | undefined;
      gs?.forEach((g) => {
        const u = g.userData;
        u.a += u.sp * 0.016;
        g.position.set((u.cx ?? 0) + Math.cos(u.a) * u.rad, u.h + Math.sin(t + u.a * 3) * 0.6, (u.cz ?? -10) + Math.sin(u.a) * u.rad * (u.zr ?? 0.7));
        if (u.day) g.visible = night < 0.5;
        g.rotation.y = -u.a + Math.PI;
        const f = Math.sin(t * 6 + u.a * 5) * 0.5;
        u.l.rotation.z = f;
        u.r.rotation.z = -f;
      });
      const sm = (group as any)._smoke as { puffs: THREE.Mesh[]; base: THREE.Vector3 } | undefined;
      sm?.puffs.forEach((pf) => {
        const k = (t * 0.22 + pf.userData.ph) % 1;
        pf.position.set(sm.base.x + k * 1.6 + Math.sin(t + pf.userData.ph * 9) * 0.15, sm.base.y + 0.5 + k * 4, sm.base.z);
        pf.scale.setScalar(0.5 + k * 1.8);
        (pf.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k) * (1 - night * 0.6);
      });
      const cr = (group as any)._cruise as { disco: THREE.Mesh; poolMat: THREE.MeshStandardMaterial; beams: THREE.Mesh[]; fw: Firework[] } | undefined;
      if (cr) {
        // 파티 조명은 낮에는 은은하게, 밤에는 환하게
        partyMats.forEach((m) => m.color.setScalar(0.5 + 0.5 * night));
        cr.poolMat.emissiveIntensity = 0.45 + night * 1.3;
        cr.disco.rotation.y = t * 0.8;
        for (const b of cr.beams) {
          const k = b.userData.k as number;
          b.rotation.z = Math.sin(t * 0.9 + k * 1.3) * 0.45 + 0.35;
          b.rotation.x = Math.cos(t * 0.7 + k) * 0.3;
          (b.material as THREE.MeshBasicMaterial).opacity = night * 0.16;
          b.visible = night > 0.02;
        }
        for (const f of cr.fw) {
          if ((t - f.t0) / f.dur >= 1) rollFirework(f, t);
          const ph = (t - f.t0) / f.dur;
          if (ph < 0) { f.m.opacity = 0; continue; }
          const rad = f.rf * Math.sqrt(ph), sag = ph * ph * f.sf;
          const arr = f.g.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < f.N; i++) arr.setXYZ(i, f.x + f.dirs[i * 3] * rad, f.y + f.dirs[i * 3 + 1] * rad - sag, f.z + f.dirs[i * 3 + 2] * rad);
          arr.needsUpdate = true;
          f.m.opacity = night * (ph < 0.08 ? ph / 0.08 : 1 - (ph - 0.08) / 0.92);
        }
      }
      spotArrows.forEach((a) => { a.position.y = a.userData.y + Math.sin(t * 2.4) * 0.15; a.rotation.y = t * 1.5; });
      spotRings.forEach((r) => r.scale.setScalar(1 + Math.sin(t * 2.4) * 0.06));
      if (id === "lake" && LAKE && t > ambientAt) {
        ambientAt = t + 2.5 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * LAKE.r * 0.8;
        world.ripple(LAKE.cx + Math.cos(a) * rr, LAKE.cz + Math.sin(a) * rr);
      }
      flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 12 + i * 2) * 0.22; f.visible = true; });
      sun.target.position.set(0, 0, 0);
    },
  };
  return world;
}
