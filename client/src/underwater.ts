import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HARPOON, SPECIES, harpoonLevelOf } from "@fishing/shared";
import type { FishSpecies, PlayerProfile } from "@fishing/shared";
import { api, auth, colyseus } from "./net";
import type { Room } from "colyseus.js";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { FishIcon } from "./ui/FishIcon";
import { UwInventory } from "./ui/UwInventory";
import "./styles.css"; // 낚시 방과 같은 인벤토리·강화 화면을 쓰므로 같은 스타일을 불러온다
import { createEngine } from "./three/engine";
import { bodyBox, buildFish } from "./three/fishModel";
import { CharacterRig, SKIN, loadCharacterModel } from "./three/character";
import { createHunt } from "./uwHunt";

// 수중 탐험 시제품: 해저 지형 소품은 폴리포크(공식 CDN에서 실행 중에만 불러옴, 저장소에 파일 없음),
// 물고기·신화·캐릭터는 우리 모델. 조작: WASD 헤엄(보는 쪽으로 오르내림), Shift 빠르게, 드래그 시점, 1~5 구역 이동, P 파스텔 비교
const CDN = "https://polyfork.dev/cdn/";
const params = new URLSearchParams(location.search);

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(20261111);
const fbm = (x: number, z: number) =>
  Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.7) * 0.5 + Math.sin(x * 0.23 + z * 0.17 + 2.1) * 0.25 + Math.sin(x * 0.41 - z * 0.37) * 0.12;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---- 구역 ------------------------------------------------------------------
interface Env { fog: string; dens: number; sky: string; ground: string; sun: number; hemi: number; ray: number; bloom: number; caus: number; top?: number } // top: 올려다본 물빛의 밝기(안 적으면 햇빛 세기에서 정한다)
interface Zone { name: string; x: number; z: number; d: number; tint: string; env: Env }
const ZONES: Zone[] = [
  { name: "알록달록 산호 숲", x: 0, z: 0, d: -26, tint: "#f0e2b4", env: { fog: "#2fa6d6", dens: 0.014, sky: "#d2f5ff", ground: "#2a8fb8", sun: 2.5, hemi: 1.7, ray: 0.1, bloom: 0.28, caus: 0.4 } },
  { name: "아틀란티스 유적", x: -175, z: 95, d: -38, tint: "#b3c2d2", env: { fog: "#1763b8", dens: 0.0105, sky: "#bfe4ff", ground: "#164a94", sun: 2.5, hemi: 0.85, ray: 0.12, bloom: 0.3, caus: 0.4 } },
  { name: "난파선 지대", x: 175, z: -95, d: -40, tint: "#a9a98a", env: { fog: "#1f808a", dens: 0.014, sky: "#a2e4da", ground: "#1a5d66", sun: 2.3, hemi: 1.15, ray: 0.14, bloom: 0.28, caus: 0.3 } },
  { name: "해적 보물 동굴", x: -175, z: -135, d: -56, tint: "#7f8f86", env: { fog: "#0c3046", dens: 0.013, sky: "#7cb4cc", ground: "#10303f", sun: 0.45, hemi: 1.7, ray: 0.0, bloom: 0.55, caus: 0.0, top: 0.8 } },
  { name: "심해 협곡", x: 0, z: 205, d: -58, tint: "#6f86b0", env: { fog: "#07165a", dens: 0.017, sky: "#5b78e6", ground: "#0a1446", sun: 0.3, hemi: 1.9, ray: 0.0, bloom: 0.9, caus: 0.0 } },
  { name: "거북이 모래 만", x: 205, z: 115, d: -24, tint: "#e2cf9c", env: { fog: "#4cc6d8", dens: 0.013, sky: "#d4f8ff", ground: "#38a2b8", sun: 2.3, hemi: 1.5, ray: 0.12, bloom: 0.26, caus: 0.6 } },
];
// 평평하게 다듬는 곳 (광장, 난파선 터, 동굴 바닥)
const FLAT_AREAS = [{ i: 0, r: 100 }, { i: 5, r: 100 }, { i: 1, r: 110 }, { i: 2, r: 44 }, { i: 3, r: 150 }, { i: 4, r: 135 }];
// 난파선 지대에서 보물 동굴로 내려가는 구덩이 (모양은 base_model/wreck.py 의 PX, PY, PR 과 맞춘다)
const PIT = { x: ZONES[2].x - 16, z: ZONES[2].z - 2, r: 5.6, depth: 10 };
// 구역 사이를 잇는 바닷길 [구역, 구역]. 길을 따라 바닥이 두 구역의 깊이를 완만하게 잇고 길가에 등불이 선다. 구역 모델(base_model 의 WAYS)도 이 방향을 비워 둔다.
// 난파선↔보물 동굴만은 길이 아니라 구덩이와 천장 구멍으로 오간다(LINKS)
const PATHS: Array<[number, number]> = [[0, 1], [0, 2], [0, 5], [2, 5], [3, 1], [3, 0]];
// 산호 숲 북쪽 끝의 깊은 구멍: 한참 내려가면 심해 협곡이 나온다. 심해에서는 위로 높이 올라가면 이 구멍으로 돌아온다
const HOLE = { x: ZONES[0].x + 4, z: ZONES[0].z + 76, r: 10, depth: 34 };
// 구역과 바닷길 밖은 수면 가까이 솟은 바위 능선으로 막는다. 구역별 열린 반지름
const WALL_R = [90, 105, 90, 125, 80, 90];
/** 0이면 열린 곳(구역 안이나 바닷길), 1이면 능선 한가운데 */
function wallAt(x: number, z: number): number {
  let open = 0;
  ZONES.forEach((q, i) => (open = Math.max(open, 1 - smooth(WALL_R[i], WALL_R[i] + 14, Math.hypot(x - q.x, z - q.z)))));
  for (const [ia, ib] of PATHS) {
    const a = ZONES[ia], b = ZONES[ib], bx = b.x - a.x, bz = b.z - a.z;
    const u = Math.min(1, Math.max(0, ((x - a.x) * bx + (z - a.z) * bz) / (bx * bx + bz * bz)));
    open = Math.max(open, 1 - smooth(24, 44, Math.hypot(x - a.x - bx * u, z - a.z - bz * u)));
  }
  return 1 - open;
}
const ENV_FOG = new THREE.Color(), ENV_SKY = new THREE.Color(), ENV_GND = new THREE.Color(), TMP_C = new THREE.Color();
const BG = -42;
const HALF = 320;
function zoneWeights(x: number, z: number) {
  const w = ZONES.map((q) => Math.exp(-((x - q.x) ** 2 + (z - q.z) ** 2) / (78 * 78)));
  return { w, sum: w.reduce((a, b) => a + b, 0) };
}
// 아틀란티스 도시의 층 바닥 [x0, y0, x1, y1, 높이] (base_model/atlantis.py가 만든 atlantis.json). 불러오기 전에는 비어 있다
let atlLevels: number[][] = [];
const ATL_LIFT = 0.35;
// 딛고 설 수 있는 바위 윗면 [구역, [x, y, 반지름, 높이][]] (base_model 의 deep.py, coral.py, turtle.py 가 만든 json 의 discs)
const discSets: Array<[Zone, number[][]]> = [];
function heightAt(x: number, z: number): number {
  const lx = x - ZONES[1].x, ly = ZONES[1].z - z;
  for (const [x0, y0, x1, y1, hh] of atlLevels) if (lx >= x0 && lx <= x1 && ly >= y0 && ly <= y1) return ZONES[1].d + ATL_LIFT + hh;
  for (const [q, discs] of discSets) {
    const dx = x - q.x, dy = q.z - z;
    if (Math.abs(dx) > 100 || Math.abs(dy) > 125) continue;
    let top = -1e9;
    for (const [cx, cy, r, hh] of discs) if (hh > top && (dx - cx) ** 2 + (dy - cy) ** 2 < r * r) top = hh;
    if (top > -1e9) return q.d + top;
  }
  const { w, sum } = zoneWeights(x, z);
  const bgW = Math.max(0, 1 - sum);
  let h = (w.reduce((a, wi, i) => a + wi * ZONES[i].d, 0) + bgW * BG) / (sum + bgW);
  h += fbm(x * 0.9, z * 0.9) * 2.2 + fbm(x * 2.3 + 5, z * 2.3) * 0.5;
  for (const [ia, ib] of PATHS) { // 바닷길: 길 가운데 10m는 평평하고 45m 밖으로 완만하게 주변 바닥에 섞인다
    const a = ZONES[ia], b = ZONES[ib], bx = b.x - a.x, bz = b.z - a.z;
    const u = Math.min(1, Math.max(0, ((x - a.x) * bx + (z - a.z) * bz) / (bx * bx + bz * bz)));
    const k = 1 - smooth(10, 45, Math.hypot(x - a.x - bx * u, z - a.z - bz * u));
    if (k > 0) h = h * (1 - k) + (a.d + (b.d - a.d) * smooth(0.2, 0.8, u) + 0.3 * fbm(x * 0.3, z * 0.3)) * k;
  }
  for (const f of FLAT_AREAS) {
    const q = ZONES[f.i];
    const k = 1 - smooth(f.r * 0.6, f.r, Math.hypot(x - q.x, z - q.z));
    if (k > 0) h = h * (1 - k) + (q.d + (f.i === 3 ? 0 : 0.2 * fbm(x * 0.3, z * 0.3))) * k;
  }
  h -= 9 * Math.exp(-((x - ZONES[4].x) ** 2 + (z - ZONES[4].z) ** 2) / 1100); // 심해 협곡
  const wk = smooth(0, 0.6, wallAt(x, z)) * 4; // 능선은 판을 쌓은 듯 계단 모양으로 솟는다
  h += (-2.2 - h) * (Math.floor(wk) + smooth(0.7, 1, wk % 1)) / 4;
  const hd = Math.hypot(x - HOLE.x, z - HOLE.z);
  if (hd < HOLE.r + 4) h -= HOLE.depth * (1 - smooth(HOLE.r - 3, HOLE.r + 4, hd)); // 심해로 내려가는 깊은 구멍
  const pd = Math.hypot(x - PIT.x, z - PIT.z);
  if (pd < PIT.r + 2.5) h -= PIT.depth * (1 - smooth(PIT.r - 1.5, PIT.r + 2.5, pd)); // 동굴로 내려가는 구덩이
  h += smooth(HALF - 36, HALF - 4, Math.max(Math.abs(x), Math.abs(z))) * 30; // 맵 가장자리는 벽처럼 솟는다
  return Math.min(h, -2);
}

const CAVE = ZONES[3];

// ---- 장면, 빛 -----------------------------------------------------------------
const root = document.getElementById("root")!;
const hud = document.getElementById("hud")!;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
const eng = createEngine(root, scene, camera);
// 화질 단계 (Q 키): 0 높음, 1 보통, 2 낮음. 해상도 배율과 블룸을 함께 조절한다
let bloomPass: any = null;
const QUALITY = [{ name: "높음", pr: 1.5, bloom: true }, { name: "보통", pr: 1, bloom: true }, { name: "낮음", pr: 0.75, bloom: false }];
const DEBUG = params.has("debug"); // 확인용 키(구역 바로 가기 등)는 주소에 ?debug 를 붙였을 때만 켠다
const readSaved = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeSaved = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* 저장소를 못 쓰면 이번만 */ } };
/** 휴대폰·태블릿처럼 손가락으로 조작하는 기기 (본 게임 RoomScreen 과 같은 판별) */
// 터치 화면이 달린 노트북·모니터에서도 마우스가 주 입력이면 PC 조작으로 한다: 주 입력 장치가 손가락(거칠고 호버 없음)일 때만 휴대폰 조작. 확인용: 주소에 &touch=1 / &touch=0 으로 강제
const isTouch = params.has("touch") ? params.get("touch") === "1" : matchMedia("(hover: none) and (pointer: coarse)").matches;
let quality = Math.min(2, Math.max(0, Number(params.get("q") ?? readSaved("uw.quality") ?? (isTouch ? 1 : 0)))); // 휴대폰은 보통 화질에서 시작한다(느리면 자동으로 더 내린다)
function applyQuality() {
  const q = QUALITY[quality];
  eng.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pr));
  eng.resize();
  for (const pass of eng.composer.passes as any[]) if (pass.strength !== undefined && pass.threshold !== undefined) { pass.enabled = q.bloom; bloomPass = pass; } // 블룸 패스
}
applyQuality();
// 화질 자동 조절: 2초 평균이 42FPS 아래로 떨어지면 한 단계 낮추고 그 단계를 기억한다. 30초 내내 넉넉하면(58FPS 이상) 한 번만 올려 보고, 올려서 다시 느려지면 내린 뒤 더는 올리지 않는다
let aqT = 0, aqN = 0, aqGood = 0, aqNoRaise = false, aqRaised = false;
function autoQuality(dt: number) {
  if (loading || document.hidden || dt > 0.25) { aqT = aqN = 0; return; }
  aqT += dt; aqN++;
  if (aqT < 2) return;
  const avg = aqN / aqT;
  aqT = aqN = 0;
  if (avg < 42 && quality < QUALITY.length - 1) {
    quality++; applyQuality(); writeSaved("uw.quality", String(quality));
    if (aqRaised) aqNoRaise = true;
    aqGood = 0;
  } else if (avg >= 58 && quality > 0 && !aqNoRaise) {
    if ((aqGood += 2) >= 30) { quality--; applyQuality(); writeSaved("uw.quality", String(quality)); aqRaised = true; aqGood = 0; }
  } else aqGood = 0;
}
// 브라우저 확대/축소(Ctrl+휠)는 화면 배율(devicePixelRatio)을 바꾸는데, 처음 켤 때 값으로 굳어 있어서 흐릿해졌다. 창 크기가 바뀔 때마다 다시 맞춘다
window.addEventListener("resize", applyQuality);
const FOG = new THREE.Color("#2b96bb");
scene.background = FOG;
scene.fog = new THREE.FogExp2(FOG, 0.017);
const hemi = new THREE.HemisphereLight(0xc4efff, 0x1f7396, 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3d6, 2.2);
sun.position.set(30, 90, 20);
scene.add(sun);

// 수면과 빛줄기
const dome = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  uniforms: { uFog: { value: FOG }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uB: { value: 1 } }, // uB: 햇빛이 닿는 정도 (심해·동굴은 0이라 위쪽이 밝아지지 않는다)
  vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `varying vec3 vD; uniform vec3 uFog; uniform vec3 uCam; uniform float uTime; uniform float uB;
float cz(vec2 p){ float a = sin(p.x*1.7 + uTime*0.9) + sin(p.y*1.9 - uTime*0.7) + sin((p.x+p.y)*1.1 + uTime*0.5); return pow(1.0 - abs(sin(a*1.3)), 4.0); }
void main(){ vec3 d = normalize(vD); float t = d.y;
  vec3 col = mix(uFog, mix(uFog, vec3(0.80, 0.96, 1.0), 0.8 * uB), smoothstep(0.0, 0.75, t));
  col = mix(col, uFog * 0.45, smoothstep(0.0, -0.7, t));
  if (t > 0.02) { float dist = -uCam.y / t; vec2 sp = uCam.xz + d.xz * dist; col += vec3(0.9, 1.0, 1.0) * (cz(sp * 0.16) + cz(sp * 0.31 + 4.0)) * 0.16 * uB * exp(-dist * 0.018); }
  gl_FragColor = vec4(col, 1.0); }`,
}));
dome.renderOrder = -10;
dome.frustumCulled = false;
scene.add(dome);
// 빛기둥: 수면에서 비스듬히 내려오는 부드러운 띠 (카메라를 향해 선다)
const shaftMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { uOp: { value: 0.5 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "varying vec2 vUv; uniform float uOp; void main(){ float x = (vUv.x - 0.5) * 3.2; float f = exp(-x * x * 2.2); gl_FragColor = vec4(vec3(0.82, 0.97, 1.0), uOp * 0.3 * f * smoothstep(0.0, 0.55, vUv.y)); }",
});
function rayMaterial(color: string, opacity: number, h: number) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: opacity }, uH: { value: h } },
    vertexShader: "varying vec3 vN; varying float vY; void main(){ vN = normalize(normalMatrix * normal); vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec3 vN; varying float vY; uniform vec3 uColor; uniform float uOp; uniform float uH; void main(){ float f = pow(abs(vN.z), 1.8); float fade = smoothstep(-uH, -uH * 0.1, vY) * (1.0 - smoothstep(-uH * 0.12, 0.0, vY) * 0.5); gl_FragColor = vec4(uColor, uOp * f * fade); }",
  });
}
const rays: THREE.Mesh[] = [];
for (let i = 0; i < 16; i++) {
  const g = new THREE.PlaneGeometry(5 + rnd() * 10, 70);
  g.translate(0, -35, 0);
  const m = new THREE.Mesh(g, shaftMat());
  m.userData.ox = (rnd() - 0.5) * 150;
  m.userData.oz = (rnd() - 0.5) * 150;
  m.userData.p = rnd() * 6;
  m.frustumCulled = false;
  scene.add(m);
  rays.push(m);
}

// 바닥과 구조물에 비치는 물결무늬 빛
function addCaustics(mat: THREE.Material) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windU;
    sh.uniforms.uCaus = causU;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vCaus;").replace("#include <begin_vertex>", "#include <begin_vertex>\n vCaus = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vCaus; uniform float uTime; uniform float uCaus;
float cz(vec2 p){ float a = sin(p.x*1.7 + uTime*0.9) + sin(p.y*1.9 - uTime*0.7) + sin((p.x+p.y)*1.1 + uTime*0.5); return pow(1.0 - abs(sin(a*1.3)), 6.0); }`)
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>
float cau = (cz(vCaus.xz*0.55) + cz(vCaus.xz*0.85 + 3.0)) * 0.5;
gl_FragColor.rgb += vec3(0.85, 1.0, 0.92) * cau * uCaus * smoothstep(-48.0, -22.0, vCaus.y);`);
  };
}

