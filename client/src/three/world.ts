import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BASE_MAPS, CYCLE_MS, DAY_MS } from "@fishing/shared";
import type { MapDef, MapId } from "@fishing/shared";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { toon } from "./engine";

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
  lake: { groundA: "#92d27f", groundB: "#6fbd74", sand: "#f3e2b0", hill: "#4f9a62", shallow: "#7be3d6", mid: "#3fb6d8", deep: "#1f6fb0", skyTop: "#6cc4f2", skyHorizon: "#d9f1ee" },
  pier: { groundA: "#f2e0b0", groundB: "#e4cf9a", sand: "#f6e8c0", hill: "#79b266", shallow: "#7fe6e0", mid: "#34b3d6", deep: "#175f9e", skyTop: "#5db8ee", skyHorizon: "#e8f3ef" },
  ice: { groundA: "#d6e6f2", groundB: "#c2d8e8", sand: "#eaf4fa", hill: "#a9c6dd", shallow: "#86cfe6", mid: "#3f9ad0", deep: "#1d5a98", skyTop: "#86bde0", skyHorizon: "#d5e9f4" },
};

export function buildWorld(mapId: MapId | string, scene: THREE.Scene): World {
  const map: MapDef = BASE_MAPS[mapId as MapId] ?? BASE_MAPS.lake;
  const id = (mapId in BASE_MAPS ? mapId : "lake") as MapId;
  const rnd = mulberry(id.length * 977 + id.charCodeAt(0));
  const th = THEMES[id];
  const group = new THREE.Group();
  scene.add(group);

  // 호수 중심과 반지름 (lake, ice)
  const LAKE = id === "lake" ? { cx: 0, cz: -8, r: 22 } : id === "ice" ? { cx: 0, cz: -5, r: 20 } : null;

  // ---- 지형 높이 ------------------------------------------------------
  const heightAt = (x: number, z: number): number => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    const edge = smooth(36, 80, d);
    const hills = edge * (5 + 11 * (0.5 + 0.5 * fbm(x * 0.7 + 3, z * 0.7 - 5)));
    let h = fbm(x, z) * 0.16 * (1 - edge * 0.6) + hills;
    if (LAKE) {
      const r = Math.hypot(x - LAKE.cx, z - LAKE.cz);
      if (r < LAKE.r) h = -0.24 - 3.0 * Math.pow(1 - r / LAKE.r, 0.9);
      else if (r < LAKE.r + 4) h = h * smooth(LAKE.r, LAKE.r + 4, r) + -0.24 * (1 - smooth(LAKE.r, LAKE.r + 4, r));
    } else if (id === "pier") {
      if (z < -2) {
        const beach = smooth(-2, -7, z);
        h = h * (1 - beach) + -0.26 * beach;
        h += -4.5 * smooth(-8, -34, z);
        if (z < -60) h += smooth(-60, -100, z) * 7;
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
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
        float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += uSunColor * (pow(s, 600.0) * 2.0 + pow(s, 24.0) * 0.28);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(330, 32, 20), skyMat);
  sky.renderOrder = -10;
  group.add(sky);

  const hemi = new THREE.HemisphereLight(0xdff2ff, 0x9bc58a, 1.0);
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
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, toon("#ffffff", { vertexColors: true }));
  ground.receiveShadow = true;
  group.add(ground);

  // ---- 물 --------------------------------------------------------------
  const waterY = -0.2;
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
      uMode: { value: id === "pier" ? 1 : 0 },
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
      uniform vec4 uRipple[${RING_COUNT}]; uniform float uNight; uniform float uMode; uniform vec2 uCenter; uniform float uRadius;
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
          alpha = mix(0.72, 0.95, depth);
        } else if (uMode < 1.5) {
          float d = clamp((-6.0 - p.y) / 40.0, 0.0, 1.0);
          col = mix(uShallow, uMid, smoothstep(0.0, 0.25, d));
          col = mix(col, uDeep, smoothstep(0.2, 0.9, d));
          float shore = smoothstep(14.0, 0.0, -6.0 - p.y);
          foam = shore * smoothstep(0.35, 0.85, sin((-6.0 - p.y) * 1.7 - t * 1.6 + noise(p * 0.6) * 5.0) * 0.5 + 0.5) * 0.75;
          foam += smoothstep(0.7, 0.0, abs(p.y + 6.6 - sin(p.x * 0.35 + t) * 0.2));
          alpha = mix(0.7, 0.96, d);
        } else {
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
        }
        if (uMode < 1.5) {
          float streak = smoothstep(0.72, 0.95, noise(p * vec2(1.3, 0.8) + w * 0.5 + t * 0.15));
          col += streak * 0.05;
          // 햇빛 반짝임
          float sp = smoothstep(0.93, 0.99, noise(p * 2.4 + vec2(t * 0.5, -t * 0.3)) * noise(p * 1.1 - vec2(t * 0.2, t * 0.4)) * 2.2);
          col += sp * 0.4 * (1.0 - uNight);
        }
        for (int i = 0; i < ${RING_COUNT}; i++) {
          vec4 rp = uRipple[i];
          float age = uTime - rp.z;
          if (age > 0.0 && age < 2.4) {
            float d = distance(p, rp.xy);
            float ring = smoothstep(0.14, 0.0, abs(d - age * 2.2)) * (1.0 - age / 2.4);
            col += ring * 0.75;
          }
        }
        // 하늘이 비치는 효과 (비스듬히 볼수록 강해짐)
        vec3 vd = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(vd.y, 0.0, 1.0), 3.0);
        col = mix(col, uSky * mix(1.0, 0.3, uNight), fres * 0.28);
        col = mix(col, vec3(1.0), foam);
        col *= mix(1.0, 0.45, uNight);
        gl_FragColor = vec4(col, max(alpha, foam));
        #include <colorspace_fragment>
      }`,
  });
  let water: THREE.Mesh;
  if (id === "pier") {
    water = new THREE.Mesh(new THREE.PlaneGeometry(380, 300), waterMat);
    water.position.set(0, waterY, -6 - 150);
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

  // 풀잎 다발
  if (id !== "ice") {
    const blade = new THREE.ConeGeometry(0.045, 0.26, 4);
    blade.translate(0, 0.13, 0);
    const bladeMat = toon("#ffffff");
    const grassCol = id === "lake" ? ["#7fcf6e", "#9be07a", "#69bd68", "#b5e88a"] : ["#c9d68a", "#b8c97a", "#d9d99a"];
    const n = id === "lake" ? 30000 : 9000;
    instanced(blade, bladeMat, n, (i, set) => {
      const x = (rnd() - 0.5) * 84, z = (rnd() - 0.5) * 84;
      if (!walkOK(x, z)) return;
      if (id === "pier" && z < 2) return;
      if (Math.hypot(x - map.spawn.x, z - map.spawn.z) < 1.2) return;
      const s = 0.6 + rnd() * 0.8;
      set(x, heightAt(x, z) - 0.02, z, s, s * (0.7 + rnd() * 0.9), s, rnd() * 6.28, grassCol[Math.floor(rnd() * grassCol.length)]);
    }, false);
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
  const pineGeo = mergeGeometries([0, 1, 2, 3].map((i) => { const c = new THREE.ConeGeometry(1.5 - i * 0.3, 1.4, 9); c.translate(0, i * 0.85, 0); return c; }))!;
  const barkMat = toon("#9a6a43");
  const leafMat = toon("#ffffff");

  const forest: Array<[number, number, number]> = [];
  const treeCount = id === "ice" ? 150 : id === "pier" ? 70 : 170;
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
  // 놀이 구역 안쪽 가장자리에도 몇 그루 (맵이 휑하지 않게)
  for (let i = 0, tries = 0; i < (id === "pier" ? 6 : 14) && tries < 200; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = 34 + rnd() * 4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (map.isWater(x, z) || (id === "pier" && z < 0)) continue;
    forest.push([x, heightAt(x, z), z]);
    i++;
  }
  const leafCols = id === "lake" ? ["#4aa564", "#5cb96b", "#73c86f", "#3f9a5c", "#89d36f"] : id === "pier" ? ["#58a860", "#6bbb6c", "#7bc46a"] : ["#eef6fb", "#e0eef6", "#d3e6f0"];
  if (id === "ice") {
    instanced(trunkGeo, barkMat, forest.length, (i, set) => { const [x, y, z] = forest[i]; const s = 0.9 + rnd() * 0.7; set(x, y - 0.1, z, s, s, s); });
    instanced(pineGeo, leafMat, forest.length, (i, set) => { const [x, y, z] = forest[i]; const s = 1.0 + rnd() * 0.9; set(x, y + 2.9 * s, z, s, s, s, rnd() * 6.28, leafCols[i % leafCols.length]); });
    // 눈 쌓인 윗부분 느낌: 어두운 초록 몸통 한 겹 더
    const pineDark = mergeGeometries([0, 1, 2].map((i) => { const c = new THREE.ConeGeometry(1.42 - i * 0.3, 1.3, 9); c.translate(0, i * 0.85 - 0.5, 0); return c; }))!;
    instanced(pineDark, toon("#3f7f63"), forest.length, (i, set) => { const [x, y, z] = forest[i]; const s = 1.0 + rnd() * 0.5; set(x, y + 2.5 * s, z, s, s, s, rnd() * 6.28); });
  } else {
    instanced(trunkGeo, barkMat, forest.length, (i, set) => { const [x, y, z] = forest[i]; const s = 0.9 + rnd() * 0.8; set(x, y - 0.1, z, s, s, s, rnd() * 6.28); });
    instanced(roundCanopy, leafMat, forest.length, (i, set) => { const [x, y, z] = forest[i]; const s = 0.95 + rnd() * 0.85; set(x, y + 3.2 * s, z, s, s, s, rnd() * 6.28, leafCols[Math.floor(rnd() * leafCols.length)]); });
  }

  // 바위
  const rockGeo = roundRockGeo();
  instanced(rockGeo, toon("#ffffff"), 70, (i, set) => {
    const a = rnd() * Math.PI * 2, r = 10 + rnd() * 50;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (map.isWater(x, z) || (id === "pier" && z < -5) || Math.hypot(x - map.spawn.x, z - map.spawn.z) < 4) return;
    const s = 0.5 + rnd() * 1.6;
    set(x, heightAt(x, z) + 0.15 * s, z, s * (1 + rnd() * 0.5), s * (0.6 + rnd() * 0.3), s * (1 + rnd() * 0.5), rnd() * 6, id === "ice" ? "#d9e4ee" : id === "pier" ? "#b3aea6" : ["#bdb8c8", "#a9a4b6", "#cfc9d6"][Math.floor(rnd() * 3)]);
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

  // 꽃 무리
  if (id !== "ice") {
    const flowerGeo = new THREE.SphereGeometry(0.11, 8, 6);
    flowerGeo.translate(0, 0.32, 0);
    const petals = ["#ff8fb3", "#ffd45a", "#ffffff", "#b69bff", "#ff9a6b", "#8fd3ff"];
    const centers = Array.from({ length: 26 }, () => [(rnd() - 0.5) * 76, (rnd() - 0.5) * 76, Math.floor(rnd() * petals.length)] as [number, number, number]);
    instanced(flowerGeo, toon("#ffffff"), 26 * 16, (i, set) => {
      const c = centers[i % centers.length];
      const x = c[0] + (rnd() - 0.5) * 3.2, z = c[1] + (rnd() - 0.5) * 3.2;
      if (!walkOK(x, z) || (id === "pier" && z < 4)) return;
      set(x, heightAt(x, z), z, 1, 1 + rnd() * 0.6, 1, 0, petals[(c[2] + (rnd() < 0.2 ? 1 : 0)) % petals.length]);
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

  // ---- 맵별 건물과 소품 -----------------------------------------------------
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
    const hull = addOutline(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon("#d9824b")), 0.03);
    hull.scale.set(0.8, 0.5, 1.9);
    hull.rotation.x = Math.PI;
    hull.position.y = 0.32;
    boat.add(hull);
    boat.position.set(-7, waterY + 0.05, 6);
    boat.rotation.y = 0.5;
    group.add(boat);
    (group as any)._boat = boat;
    lantern(-1.4, 0.1, 15.4);
    const dockLight = new THREE.PointLight(0xffc977, 0, 16, 1.6);
    dockLight.position.set(-1.4, 2.4, 15.4);
    lights.push(dockLight);
    // 통나무 벤치와 작은 집
    const cabin = new THREE.Group();
    const wall = addOutline(new THREE.Mesh(rbox(5, 3.2, 4), toon("#e8c9a0")), 0.02);
    wall.position.y = 1.6;
    const roof = new THREE.Mesh(dome(3.7, 2.1), toon("#d9695f"));
    roof.position.y = 3.05;
    roof.scale.set(1, 1, 0.85);
    const door = new THREE.Mesh(rbox(1, 1.8, 0.1), toon("#8a5a3a"));
    door.position.set(0, 0.9, 2.05);
    const win = new THREE.Mesh(rbox(0.9, 0.9, 0.1), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    glowMats.push(win.material as THREE.MeshBasicMaterial);
    win.position.set(1.5, 1.8, 2.05);
    cabin.add(wall, roof, door, win);
    cabin.position.set(-22, heightAt(-22, 28), 28);
    cabin.rotation.y = 0.5;
    wall.castShadow = true;
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
    // 창고, 통, 그물, 보트
    const shed = addOutline(new THREE.Mesh(rbox(5, 3.4, 4), toon("#e0907c")), 0.02);
    shed.position.set(11, 1.7, 4);
    shed.castShadow = true;
    const roof = addOutline(new THREE.Mesh(rbox(5.8, 0.3, 4.8), toon("#5b6c9a")), 0.02);
    roof.position.set(11, 3.7, 4);
    roof.rotation.z = 0.12;
    const win = new THREE.Mesh(rbox(1, 1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    glowMats.push(win.material as THREE.MeshBasicMaterial);
    win.position.set(11, 2, 6.05);
    group.add(shed, roof, win);
    for (let i = 0; i < 6; i++) {
      const barrel = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.9, 24), toon("#a8754a")), 0.03);
      barrel.position.set(5 + (i % 3) * 0.95, 0.45, 7 + Math.floor(i / 3) * 1.0);
      barrel.castShadow = true;
      group.add(barrel);
    }
    for (const [x, z, ry] of [[-11, -12, 0.3], [-18, -16, -0.2]] as number[][]) {
      const boat = addOutline(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon("#4f86c6")), 0.03);
      boat.scale.set(0.9, 0.55, 2.2);
      boat.rotation.set(Math.PI, ry, 0);
      boat.position.set(x, waterY + 0.1, z);
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
    const hut = new THREE.Group();
    const body = addOutline(new THREE.Mesh(rbox(3.6, 2.5, 3.2), toon("#c9805a")), 0.02);
    body.position.y = 1.25;
    const roof = new THREE.Mesh(dome(2.8, 1.5), toon("#f2f7fb"));
    roof.position.y = 2.35;
    const win = new THREE.Mesh(rbox(0.8, 0.8, 0.1), new THREE.MeshBasicMaterial({ color: 0xffe3a0 }));
    glowMats.push(win.material as THREE.MeshBasicMaterial);
    win.position.set(0.8, 1.4, 1.65);
    const chimney = new THREE.Mesh(rbox(0.5, 1.2, 0.5), toon("#7a6a64"));
    chimney.position.set(-1.0, 3.2, -0.6);
    hut.add(body, roof, win, chimney);
    hut.position.set(-13, 0, 14);
    hut.rotation.y = 0.4;
    body.castShadow = true;
    group.add(hut);
    // 모닥불
    const fire = new THREE.PointLight(0xffa24a, 0, 16, 1.4);
    fire.position.set(-8, 1.2, 12);
    lights.push(fire);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const log = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.75, 6, 12), toon("#6e4a30"));
      log.position.set(-8 + Math.cos(a) * 0.4, 0.2, 12 + Math.sin(a) * 0.4);
      log.rotation.set(Math.PI / 2 - 0.5, 0, a);
      group.add(log);
    }
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.05, 0.9 - i * 0.2, 7), new THREE.MeshBasicMaterial({ color: [0xff7a2a, 0xffa24a, 0xffd36a][i] }));
      flame.position.set(-8, 0.5 + i * 0.05, 12);
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
    sm.position.set(9, 0, 22);
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

  // 먼 산 (안개에 묻혀 깊이감을 준다)
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
  const mountains = new THREE.Mesh(mergeGeometries(mountainGeos)!, new THREE.MeshToonMaterial({ color: id === "ice" ? "#cfe3f0" : "#7fb4a6", gradientMap: (toon("#fff") as any).gradientMap }));
  group.add(mountains);

  // 구름
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.94 });
    for (let j = 0; j < 5; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(3 + rnd() * 2.6, 12, 10), mat);
      p.position.set(j * 3.4 - 6, rnd() * 1.4, rnd() * 2.4);
      p.scale.y = 0.62;
      c.add(p);
    }
    c.position.set((rnd() - 0.5) * 260, 42 + rnd() * 16, (rnd() - 0.5) * 260);
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
  scene.fog = new THREE.Fog(0xffffff, 60, 190);
  for (const l of lights) group.add(l);

  const world: World = {
    group,
    waterY,
    ripple(x, z) {
      rippleSlots[rippleIdx].set(x, z, waterMat.uniforms.uTime.value, 0);
      rippleIdx = (rippleIdx + 1) % RING_COUNT;
    },
    update(t, serverNowMs) {
      waterMat.uniforms.uTime.value = t;
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
      skyMat.uniforms.uTop.value.copy(top);
      skyMat.uniforms.uHorizon.value.copy(hor);
      fogColor.copy(hor);
      (scene.fog as THREE.Fog).color.copy(fogColor);
      const ang = (phase / CYCLE_MS) * Math.PI * 2;
      const sunPos = new THREE.Vector3(Math.cos(ang) * 40 + 10, 30 + Math.sin(ang) * 22, 22);
      sun.position.copy(sunPos);
      skyMat.uniforms.uSunDir.value.copy(sunPos).normalize();
      skyMat.uniforms.uSunColor.value.copy(sunHigh).lerp(new THREE.Color(0xff8a5a), dusk * 0.7).multiplyScalar(1 - night);
      hemi.intensity = 1.1 - night * 0.7;
      hemi.color.set(0xdff2ff).lerp(new THREE.Color(0x6a78c8), night);
      sun.intensity = 2.6 * (1 - night) + 0.45 * night;
      sun.color.copy(sunHigh).lerp(moonCol, night).lerp(new THREE.Color(0xff9e6b), dusk * 0.6);
      starsMat.opacity = night;
      moon.visible = night > 0.3;
      waterMat.uniforms.uNight.value = night * 0.6;
      lights.forEach((l) => (l.intensity = night * 45));
      glowMats.forEach((m) => m.color.setScalar(0.5 + 0.5 * night).multiply(new THREE.Color(1, 0.85, 0.55)).multiplyScalar(1 + night));
      clouds.forEach((c, i) => {
        c.position.x += 0.008 * (1 + (i % 3));
        if (c.position.x > 140) c.position.x = -140;
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
        pMat.opacity = id === "lake" ? night * 0.95 : 0.35 * (1 - night);
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
        g.position.set(Math.cos(u.a) * u.rad, u.h + Math.sin(t + u.a * 3) * 0.6, -10 + Math.sin(u.a) * u.rad * 0.7);
        g.rotation.y = -u.a + Math.PI;
        const f = Math.sin(t * 6 + u.a * 5) * 0.5;
        u.l.rotation.z = f;
        u.r.rotation.z = -f;
      });
      flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 12 + i * 2) * 0.22; f.visible = true; });
      sun.target.position.set(0, 0, 0);
    },
  };
  return world;
}