// ---- 해저 바닥 (우리 코드로 만든 넓은 모래 바닥) -------------------------------------
{
  // 8x8 조각으로 나눠 화면 밖 조각은 그리지 않는다 (한 장이면 35만 삼각형이 늘 그려진다)
  const SIZE = HALF * 2 + 20, TILES = 8, SEG = 32, TS = SIZE / TILES;
  const sandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  addCaustics(sandMat);
  const c = new THREE.Color(), t = new THREE.Color(), n = new THREE.Vector3();
  for (let tx = 0; tx < TILES; tx++) for (let tz = 0; tz < TILES; tz++) {
    const geo = new THREE.PlaneGeometry(TS, TS, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    geo.translate(-SIZE / 2 + (tx + 0.5) * TS, 0, -SIZE / 2 + (tz + 0.5) * TS);
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      n.set(heightAt(x - 1, z) - heightAt(x + 1, z), 2, heightAt(x, z - 1) - heightAt(x, z + 1)).normalize(); // 조각 이음매가 안 보이게 기울기에서 바로 구한다
      nor.setXYZ(i, n.x, n.y, n.z);
      const { w, sum } = zoneWeights(x, z);
      c.set("#b9b08a");
      ZONES.forEach((q, k) => c.lerp(t.set(q.tint), (w[k] / Math.max(sum, 1e-6)) * Math.min(1, sum * 1.4)));
      c.multiplyScalar(0.92 + 0.12 * (0.5 + 0.5 * fbm(x * 1.7, z * 1.7)));
      c.lerp(t.set("#6f8088"), smooth(0.05, 0.5, wallAt(x, z))); // 능선은 바위 빛
      c.multiplyScalar(0.55 + 0.45 * smooth(-58, -24, h)); // 깊을수록 어둡게
      c.multiplyScalar(0.12 + 0.88 * smooth(HOLE.r, HOLE.r + 6, Math.hypot(x - HOLE.x, z - HOLE.z))); // 심해로 내려가는 구멍 속은 캄캄하게
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();
    scene.add(new THREE.Mesh(geo, sandMat));
  }
}

// ---- 폴리포크 소품 (지형 위 사물) --------------------------------------------------
// fixed: [x, z, 크기, 방향, 앞뒤 기울기, 좌우 기울기] 구역 중심 기준 고정 배치
interface Spec { id: string; zone: number; n: number; s: [number, number]; r: number; sway?: number; ring?: boolean; fixed?: Array<[number, number, number, number, number?, number?]> }
const R3 = (n: number, sMin: number, sMax: number, r: number, extra: Partial<Spec> = {}) => ({ n, s: [sMin, sMax] as [number, number], r, ...extra });
const SPECS: Spec[] = [
  // 0 알록달록 산호 숲, 5 거북이 모래 만: 바위·산호·해초·유적이 모두 우리 모델(coral.glb, turtle.glb)에 들어 있어 소품이 없다
  // 1 아틀란티스 유적: 도시는 우리 모델(atlantis.glb), 여기서는 그 위에 자란 산호와 해초, 바위만
  { id: "staghorn-coral-422d23", zone: 1, ...R3(46, 1.2, 2.2, 44) },
  { id: "sea-fan-bafd49", zone: 1, ...R3(46, 1.3, 2.4, 44, { sway: 0.04 }) },
  { id: "table-coral-193fa6", zone: 1, ...R3(30, 1.3, 2.4, 44) },
  { id: "soft-coral-tree-450af0", zone: 1, ...R3(30, 1.2, 2.0, 44, { sway: 0.05 }) },
  { id: "tube-sponge-df576b", zone: 1, ...R3(26, 1.4, 2.4, 44) },
  { id: "brain-coral-head-7db21a", zone: 1, ...R3(20, 1.3, 2.2, 44) },
  { id: "sea-whip-e56668", zone: 1, ...R3(30, 1.2, 2.2, 44, { sway: 0.1 }) },
  { id: "seagrass-tuft-862cc5", zone: 1, ...R3(170, 2.0, 3.6, 46, { sway: 0.18 }) },
  { id: "small-reef-rock-99062d", zone: 1, ...R3(50, 1.6, 3.4, 60) },
  // 2 난파선 지대: 배 두 척과 닻·바위는 우리 모델(wreck.glb), 여기서는 대포·통·상자와 산호, 해초
  { id: "overflowing-treasure-chest-3d6ee0", zone: 2, n: 0, s: [1, 1], r: 0, fixed: [[-6, 6, 2.2, 0.6], [24, -34, 1.9, 2.2]] },
  { id: "deck-cannon-17849e", zone: 2, ...R3(6, 1.8, 2.4, 20) },
  { id: "admiralty-anchor-bd6882", zone: 2, ...R3(2, 1.8, 2.6, 26) },
  { id: "wooden-barrel-6afab0", zone: 2, ...R3(7, 1.8, 2.4, 24) },
  { id: "staghorn-coral-422d23", zone: 2, ...R3(16, 1.2, 2.2, 30) },
  { id: "tube-sponge-df576b", zone: 2, ...R3(16, 1.4, 2.6, 30) },
  { id: "sea-fan-bafd49", zone: 2, ...R3(16, 1.3, 2.4, 30, { sway: 0.04 }) },
  { id: "sea-whip-e56668", zone: 2, ...R3(22, 1.2, 2.2, 34, { sway: 0.1 }) },
  { id: "seagrass-tuft-862cc5", zone: 2, ...R3(46, 2.0, 3.4, 36, { sway: 0.18 }) },
  // 3 해적 보물 동굴: 동굴 자체(벽·천장·종유석·바닥)는 우리 모델(cave.glb), 여기서는 보물과 해골, 게, 통, 해초
  { id: "lair-stalagmite-7d4d95", zone: 3, ...R3(31, 1.4, 2.4, 56) },
  { id: "overflowing-treasure-chest-3d6ee0", zone: 3, n: 0, s: [1, 1], r: 0, fixed: [[-14, 10, 2.8, 0.7], [40, -26, 2.2, 3.5], [-44, -26, 2, 1.9]] }, // 자리는 base_model/cave.py 의 GOLD 와 맞춘다
  { id: "treasure-chest-c2ac4f", zone: 3, n: 0, s: [1, 1], r: 0, fixed: [[4, -52, 2.4, 2.8], [42, 26, 2.2, 0.2]] },
  { id: "coin-hoard-heap-07b6e4", zone: 3, n: 0, s: [1, 1], r: 0, fixed: [[-10, 14, 3.2, 0], [44, -22, 3, 1], [-40, -30, 2.8, 2], [8, -48, 2.6, 3]] },
  { id: "spilled-coin-pile-caccf6", zone: 3, ...R3(26, 2.4, 3.4, 48) },
  { id: "skull-and-bone-scatter-3dea4c", zone: 3, ...R3(18, 1.8, 2.8, 52) },
  { id: "bone-scatter-90313d", zone: 3, ...R3(18, 1.8, 2.8, 56) },
  { id: "reef-crab-base", zone: 3, n: 0, s: [1, 1], r: 0, fixed: [[-6, 16, 2.6, 0.5], [36, -20, 2.4, 2.4], [-38, 22, 2.2, 4.1]] },
  { id: "wooden-barrel-6afab0", zone: 3, ...R3(18, 2.0, 2.8, 48) },
  { id: "tube-sponge-df576b", zone: 3, ...R3(44, 1.4, 2.6, 56) },
  { id: "seagrass-tuft-862cc5", zone: 3, ...R3(110, 2.2, 4.0, 60, { sway: 0.18 }) },
  { id: "sea-whip-e56668", zone: 3, ...R3(53, 1.4, 2.4, 60, { sway: 0.1 }) },
  { id: "seabed-bubble-vent-cfa541", zone: 3, ...R3(11, 1.6, 2.4, 48) },
  // 4 심해 협곡: 절벽·봉우리·아치·빛나는 수정은 우리 모델(deep.glb), 여기서는 키 큰 해초와 해면만
  { id: "seagrass-tuft-862cc5", zone: 4, ...R3(70, 5.0, 8.5, 52, { sway: 0.18 }) },
  { id: "sea-whip-e56668", zone: 4, ...R3(60, 1.8, 3.2, 52, { sway: 0.1 }) },
  { id: "tube-sponge-df576b", zone: 4, ...R3(46, 1.6, 3.0, 52) },
  { id: "seabed-bubble-vent-cfa541", zone: 4, ...R3(12, 1.8, 3.0, 40) },
];
// 구역을 넓게: 무작위 배치 소품은 개수와 반경을 키운다 (고정 배치는 그대로)
SPECS.forEach((sp) => { if (!sp.fixed) { sp.n = Math.round(sp.n * 1.3); sp.r = sp.r * 1.4; } });
// 빛나는 소품: 심해 크리스털과 금화
const GLOW: Record<string, [string, number]> = {
  "crystal-cluster-78f2d7": ["#4a8cff", 2.2], "crystal-cluster-624138": ["#5a9cff", 2.2], "lair-crystal-column-877d1a": ["#3fd2ff", 2.2],
  "coin-hoard-heap-07b6e4": ["#ffb52e", 0.8], "spilled-coin-pile-caccf6": ["#ffb52e", 0.7], "overflowing-treasure-chest-3d6ee0": ["#ffb52e", 0.35], "treasure-chest-c2ac4f": ["#ffb52e", 0.3],
};

const windU = { value: 0 };
const causU = { value: 0.5 };
interface Part { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial; col0: Float32Array | null }
const propParts = new Map<string, Part[]>();
const loader = new GLTFLoader();
async function loadProp(id: string) {
  const gltf = await loader.loadAsync(CDN + id + ".glb");
  gltf.scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    const src = m.material as THREE.MeshStandardMaterial;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: !!geo.attributes.color, color: src.color ?? 0xffffff, roughness: 0.9, metalness: 0, transparent: src.transparent, opacity: src.opacity });
    const gl = GLOW[id];
    if (gl) { mat.emissive = new THREE.Color(gl[0]); mat.emissiveIntensity = gl[1]; }
    const colAttr = geo.attributes.color as THREE.BufferAttribute | undefined;
    parts.push({ geo, mat, col0: colAttr ? new Float32Array(colAttr.array as Float32Array) : null });
  });
  propParts.set(id, parts);
}

// 파스텔로 낮춘 색 (우리 캐릭터·물고기 톤에 가깝게). P 키로 원래 색과 비교
let pastel = params.get("pastel") === "1";
function applyPastel() {
  const c = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };
  for (const parts of propParts.values()) for (const p of parts) {
    const attr = p.geo.attributes.color as THREE.BufferAttribute | undefined;
    if (!attr || !p.col0) continue;
    for (let i = 0; i < attr.count; i++) {
      c.setRGB(p.col0[i * 3], p.col0[i * 3 + 1], p.col0[i * 3 + 2]);
      if (pastel) { c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * 0.9, hsl.l * 0.9 + 0.07); }
      attr.setXYZ(i, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  }
}

const tick = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
let loading = "불러오는 중...";
const CELL = 96; // 칸이 클수록 그리기 횟수가 준다
const chunks: Array<{ mesh: THREE.InstancedMesh; x: number; z: number; small: boolean }> = [];
interface Placed { x: number; y: number; z: number; ry: number; s: number; tx: number; tz: number }
const placedHeroes = new Map<string, Placed[]>();
async function placeProps() {
  const dummy = new THREE.Object3D();
  let done = 0;
  for (const spec of SPECS) {
    await tick(); // 한 종류씩 배치하고 한 프레임 쉰다
    loading = `지형을 배치하는 중... ${++done}/${SPECS.length}`;
    const parts = propParts.get(spec.id);
    if (!parts) continue;
    const z = ZONES[spec.zone];
    const pts: Placed[] = [];
    if (spec.fixed) {
      for (const [dx, dz, sc, ry, tx = 0, tz = 0] of spec.fixed) {
        const x = z.x + dx, zz = z.z + dz;
        const pl = { x, y: heightAt(x, zz), z: zz, ry, s: sc, tx, tz };
        pts.push(pl);
        (placedHeroes.get(spec.id) ?? placedHeroes.set(spec.id, []).get(spec.id)!).push(pl);
      }
    } else {
      for (let i = 0; i < spec.n; i++) {
        let x: number, zz: number;
        if (spec.ring) { const a = (i / spec.n) * Math.PI * 2 + rnd() * 0.2; const rr = spec.r * (0.8 + rnd() * 0.3); x = z.x + Math.cos(a) * rr; zz = z.z + Math.sin(a) * rr; }
        else { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * spec.r; x = z.x + Math.cos(a) * rr; zz = z.z + Math.sin(a) * rr; }
        pts.push({ x, y: heightAt(x, zz), z: zz, ry: rnd() * 6.28, s: spec.s[0] + rnd() * (spec.s[1] - spec.s[0]), tx: (rnd() - 0.5) * 0.12, tz: (rnd() - 0.5) * 0.12 });
      }
    }
    // 작은 소품(풀, 불가사리, 작은 산호)은 멀리서는 점이라 가까운 칸에서만 그린다
    const small = Math.max(...parts.map((p) => { p.geo.boundingSphere ?? p.geo.computeBoundingSphere(); return p.geo.boundingSphere!.radius + p.geo.boundingSphere!.center.length(); })) * spec.s[1] < 5;
    for (const p of parts) {
      const mat = p.mat.clone();
      if (spec.sway) {
        const amp = spec.sway;
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uWind = windU;
          sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nuniform float uWind;")
            .replace("#include <begin_vertex>", `#include <begin_vertex>\n float sw = sin(uWind * 1.1 + instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27) * max(position.y, 0.0) * ${amp.toFixed(3)}; transformed.x += sw; transformed.z += sw * 0.6;`);
        };
      }
      // 칸별로 따로 만들어 화면 밖과 먼 칸은 그리지 않게 한다
      const cells = new Map<string, Placed[]>();
      for (const m of pts) {
        const key = Math.floor(m.x / CELL) + "," + Math.floor(m.z / CELL);
        (cells.get(key) ?? cells.set(key, []).get(key)!).push(m);
      }
      for (const [key, list] of cells) {
        const im = new THREE.InstancedMesh(p.geo, mat, list.length);
        list.forEach((m, i) => {
          dummy.position.set(m.x, m.y - 0.05, m.z);
          dummy.rotation.set(m.tx, m.ry, m.tz);
          dummy.scale.setScalar(m.s);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
        });
        im.instanceMatrix.needsUpdate = true;
        const [cx, cz] = key.split(",").map(Number);
        scene.add(im);
        chunks.push({ mesh: im, x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL, small });
      }
    }
  }
}

// ---- 우리가 코드로 만드는 구조물 (폴리포크에 없는 것): 신전, 동굴 천장, 돛대, 해적 깃발, 발광 해파리 ----------
// 부딪히는 것: 우리가 지은 구역 모델(건물, 동굴 벽, 배, 절벽). 캐릭터는 벽을 따라 미끄러지고 카메라는 벽 앞으로 당겨진다
const solids: THREE.Object3D[] = [];
const caster = new THREE.Raycaster();
function hitSolid(from: THREE.Vector3, dir: THREE.Vector3, far: number) {
  caster.set(from, dir);
  caster.far = far;
  return caster.intersectObjects(solids, true)[0];
}
/** 처음 보이는 물체를 그 순간에 준비하느라 멈칫하지 않게, 불러오기 끝에 전부 한 번 그려 둔다 */
function prewarm() {
  const saved: Array<[THREE.Object3D, boolean, boolean]> = [];
  scene.traverse((o) => { saved.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; });
  eng.render();
  for (const [o, v, f] of saved) { o.visible = v; o.frustumCulled = f; }
}

/** 우리가 Blender로 지은 구역 모델(base_model/*.py)을 구역 중심에 놓는다. 함께 나온 json(바닥 높이 정보)을 돌려준다 */
async function loadZoneModel(name: string, zi: number, lift: number) {
  const z = ZONES[zi];
  const [gltf, info] = await Promise.all([loader.loadAsync(`/models/underwater/${name}.glb`), fetch(`/models/underwater/${name}.json`).then((r) => r.json())]);
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.9, 1.9, 1.9) }); // 스스로 빛나는 것(수정): 번짐 효과가 걸리게 밝게
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }); // 음영은 꼭짓점 색에 구워져 있다
  addCaustics(mat);
  // 돌 표면: 얼룩과 이끼, 큰 벽의 돌 쌓은 줄눈을 셰이더로 그린다 (텍스처 파일도 추가 삼각형도 없다). 줄눈을 그릴 벽은 꼭짓점 색의 알파가 0
  const withCaustics = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    withCaustics.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
{ vec3 wn = normalize(cross(dFdx(vCaus), dFdy(vCaus)));
  float n1 = vnoise(vCaus * 0.45), n2 = vnoise(vCaus * 2.1 + 7.0), n3 = vnoise(vCaus * 8.0 + 3.0);
  diffuseColor.rgb *= 0.66 + 0.22 * n1 + 0.16 * n2 + 0.10 * n3;
  float moss = smoothstep(0.50, 0.72, n1 * 0.55 + n2 * 0.45) * (0.35 + 0.65 * smoothstep(0.4, 0.9, wn.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.50, 0.95, 0.78), moss * 0.75);
#ifdef USE_COLOR_ALPHA
  float side = (1.0 - vColor.a) * (1.0 - smoothstep(0.3, 0.6, abs(wn.y)));
  float row = floor(vCaus.y / 0.9), fy = fract(vCaus.y / 0.9);
  float u = dot(vCaus.xz, normalize(vec2(-wn.z, wn.x) + 1e-4)) / 1.9 + mod(row, 2.0) * 0.5, fu = fract(u);
  float ln = max(1.0 - smoothstep(0.0, 0.04, min(fy, 1.0 - fy)), 1.0 - smoothstep(0.0, 0.02, min(fu, 1.0 - fu)));
  diffuseColor.rgb *= mix(1.0, (0.88 + 0.24 * h31(vec3(floor(u), row, 1.0))) * (1.0 - 0.5 * ln), side);
  diffuseColor.a = 1.0;
#endif
}`);
  };
  if (info.doubleSided) mat.side = THREE.DoubleSide; // 동굴: 벽 안쪽과 구멍 가장자리의 뒷면도 보인다
  // 산호·해초("coral_" 메시): 얼룩 없이 선명한 색 그대로. 꼭짓점 색의 알파가 낮은 곳(해초 끝)은 물결에 흔들린다
  const vivid = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide });
  addCaustics(vivid);
  const vividCaustics = vivid.onBeforeCompile;
  vivid.onBeforeCompile = (sh, r) => {
    vividCaustics.call(vivid, sh, r);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_COLOR_ALPHA
 float sw = 1.0 - color.a;
 transformed.x += sin(uTime * 1.6 + position.x * 0.8 + position.z * 0.6) * sw * 0.32;
 transformed.z += cos(uTime * 1.3 + position.x * 0.5) * sw * 0.18;
#endif`);
  };
  gltf.scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const coral = o.name.startsWith("coral");
    (o as THREE.Mesh).material = o.name.startsWith("glow") ? glow : coral ? vivid : mat;
    if (coral) o.raycast = () => {}; // 산호와 해초는 헤엄쳐 지나갈 수 있고 카메라도 가리지 않는다
  });
  gltf.scene.position.set(z.x, z.d + lift, z.z);
  scene.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  solids.push(gltf.scene);
  return info;
}

// 해적선: 돛대와 찢어진 돛, 해적 깃발
const flagCloth: THREE.Mesh[] = [];
function buildFlag() {
  const x = CAVE.x + 10, zz = CAVE.z + 2, y = heightAt(x, zz);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 9.5, 8), new THREE.MeshStandardMaterial({ color: "#5d4636", roughness: 1 }));
  pole.position.set(x, y + 4.75, zz);
  const c = document.createElement("canvas");
  c.width = 256; c.height = 176;
  const g2 = c.getContext("2d")!;
  g2.fillStyle = "#1d1f26"; g2.fillRect(0, 0, 256, 176);
  g2.fillStyle = "#eee6d2";
  g2.beginPath(); g2.arc(128, 74, 36, 0, Math.PI * 2); g2.fill();
  g2.fillRect(104, 96, 48, 22);
  g2.fillStyle = "#1d1f26"; g2.beginPath(); g2.arc(114, 70, 8, 0, 7); g2.arc(142, 70, 8, 0, 7); g2.fill();
  g2.strokeStyle = "#eee6d2"; g2.lineWidth = 13; g2.lineCap = "round";
  g2.beginPath(); g2.moveTo(64, 126); g2.lineTo(192, 160); g2.moveTo(192, 126); g2.lineTo(64, 160); g2.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.4, 10, 6), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.DoubleSide }));
  cloth.position.set(x + 3.4, y + 7.0, zz);
  cloth.userData.base = Float32Array.from(cloth.geometry.attributes.position.array as Float32Array);
  scene.add(pole, cloth);
  flagCloth.push(cloth);
}

function updateExtras(t: number) {
  for (const cl of flagCloth) {
    const base = cl.userData.base as Float32Array, arr = cl.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < arr.count; i++) { const x = base[i * 3]; arr.setZ(i, Math.sin(x * 1.3 - t * 3) * 0.35 * ((x + 3.2) / 6.4)); }
    arr.needsUpdate = true;
  }
}

// 구역 환경: 안개 색과 짙기, 빛, 빛줄기, 번짐, 바닥의 물결무늬 빛을 가까운 구역끼리 부드럽게 섞는다
function applyEnv(dt: number) {
  const { w, sum } = zoneWeights(player.pos.x, player.pos.z);
  const zi = w.indexOf(Math.max(...w));
  if (zi !== curZone && !trans && !loading) { titleEl.textContent = ZONES[zi].name; titleEl.style.opacity = "1"; titleUntil = t + 2.4; } // 헤엄쳐서 다른 구역에 들어서면 이름을 잠깐 띄운다
  curZone = zi;
  const tot = Math.max(sum, 1e-6);
  let dens = 0, sunI = 0, hemiI = 0, ray = 0, bloom = 0, caus = 0, top = 0;
  ENV_FOG.setRGB(0, 0, 0); ENV_SKY.setRGB(0, 0, 0); ENV_GND.setRGB(0, 0, 0);
  ZONES.forEach((q, i) => {
    const k = w[i] / tot, e = q.env;
    TMP_C.set(e.fog); ENV_FOG.r += TMP_C.r * k; ENV_FOG.g += TMP_C.g * k; ENV_FOG.b += TMP_C.b * k;
    TMP_C.set(e.sky); ENV_SKY.r += TMP_C.r * k; ENV_SKY.g += TMP_C.g * k; ENV_SKY.b += TMP_C.b * k;
    TMP_C.set(e.ground); ENV_GND.r += TMP_C.r * k; ENV_GND.g += TMP_C.g * k; ENV_GND.b += TMP_C.b * k;
    dens += e.dens * k; sunI += e.sun * k; hemiI += e.hemi * k; ray += e.ray * k; bloom += e.bloom * k; caus += e.caus * k; top += (e.top ?? Math.min(1, Math.max(0, (e.sun - 0.7) / 1.2))) * k;
  });
  const a = Math.min(1, dt * 1.5);
  FOG.lerp(ENV_FOG, a);
  const fog = scene.fog as THREE.FogExp2;
  fog.color.copy(FOG);
  fog.density += (dens - fog.density) * a;
  hemi.color.lerp(ENV_SKY, a);
  hemi.groundColor.lerp(ENV_GND, a);
  hemi.intensity += (hemiI - hemi.intensity) * a;
  sun.intensity += (sunI - sun.intensity) * a;
  const uB = (dome.material as THREE.ShaderMaterial).uniforms.uB;
  uB.value += (top - uB.value) * a;
  for (const r of rays) { const u = (r.material as THREE.ShaderMaterial).uniforms.uOp; u.value += (ray * 5 - u.value) * a; }
  causU.value += (caus - causU.value) * a;
  if (bloomPass && QUALITY[quality].bloom) bloomPass.strength += (bloom - bloomPass.strength) * a;
}

// ---- 우리 물고기: 떼, 큰 생물, 신화 탈것 -----------------------------------------------
function makeFish(sp: FishSpecies, len: number) {
  const f = buildFish(sp);
  const box = bodyBox(f);
  const size = box.getSize(new THREE.Vector3());
  const k = len / Math.max(size.x, size.y, size.z, 0.001);
  const center = box.getCenter(new THREE.Vector3());
  f.scale.multiplyScalar(k);
  f.position.set(-center.x * k, -center.y * k, -center.z * k);
  const root = new THREE.Group();
  root.add(f);
  return { root, fish: f, k, box };
}
// ---- 그리기 부담 줄이기 ------------------------------------------------------------
/** 구 모양 부품은 격자를 건너뛰어 삼각형을 줄인다 (꼭짓점은 그대로 두고 색인만 새로 짠다) */
function thin(g: THREE.BufferGeometry, target = 14): THREE.BufferGeometry {
  const p = (g as any).parameters;
  if (g.type === "ExtrudeGeometry" && p?.options) { // 지느러미: 곡선과 모서리 단계를 줄여 다시 만든다
    const out = new THREE.ExtrudeGeometry(p.shapes, { ...p.options, bevelSegments: 1, curveSegments: 5 });
    out.translate(0, 0, -(p.options.depth ?? 0) / 2);
    return out;
  }
  if (g.type !== "SphereGeometry" || !p || !g.index) return g;
  const W: number = p.widthSegments, H: number = p.heightSegments, st = Math.ceil(W / target);
  if (st < 2) return g;
  const cols: number[] = [], rows: number[] = [];
  for (let c = 0; c < W; c += st) cols.push(c);
  for (let r = 0; r < H; r += st) rows.push(r);
  cols.push(W); rows.push(H);
  const at = (r: number, c: number) => r * (W + 1) + c, idx: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < cols.length - 1; j++) {
    const a = at(rows[i], cols[j + 1]), b = at(rows[i], cols[j]), c = at(rows[i + 1], cols[j]), d = at(rows[i + 1], cols[j + 1]);
    idx.push(a, b, d, b, c, d);
  }
  const out = g.clone();
  out.setIndex(idx);
  return out;
}
/** 부품의 위치를 구워 넣은 낱개 삼각형 형태로 만든다. 뒤집힌(거울) 부품은 면 방향을 바로잡는다 */
function baked(m: THREE.Mesh, mat4: THREE.Matrix4, lowPoly: boolean): THREE.BufferGeometry {
  const src = lowPoly ? thin(m.geometry) : m.geometry;
  const g = src.index ? src.toNonIndexed() : src.clone();
  g.applyMatrix4(mat4);
  if (mat4.determinant() < 0) for (const a of Object.values(g.attributes) as THREE.BufferAttribute[]) {
    const arr = a.array as Float32Array, n = a.itemSize;
    for (let i = 0; i + 2 * n <= arr.length; i += 3 * n) for (let k = 0; k < n; k++) { const t0 = arr[i + k]; arr[i + k] = arr[i + n + k]; arr[i + n + k] = t0; }
  }
  return g;
}
/** 겉보기가 같은 재질인지 가리는 표식 (부품마다 복제된 재질도 한데 묶기 위해) */
function matSig(m: THREE.Material): string {
  const a = m as THREE.MeshPhysicalMaterial;
  if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || (m as any).isShaderMaterial) return m.uuid; // 셰이더를 손댄 재질은 섞지 않는다
  return [m.type, a.color?.getHexString(), a.emissive?.getHexString(), a.emissiveIntensity, a.roughness, a.metalness, a.clearcoat, a.opacity, a.transparent, a.side, a.vertexColors, a.blending, a.depthWrite,
    a.map?.uuid, a.bumpMap?.uuid, a.normalMap?.uuid, a.emissiveMap?.uuid, a.alphaMap?.uuid, a.onBeforeCompile === THREE.Material.prototype.onBeforeCompile].join("|");
}
/** 같은 재질끼리 한 덩어리로 합친다 (속성 구성이 다르면 따로 둔다) */
function mergeByMaterial(items: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; key?: string }>) {
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  for (const it of items) {
    const key = (it.key ?? "") + matSig(it.mat) + Object.keys(it.geo.attributes).sort().join();
    (groups.get(key) ?? groups.set(key, { mat: it.mat, geos: [] }).get(key)!).geos.push(it.geo);
  }
  return [...groups.values()].map((g) => ({ mat: g.mat, geo: g.geos.length > 1 ? mergeGeometries(g.geos) ?? g.geos[0] : g.geos[0] }));
}
/** 큰 생물: 움직이지 않는 부품끼리 재질별로 합친다. 움직이는 마디(꼬리, 지느러미)는 동작을 세 번 돌려 보고 찾아낸다 */
function flatten(fish: THREE.Object3D) {
  const upd = fish.userData.update as ((t: number) => void) | undefined;
  const nodes: THREE.Object3D[] = [];
  fish.traverse((o) => { if (o !== fish) nodes.push(o); });
  const snap = () => nodes.map((o) => { o.updateMatrix(); return [...o.matrix.elements, o.visible ? 1 : 0]; });
  upd?.(0.37); const s1 = snap(); upd?.(1.91); const s2 = snap(); upd?.(4.13); const s3 = snap();
  const moving = new Set<THREE.Object3D>();
  nodes.forEach((o, i) => { if (s1[i].some((v, k) => Math.abs(v - s2[i][k]) > 1e-6 || Math.abs(v - s3[i][k]) > 1e-6)) moving.add(o); });
  fish.updateMatrixWorld(true);
  const byAnchor = new Map<THREE.Object3D, THREE.Mesh[]>();
  for (const o of nodes) {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as any).isSkinnedMesh || Array.isArray(m.material) || moving.has(m) || m.children.length || !m.visible || m.userData.live) continue; // live: 꼭짓점이 매 프레임 움직이는 부품(날개·돛·천)은 합치지 않는다
    let anchor = m.parent!;
    while (anchor !== fish && !moving.has(anchor)) anchor = anchor.parent!;
    (byAnchor.get(anchor) ?? byAnchor.set(anchor, []).get(anchor)!).push(m);
  }
  // 반짝이 알갱이처럼 같은 모양·같은 재질의 작은 구가 여럿인 묶음은 한 번에 그린다. 원래 알갱이는 숨긴 채 움직임만 계산하고 그 위치를 베낀다
  const fx: Array<{ im: THREE.InstancedMesh; group: THREE.Object3D; kids: THREE.Mesh[]; k: number[] }> = [];
  for (const g of [fish, ...nodes]) {
    const kids = g.children as THREE.Mesh[];
    if (kids.length < 6 || !g.parent || !kids.every((c) => c.isMesh && !c.children.length && c.geometry.type === "SphereGeometry" && !Array.isArray(c.material))) continue;
    const sig = matSig(kids[0].material as THREE.Material).replace((kids[0].material as THREE.Material).uuid, "");
    if (!kids.every((c) => matSig(c.material as THREE.Material) === sig)) continue;
    const r0 = (kids[0].geometry as any).parameters.radius as number;
    const im = new THREE.InstancedMesh(kids[0].geometry, kids[0].material as THREE.Material, kids.length);
    im.frustumCulled = false;
    im.matrixAutoUpdate = false;
    g.parent.add(im);
    for (const c of kids) c.visible = false;
    fx.push({ im, group: g, kids, k: kids.map((c) => ((c.geometry as any).parameters.radius as number) / r0) });
  }
  if (fx.length) {
    const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3();
    fish.userData.update = (t: number) => {
      upd?.(t);
      for (const f of fx) {
        f.group.updateMatrix();
        f.im.matrix.copy(f.group.matrix);
        f.im.matrixWorldNeedsUpdate = true;
        f.kids.forEach((c, i) => { c.updateMatrix(); f.im.setMatrixAt(i, m4.copy(c.matrix).scale(v3.setScalar(f.k[i]))); });
        f.im.instanceMatrix.needsUpdate = true;
      }
    };
  }
  for (const [anchor, list] of byAnchor) {
    if (list.length < 2) continue;
    const inv = new THREE.Matrix4().copy(anchor.matrixWorld).invert();
    const merged = mergeByMaterial(list.map((m) => ({ geo: baked(m, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), false), mat: m.material as THREE.Material, key: String(m.renderOrder) })));
    for (const m of list) m.removeFromParent();
    for (const g of merged) anchor.add(new THREE.Mesh(g.geo, g.mat));
  }
}

const pickSp = (pred: (s: FishSpecies) => boolean, nth = 0) => SPECIES.filter(pred)[nth];
const schoolPool = SPECIES.filter((s) => ["slim", "round", "bass", "carp", "flat"].includes(s.body) && s.rarity !== "mythic" && s.rarity !== "legendary");

const clampW = (v: number) => Math.min(HALF - 20, Math.max(-HALF + 20, v));
const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const RND = Math.random; // 시각 효과라 매번 다르게
// 새로 나타날 방향: 대부분은 바라보는 쪽의 먼 안개 속(헤엄쳐 가면 점점 보인다), 나머지는 사방
const spawnAngle = () => (RND() < 0.7 ? Math.atan2(Math.cos(camYaw), Math.sin(camYaw)) + (RND() - 0.5) * Math.PI * 1.3 : RND() * Math.PI * 2);

// 물고기떼: 템플릿(종류와 부품)은 처음에 만들어 두고, 위치와 방향, 크기, 마릿수만 계속 새로 정한다
interface School { n: number; active: number; meshes: THREE.InstancedMesh[]; offs: THREE.Vector3[]; phs: number[]; sc: number; pos: THREE.Vector3; a: number; turn: number; speed: number; above: number; zone?: number }
const schools: School[] = [];
const tmpObj = new THREE.Object3D();
function respawnSchool(s: School, initial: boolean) {
  // 처음에는 주변 곳곳에, 이후에는 안개에 가려진 먼 곳(100m 이상)에서 나타난다
  const R = initial ? 18 + RND() * 95 : 102 + RND() * 16;
  const ang = initial ? RND() * Math.PI * 2 : spawnAngle();
  s.pos.x = clampW(player.pos.x + Math.cos(ang) * R);
  s.pos.z = clampW(player.pos.z + Math.sin(ang) * R);
  // 플레이어 근처를 지나가도록 방향을 잡는다
  const tx = player.pos.x + (RND() - 0.5) * 70, tz = player.pos.z + (RND() - 0.5) * 70;
  s.a = Math.atan2(tz - s.pos.z, tx - s.pos.x);
  s.turn = 0;
  s.speed = 2.5 + RND() * 2.5;
  s.above = 2 + RND() * 12;
  s.sc = 0.8 + RND() * 0.5;
  s.active = Math.max(4, Math.ceil(s.n * (0.5 + RND() * 0.5)));
  s.pos.y = Math.min(-3, heightAt(s.pos.x, s.pos.z) + s.above);
  for (const im of s.meshes) im.count = s.active;
}
function addSchool(sp: FishSpecies, n: number, len: number, zone?: number) {
  const base = makeFish(sp, len);
  base.root.updateMatrixWorld(true);
  // 기준 물고기의 부품을 위치까지 구워서 부품마다 인스턴스 메시 하나로 만든다 (꼬리 흔들림은 몸 전체 흔들림으로 대신)
  // 멀리서 떼로 보는 물고기라 구 모양 부품은 삼각형을 줄이고, 같은 재질끼리 합친다
  const items: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  base.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (o as THREE.Sprite).isSprite || Array.isArray(m.material) || (m.material as THREE.Material).type === "ShaderMaterial") return;
    items.push({ geo: baked(m, m.matrixWorld, true), mat: m.material as THREE.Material });
  });
  const meshes = mergeByMaterial(items).map((g) => {
    const im = new THREE.InstancedMesh(g.geo, g.mat, n);
    im.frustumCulled = false;
    scene.add(im);
    return im;
  });
  const offs: THREE.Vector3[] = [];
  const phs: number[] = [];
  for (let i = 0; i < n; i++) {
    phs.push(rnd() * 6);
    offs.push(new THREE.Vector3((rnd() - 0.5) * 4.5, (rnd() - 0.5) * 2.2, (rnd() - 0.5) * 4.5));
  }
  const s: School = { n, active: n, meshes, offs, phs, sc: 1, pos: new THREE.Vector3(), a: 0, turn: 0, speed: 3, above: 5, zone };
  respawnSchool(s, true);
  schools.push(s);
}
function updateSchool(s: School, t: number, dt: number) {
  s.turn = Math.min(0.35, Math.max(-0.35, s.turn + (RND() - 0.5) * dt * 1.2));
  s.a += s.turn * dt;
  // 맵 가장자리에서는 안쪽으로 돌아선다
  if (Math.abs(s.pos.x) > HALF - 30 || Math.abs(s.pos.z) > HALF - 30) s.a -= angDiff(s.a, Math.atan2(-s.pos.z, -s.pos.x)) * Math.min(1, dt * 1.5);
  s.pos.x += Math.cos(s.a) * s.speed * dt;
  s.pos.z += Math.sin(s.a) * s.speed * dt;
  s.pos.y += (Math.min(-3, heightAt(s.pos.x, s.pos.z) + s.above) - s.pos.y) * Math.min(1, dt * 0.8);
  const dist = Math.hypot(s.pos.x - player.pos.x, s.pos.z - player.pos.z);
  if (dist > 140) { respawnSchool(s, false); return; } // 안개 속으로 멀어졌으면 다른 곳에서 새로 나타난다
  const far = dist > 118 || (s.zone === undefined ? curZone === 2 || curZone === 4 : s.zone !== curZone); // 안개에 가려 안 보이는 거리와 제 구역이 아닌 곳에서는 그리지 않는다
  s.meshes.forEach((im) => (im.visible = !far));
  if (far) return;
  const yaw = -s.a;
  for (let i = 0; i < s.active; i++) {
    const o = s.offs[i], ph = s.phs[i];
    tmpObj.position.set(s.pos.x + o.x * s.sc + Math.sin(t * 0.8 + ph) * 0.6, s.pos.y + o.y * s.sc + Math.sin(t * 0.6 + ph * 2) * 0.5, s.pos.z + o.z * s.sc + Math.cos(t * 0.7 + ph) * 0.6);
    tmpObj.rotation.set(0, yaw + Math.sin(t * 5 + ph) * 0.14, Math.sin(t * 2 + ph) * 0.05);
    tmpObj.scale.setScalar(s.sc);
    tmpObj.updateMatrix();
    for (const im of s.meshes) im.setMatrixAt(i, tmpObj.matrix);
  }
  for (const im of s.meshes) im.instanceMatrix.needsUpdate = true;
}

// 큰 생물(고래, 상어, 가오리, 신화): 멀리서 나타나 플레이어 근처를 지나가고, 너무 멀어지면 다시 먼 곳에서 나타난다
interface Roamer { root: THREE.Group; fish: THREE.Group; pos: THREE.Vector3; a: number; turn: number; sp: number; ab: number; speed: [number, number]; above: [number, number]; ring: [number, number]; gone: number; vis: number; zone?: number }
let curZone = 0; // 지금 있는 구역
const roamers: Roamer[] = [];
function respawnRoamer(r: Roamer, initial: boolean) {
  const R = initial ? 40 + RND() * (r.ring[1] - 40) : r.ring[0] + RND() * (r.ring[1] - r.ring[0]);
  const ang = initial ? RND() * Math.PI * 2 : spawnAngle();
  r.pos.x = clampW(player.pos.x + Math.cos(ang) * R);
  r.pos.z = clampW(player.pos.z + Math.sin(ang) * R);
  const tx = player.pos.x + (RND() - 0.5) * 80, tz = player.pos.z + (RND() - 0.5) * 80;
  r.a = Math.atan2(tz - r.pos.z, tx - r.pos.x);
  r.turn = 0;
  r.sp = r.speed[0] + RND() * (r.speed[1] - r.speed[0]);
  r.ab = r.above[0] + RND() * (r.above[1] - r.above[0]);
  r.pos.y = Math.min(-3, heightAt(r.pos.x, r.pos.z) + r.ab);
}
function addRoamer(sp: FishSpecies, len: number, o: { speed: [number, number]; above: [number, number]; ring: [number, number]; gone: number; vis: number; zone?: number }): Roamer {
  const { root, fish } = makeFish(sp, len);
  flatten(fish);
  scene.add(root);
  const r: Roamer = { root, fish, pos: new THREE.Vector3(), a: 0, turn: 0, sp: 3, ab: 6, ...o };
  respawnRoamer(r, true);
  roamers.push(r);
  return r;
}
function updateRoamer(r: Roamer, t: number, dt: number) {
  r.turn = Math.min(0.2, Math.max(-0.2, r.turn + (RND() - 0.5) * dt * 0.6));
  r.a += r.turn * dt;
  if (Math.abs(r.pos.x) > HALF - 30 || Math.abs(r.pos.z) > HALF - 30) r.a -= angDiff(r.a, Math.atan2(-r.pos.z, -r.pos.x)) * Math.min(1, dt * 1.2);
  r.pos.x += Math.cos(r.a) * r.sp * dt;
  r.pos.z += Math.sin(r.a) * r.sp * dt;
  r.pos.y += (Math.min(-3, heightAt(r.pos.x, r.pos.z) + r.ab) - r.pos.y) * Math.min(1, dt * 0.5);
  const dist = Math.hypot(r.pos.x - player.pos.x, r.pos.z - player.pos.z);
  if (dist > r.gone) respawnRoamer(r, false);
  r.root.visible = dist < r.vis && (r.zone === undefined || r.zone === curZone); // 안개에 가려 안 보이는 거리와 제 구역이 아닌 곳에서는 그리지 않는다
  if (!r.root.visible) return;
  r.root.position.copy(r.pos);
  r.root.rotation.y = -r.a;
  (r.fish.userData.update as ((t: number) => void) | undefined)?.(t * 2);
}

// ---- 캐릭터 (헤엄 시연: 걷기 동작을 그대로 사용하는 임시 모습) ---------------------------------
const LOOK = { appearance: { eyes: 0, nose: 1, mouth: 0, hair: 4, skinColor: 0, hairColor: 1, eyeColor: 1, body: 1 }, equipped: {} };
const player = { pos: new THREE.Vector3(-6, -22, 14), vel: new THREE.Vector3(), yaw: Math.PI };
let rig: CharacterRig | null = null;
// 신화 탈것: 메인 화면의 탈것 메뉴에서 칸 1~4에 넣어 둔 신화를 숫자 키로 불러 탄다. 타고 있는 칸의 키를 다시 누르면 돌려보낸다
interface Mount { root: THREE.Group; fish: THREE.Group; id: string; name: string; top: number; seatX: number; yaw: number; pitch: number; ph: number }
let mount: Mount | null = null;
let mythList: FishSpecies[] = [];
const mountSlots: Array<FishSpecies | null> = [null, null, null, null];
let slotNote = "";
const mountCache = new Map<string, Mount>();
/** 탈것으로 탈 때만 오라의 크기(범위)를 줄인다. 색과 밝기는 그대로 두고(사용자 지정), 몸이 아닌 것(고리·빛 방울·반짝이)을 몸 중심 쪽으로 절반쯤 오므린다. 낚시 화면의 신화는 그대로 */
function calmAura(root: THREE.Object3D, K = 0.5) {
  root.updateMatrixWorld(true);
  type M = THREE.Mesh & { material: THREE.Material & { isMeshStandardMaterial?: boolean; isShaderMaterial?: boolean } };
  const flesh = (o: THREE.Object3D) => { const m = o as M; return !!m.isMesh && !Array.isArray(m.material) && !!m.material.isMeshStandardMaterial && m.material.blending === THREE.NormalBlending; };
  const bb = new THREE.Box3(), one = new THREE.Box3(), v = new THREE.Vector3();
  root.traverse((o) => { if (flesh(o)) bb.expandByObject(o); });
  const span = bb.getSize(v).length();
  bb.expandByScalar(span * 0.05);
  const body = (o: THREE.Object3D) => { // 살·비늘·지느러미, 그리고 몸에 붙은 작은 불투명 조각(눈 같은 것)
    const m = o as M;
    if (!m.isMesh) return false;
    if (flesh(m) || Array.isArray(m.material)) return true;
    if (m.material.transparent || m.material.isShaderMaterial || m.material.blending !== THREE.NormalBlending) return false;
    one.setFromObject(m);
    return one.getSize(v).length() < span * 0.4 && bb.containsPoint(one.getCenter(v));
  };
  const has = (o: THREE.Object3D): boolean => body(o) || o.children.some(has);
  const walk = (o: THREE.Object3D) => { for (const c of o.children) { if (has(c)) walk(c); else { c.position.multiplyScalar(K); c.scale.multiplyScalar(K); } } };
  walk(root);
}
/** 신화 물고기 탈것을 만든다(한 번 만든 것은 다시 쓴다). 앉는 자리는 오라·빛무리(반투명)가 아니라 몸통을 위에서 아래로 쏘아 찾는다 */
function buildMount(sp: FishSpecies, owner = ""): Mount { // owner: 다른 사람이 탄 것은 사람마다 따로 만든다
  const had = mountCache.get(sp.id + owner);
  if (had) return had;
  let made = makeFish(sp, 7);
  calmAura(made.fish);
  flatten(made.fish);
  try { (made.fish.userData.update as ((t: number) => void) | undefined)?.(0.5); }
  catch { made = makeFish(sp, 7); calmAura(made.fish); } // 부품을 합치면 동작이 깨지는 모델은 합치지 않고 쓴다
  const { root: mr, fish: mf } = made;
  mr.rotation.order = "YZX"; // 방향을 먼저 돌리고 그 방향 기준으로 머리를 들고 숙인다
  mr.position.set(6, -9.5, 8);
  scene.add(mr);
  (mf.userData.update as ((t: number) => void) | undefined)?.(0.5); // 움직이는 자세(목을 뺀 모습 등)에서 잰다
  mr.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.camera = camera; // 빛 조각(Sprite)이 섞여 있으면 카메라가 있어야 한다
  // 몸(살·비늘 재질)만 친다. 오라 고리, 빛 번짐, 반짝이는 다른 재질이라 빠진다
  const solid = (o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as any).isInstancedMesh) return false;
    return (Array.isArray(m.material) ? m.material : [m.material]).every((q) => (q as any).isMeshStandardMaterial && q.opacity >= 0.45 && q.blending === THREE.NormalBlending);
  };
  const topAt = (dx: number, dz: number, any = false) => { // any: 유리처럼 비치는 것(얼음 수정)도 친다
    ray.set(new THREE.Vector3(mr.position.x + dx, mr.position.y + 40, mr.position.z + dz), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(mr, true).find((h) => (any ? (h.object as THREE.Mesh).isMesh && !(h.object as any).isInstancedMesh && !((h.object as THREE.Mesh).material as any).isShaderMaterial && ((h.object as THREE.Mesh).material as THREE.Material).opacity >= 0.45 && ((h.object as THREE.Mesh).material as THREE.Material).blending === THREE.NormalBlending : solid(h.object)));
    return hit ? hit.point.y - mr.position.y : -1e9;
  };
  // 물고기는 +x 를 보고 있다. 등에서 가장 높으면서 폭이 있는 자리(뿔·등지느러미처럼 얇은 것은 양옆이 비어 걸러진다)를 가운데 가까이에서 고른다
  let top = 0.5, seatX = 0, bestScore = -1e9;
  const onHead = ["빙하거신수", "천년이무기", "심연의 흑룡"].includes(sp.name); // 사용자 지정: 얼음 거북은 등이 수정 무더기라 머리 위, 두 용은 머리의 뿔 사이에 탄다. // 등이 얼음 수정 무더기라 캐릭터가 가려진다. 이 녀석만 머리 위에 탄다(사용자 지정)
  for (let dx = onHead ? 2.25 : -2.5; dx <= (onHead ? (sp.name === "심연의 흑룡" ? 5.25 : 4) : 2.5); dx += 0.25) { // 흑룡은 머리가 더 앞에 있다
    const h = onHead ? topAt(dx, 0, true) : Math.min(topAt(dx, -0.3, true), topAt(dx, 0, true), topAt(dx, 0.3, true)); // 머리는 좁아서 가운데만 잰다
    const score = onHead ? h : h - Math.abs(dx) * 0.2;
    if (h > -1e8 && score > bestScore) { bestScore = score; top = h; seatX = dx; }
  }
  mr.visible = false;
  const made2: Mount = { root: mr, fish: mf, id: sp.id, name: sp.name, top, seatX, yaw: 0, pitch: 0, ph: 0 };
  mountCache.set(sp.id + owner, made2);
  return made2;
}
// 소환(부르기) → 타고 다님 → 해제(돌려보내기)
let ridePhase: "none" | "summon" | "ride" | "dismiss" = "none";
let rideT0 = 0, rideSlot = -1, nextSlot = -1;
let rideK = 0; // 0 내려 있음 ~ 1 올라탐
let riding = false; // 캐릭터가 앉은 자세인가
const SUMMON = 1.5, DISMISS = 0.9;
function startSummon(slot: number) {
  const sp = mountSlots[slot];
  if (!sp) return;
  mount = buildMount(sp);
  mount.root.visible = true;
  mount.yaw = player.yaw; mount.pitch = 0;
  rideSlot = slot; ridePhase = "summon"; rideT0 = t; fxT0 = t; fxUp = true;
  camDist = Math.max(camDist, 12);
  titleEl.textContent = "✨ " + sp.name; titleEl.style.opacity = "1"; titleUntil = t + 1.8;
}
/** 숫자 키: 그 칸의 신화를 부른다. 타고 있는 칸이면 돌려보내고, 다른 칸이면 돌려보낸 뒤 바꿔 부른다 */
function callMount(slot: number) {
  if (trans || exitOpen || loading || ridePhase === "summon" || ridePhase === "dismiss") return;
  if (ridePhase === "ride") { nextSlot = slot === rideSlot || !mountSlots[slot] ? -1 : slot; ridePhase = "dismiss"; rideT0 = t; fxT0 = t; fxUp = false; return; }
  if (!mountSlots[slot]) { titleEl.textContent = `${slot + 1}번 칸이 비어 있어요. 메인 화면의 탈것에서 넣어요`; titleEl.style.opacity = "1"; titleUntil = t + 2; return; }
  startSummon(slot);
}
// 소환·해제 빛: 발밑에서 퍼지는(해제 때는 모여드는) 고리 둘과 몸을 감아 오르는 빛 알갱이
let fxT0 = -99, fxUp = true;
const fxRings = [0, 1].map(() => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 56), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.45, 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = Math.PI / 2; m.visible = false; m.frustumCulled = false;
  scene.add(m);
  return m;
});
const FXN = 80;
const fxGeo = new THREE.BufferGeometry();
const fxPos = new Float32Array(FXN * 3);
fxGeo.setAttribute("position", new THREE.BufferAttribute(fxPos, 3));
const fxPts = new THREE.Points(fxGeo, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.5, 1.0), size: 0.32, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
fxPts.frustumCulled = false; fxPts.visible = false;
scene.add(fxPts);
function updateRideFx() {
  const k = (t - fxT0) / 1.4;
  const on = k >= 0 && k < 1;
  fxPts.visible = on;
  fxRings.forEach((m) => (m.visible = on));
  if (!on) return;
  fxRings.forEach((m, i) => {
    const kk = Math.min(1, Math.max(0, k * 1.5 - i * 0.3));
    m.scale.setScalar(fxUp ? 0.6 + kk * 7.5 : 8 - kk * 7.4);
    (m.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * kk) * 0.95;
    m.position.set(player.pos.x, player.pos.y + (fxUp ? -0.6 + kk * 1.2 : 0.4), player.pos.z);
  });
  for (let j = 0; j < FXN; j++) {
    const u = j / FXN, a = j * 2.4 + k * 7 * (fxUp ? 1 : -1);
    const r = fxUp ? 0.5 + 3.2 * Math.min(1, k * 1.3) * (0.6 + 0.4 * u) : 3.4 * (1 - k) + 0.3;
    fxPos[j * 3] = player.pos.x + Math.cos(a) * r;
    fxPos[j * 3 + 1] = player.pos.y + (fxUp ? -4 + u * 3 + k * 7 : u * 4 - 1.5 + k * 3.5);
    fxPos[j * 3 + 2] = player.pos.z + Math.sin(a) * r;
  }
  fxGeo.attributes.position.needsUpdate = true;
  (fxPts.material as THREE.PointsMaterial).opacity = Math.min(1, (1 - k) * 2.5);
}
let firstPerson = false; // V: 1인칭 ↔ 3인칭
let rideHop = 0; // 타고 내릴 때 폴짝 뛰는 높이
// 헤엄: 움직이면 몸을 눕혀 헤엄치고(여자 평영, 남자 자유형), 멈추면 서서 떠 있는다
let swimK = 0, swimTilt = 0, swimStyle = 0;
// 헤엄칠 때 손발 뒤로 흩어지는 잔거품
const SWB = 40;
const swbGeo = new THREE.BufferGeometry();
const swbPos = new Float32Array(SWB * 3).fill(1e6);
const swbLife = new Float32Array(SWB);
swbGeo.setAttribute("position", new THREE.BufferAttribute(swbPos, 3));
const swb = new THREE.Points(swbGeo, new THREE.PointsMaterial({ color: "#eafcff", size: 0.13, transparent: true, opacity: 0.75, depthWrite: false }));
swb.frustumCulled = false;
scene.add(swb);
let swbNext = 0, swbTimer = 0;
function updateSwimBubbles(dt: number) {
  swbTimer -= dt;
  if (swimK > 0.4 && swbTimer <= 0) { // 발끝 쪽(몸 뒤)에서 나온다
    swbTimer = 0.05;
    const i = swbNext++ % SWB, b = 0.9 + rnd() * 0.5;
    swbPos[i * 3] = player.pos.x - Math.sin(player.yaw) * b + (rnd() - 0.5) * 0.7;
    swbPos[i * 3 + 1] = player.pos.y + 0.6 + (rnd() - 0.5) * 0.6;
    swbPos[i * 3 + 2] = player.pos.z - Math.cos(player.yaw) * b + (rnd() - 0.5) * 0.7;
    swbLife[i] = 1.3;
  }
  for (let i = 0; i < SWB; i++) {
    if (swbLife[i] <= 0) continue;
    swbLife[i] -= dt;
    swbPos[i * 3 + 1] += dt * 1.1;
    if (swbLife[i] <= 0) swbPos[i * 3 + 1] = 1e6;
  }
  swbGeo.attributes.position.needsUpdate = true;
}
// 1인칭에서 보이는 내 팔: 화면 아래에서 평영으로 물을 가른다
const fpArms = new THREE.Group();
const fpMat = new THREE.MeshStandardMaterial({ color: SKIN[0], roughness: 0.75 });
const fpArm = [-1, 1].map(() => {
  const g = new THREE.Group();
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.6, 4, 10), fpMat);
  fore.rotation.x = Math.PI / 2; fore.position.z = 0.36; // 손에서 카메라 쪽으로 뻗은 아래팔
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), fpMat);
  hand.scale.set(1.1, 0.45, 1.5);
  g.add(fore, hand);
  fpArms.add(g);
  return g;
});
camera.add(fpArms);
scene.add(camera);
let fpPhase = 0;
function updateFpArms(dt: number) {
  fpArms.visible = firstPerson && ridePhase === "none" && !loading;
  if (!fpArms.visible) return;
  if (hunt.aimPose()) { // 작살총을 두 손으로 잡은 모습: 오른손은 손잡이, 왼손은 앞쪽을 받친다
    fpArm[1].position.set(0.23, -0.35, -1.05); fpArm[1].rotation.set(1.0, 0.2, 0);
    fpArm[0].position.set(0.17, -0.31, -1.3); fpArm[0].rotation.set(1.0, -0.4, 0);
    return;
  }
  fpPhase += dt * (1.1 + swimK * 2.4);
  const p = (fpPhase / (Math.PI * 2)) % 1;
  const reach = p < 0.35 ? 1 : p < 0.7 ? 1 - (p - 0.35) / 0.35 : (p - 0.7) / 0.3; // 1 앞으로 뻗음 ~ 0 가슴 앞으로 당김
  const sweep = Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.3) / 0.45))); // 바깥으로 벌려 가르는 정도
  const amp = 0.35 + 0.65 * swimK; // 멈춰 있을 때는 작게 살랑거린다
  fpArm.forEach((g, i) => {
    const sgn = i ? 1 : -1;
    g.position.set(sgn * (0.13 + (0.4 * sweep + 0.2 * (1 - reach)) * amp + 0.2 * (1 - swimK)), -0.36 - (0.14 * (1 - reach)) * amp - 0.1 * (1 - swimK), -0.72 - 0.45 * reach * amp);
    g.rotation.set(0.2 * (1 - reach), -sgn * (0.15 + 0.85 * sweep * amp), sgn * 0.5 * sweep);
  });
}
const SEAT = 0.7; // 탈것 등에서 캐릭터 발까지 내려오는 높이 (앉은 자세라 엉덩이가 등에 닿는다)

// ---- 입력, 카메라 ---------------------------------------------------------------
const keys = new Set<string>();
const stick = { x: 0, y: 0 }; // 휴대폰 이동 스틱: x 오른쪽, y 앞
let teleZone = 0;
let camYaw = Number(params.get("yaw") ?? Math.PI), camPitch = Number(params.get("pitch") ?? 0.25), camDist = Number(params.get("dist") ?? 8);
window.addEventListener("keydown", (e) => {
  if (document.activeElement === chatInput) return; // 채팅을 치는 중에는 게임 키로 받지 않는다
  const k = e.key.toLowerCase();
  if (k === "enter") { openChat(); return; }
  // Ctrl+D(북마크), Ctrl+S(저장) 같은 브라우저 단축키가 게임 키 입력과 겹치지 않게 막는다. shortcut: Ctrl+W/T/N은 브라우저가 못 막게 해서 질주는 Ctrl 이 아니라 Shift 로 한다
  if (e.ctrlKey || e.metaKey || k.startsWith("arrow") || k === " ") e.preventDefault();
  keys.add(k);
  if (DEBUG && k === "p") { pastel = !pastel; applyPastel(); }
  if (DEBUG && k === "g") toGate(++gateIdx);
  if (k === "v") firstPerson = !firstPerson;
  const dg = /^Digit([1-4])$/.exec(e.code); // Shift 를 누른 채여도 숫자 키로 알아본다
  if (dg && !e.repeat) callMount(Number(dg[1]) - 1);
  if (DEBUG && (k === "[" || k === "]")) { teleZone = (teleZone + (k === "]" ? 1 : ZONES.length - 1)) % ZONES.length; teleport(teleZone); } // 확인용: 구역 바로 가기
  if (k === "i") { toggleInv(); return; }
  if (k === "g") { toggleGuide(); return; }
  if (k === "escape" && guideOpen) { toggleGuide(false); return; }
  if (guideOpen) return;
  if (k === "escape" && invOpen) { toggleInv(); return; }
  if (invOpen) return; // 가방이 열려 있는 동안은 게임 키를 받지 않는다
  if (k === "h") showHelp(helpEl.style.display === "none");
  if (k === "m") setMap(mapEl.style.display === "none"); // 미니맵 여닫기
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
const canvas = eng.renderer.domElement;
const locked = () => document.pointerLockElement === canvas;
// 클릭하면 마우스 시점 모드를 켠다. 마우스 고정이 되면 완전 고정, 안 되는 환경(앱 안의 미리보기 탭 등)에서는
// 커서를 숨기고 마우스 움직임만으로 돌린다 (창 가장자리에 닿으면 멈춘다). Esc로 해제
let freeLook = false;
canvas.style.touchAction = "none"; // 손가락으로 끌 때 페이지가 밀리거나 확대되지 않게
canvas.addEventListener("click", () => {
  if (isTouch || locked() || freeLook) return; // 휴대폰에는 마우스 고정이 없다: 화면을 끌어서 돌린다
  Promise.resolve(canvas.requestPointerLock?.()).catch(() => {});
  setTimeout(() => { if (!locked()) { freeLook = true; canvas.style.cursor = "none"; } }, 150);
});
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && freeLook) { freeLook = false; canvas.style.cursor = ""; } });
const look = (dx: number, dy: number, k: number) => {
  camYaw -= dx * k;
  camPitch = Math.min(1.35, Math.max(-0.7, camPitch + dy * k));
};
document.addEventListener("mousemove", (e) => { if (locked() || freeLook) look(e.movementX, e.movementY, 0.0025); });
// 마우스 고정이 안 되는 환경(미리보기 창 등)에서는 누른 채 끌어서 돌린다
// 휴대폰에서는 이것이 시점 조작이다. 끄는 손가락 하나만 따라간다(다른 손가락은 이동 스틱) — iOS 는 movementX 를 주지 않아서 지난 위치와의 차이를 직접 잰다
const touches = new Map<number, { x: number; y: number }>(); // 화면에 닿아 있는 손가락(또는 누른 마우스)
let pinch = 0;
canvas.addEventListener("pointerdown", (e) => { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; });
const dragEnd = (e: PointerEvent) => { touches.delete(e.pointerId); pinch = 0; };
window.addEventListener("pointerup", dragEnd);
window.addEventListener("pointercancel", dragEnd);
window.addEventListener("pointermove", (e) => {
  const p = touches.get(e.pointerId);
  if (!p || locked() || freeLook) return;
  if (touches.size >= 2) { // 두 손가락: 벌리면 카메라가 가까워지고 오므리면 멀어진다(마우스 휠과 같은 범위)
    p.x = e.clientX; p.y = e.clientY;
    const [f1, f2] = [...touches.values()];
    const d = Math.hypot(f1.x - f2.x, f1.y - f2.y);
    if (pinch) camDist = Math.min(26, Math.max(3, camDist - (d - pinch) * 0.05));
    pinch = d;
    return;
  }
  look(e.clientX - p.x, e.clientY - p.y, isTouch ? 0.007 : 0.005);
  p.x = e.clientX; p.y = e.clientY;
});
canvas.addEventListener("wheel", (e) => { camDist = Math.min(26, Math.max(3, camDist + e.deltaY * 0.01)); });
function teleport(i: number) {
  const z = ZONES[i];
  player.pos.set(z.x, heightAt(z.x, z.z) + 5, z.z + 12);
  schools.forEach((s) => respawnSchool(s, true));
  roamers.forEach((r) => respawnRoamer(r, true));
}

// 기력(스태미너): 화면 아래 가운데 막대. 가득 차 있으면 숨긴다
let stamina = 1, staRest = 0, tired = false;
const staEl = document.createElement("div");
staEl.style.cssText = "position:fixed;left:50%;bottom:112px;transform:translateX(-50%);width:190px;height:18px;box-sizing:border-box;border-radius:999px;background:rgba(255,255,255,.9);padding:3px;box-shadow:0 3px 0 rgba(74,59,82,.14);pointer-events:none;opacity:0;transition:opacity .4s";
const STA_FILL = "linear-gradient(90deg,var(--mint),var(--sun),var(--pink-deep))";
const staFill = document.createElement("div");
staFill.style.cssText = `height:100%;width:100%;background:${STA_FILL};border-radius:999px`;
staEl.append(staFill);
if (isTouch) { staEl.style.bottom = "auto"; staEl.style.top = "50px"; staEl.style.width = "130px"; }
document.body.append(staEl);
const WALL_STOP = 0.12; // 능선 발치(바위 더미 앞)에서 멈춘다
let surfT = 0, exitOpen = false;
const exitEl = document.createElement("div");
exitEl.className = "modal-back";
exitEl.style.display = "none";
exitEl.innerHTML = `<div class="panel modal narrow" style="width:min(400px,100%);text-align:center"><h2>물 밖으로 나가시겠습니까?</h2><p class="hint" style="font-size:16px;margin:8px 0 18px">나가면 대기실로 돌아갑니다.</p><div style="display:flex;gap:10px;justify-content:center"><button id="exitYes" class="btn pink">나가기</button><button id="exitNo" class="btn ghost">계속 탐험</button></div></div>`;
document.body.append(exitEl);
function askExit() {
  exitOpen = true; surfT = 0;
  keys.clear();
  document.exitPointerLock?.();
  freeLook = false; canvas.style.cursor = "";
  exitEl.style.display = "grid";
}
exitEl.querySelector("#exitYes")!.addEventListener("click", () => { location.href = "/"; }); // 대기실(본 게임 첫 화면)
exitEl.querySelector("#exitNo")!.addEventListener("click", () => { exitOpen = false; exitEl.style.display = "none"; surfT = -1.5; player.vel.y = -5; });

function movePlayer(dt: number) {
  // 나아가는 방향: 카메라가 살짝 내려다보는 기본 시점에서는 수평으로 헤엄치고, 시점을 더 올리거나 내리면 그쪽으로 오르내린다
  const mp = firstPerson ? camPitch : Math.abs(camPitch - 0.2) < 0.14 ? 0 : camPitch - 0.2; // 1인칭은 보는 쪽 그대로 나아간다
  const cpl = Math.cos(mp);
  const f = new THREE.Vector3(Math.sin(camYaw) * cpl, -Math.sin(mp), Math.cos(camYaw) * cpl);
  const r = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw)); // 오른쪽
  const forced = transitionWish(dt);
  const wish = new THREE.Vector3();
  if (!forced && !exitOpen && !invOpen && !guideOpen && ridePhase !== "summon") {
  if (keys.has("w") || keys.has("arrowup")) wish.add(f);
  if (keys.has("s") || keys.has("arrowdown")) wish.sub(f);
  if (keys.has("d") || keys.has("arrowright")) wish.add(r);
  if (keys.has("a") || keys.has("arrowleft")) wish.sub(r);
  wish.addScaledVector(f, stick.y).addScaledVector(r, stick.x); // 휴대폰의 이동 스틱
  // 오르내리기는 보는 쪽으로 헤엄쳐서 한다(위아래 전용 키는 없다). Shift 는 빠르게 헤엄치기: 맨몸은 기력이 닳고, 탈것은 닳지 않는다
  const mounted = ridePhase === "ride", going = wish.lengthSq() > 0;
  const sprint = keys.has("shift") && going && (mounted || (!tired && stamina > 0));
  if (going) wish.normalize().multiplyScalar(mounted ? (sprint ? 20 : 11) : sprint ? 14 : 7);
  if (sprint && !mounted) { stamina = Math.max(0, stamina - dt / 6); staRest = 1; if (stamina === 0) tired = true; } // 6초 달리면 바닥난다
  else if ((staRest -= dt) <= 0) { stamina = Math.min(1, stamina + dt / 8); if (stamina >= 0.3) tired = false; } // 1초 쉬면 차기 시작, 바닥났으면 30% 찰 때까지 못 달린다
  staEl.style.opacity = stamina < 1 ? "1" : "0";
  staFill.style.width = `${stamina * 100}%`;
  staFill.style.background = tired ? "var(--danger)" : STA_FILL;
  } else if (forced) wish.copy(forced);
  player.vel.lerp(wish, Math.min(1, dt * (forced ? 6 : wish.lengthSq() > 0 ? 6 : 8))); // 손을 떼면 금방 선다
  const sp = player.vel.length();
  if (sp > 0.05 && !forced) { // 벽에 닿으면 벽을 따라 미끄러진다
    const dir = player.vel.clone().divideScalar(sp);
    const h = hitSolid(new THREE.Vector3(player.pos.x, player.pos.y + 0.8, player.pos.z), dir, sp * dt + 0.8);
    if (h?.face) {
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.dot(dir) > 0) n.negate();
      player.vel.addScaledVector(n, -player.vel.dot(n));
    }
  }
  const px = player.pos.x, pz = player.pos.z;
  player.pos.addScaledVector(player.vel, dt);
  const wl = forced ? 0 : wallAt(player.pos.x, player.pos.z);
  if (wl > WALL_STOP && wl > wallAt(px, pz)) { // 능선은 위로도 넘지 못한다: 능선을 따라 미끄러진다
    if (wallAt(player.pos.x, pz) <= WALL_STOP) player.pos.z = pz;
    else if (wallAt(px, player.pos.z) <= WALL_STOP) player.pos.x = px;
    else { player.pos.x = px; player.pos.z = pz; }
  }
  player.pos.x = Math.min(HALF - 6, Math.max(-HALF + 6, player.pos.x));
  player.pos.z = Math.min(HALF - 6, Math.max(-HALF + 6, player.pos.z));
  player.pos.y = Math.min(-1.5, Math.max(heightAt(player.pos.x, player.pos.z) + 0.9 + (mount ? (mount.top + 2.5 - SEAT) * rideK : 0), player.pos.y));
  // 수면까지 올라와서도 계속 위로 가려 하면 나갈지 묻는다
  surfT = !forced && !exitOpen && player.pos.y >= -1.55 && wish.y > 2 ? surfT + dt : Math.min(surfT, 0);
  if (surfT > 0.6) askExit();
  const moving = player.vel.lengthSq() > 0.3;
  if (moving) player.yaw = Math.atan2(player.vel.x, player.vel.z);
  return moving;
}

// ---- 구역 경계와 이동 연출 -------------------------------------------------------------
// 눈에 보이는 문은 없다. 구역 가장자리의 보이지 않는 경계선을 넘으면 이동 연출이 시작된다.
// 실제로는 다른 맵으로 옮겨 가는 것을 가정한 시연: 경계를 넘으면 앞으로 쭉 나아가고, 이동 중 화면이 뜨고, 도착한 구역의 경계 안쪽에서 나온다
interface Gate { from: number; to: number; pos: THREE.Vector3; out: THREE.Vector2; pair: number; up?: number; vy?: number } // up: 위아래로 드나드는 구멍의 반지름. vy: 1이면 위로(동굴 천장 구멍), -1이면 아래로(난파선 구덩이) 빠져나갈 때 이동하고, 도착할 때는 그 반대로 나온다
let caveGateZ = 30; // 천장 구멍 위 굴에서 난파선 지대로 넘어가는 높이 (cave.json 의 gate)
let caveHoles: number[][] = []; // 동굴 천장 구멍 [x, y, 반지름, 높이]: 첫째(가운데 방)로 올라가면 난파선 지대로 간다
const gates: Gate[] = [];
const LINKS: Array<[number, number]> = [[2, 3], [0, 4], ...PATHS]; // 지형은 바닷길로 이어져 보이지만, 길을 따라 구역 밖으로 나서면 이동 연출과 함께 다음 구역 어귀로 옮겨진다. 난파선↔동굴은 구덩이와 천장 구멍
const smoothStep = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
// 능선 발치와 심해 구멍 둘레의 바위 더미(넓적한 판을 쌓은 모양, 구역 모델과 같은 양식). 구역별로 한 번에 그린다
function buildRidgeRocks() {
  const per: Array<Array<{ m: THREE.Matrix4; c: THREE.Color }>> = ZONES.map(() => []);
  const q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
  const stack = (x: number, z: number, r0: number, n: number) => {
    let zi = 0, best = 1e9;
    ZONES.forEach((q, i) => { const d = Math.hypot(x - q.x, z - q.z); if (d < best) { best = d; zi = i; } });
    let y = heightAt(x, z) - 1.2;
    for (let i = 0; i < n; i++) {
      const hgt = 1.5 + rnd() * 1.3, r = r0 * (1 - 0.14 * i);
      if (y + hgt > -1.2) break; // 수면 위로는 나오지 않는다
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x + (rnd() - 0.5) * r * 0.3, y + hgt / 2, z + (rnd() - 0.5) * r * 0.3), q4.setFromAxisAngle(up, rnd() * 6.28), new THREE.Vector3(r, hgt, r * (0.7 + rnd() * 0.3)));
      const c = new THREE.Color(0.5, 0.52, 0.55).lerp(tint.set(ZONES[zi].tint), 0.22).multiplyScalar((0.72 + rnd() * 0.3) * (0.45 + 0.55 * smooth(-58, -24, y)));
      per[zi].push({ m, c });
      y += hgt * 0.92;
    }
  };
  for (let x = -HALF + 10; x < HALF - 10; x += 6.5) for (let z = -HALF + 10; z < HALF - 10; z += 6.5) {
    const px = x + (rnd() - 0.5) * 5, pz = z + (rnd() - 0.5) * 5, w = wallAt(px, pz);
    if (w > WALL_STOP + 0.02 && w < 0.62 && Math.hypot(px - HOLE.x, pz - HOLE.z) > HOLE.r + 6) stack(px, pz, 3 + rnd() * 3, 2 + Math.floor(rnd() * 3));
  }
  for (let i = 0; i < 11; i++) { // 구멍 둘레: 길 쪽(남쪽)은 열어 둔다
    const a = 0.9 + (i / 10) * (Math.PI * 2 - 1.8), d = HOLE.r + 5 + rnd() * 2;
    stack(HOLE.x - Math.sin(a) * d, HOLE.z - Math.cos(a) * d, 2.5 + rnd() * 2, 2 + Math.floor(rnd() * 2));
  }
  const geo = new THREE.CylinderGeometry(1, 1.1, 1, 7);
  const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
  per.forEach((list) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => { im.setMatrixAt(i, o.m); im.setColorAt(i, o.c); });
    im.computeBoundingSphere();
    scene.add(im);
  });
  // 구멍 벽을 따라 내려가는 푸른 빛: 아래에 뭔가 있다는 표시
  const glow = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.5, 2.6) }), 14);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 14; i++) {
    const a = i * 1.9, d = HOLE.r - 1.5;
    glow.setMatrixAt(i, m4.makeScale(1, 2.2, 1).setPosition(HOLE.x + Math.cos(a) * d, ZONES[0].d - 1 - i * 2.3, HOLE.z + Math.sin(a) * d));
  }
  glow.computeBoundingSphere();
  scene.add(glow);
}
function buildGates() {
  const mk = (from: number, to: number) => {
    const hole = from === 3 && to === 2 ? caveHoles[0] : undefined;
    if (hole) { gates.push({ from, to, pos: new THREE.Vector3(CAVE.x + hole[0], CAVE.d + caveGateZ, CAVE.z - hole[1]), out: new THREE.Vector2(0, 0), pair: -1, up: hole[2] + 1, vy: 1 }); return; }
    if (from === 0 && to === 4) { gates.push({ from, to, pos: new THREE.Vector3(HOLE.x, ZONES[0].d - 26, HOLE.z), out: new THREE.Vector2(0, 0), pair: -1, up: HOLE.r, vy: -1 }); return; }
    if (from === 4 && to === 0) { gates.push({ from, to, pos: new THREE.Vector3(ZONES[4].x, ZONES[4].d + 31, ZONES[4].z), out: new THREE.Vector2(0, 0), pair: -1, up: 95, vy: 1 }); return; }
    if (from === 2 && to === 3) { gates.push({ from, to, pos: new THREE.Vector3(PIT.x, ZONES[2].d - 5, PIT.z), out: new THREE.Vector2(0, 0), pair: -1, up: PIT.r, vy: -1 }); return; }
    const a = ZONES[from], b = ZONES[to];
    let ox = b.x - a.x, oz = b.z - a.z;
    const L = Math.hypot(ox, oz);
    ox /= L; oz /= L;
    const D = from === 1 ? 100 : from === 3 ? 115 : 80; // 동굴은 굴 입구(92m)보다 바깥 // 구역 중심에서 이만큼 떨어진 길 위의 경계선. 아틀란티스는 도시가 커서 더 바깥
    const gx = a.x + ox * D, gz = a.z + oz * D;
    gates.push({ from, to, pos: new THREE.Vector3(gx, Math.min(-5, heightAt(gx, gz) + 7.5), gz), out: new THREE.Vector2(ox, oz), pair: -1 });
  };
  for (const [a, b] of LINKS) { mk(a, b); mk(b, a); }
  gates.forEach((g) => (g.pair = gates.findIndex((h) => h.from === g.to && h.to === g.from)));
  // 바닷길 등불: 길 양옆에 번갈아 선 돌기둥과 빛나는 구슬. 흐린 물속에서도 다음 구역 쪽이 보인다
  const spots: THREE.Vector3[] = [];
  for (const [ia, ib] of PATHS) {
    const a = ZONES[ia], b = ZONES[ib], L = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    for (let d = 62, n = 0; d < L - 62; d += 14, n++) {
      const side = n % 2 ? 9 : -9, x = a.x + ux * d - uz * side, z = a.z + uz * d + ux * side;
      spots.push(new THREE.Vector3(x, heightAt(x, z), z));
    }
  }
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.5, 2.6, 6), new THREE.MeshStandardMaterial({ color: "#7d8a8c", flatShading: true, roughness: 1 }), spots.length);
  const orbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.0, 1.5) }), spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach((p, i) => { posts.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 1.1, p.z)); orbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 2.9, p.z)); });
  posts.frustumCulled = orbs.frustumCulled = false;
  scene.add(posts, orbs);
  buildRidgeRocks();
}

// ---- 미니맵 (오른쪽 위): 구역과 바닷길, 굴 입구, 내 위치와 바라보는 방향 ------------------------------
const MAP = 230;
const mapEl = document.createElement("canvas");
mapEl.width = mapEl.height = MAP * 2;
mapEl.style.cssText = `position:fixed;right:12px;top:12px;width:${isTouch ? 108 : MAP}px;height:${isTouch ? 108 : MAP}px;border-radius:18px;border:3px solid #fff;box-shadow:0 5px 0 rgba(74,59,82,.14);background:rgba(8,40,70,.93);pointer-events:none`;
document.body.append(mapEl);
const ICON = (d: string, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const mapX = document.createElement("button"), mapOpen = document.createElement("button");
mapX.innerHTML = ICON('<path d="M6 6l12 12M18 6L6 18"/>', 14);
mapX.setAttribute("aria-label", "지도 닫기");
mapX.style.cssText = "position:fixed;right:17px;top:17px;width:26px;height:26px;border-radius:50%;border:0;background:#fff;color:var(--ink);display:none;place-items:center;padding:0;z-index:6";
mapOpen.innerHTML = ICON('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>', 20);
mapOpen.setAttribute("aria-label", "지도 열기");
mapOpen.style.cssText = "position:fixed;right:12px;top:12px;width:38px;height:38px;border-radius:50%;border:0;background:#fff;color:var(--ink);box-shadow:0 3px 0 rgba(74,59,82,.14);display:none;place-items:center;padding:0;z-index:6";
document.body.append(mapX, mapOpen);
function setMap(on: boolean) {
  mapEl.style.display = on ? "" : "none";
  if (!isTouch) return; // 컴퓨터는 M 키로만 여닫는다
  mapX.style.display = on ? "grid" : "none";
  mapOpen.style.display = on ? "none" : "grid";
}
mapX.addEventListener("click", () => setMap(false));
mapOpen.addEventListener("click", () => setMap(true));
setMap(true);
function drawMap() {
  const g = mapEl.getContext("2d")!, S = (MAP * 2) / (HALF * 2), P = (v: number) => (v + HALF) * S;
  g.clearRect(0, 0, MAP * 2, MAP * 2);
  g.lineCap = "round";
  g.strokeStyle = "rgba(255,240,190,.75)"; g.lineWidth = 7;
  for (const [ia, ib] of PATHS) { g.beginPath(); g.moveTo(P(ZONES[ia].x), P(ZONES[ia].z)); g.lineTo(P(ZONES[ib].x), P(ZONES[ib].z)); g.stroke(); }
  for (const pr of gates) { // 굴: 난파선 구덩이 ↔ 동굴 천장 구멍 (점선)
    const o = gates[pr.pair];
    if (!o || pr.from > pr.to) continue;
    g.setLineDash([6, 10]); g.strokeStyle = "rgba(255,170,90,.9)"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(P(pr.pos.x), P(pr.pos.z)); g.lineTo(P(o.pos.x), P(o.pos.z)); g.stroke();
    g.setLineDash([]);
  }
  g.textAlign = "center"; g.font = "bold 19px Jua, sans-serif";
  ZONES.forEach((q, i) => {
    g.fillStyle = i === curZone ? "#fff" : q.tint; g.globalAlpha = i === curZone ? 1 : 0.8;
    g.beginPath(); g.arc(P(q.x), P(q.z), i === curZone ? 30 : 25, 0, 7); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = "#fff"; g.strokeStyle = "rgba(0,30,60,.9)"; g.lineWidth = 5;
    const label = q.name.split(" ").slice(-2).join(" ");
    g.strokeText(label, P(q.x), P(q.z) + 50); g.fillText(label, P(q.x), P(q.z) + 50);
  });
  for (const pr of gates) { // 굴 입구
    g.fillStyle = "#ff9d4d"; g.strokeStyle = "#fff"; g.lineWidth = 3;
    g.beginPath(); g.arc(P(pr.pos.x), P(pr.pos.z), 9, 0, 7); g.fill(); g.stroke();
  }
  room?.state?.players?.forEach((q: DiverLike, sid: string) => { // 같은 채널의 다른 사람들 (다른 구역에 있어도 표시)
    if (sid === mySid) return;
    g.fillStyle = "#6fe8ff"; g.strokeStyle = "#fff"; g.lineWidth = 3;
    g.beginPath(); g.arc(P(q.x), P(q.z), 8, 0, 7); g.fill(); g.stroke();
  });
  g.save(); // 나: 바라보는 쪽을 가리키는 화살표
  g.translate(P(player.pos.x), P(player.pos.z));
  g.rotate(Math.atan2(Math.sin(camYaw), -Math.cos(camYaw)));
  g.fillStyle = "#ff4466"; g.strokeStyle = "#fff"; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, -20); g.lineTo(13, 14); g.lineTo(0, 6); g.lineTo(-13, 14); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
/** 경계선을 막 넘었는지: 경계 방향으로 0~10m 지나갔고, 길 가운데에서 30m 안쪽일 때 */
function crossedBoundary(g: Gate): boolean {
  const dx = player.pos.x - g.pos.x, dz = player.pos.z - g.pos.z;
  if (g.up) return Math.hypot(dx, dz) < g.up && (player.pos.y - g.pos.y) * g.vy! > 0 && (g.from !== 3 || player.pos.y - g.pos.y < 9); // 동굴 굴은 굴 안에서만(굴뚝 위 바깥 물에서는 아님)
  const along = dx * g.out.x + dz * g.out.y;
  const side = Math.abs(-dx * g.out.y + dz * g.out.x);
  return along >= 0 && along < 10 && side < 46;
}
function toGate(i: number) {
  const g = gates[((i % gates.length) + gates.length) % gates.length];
  if (!g) return;
  // 경계선 16m 앞(구역 안쪽)에서 경계 쪽을 바라본다
  player.pos.set(g.pos.x - g.out.x * 16, g.pos.y - (g.vy ?? 0) * 9, g.pos.z - g.out.y * 16);
  player.vel.set(0, 0, 0);
  if (!g.up) camYaw = Math.atan2(g.out.x, g.out.y);
  camPitch = 0.1;
  schools.forEach((s) => respawnSchool(s, true));
  roamers.forEach((r) => respawnRoamer(r, true));
}
let gateIdx = -1;

// 이동 연출(가볍게): 경계를 넘으면 앞으로 쭉 나아가며 화면 가장자리가 밝아지고(0.7초) → 짧은 섬광 때 도착 구역으로 바뀌고(0.3초) → 도착한 곳에서 나아가며 걷힌다(0.8초).
// 로딩 화면은 없다. 실제로는 경계에 가까워질 때 다음 구역을 미리 불러 두고 섬광 순간에 바꾼다.
const vignetteEl = document.createElement("div"); // 가장자리만 밝아지는 빛
vignetteEl.style.cssText = "position:fixed;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%,rgba(220,250,255,0) 28%,rgba(160,236,255,.75) 68%,rgba(120,214,255,.95) 100%)";
const flashEl = document.createElement("div"); // 이동 순간의 섬광
flashEl.style.cssText = "position:fixed;inset:0;pointer-events:none;opacity:0;background:#dff8ff";
const titleEl = document.createElement("div"); // 도착 구역 이름 (위쪽에 작게 잠깐)
titleEl.style.cssText = `position:fixed;left:50%;top:14%;transform:translateX(-50%);pointer-events:none;opacity:0;transition:opacity .5s;padding:8px 22px;border-radius:999px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink);font:${isTouch ? 15 : 20}px/1.35 var(--font);max-width:88vw;box-sizing:border-box;text-align:center;word-break:keep-all`; // 좁은 화면에서는 줄을 바꿔 잘리지 않게
document.body.append(vignetteEl, flashEl, titleEl);
let trans: { t0: number; gate: Gate; teleported: boolean } | null = null;
let gateCooldown = 0;
let fovNow = 55;
let titleUntil = 0;
function transitionWish(dt: number): THREE.Vector3 | null {
  if (titleUntil && t > titleUntil) { titleEl.style.opacity = "0"; titleUntil = 0; }
  if (!trans) return null;
  const e = t - trans.t0, g = trans.gate;
  const IN = 0.7, HOLD = 0.3, OUT = 0.8;
  const dest = gates[g.pair];
  let wish: THREE.Vector3 | null = null;
  if (e < IN) {
    if (!g.up) camYaw -= angDiff(camYaw, Math.atan2(g.out.x, g.out.y)) * Math.min(1, dt * 3);
    camPitch += (0.1 - camPitch) * Math.min(1, dt * 4);
    wish = new THREE.Vector3(g.out.x, g.vy ?? 0, g.out.y).multiplyScalar(14);
    fovNow = 55 + 38 * smoothStep(0, IN, e);
    vignetteEl.style.opacity = String(smoothStep(0.1, IN, e));
    flashEl.style.opacity = String(smoothStep(0.55, IN, e) * 0.6);
  } else if (e < IN + HOLD) {
    if (!trans.teleported && dest) {
      trans.teleported = true;
      const inx = -dest.out.x, inz = -dest.out.y;
      player.pos.set(dest.pos.x + inx * 9, dest.pos.y - (dest.vy ?? 0) * 3, dest.pos.z + inz * 9);
      player.vel.set(inx * 10, -(dest.vy ?? 0) * 10, inz * 10);
      if (!dest.up) camYaw = Math.atan2(inx, inz);
      camPitch = 0.1;
      camera.position.set(player.pos.x - inx * 9, player.pos.y + (dest.up ? 6 : 1), player.pos.z - inz * 9 + (dest.up ? 0.5 : 0)); // 도착 위치로 카메라도 바로 옮긴다
      schools.forEach((sc) => respawnSchool(sc, true));
      roamers.forEach((r) => respawnRoamer(r, true));
      titleEl.textContent = "→ " + ZONES[g.to].name;
      titleEl.style.opacity = "1";
      titleUntil = t + 2.4;
    }
    flashEl.style.opacity = "1";
    vignetteEl.style.opacity = "1";
    fovNow = 93;
    wish = new THREE.Vector3(-(dest?.out.x ?? 0), -(dest?.vy ?? 0), -(dest?.out.y ?? 0)).multiplyScalar(10);
  } else if (e < IN + HOLD + OUT) {
    const k = (e - IN - HOLD) / OUT;
    flashEl.style.opacity = String(1 - smoothStep(0, 0.45, k));
    vignetteEl.style.opacity = String(1 - smoothStep(0.1, 1, k));
    fovNow = 93 - 38 * smoothStep(0, 1, k);
    wish = new THREE.Vector3(-(dest?.out.x ?? 0), -(dest?.vy ?? 0), -(dest?.out.y ?? 0)).multiplyScalar(10 * (1 - k * 0.6));
  } else {
    trans = null;
    gateCooldown = 3;
    fovNow = 55;
    flashEl.style.opacity = "0";
    vignetteEl.style.opacity = "0";
  }
  if (Math.abs(camera.fov - fovNow) > 0.01) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
  return wish;
}

// ---- 화면 위 표시: 탈것 칸(아래 가운데), 조작 안내 카드 --------------------------------------
// 탈것 칸: 1~4번 칸에 넣어 둔 신화와, 지금 불러서 타고 있는 칸을 보여 준다. 눌러도 불린다
const slotBar = document.createElement("div");
slotBar.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:8px;padding:8px 10px;border-radius:26px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink);z-index:5";
document.body.append(slotBar);
const slotEls: HTMLDivElement[] = [];
function buildSlotBar() {
  slotBar.replaceChildren();
  slotEls.length = 0;
  slotBar.title = slotNote.trim();
  mountSlots.forEach((sp, i) => {
    const el = document.createElement("div");
    el.style.cssText = "position:relative;width:66px;height:74px;border-radius:16px;background:#fff;border:3px solid #f0eaf5;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s,box-shadow .2s,background .2s;overflow:hidden";
    const key = document.createElement("span");
    key.textContent = String(i + 1);
    key.style.cssText = "position:absolute;left:4px;top:3px;min-width:16px;height:16px;line-height:16px;text-align:center;border-radius:5px;background:var(--ink);color:#fff;font:11px var(--font);z-index:1";
    const icon = document.createElement("div");
    icon.style.cssText = "width:48px;height:48px;display:grid;place-items:center;color:#c9c0d1;font-size:24px";
    if (sp) createRoot(icon).render(createElement(FishIcon, { sp, size: 48 }));
    else icon.textContent = "＋";
    const nm = document.createElement("div");
    nm.textContent = sp ? sp.name : "빈 칸";
    nm.style.cssText = `width:62px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:11px var(--font);color:${sp ? "var(--ink)" : "var(--ink-soft)"}`;
    el.append(key, icon, nm);
    el.title = sp ? `${i + 1}번 키: ${sp.name}` : "메인 화면의 🐉 탈것에서 넣을 수 있어요";
    el.addEventListener("click", () => callMount(i));
    slotBar.append(el);
    slotEls.push(el);
  });
}
function updateSlotBar() {
  slotEls.forEach((el, i) => {
    const on = ridePhase !== "none" && rideSlot === i; // 지금 불러서 타고 있는 칸
    el.style.borderColor = on ? "var(--sun-deep)" : "#f0eaf5";
    el.style.boxShadow = on ? "0 0 0 3px rgba(255,212,90,.5)" : "none";
    el.style.background = on ? "#fff4c9" : "#fff";
  });
}

// 조작 안내: 처음 한 번 보여 주고, 닫으면 왼쪽 위의 작은 ? 단추만 남는다(H 로도 여닫는다)
const helpEl = document.createElement("div");
helpEl.style.cssText = "position:fixed;left:12px;top:12px;padding:12px 14px 12px;border-radius:18px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink);font:14px/1 var(--font);z-index:6;display:none";
const keycap = "display:inline-block;min-width:34px;padding:4px 7px;margin-right:9px;border-radius:8px;background:var(--sun);color:var(--ink);font:13px var(--font);text-align:center;box-shadow:0 2px 0 var(--sun-deep)";
helpEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px"><b style="font-size:16px;font-weight:normal">조작</b><button id="helpClose" style="border:0;background:none;color:var(--ink-soft);font-size:17px;cursor:pointer;padding:0 0 0 18px;line-height:1">✕</button></div>`
  + (isTouch ? [["스틱", "보는 쪽으로 헤엄"], ["끌기", "화면을 끌어 시점 돌리기"], ["두 손가락", "벌리고 오므려 거리 조절"], ["달리기", "누르고 있는 동안 빠르게"], ["시점", "1인칭 ↔ 3인칭"], ["발사", "작살 쏘기 · 힘겨루기 땐 꾹 눌러 감기"]]
    : [["Shift", "빠르게 헤엄"], ["클릭", "마우스로 시점 돌리기"], ["Esc", "시점 풀기"], ["V", "1인칭 ↔ 3인칭"], ["클릭/Space", "작살 쏘기 · 힘겨루기 땐 꾹 눌러 감기"], ["H", "안내 닫기"]])
    .map(([k, d]) => `<div style="display:flex;align-items:center;margin-top:7px"><span style="${keycap}">${k}</span>${d}</div>`).join("");
const helpBtn = document.createElement("button");
helpBtn.textContent = "?";
helpBtn.title = "조작 안내 (H)";
helpBtn.style.cssText = "position:fixed;left:12px;top:12px;width:30px;height:30px;border-radius:50%;border:0;background:#fff;color:var(--ink);box-shadow:0 3px 0 rgba(74,59,82,.14);font:16px var(--font);cursor:pointer;z-index:6;display:none";
if (isTouch) helpEl.style.top = "52px"; // 휴대폰: 위 가운데의 채널 단추와 겹치지 않게 한 줄 아래에 편다
document.body.append(helpEl, helpBtn);
function showHelp(on: boolean) {
  helpEl.style.display = on ? "" : "none";
  helpBtn.style.display = on ? "none" : "";
  guideBtn.style.display = on ? "none" : "";
  if (!on) writeSaved("uw.help", "seen"); // 한 번 닫으면 다음부터는 접힌 채로 시작한다
}
helpEl.querySelector("#helpClose")!.addEventListener("click", () => showHelp(false));
helpBtn.addEventListener("click", () => showHelp(true));

// 안내(G): 조작 창과 별개로, 작살·힘겨루기·줍기·보스 사용법을 탭으로 알려 주는 창. 열려 있는 동안은 조작과 발사를 막는다
let guideOpen = false;
const GUIDE: Array<[string, string[]]> = [
  ["작살 쏘기", [
    `${isTouch ? "오른쪽 아래 <b>발사</b> 단추" : "<b>마우스 왼쪽 클릭</b>(또는 Space)"}으로 작살을 쏴요. 맞으면 물고기가 줄에 끌려와요.`,
    "물고기는 계속 움직여요. 가는 방향의 <b>조금 앞쪽</b>을 겨냥하세요.",
    "십자선이 흔들려요. 가만히 떠 있으면 덜 흔들리고, 작살총을 강화하면 더 안정돼요.",
    "빠르게 헤엄치거나 바짝 다가가면 물고기가 놀라 도망가요. 천천히 다가가세요.",
    "쏜 뒤에는 잠깐 재장전이 필요해요(작살총을 강화하면 빨라져요).",
  ]],
  ["힘겨루기", [
    "<b>매우 희귀 · 전설 · 신화</b> 물고기는 작살을 맞힌 뒤 힘겨루기를 해야 잡혀요. 조준은 필요 없고 <b>누르고 떼기</b>만 해요.",
    `<b>① 지치게 하기 (모두)</b>: 물고기는 <b>쉬는 구간</b>과 <b>돌진 구간</b>을 번갈아 해요. 쉴 때는 ${isTouch ? "발사 단추" : "마우스(또는 Space)"}를 <b>꾹 눌러 감고</b>, 돌진할 때는 <b>손을 떼서 줄을 풀어</b> 주세요. 바깥 <b>노란 고리</b>가 지친 정도예요. 가득 차면 <b>매우 희귀</b>는 바로 잡혀요.`,
    "돌진 직전에는 화면 가장자리가 <b>노랗게 깜빡</b>이고, 돌진하면 <b>주황으로 번쩍이며 ✋ 놓아요!</b>가 떠요. 이때 계속 감고 있으면 화면이 <b>붉게</b> 변하고 흔들려요.",
    "<b>안쪽 고리(장력)</b>는 감는 동안 커져요. 하양 → 주황 → <b>빨강</b>이 되고 가득 차면 줄이 끊겨요. 손을 떼면 작아져요. 안 감으면 물고기가 쉬어서 지치지 않아요.",
    "<b>② 마지막 버티기 (전설 · 신화)</b>: 지치면 <b>⚖ 띠 안에 유지해요!</b>가 떠요. 안쪽 고리를 <b>두 점선 고리 사이</b>(연두색 띠)에 일정 시간 두세요. 누르면 커지고 떼면 작아져요. 물고기가 불규칙하게 밀어서 흔들려요. 띠를 벗어나면 모은 시간이 줄어요.",
    `<b>③ 박자 (신화)</b>: 마지막으로 <b>♪ 박자에 맞춰 눌러요!</b>가 떠요. 바깥에서 모여드는 노란 링이 안쪽 고리에 닿는 순간에 ${isTouch ? "발사 단추" : "클릭"}를 <b>세 번</b> 눌러요. 틀리면 장력이 오르고 처음부터 다시 해요.`,
    "등급이 높을수록 돌진이 길고, 띠가 좁고, 박자가 빨라요. 작살총을 강화하면 장력이 천천히 오르고 물고기가 덜 흔들어요.",
  ]],
  ["줍기 · 상자", [
    "바닥의 <b>조개</b>와 <b>보물 상자</b>에 가까이 가면 'E' 안내가 떠요. <b>E 키</b>(휴대폰은 <b>줍기</b> 단추)로 주워요.",
    "상자는 나무 · 은 · 금 순으로 좋은 게 나오고, 가끔 텅 비어 있기도 해요.",
    "주운 조개와 잡은 물고기는 <b>I 키(가방)</b>에서 팔 수 있어요. 같은 채널에 사람이 많을수록 값이 조금 높아요.",
  ]],
  ["보스 · 강화", [
    "가끔 어딘가에 <b>구역 보스</b>가 나타나요. 나타나면 채널 전체에 알림이 떠요(어디인지는 몰라요).",
    "보스는 몸을 맞히면 조금, <b>깜빡이는 약점</b>을 맞히면 크게 깎여요. 같이 때린 사람 모두에게 기여한 만큼 보상이 가요.",
    "<b>I 키 → 작살총 강화</b>에서 강화석과 코인으로 작살총을 올려요. 사거리 · 속도 · 재장전 · 조준 안정 · 줄 강도가 좋아져요.",
  ]],
];
const guideEl = document.createElement("div");
guideEl.style.cssText = "position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,30,50,.4);z-index:21;font-family:var(--font)";
guideEl.innerHTML = `<div id="guideBox" style="width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 40px);display:flex;flex-direction:column;border-radius:20px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink)"><div style="display:flex;align-items:center;gap:8px;padding:12px 16px 8px"><b style="font-size:18px;font-weight:normal;flex:1">📖 안내</b><button id="guideX" style="border:0;background:none;color:var(--ink-soft);font-size:18px;cursor:pointer">✕</button></div><div id="guideTabs" style="display:flex;gap:6px;flex-wrap:wrap;padding:0 16px"></div><div id="guideBody" style="overflow-y:auto;padding:12px 18px 16px;font-size:15px;line-height:1.6"></div></div>`;
document.body.append(guideEl);
const guideBody = guideEl.querySelector<HTMLElement>("#guideBody")!, guideTabs = guideEl.querySelector<HTMLElement>("#guideTabs")!;
function showGuideTab(n: number) {
  guideBody.innerHTML = "<ul style='margin:0;padding-left:20px'>" + GUIDE[n][1].map((t) => `<li style="margin-bottom:8px">${t}</li>`).join("") + "</ul>";
  [...guideTabs.children].forEach((b, i) => ((b as HTMLElement).style.cssText = `border:0;border-radius:999px;padding:6px 14px;font:14px var(--font);cursor:pointer;background:${i === n ? "var(--sun)" : "#fff"};color:var(--ink);box-shadow:0 2px 0 ${i === n ? "var(--sun-deep)" : "rgba(74,59,82,.14)"}`));
}
GUIDE.forEach(([name], i) => { const b = document.createElement("button"); b.textContent = name; b.addEventListener("click", () => showGuideTab(i)); guideTabs.append(b); });
function toggleGuide(on = !guideOpen) {
  if (on && (loading || exitOpen)) return;
  guideOpen = on;
  guideEl.style.display = on ? "flex" : "none";
  if (on) { showGuideTab(0); keys.clear(); stick.x = stick.y = 0; document.exitPointerLock?.(); freeLook = false; canvas.style.cursor = ""; }
}
guideEl.addEventListener("click", (e) => { if (e.target === guideEl) toggleGuide(false); });
guideEl.querySelector("#guideX")!.addEventListener("click", () => toggleGuide(false));
const guideBtn = document.createElement("button");
guideBtn.textContent = "📖 안내";
guideBtn.title = "사용법 안내 (G)";
guideBtn.style.cssText = "position:fixed;left:50px;top:12px;height:30px;padding:0 12px;border-radius:15px;border:0;background:#fff;color:var(--ink);box-shadow:0 3px 0 rgba(74,59,82,.14);font:14px var(--font);cursor:pointer;z-index:6;display:none";
document.body.append(guideBtn);
guideBtn.addEventListener("click", () => toggleGuide(true));
const guideInHelp = document.createElement("button"); // 조작 창이 펼쳐져 있을 때는 그 안에 안내 단추를 둔다
guideInHelp.textContent = "📖 사용법 안내 (G)";
guideInHelp.style.cssText = "margin-top:10px;width:100%;border:0;border-radius:10px;padding:7px 0;background:var(--sun);color:var(--ink);font:14px var(--font);cursor:pointer;box-shadow:0 2px 0 var(--sun-deep)";
guideInHelp.addEventListener("click", () => toggleGuide(true));
helpEl.append(guideInHelp);
showHelp(readSaved("uw.help") !== "seen");

// ---- 멀티: 수중 탐험 채널 -------------------------------------------------------------
// 개인이 만드는 방이 아니라 자동으로 열리는 채널(15명)에 들어간다. 같은 구역 사람만 화면에 보이고, 다른 구역 사람은 미니맵에만 나온다.
// 채팅창은 채널 전체(모든 구역)가 함께 쓰고, 캐릭터 위 말풍선은 가까이 있는 사람에게 보인다.
type DiverLike = { name: string; look: string; x: number; y: number; z: number; yaw: number; zone: number; moving: boolean; mount: string };
interface Peer { rig: CharacterRig; label: THREE.Sprite; bubble: THREE.Sprite | null; bubbleUntil: number; pos: THREE.Vector3; mountId: string; mount: Mount | null; mountK: number; swimK: number; tilt: number; style: number }
let room: Room<any> | null = null;
let mySid = "";
const peers = new Map<string, Peer>();

/** 글자를 그린 판(이름표, 말풍선). 항상 카메라를 본다 */
function textSprite(lines: string[], font: number, bubble: boolean): THREE.Sprite {
  const c = document.createElement("canvas"), g = c.getContext("2d")!;
  g.font = `bold ${font}px Jua, sans-serif`;
  const pad = bubble ? 26 : 12, lh = font * 1.3;
  const w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width))) + pad * 2, h = Math.ceil(lines.length * lh) + pad * 2 + (bubble ? 18 : 0);
  c.width = w; c.height = h;
  g.font = `bold ${font}px Jua, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  if (bubble) { // 흰 말풍선과 꼬리
    g.fillStyle = "rgba(255,255,255,.96)"; g.strokeStyle = "#2a6f9a"; g.lineWidth = 5;
    g.beginPath(); g.roundRect(3, 3, w - 6, h - 24, 24); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(w / 2 - 14, h - 23); g.lineTo(w / 2, h - 3); g.lineTo(w / 2 + 14, h - 23); g.closePath(); g.fill(); g.stroke();
    g.fillRect(w / 2 - 12, h - 28, 24, 8);
    g.fillStyle = "#17405c";
  } else { g.lineWidth = 6; g.strokeStyle = "rgba(0,30,60,.9)"; g.fillStyle = "#fff"; }
  lines.forEach((l, i) => { const y = pad + lh * (i + 0.5); if (!bubble) g.strokeText(l, w / 2, y); g.fillText(l, w / 2, y); });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(w / 90, h / 90, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 5;
  return sp;
}
function dropSprite(sp: THREE.Sprite | null) { if (!sp) return; scene.remove(sp); sp.material.map?.dispose(); sp.material.dispose(); }
/** 말풍선: 한 줄 14자쯤에서 끊어 세 줄까지 */
function makeBubble(text: string): THREE.Sprite {
  const lines: string[] = [];
  for (let i = 0; i < text.length && lines.length < 3; i += 14) lines.push(text.slice(i, i + 14));
  if (text.length > 42) lines[2] = lines[2].slice(0, 13) + "…";
  return textSprite(lines, 46, true);
}

// 채팅창(왼쪽 아래)과 입력 칸. Enter 로 열고 Enter 로 보낸다
const chatLog = document.createElement("div");
chatLog.style.cssText = "position:fixed;left:12px;bottom:58px;width:min(360px,70vw);display:flex;flex-direction:column;gap:3px;pointer-events:none;font:15px/1.35 var(--font);color:var(--ink)";
const chatInput = document.createElement("input");
chatInput.maxLength = 100;
chatInput.placeholder = "Enter 를 눌러 채팅";
chatInput.style.cssText = "position:fixed;left:12px;bottom:14px;width:min(360px,70vw);box-sizing:border-box;padding:7px 14px;border-radius:16px;border:3px solid #e6dff0;background:#fff;color:var(--ink);font:16px var(--font);outline:none;opacity:.7";
document.body.append(chatLog, chatInput);
// 화면이 좁으면 아래 가운데의 탈것 칸과 겹치므로 채팅을 그 위로 올린다
const layoutChat = () => { const up = window.innerWidth < 1100 ? 100 : 0; chatInput.style.bottom = `${14 + up}px`; chatLog.style.bottom = `${58 + up}px`; };
// 휴대폰: 채팅은 평소에 화면에 없다. 채팅 단추를 누르면 위쪽에 창이 뜨고(키보드에 가리지 않게) ✕ 로 닫는다
const chatPanel = document.createElement("div");
let chatUnread: HTMLElement | null = null; // 창이 닫혀 있을 때 새 글이 오면 채팅 단추에 찍는 점
if (isTouch) {
  chatPanel.style.cssText = "position:fixed;left:10px;right:10px;top:56px;max-height:50vh;display:none;flex-direction:column;gap:8px;padding:12px;border-radius:22px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink);z-index:8";
  const head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;justify-content:space-between;font:18px var(--font)";
  head.innerHTML = `<span>채팅</span><button aria-label="채팅 닫기" style="border:0;background:#f0eaf5;color:var(--ink);width:32px;height:32px;border-radius:50%;padding:0;display:grid;place-items:center">${ICON('<path d="M6 6l12 12M18 6L6 18"/>', 18)}</button>`;
  head.querySelector("button")!.addEventListener("click", () => closeChat());
  chatLog.style.cssText = "display:flex;flex-direction:column;gap:4px;overflow-y:auto;min-height:48px;font:14px/1.4 var(--font)";
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px";
  chatInput.style.cssText = "flex:1;min-width:0;box-sizing:border-box;padding:8px 14px;border-radius:16px;border:3px solid #e6dff0;background:#fff;color:var(--ink);font:16px var(--font);outline:none"; // 16px: 아이폰이 입력 칸을 누를 때 화면을 확대하지 않는 크기
  chatInput.placeholder = "채팅 입력";
  chatInput.enterKeyHint = "send";
  const send = document.createElement("button");
  send.textContent = "보내기";
  send.className = "btn mint small";
  send.addEventListener("click", () => { sendChat(); chatInput.focus(); });
  row.append(chatInput, send);
  chatPanel.append(head, chatLog, row);
  document.body.append(chatPanel);
} else {
  window.addEventListener("resize", layoutChat);
  layoutChat();
}
function closeChat() { chatPanel.style.display = "none"; chatInput.blur(); }
function sendChat() {
  const text = chatInput.value.trim();
  if (text) room?.send("chat", { text });
  chatInput.value = "";
}
function addChatLine(name: string, text: string) {
  const d = document.createElement("div");
  d.style.cssText = "background:rgba(255,255,255,.88);border-radius:14px;padding:4px 11px;align-self:flex-start;max-width:100%;word-break:break-all";
  const b = document.createElement("b");
  b.style.cssText = "color:var(--pink-deep);font-weight:normal";
  b.textContent = name ? name + "  " : "";
  d.append(b, text);
  chatLog.append(d);
  while (chatLog.children.length > (isTouch ? 40 : 8)) chatLog.firstChild!.remove();
  if (isTouch) { // 창 안에서는 흐려지지 않고 맨 아래 글이 보이게 한다. 닫혀 있으면 채팅 단추에 점을 찍는다
    chatLog.scrollTop = chatLog.scrollHeight;
    if (name && chatUnread && chatPanel.style.display === "none") chatUnread.style.display = "";
  } else setTimeout(() => { d.style.transition = "opacity 1.5s"; d.style.opacity = "0.35"; }, 12000);
}
function openChat() {
  if (isTouch) {
    if (!room && !chatLog.children.length) addChatLine("", "채널에 연결되지 않아 채팅을 쓸 수 없어요");
    chatPanel.style.display = "flex";
    if (chatUnread) chatUnread.style.display = "none";
    chatLog.scrollTop = chatLog.scrollHeight;
    chatInput.focus();
    return;
  }
  if (!room) { addChatLine("", "채널에 연결되지 않아 채팅을 쓸 수 없어요"); return; }
  keys.clear();
  chatInput.style.opacity = "1";
  chatInput.focus();
}
chatInput.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key !== "Enter" && e.key !== "Escape") return;
  if (e.key === "Enter") sendChat(); else chatInput.value = "";
  if (isTouch) { if (e.key === "Escape") closeChat(); return; } // 휴대폰은 창을 열어 둔 채 이어서 쓴다
  chatInput.style.opacity = ".7";
  chatInput.blur();
});
chatInput.addEventListener("keyup", (e) => e.stopPropagation());

// ---- 휴대폰 조작: 왼쪽 아래 이동 스틱, 오른쪽 아래 단추(시점·채팅·달리기). 시점은 화면을 끌어서, 카메라 거리는 두 손가락으로 ----
if (isTouch) {
  const base = "position:fixed;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none";
  const stickEl = document.createElement("div"), knob = document.createElement("i");
  stickEl.style.cssText = `${base};left:16px;bottom:106px;width:108px;height:108px;border-radius:50%;background:rgba(255,255,255,.4);border:4px solid rgba(255,255,255,.8)`;
  knob.style.cssText = "position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 4px 0 rgba(74,59,82,.2);pointer-events:none";
  stickEl.append(knob);
  let sid = -1;
  const moveStick = (e: PointerEvent) => {
    if (e.pointerId !== sid) return;
    const b = stickEl.getBoundingClientRect(), R = b.width / 2;
    let dx = (e.clientX - b.left - R) / R, dy = (e.clientY - b.top - R) / R;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    stick.x = Math.abs(dx) < 0.15 ? 0 : dx; stick.y = Math.abs(dy) < 0.15 ? 0 : -dy; // 가운데 근처는 멈춤
    knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`;
  };
  const endStick = (e: PointerEvent) => { if (e.pointerId !== sid) return; sid = -1; stick.x = stick.y = 0; knob.style.transform = ""; };
  stickEl.addEventListener("pointerdown", (e) => { sid = e.pointerId; moveStick(e); try { stickEl.setPointerCapture(e.pointerId); } catch { /* 손가락을 못 잡아도 스틱 위에서는 동작한다 */ } });
  stickEl.addEventListener("pointermove", moveStick);
  stickEl.addEventListener("pointerup", endStick);
  stickEl.addEventListener("pointercancel", endStick);

  // 단추: 그림과 글자를 함께 넣어 무엇인지 바로 알게 한다
  const OFF = "var(--sky)"; // 달리기 단추의 평소 색
  const mk = (svg: string, label: string, size: number) => {
    const b = document.createElement("button");
    b.innerHTML = `${ICON(svg, size > 60 ? 26 : 20)}<span style="font:${size > 60 ? 12 : 10}px var(--font);margin-top:1px">${label}</span>`;
    b.style.cssText = `position:relative;width:${size}px;height:${size}px;border-radius:50%;border:0;background:#fff;color:var(--ink);box-shadow:0 4px 0 #d9d2de;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;touch-action:none;user-select:none;-webkit-user-select:none`;
    return b;
  };
  const viewBtn = mk('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', "시점", 54);
  viewBtn.addEventListener("click", () => (firstPerson = !firstPerson));
  const chatBtn = mk('<path d="M4 5h16v11H10l-5 4v-4H4z"/>', "채팅", 54);
  chatBtn.addEventListener("click", () => openChat());
  const dot = document.createElement("i");
  dot.style.cssText = "position:absolute;right:2px;top:2px;width:13px;height:13px;border-radius:50%;background:var(--danger);border:2px solid #fff;display:none";
  chatBtn.append(dot);
  chatUnread = dot;
  // 달리기: 누르고 있는 동안만 빠르게 헤엄친다. 누른 채 손가락을 움직이면 시점도 돌아간다(달리면서 방향을 틀 수 있게)
  const runBtn = mk('<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>', "달리기", 76);
  runBtn.style.background = OFF; runBtn.style.boxShadow = "0 5px 0 var(--sky-deep)";
  let rid = -1, rx = 0, ry = 0;
  runBtn.addEventListener("pointerdown", (e) => { rid = e.pointerId; rx = e.clientX; ry = e.clientY; keys.add("shift"); runBtn.style.background = "var(--mint)"; try { runBtn.setPointerCapture(rid); } catch { /* 손가락을 못 잡아도 단추 위에서는 동작한다 */ } });
  runBtn.addEventListener("pointermove", (e) => { if (e.pointerId !== rid) return; look(e.clientX - rx, e.clientY - ry, 0.007); rx = e.clientX; ry = e.clientY; });
  const endRun = (e: PointerEvent) => { if (e.pointerId !== rid) return; rid = -1; keys.delete("shift"); runBtn.style.background = OFF; };
  runBtn.addEventListener("pointerup", endRun);
  runBtn.addEventListener("pointercancel", endRun);
  runBtn.addEventListener("contextmenu", (e) => e.preventDefault()); // 길게 눌러도 메뉴가 뜨지 않게

  const pad = document.createElement("div"), top = document.createElement("div");
  pad.style.cssText = `${base};right:14px;bottom:106px;display:flex;flex-direction:column;align-items:flex-end;gap:10px`;
  top.style.cssText = "display:flex;gap:10px";
  const bagBtn = mk('<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', "가방", 54);
  bagBtn.addEventListener("click", () => toggleInv());
  top.append(viewBtn, chatBtn, bagBtn);
  pad.append(top, runBtn);
  document.body.append(stickEl, pad);
}

let myBubble: THREE.Sprite | null = null, myBubbleUntil = 0;
/** id 가 없으면 자동 배정(앞 채널부터 채운다), 있으면 그 채널로 직접 들어간다 */
async function joinChannel(id?: string) {
  const r: Room<any> = id ? await colyseus.joinById(id, { token: auth.token }) : await colyseus.joinOrCreate("underwater", { token: auth.token });
  r.onMessage("welcome", () => {});
  r.onMessage("chatBlocked", (m: { reason: string }) => addChatLine("", m.reason));
  r.onMessage("chat", (m: { sessionId: string; name: string; text: string }) => {
    addChatLine(m.name, m.text);
    const b = makeBubble(m.text);
    scene.add(b);
    if (m.sessionId === mySid) { dropSprite(myBubble); myBubble = b; myBubbleUntil = t + 6; }
    else { const q = peers.get(m.sessionId); if (q) { dropSprite(q.bubble); q.bubble = b; q.bubbleUntil = t + 6; } else dropSprite(b); }
  });
  r.onLeave(() => { if (room !== r) return; room = null; addChatLine("", "채널 연결이 끊겼어요. 혼자 모드로 이어집니다."); }); // 채널을 옮기느라 떠난 옛 채널은 무시한다
  mySid = r.sessionId;
  room = r;
  addChatLine("", isTouch ? "채널에 들어왔어요." : "채널에 들어왔어요. Enter 로 채팅할 수 있어요.");
}

// 채널 고르기: 위 가운데 단추를 누르면 채널 목록이 열리고, 고르면 그 채널로 옮긴다(친구와 같은 채널에 갈 때)
const chBtn = document.createElement("button");
chBtn.style.cssText = "position:fixed;left:50%;top:10px;transform:translateX(-50%);padding:6px 16px;border-radius:999px;border:0;background:#fff;color:var(--ink);box-shadow:0 3px 0 rgba(74,59,82,.14);font:15px var(--font);cursor:pointer;z-index:6";
const chList = document.createElement("div");
chList.style.cssText = "position:fixed;left:50%;top:48px;transform:translateX(-50%);display:none;flex-direction:column;gap:6px;padding:12px;border-radius:20px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink);z-index:6;min-width:170px";
document.body.append(chBtn, chList);
let chBusy = false;
chBtn.addEventListener("click", async () => {
  if (chList.style.display === "flex") { chList.style.display = "none"; return; }
  const list = await api<Array<{ id: string; channel: number; players: number; max: number }>>("/api/underwater/channels").catch(() => []);
  chList.replaceChildren();
  if (!list.length) chList.textContent = "열린 채널이 없어요";
  for (const c of list) {
    const b = document.createElement("button"), here = room?.roomId === c.id, full = c.players >= c.max;
    b.textContent = `${c.channel}채널  ${c.players}/${c.max}명${here ? "  (여기)" : full ? "  (가득)" : ""}`;
    b.disabled = here || full;
    b.style.cssText = `padding:7px 14px;border-radius:999px;border:0;font:15px var(--font);cursor:${b.disabled ? "default" : "pointer"};background:${here ? "var(--mint)" : full ? "#e6e0ea" : "var(--sky)"};color:var(--ink)`;
    b.addEventListener("click", async () => {
      if (chBusy) return;
      chBusy = true;
      chList.style.display = "none";
      const old = room;
      room = null; // 옮기는 동안 다른 사람들은 화면에서 치운다
      try { await old?.leave(); await joinChannel(c.id); }
      catch { addChatLine("", "그 채널에 들어가지 못했어요. 자동으로 다른 채널에 들어갑니다."); await joinChannel().catch(() => addChatLine("", "채널에 연결하지 못했어요. 혼자 모드로 이어집니다.")); }
      chBusy = false;
    });
    chList.append(b);
  }
  chList.style.display = "flex";
});

// 인벤토리(I 키): 낚시 방과 같은 목록. 열려 있는 동안은 조작·발사를 막고 마우스 고정을 푼다
let invOpen = false;
const invHost = document.createElement("div");
document.body.append(invHost);
const invRoot = createRoot(invHost);
function toggleInv() {
  if (loading || exitOpen) return;
  invOpen = !invOpen;
  if (invOpen) { keys.clear(); stick.x = stick.y = 0; document.exitPointerLock?.(); freeLook = false; canvas.style.cursor = ""; }
  invRoot.render(invOpen ? createElement(UwInventory, { room, divers: () => room?.state?.players?.size ?? 1, onHarpoon: (l: number) => hunt.setLevel(l), onClose: toggleInv }) : null);
}

// 작살 사냥(조준·던지기·조개 줍기)은 uwHunt.ts. 채널에 들어가 있을 때만 동작한다
const hunt = createHunt({
  scene, camera, player, isTouch,
  zone: () => curZone,
  room: () => room,
  firstPerson: () => firstPerson,
  setYaw: (y) => { player.yaw = y; },
  setFirstPerson: (on) => { firstPerson = on; },
  hand: (side, out) => (rig ? rig.handWorld(side, out) : null),
  posOf: (sid) => (sid === mySid ? player.pos : peers.get(sid)?.pos ?? null),
  aiming: () => locked() || freeLook,
  blocked: () => !!loading || exitOpen || invOpen || guideOpen || !!trans || document.activeElement === chatInput,
  makeFish, flatten, heightAt,
  say: (text) => addChatLine("", text),
});

let sendTimer = 0;
const TMP_P = new THREE.Vector3();
function updatePeers(dt: number, moving: boolean) {
  if (frame % 12 === 0) chBtn.textContent = room ? `${room.state?.channel ?? "?"}채널 ${room.state?.players?.size ?? 1}/15 ▾` : "혼자 모드 ▾";
  if (myBubble) { // 내 말풍선
    myBubble.visible = t < myBubbleUntil && !firstPerson;
    myBubble.position.set(player.pos.x, player.pos.y + 3.5 + rideK * 0.4, player.pos.z);
    if (t > myBubbleUntil) { dropSprite(myBubble); myBubble = null; }
  }
  if (!room) { if (peers.size) for (const sid of [...peers.keys()]) removePeer(sid); return; }
  if ((sendTimer -= dt) <= 0) { // 내 위치를 1초에 10번 보낸다
    sendTimer = 0.1;
    room.send("move", { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: riding && mount ? mount.yaw : player.yaw, zone: curZone, moving, mount: ridePhase === "ride" && mount ? mount.id : "" });
  }
  const seen = new Set<string>();
  room.state?.players?.forEach((p: DiverLike, sid: string) => {
    if (sid === mySid) return;
    seen.add(sid);
    let q = peers.get(sid);
    if (!q) {
      let look = LOOK;
      try { look = JSON.parse(p.look); } catch { /* 겉모습을 못 읽으면 기본 모습 */ }
      const rg = new CharacterRig(look);
      rg.root.rotation.order = "YXZ";
      const label = textSprite([p.name], 34, false);
      scene.add(rg.root, label);
      q = { rig: rg, label, bubble: null, bubbleUntil: 0, pos: new THREE.Vector3(p.x, p.y, p.z), mountId: "", mount: null, mountK: 0, swimK: 0, tilt: 0, style: (look.appearance as { gender?: number }).gender === 1 ? 1 : 0 };
      peers.set(sid, q);
    }
    const show = p.zone === curZone && !loading; // 같은 구역 사람만 보인다
    TMP_P.set(p.x, p.y, p.z);
    if (q.pos.distanceTo(TMP_P) > 25) q.pos.copy(TMP_P); // 구역 이동(순간 이동)은 바로 옮긴다
    else q.pos.lerp(TMP_P, Math.min(1, dt * 10));
    if (p.mount !== q.mountId) { // 탈것을 타거나 내렸다
      if (q.mount) q.mount.root.visible = false;
      q.mountId = p.mount;
      const sp = mythList.find((m) => m.id === p.mount);
      q.mount = sp ? buildMount(sp, sid) : null;
      q.mountK = 0;
      if (q.mount) q.mount.yaw = p.yaw;
    }
    const rides = !!q.mount;
    q.mountK = Math.min(1, q.mountK + dt * 2.5);
    q.swimK += ((p.moving && !rides ? 1 : 0) - q.swimK) * Math.min(1, dt * 5);
    q.tilt += ((rides ? 0 : 0.12 + q.swimK * 1.2) - q.tilt) * Math.min(1, dt * 6);
    q.rig.root.visible = show;
    q.rig.update(dt, { moving: false, fishing: "idle", ride: rides, swim: rides ? undefined : { k: q.swimK, style: q.style } }, p.yaw);
    const yw = q.rig.root.rotation.y, st = Math.sin(q.tilt);
    q.rig.root.rotation.x = q.tilt;
    q.rig.root.position.set(q.pos.x - st * Math.sin(yw), q.pos.y + (1 - Math.cos(q.tilt)), q.pos.z - st * Math.cos(yw));
    if (q.mount) {
      const m = q.mount, sc = 0.05 + 0.95 * (1 - (1 - q.mountK) ** 3);
      m.root.visible = show;
      m.yaw -= angDiff(m.yaw, p.yaw) * Math.min(1, dt * 5);
      m.root.position.set(q.pos.x - Math.sin(m.yaw) * m.seatX * sc, q.pos.y + (SEAT - m.top) * sc, q.pos.z - Math.cos(m.yaw) * m.seatX * sc);
      m.root.rotation.set(0, m.yaw - Math.PI / 2, 0);
      m.root.scale.setScalar(sc);
      m.ph += dt * (p.moving ? 5 : 2);
      (m.fish.userData.update as ((t: number) => void) | undefined)?.(m.ph);
    }
    q.label.visible = show;
    q.label.position.set(q.pos.x, q.pos.y + 2.5 + (rides ? 0.4 : 0), q.pos.z);
    if (q.bubble) {
      q.bubble.visible = show && t < q.bubbleUntil;
      q.bubble.position.set(q.pos.x, q.pos.y + 3.3 + (rides ? 0.4 : 0), q.pos.z);
      if (t > q.bubbleUntil) { dropSprite(q.bubble); q.bubble = null; }
    }
  });
  for (const sid of [...peers.keys()]) if (!seen.has(sid)) removePeer(sid);
}
function removePeer(sid: string) {
  const q = peers.get(sid);
  if (!q) return;
  scene.remove(q.rig.root);
  dropSprite(q.label); dropSprite(q.bubble);
  if (q.mount) { scene.remove(q.mount.root); mountCache.delete(q.mount.id + sid); }
  peers.delete(sid);
}

// ---- 거품 -----------------------------------------------------------------------
const BUB = 160;
const bubGeo = new THREE.BufferGeometry();
const bubPos = new Float32Array(BUB * 3);
const bubSeed = Array.from({ length: BUB }, () => ({ x: (rnd() - 0.5) * 60, y: rnd() * 40, z: (rnd() - 0.5) * 60, sp: 0.6 + rnd() * 1.2 }));
bubGeo.setAttribute("position", new THREE.BufferAttribute(bubPos, 3));
const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ color: "#e8fbff", size: 0.22, transparent: true, opacity: 0.6, depthWrite: false }));
bubbles.frustumCulled = false;
scene.add(bubbles);

// ---- 시작 ------------------------------------------------------------------------
const clock = new THREE.Clock();
let t = 0;
let frame = 0;
let fps = 60;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  t += dt;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  windU.value = t;
  const moving = movePlayer(dt);
  applyEnv(dt);
  updateExtras(t);
  if (rig) {
    rig.root.visible = !firstPerson;
    const hsp = Math.hypot(player.vel.x, player.vel.z);
    swimK += ((moving && !riding ? 1 : 0) - swimK) * Math.min(1, dt * 5);
    // 헤엄칠 때는 몸을 앞으로 눕힌다. 위로 오를 때는 덜, 아래로 내려갈 때는 더 눕는다. 제자리에서는 거의 서 있는다
    const wantTilt = riding ? 0 : 0.12 + swimK * Math.min(1.5, Math.max(0.3, 1.2 - Math.atan2(player.vel.y, Math.max(hsp, 2)) * 0.9));
    swimTilt += (wantTilt - swimTilt) * Math.min(1, dt * 6);
    rig.update(dt, { moving: false, fishing: "idle", ride: riding, swim: riding ? undefined : { k: swimK, style: swimStyle }, aim: riding ? undefined : hunt.aimPose() }, riding && mount ? mount.yaw : player.yaw);
    // 발이 아니라 가슴께(H)를 축으로 눕혀서, 누워도 몸 가운데가 제자리에 있게 한다
    const H = 1.0, yw = rig.root.rotation.y, st = Math.sin(swimTilt), bob = riding ? 0 : Math.sin(t * 1.6) * 0.12;
    rig.root.rotation.x = swimTilt;
    rig.root.position.set(player.pos.x - H * st * Math.sin(yw), player.pos.y + bob + rideHop + H * (1 - Math.cos(swimTilt)), player.pos.z - H * st * Math.cos(yw));
  }
  updateSwimBubbles(dt);
  updatePeers(dt, moving);
  hunt.update(dt, t);
  updateFpArms(dt);
  gateCooldown -= dt;
  if (!trans && gateCooldown <= 0) for (const g of gates) if (crossedBoundary(g)) { trans = { t0: t, gate: g, teleported: false }; break; }
  if (frame % 6 === 0 && !loading) drawMap();
  if (frame++ % 10 === 0) {
    const far = Math.min(135, 1.8 / (scene.fog as THREE.FogExp2).density); // 안개에 묻혀 안 보이는 거리 밖은 그리지 않는다
    for (const c of chunks) c.mesh.visible = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) < (c.small ? Math.min(far, 65) : far) + CELL * 0.7;
  }
  schools.forEach((s) => updateSchool(s, t, dt));
  roamers.forEach((r) => updateRoamer(r, t, dt));
  updateRideFx();
  if (mount && ridePhase !== "none") {
    const hs = Math.hypot(player.vel.x, player.vel.z), e = t - rideT0;
    let scale = 1, drop = 0, spin = 0, ahead = 0;
    if (ridePhase === "summon") { // 발밑 깊은 곳에서 빛과 함께 빙글 돌며 솟아오르고, 캐릭터가 폴짝 뛰어 올라탄다
      const k = Math.min(1, e / SUMMON), a = 1 - (1 - k) ** 3;
      scale = 0.05 + 0.95 * Math.min(1, a * 1.15); drop = (1 - a) * 6; spin = (1 - a) * Math.PI * 3;
      const j = smooth(0.45, 0.92, k);
      rideK = j; rideHop = Math.sin(Math.PI * j) * 1.5; riding = j > 0.55;
      if (k >= 1) { ridePhase = "ride"; rideK = 1; rideHop = 0; riding = true; }
    } else if (ridePhase === "dismiss") { // 캐릭터가 폴짝 내리고, 탈것은 앞으로 헤엄쳐 오르며 빛으로 작아져 사라진다
      const k = Math.min(1, e / DISMISS), a = k * k;
      const j = smooth(0, 0.45, k);
      rideK = 1 - j; rideHop = Math.sin(Math.PI * j) * 1.0; riding = j < 0.4;
      scale = 1 - 0.96 * a; drop = -a * 3; spin = a * Math.PI * 2; ahead = a * 7;
      if (k >= 1) {
        mount.root.visible = false; mount.root.scale.setScalar(1);
        mount = null; ridePhase = "none"; rideK = 0; rideHop = 0; riding = false;
        if (nextSlot >= 0) { const n = nextSlot; nextSlot = -1; startSummon(n); }
      }
    } else if (hs > 0.5) mount.yaw -= angDiff(mount.yaw, player.yaw) * Math.min(1, dt * 5); // 가는 쪽으로 몸을 돌린다
    if (mount) {
      mount.pitch += ((ridePhase === "ride" ? Math.max(-0.6, Math.min(0.6, Math.atan2(player.vel.y, Math.max(hs, 5)))) : 0) - mount.pitch) * Math.min(1, dt * 4); // 오르내릴 때 머리를 들고 숙인다
      const off = ahead - mount.seatX * scale;
      mount.root.position.set(player.pos.x + Math.sin(mount.yaw) * off, player.pos.y + (SEAT - mount.top) * scale - drop, player.pos.z + Math.cos(mount.yaw) * off);
      mount.root.rotation.set(0, mount.yaw + spin - Math.PI / 2, mount.pitch);
      mount.root.scale.setScalar(scale);
      mount.ph += dt * (2 + hs * 0.35); // 빨리 갈수록 꼬리를 빨리 친다
      (mount.fish.userData.update as ((t: number) => void) | undefined)?.(mount.ph);
    }
  }
  rays.forEach((r) => { r.position.set(player.pos.x + (r.userData.ox as number), 0, player.pos.z + (r.userData.oz as number)); r.rotation.set(0, camYaw, 0.3 + Math.sin(t * 0.25 + (r.userData.p as number)) * 0.06); });
  dome.position.copy(camera.position);
  (dome.material as THREE.ShaderMaterial).uniforms.uCam.value.copy(camera.position);
  (dome.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  // 거품은 캐릭터 주변에서 위로 올라간다
  for (let i = 0; i < BUB; i++) {
    const b = bubSeed[i];
    const y = ((b.y + t * b.sp * (trans ? 6 : 1)) % 40) - 20;
    bubPos[i * 3] = player.pos.x + b.x + Math.sin(t + i) * 0.4;
    bubPos[i * 3 + 1] = player.pos.y + y;
    bubPos[i * 3 + 2] = player.pos.z + b.z + Math.cos(t * 0.8 + i) * 0.4;
  }
  bubGeo.attributes.position.needsUpdate = true;
  // 카메라: 캐릭터 뒤에서 따라간다. 바닥 아래로 내려가지 않게 한다
  const cp = Math.cos(camPitch);
  const target = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
  if (!firstPerson) target.addScaledVector(new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw)), 1.3 * hunt.shoulder()); // 작살총을 들 때는 어깨 너머로 본다: 캐릭터가 한쪽으로 비켜서 십자선이 가려지지 않는다
  const want = new THREE.Vector3(target.x - Math.sin(camYaw) * cp * camDist, target.y + Math.sin(camPitch) * camDist, target.z - Math.cos(camYaw) * cp * camDist);
  const toCam = want.clone().sub(target), cd = toCam.length();
  const blocked = cd > 0.1 ? hitSolid(target, toCam.divideScalar(cd), cd) : undefined; // 벽이 가리면 카메라를 벽 앞으로 당긴다
  if (blocked && blocked.distance > 2.5) want.copy(target).addScaledVector(toCam, blocked.distance - 0.5); // 바로 등 뒤의 밧줄·난간 같은 것에는 당기지 않는다 (화면이 캐릭터로 꽉 찬다)
  want.y = Math.min(-0.8, Math.max(heightAt(want.x, want.z) + 0.6, want.y));
  if (firstPerson) { // 1인칭: 눈높이에서 보는 쪽 그대로
    const eye = player.pos.clone().add(new THREE.Vector3(0, 1.45, 0));
    eye.y = Math.min(-0.8, eye.y);
    camera.position.copy(eye);
    camera.lookAt(eye.x + Math.sin(camYaw) * cp, eye.y - Math.sin(camPitch), eye.z + Math.cos(camYaw) * cp);
  } else {
    camera.position.lerp(want, Math.min(1, dt * 12));
    camera.lookAt(target);
  }
  // 안내문
  hud.style.display = loading ? "" : "none"; // 불러오는 동안에만 가운데에 진행 상황을 보여 준다
  if (loading && frame % 6 === 0) hud.textContent = loading;
  hunt.late(); // 작살총은 카메라 위치가 정해진 뒤에 놓는다
  autoQuality(dt);
  if (frame % 12 === 0) updateSlotBar();
  eng.render();
  requestAnimationFrame(loop);
}

async function start() {
  // 소품 먼저 (실패해도 나머지는 계속)
  const ids = [...new Set(SPECS.map((s) => s.id))];
  await Promise.all(ids.map((id) => loadProp(id).catch((e) => console.warn("소품 불러오기 실패", id, e))));
  applyPastel();
  // 소품을 놓기 전에: 바닥 높이 정보가 필요하다
  await loadZoneModel("atlantis", 1, ATL_LIFT).then((i) => (atlLevels = i.levels)).catch((e) => console.warn("아틀란티스 불러오기 실패", e));
  await loadZoneModel("wreck", 2, 0).catch((e) => console.warn("난파선 불러오기 실패", e));
  await loadZoneModel("cave", 3, 0).then((i) => {
    caveHoles = i.holes; caveGateZ = i.gate ?? caveGateZ;
    for (const [hx, hy, hr, top] of i.holes as number[][]) { // 천장 구멍으로 쏟아지는 빛줄기: 위는 구멍 크기 그대로 시작해 아래로 갈수록 넓어진다(사용자 지정. 한 점에서 퍼지는 원뿔이면 구멍과 안 맞는다)
      const cg = new THREE.CylinderGeometry(hr, hr * 1.7 + 2, top, 28, 1, true);
      cg.translate(0, -top / 2, 0);
      const beam = new THREE.Mesh(cg, rayMaterial("#bfe6ff", 0.5, top));
      beam.position.set(CAVE.x + hx, CAVE.d + top, CAVE.z - hy);
      scene.add(beam);
    }
  }).catch((e) => console.warn("보물 동굴 불러오기 실패", e));
  await loadZoneModel("deep", 4, 0).then((i) => discSets.push([ZONES[4], i.discs])).catch((e) => console.warn("심해 협곡 불러오기 실패", e));
  await loadZoneModel("coral", 0, 0).then((i) => discSets.push([ZONES[0], i.discs])).catch((e) => console.warn("산호 숲 불러오기 실패", e));
  await loadZoneModel("turtle", 5, 0).then((i) => discSets.push([ZONES[5], i.discs])).catch((e) => console.warn("거북이 만 불러오기 실패", e));
  await placeProps();
  buildGates();
  loading = "테마 구조물을 만드는 중..."; await tick();
  buildFlag(); await tick();
  // 구경용 물고기(떼, 고래, 상어, 구역 생물)는 두지 않는다. 눈에 보이는 물고기는 전부 서버가 내보내는 잡을 수 있는 물고기다(uwHunt.ts)
  // 신화 탈것 비교: 시작 지점 옆에 신화 물고기와 캐릭터를 태워 둔다
  loading = "캐릭터를 준비하는 중..."; await tick();
  await loadCharacterModel().catch(() => {});
  const me = await api<PlayerProfile>("/api/me").catch(() => null);
  const look = me ? { appearance: me.appearance, equipped: me.equipped } : LOOK;
  if (params.get("gender")) look.appearance = { ...look.appearance, gender: Number(params.get("gender")) } as typeof look.appearance; // 확인용: &gender=1 은 남자
  swimStyle = (look.appearance as { gender?: number }).gender === 1 ? 1 : 0;
  fpMat.color.set(SKIN[look.appearance.skinColor % SKIN.length]);
  rig = new CharacterRig(look);
  rig.root.rotation.order = "YXZ"; // 방향을 먼저 돌리고 그 방향 기준으로 몸을 눕힌다
  scene.add(rig.root);
  const myth = SPECIES.filter((s) => s.rarity === "mythic");
  mythList = myth;
  // 탈것 칸: 메인 화면에서 넣어 둔 것을 읽는다. 로그인 정보를 못 읽으면(이 시제품만 따로 열었을 때) 시험용으로 신화 넷을 넣는다
  if (me) for (let i = 0; i < 4; i++) mountSlots[i] = myth.find((q) => q.id === me!.equipped[`mount${i + 1}`]) ?? null;
  else { myth.slice(0, 4).forEach((q, i) => (mountSlots[i] = q)); slotNote = " (로그인 정보 없음: 시험용)"; }
  const dm = params.get("mount"); // 확인용: &mount=0,6,5,3 처럼 쓰면 칸 1~4에 신화 N번을 넣는다(잡지 않았어도)
  if (dm) { dm.split(",").slice(0, 4).forEach((v, i) => (mountSlots[i] = myth[Number(v)] ?? mountSlots[i])); slotNote = " (시험용 칸)"; }
  for (const q of mountSlots) if (q) buildMount(q); // 부르는 순간 멈칫하지 않게 미리 만들어 둔다
  buildSlotBar();
  const m2 = myth[2];
  if (m2) addRoamer(m2, 6, { speed: [3, 4], above: [4, 9], ring: [100, 120], gone: 150, vis: 130 });
  prewarm();
  loading = "";
  if (me) hunt.setLevel(harpoonLevelOf(me.equipped));
  if (me && auth.token) await joinChannel().catch((e) => console.warn("수중 채널 접속 실패", e));
  if (params.get("zone")) teleport(Number(params.get("zone")) - 1);
  const at = params.get("at")?.split(",").map(Number); // 확인용: &at=x,y,z
  if (at) player.pos.set(at[0], at[1], at[2]);
  const gp = params.get("gate"); // 확인용: &gate=N 구역 경계 N번 앞에서 시작
  if (gp) { gateIdx = Number(gp) - 1; toGate(gateIdx); }
}

loop();
start().catch((e) => { console.error(e); hud.textContent = "불러오기 오류: " + e; });
(window as any).__scene = scene;
(window as any).__eng = eng; // 성능 측정용
(window as any).__dbg = { HARPOON, hunt, makeFish, flatten, scene, room: () => room, setCam: (y: number, p: number, first?: boolean) => { camYaw = y; camPitch = p; if (first !== undefined) firstPerson = first; }, loading: () => loading, quality: () => quality, player, gates, toGate, wallAt, callMount, slots: mountSlots, setSlot: (slot: number, i: number) => { mountSlots[slot] = mythList[i]; }, myth: () => mythList.map((s) => s.name), mount: () => mount, phase: () => ridePhase }; // 이동 지점 확인용
