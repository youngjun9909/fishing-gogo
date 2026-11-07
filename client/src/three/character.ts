import * as THREE from "three";
import type { Appearance } from "@fishing/shared";
import { lerpAngle } from "./engine";
import { buildHair } from "./hair";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/** 새 캐릭터 모델(GLB). 한 번만 불러와서 모든 캐릭터가 복제해 쓴다 */
let glb: THREE.Group | null = null;
let scalpF: THREE.Texture | null = null; // 마네킹 머리 그림에서 정수리·뒷머리 부분(흰색)을 표시한 마스크. 이 부분에 머리색을 칠한다
let scalpM: THREE.Texture | null = null;
let eyeF: THREE.Texture | null = null; // 몸 그림에서 눈동자(R)와 눈썹(G) 자리를 표시한 마스크. 눈동자는 고른 색, 눈썹은 머리색으로 칠한다
let eyeM: THREE.Texture | null = null;
let glbMale: THREE.Group | null = null; // 남자 몸(성별 1). 파일이 없으면 여자 몸을 쓴다
const HAIR_FILES = ["hair_1_ponytail", "hair_2_twintail", "hair_3_bob", "hair_4_long"];
const hairGlbs: Array<THREE.Group | null> = [null, null, null, null];
const HAIR_FILES_M = ["hair_m1_wavy", "hair_m2_sidepart", "hair_m3_bangs", "hair_m4_messy"]; // 남자 머리 4종
const hairGlbsM: Array<THREE.Group | null> = [null, null, null, null];
let glbLoading: Promise<void> | null = null;
export function loadCharacterModel(): Promise<void> {
  const loader = new GLTFLoader();
  glbLoading ??= Promise.all([
    loader.loadAsync("/models/body_outfits.glb").then((g) => { glb = g.scene; }),
    new THREE.TextureLoader().loadAsync("/models/scalp_f.png").then((t) => { t.flipY = false; scalpF = t; }).catch(() => undefined),
    new THREE.TextureLoader().loadAsync("/models/scalp_m.png").then((t) => { t.flipY = false; scalpM = t; }).catch(() => undefined),
    new THREE.TextureLoader().loadAsync("/models/eye_f.png").then((t) => { t.flipY = false; eyeF = t; }).catch(() => undefined),
    new THREE.TextureLoader().loadAsync("/models/eye_m.png").then((t) => { t.flipY = false; eyeM = t; }).catch(() => undefined),
    loader.loadAsync("/models/body_male.glb").then((g) => { glbMale = g.scene; }).catch(() => undefined),
    ...HAIR_FILES.map((f, i) => loader.loadAsync(`/models/${f}.glb`).then((g) => { hairGlbs[i] = g.scene; }).catch(() => undefined)),
    ...HAIR_FILES_M.map((f, i) => loader.loadAsync(`/models/${f}.glb`).then((g) => { hairGlbsM[i] = g.scene; }).catch(() => undefined)),
  ]).then(() => undefined, (e) => { console.warn("캐릭터 모델을 못 불러와서 기본 모양을 써요", e); });
  return glbLoading;
}
void loadCharacterModel();

/** 머리카락 뿌리는 어둡게, 끝은 밝게 정점 색을 넣어 깊이감을 낸다(머리 중심에서 멀수록 밝음) */
function rootToTipColors(root: THREE.Object3D) {
  const c = new THREE.Vector3(0, 0.82, 0);
  const p = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m.material as THREE.Material).name === "HairTie") return;
    const pos = m.geometry.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const t = THREE.MathUtils.clamp((p.distanceTo(c) - 0.17) / 0.24, 0, 1);
      const k = 0.86 + 0.2 * t;
      col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k;
    }
    m.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  });
}

/** 머리카락 텍스처를 밝기만 남긴 회색조로 바꾼다(평균 밝기 1). 이 위에 머리색을 곱해서 원하는 색으로 보이게 한다 */
const grayCache = new WeakMap<THREE.Texture, THREE.Texture>();
function grayTexture(src: THREE.Texture): THREE.Texture {
  const hit = grayCache.get(src);
  if (hit) return hit;
  const img = src.image as CanvasImageSource & { width: number; height: number };
  const w = img.width, h = img.height;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  const lum = new Float32Array(w * h);
  let sum = 0, n = 0;
  for (let i = 0; i < w * h; i++) {
    const l = 0.299 * d.data[i * 4] + 0.587 * d.data[i * 4 + 1] + 0.114 * d.data[i * 4 + 2];
    lum[i] = l;
    sum += l; n++;
  }
  const k = Math.min(4, 255 / Math.max(1, sum / n)); // 평균이 255(=1.0)가 되도록
  for (let i = 0; i < w * h; i++) {
    const g = Math.min(255, lum[i] * k);
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = g;
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = src.flipY;
  t.colorSpace = src.colorSpace;
  t.wrapS = src.wrapS; t.wrapT = src.wrapT;
  t.channel = src.channel;
  grayCache.set(src, t);
  return t;
}

const MODEL_SCALE = 2.6; // 모델은 키 1m, 게임 안 캐릭터는 약 2.6

const ARM_DOWN = 1.22; // 모델은 T자세. 걷기·낚시에서 팔을 내리는 각도
/** 게임 옷 아이템 → 몸 GLB 안의 옷 메시(상의·하의·신발) 이름 뒷부분. 메시 이름은 top_/pants_/shoes_ (+ 디테일은 topd_ 등) 뒤에 붙는다 */
const ITEM_MESH: Record<string, string> = {
  "top-hoodie": "hoodie", // 남색 후드티
  "pants-jeans": "tee", // 청바지(메시 이름이 tee인 것은 옛 이름)
  "shoes-white": "hoodie", // 흰 운동화
};
// 아무것도 안 입은 칸은 기본 옷("basic": 흰 티, 검정 반바지, 검정 스니커즈)이 보인다
const outfitPart = (name: string) => /^(top|pants|shoes)d?_(.+)$/.exec(name);

/** 참고 이미지처럼 부드러운 질감. 거친 윤곽선 대신 은은한 음영으로 입체감을 낸다 */
const soft = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra });
const toon = soft;
const addOutline = <T,>(m: T, _t?: number) => m;

export const SKIN = ["#ffe0c8", "#fcd2b0", "#f5bf98", "#e8a87c", "#cf8a5e", "#a5683f", "#7d4a2b", "#fbe3ea", "#e8f3d9", "#d7ecf7", "#e6d9f5", "#fff1b8"];
export const HAIR = ["#8a4a40", "#3a2a22", "#a8744a", "#e8c07a", "#f4f0e4", "#d05d6a", "#f29bb8", "#6fa8dc", "#7bc67e", "#9b7bd0", "#ff9d4d", "#2b2f44"];
export const EYE = ["#2b2230", "#5a3b2a", "#2f6fb5", "#3f9a5c", "#8e5bc9", "#c94f5c", "#e0a030", "#4aa8a8", "#6b6b78", "#d86aa8", "#1f3a6b", "#7a4a1f"];
const BODY_SCALE: Array<[number, number]> = [[0.9, 1.05], [1, 1], [1.12, 0.92]]; // [가로, 세로]

export interface Look {
  appearance: Appearance;
  equipped: Record<string, string>;
  shape?: string;
}

/** 기본 체형: 머리 크기, 몸통 가로/세로, 다리와 팔 길이의 배율 */
export interface Shape {
  name: string;
  head: number;
  bw: number;
  bh: number;
  leg: number;
  arm: number;
}
export const SHAPES: Record<string, Shape> = {
  ref: { name: "참고 이미지", head: 1.25, bw: 0.78, bh: 0.9, leg: 1.15, arm: 1.05 },
  classic: { name: "지금(0)", head: 1, bw: 1, bh: 1, leg: 1, arm: 1 },
  animal: { name: "A 동숲형", head: 1.3, bw: 0.72, bh: 0.7, leg: 0.6, arm: 0.65 },
  chibi: { name: "B 2등신", head: 1.15, bw: 0.85, bh: 0.78, leg: 0.75, arm: 0.8 },
  cute: { name: "C 3등신", head: 0.95, bw: 0.78, bh: 0.95, leg: 1.2, arm: 1.1 },
  balanced: { name: "D 4등신", head: 0.8, bw: 0.74, bh: 1.1, leg: 1.7, arm: 1.4 },
  bean: { name: "E 젤리빈", head: 1.1, bw: 1.1, bh: 0.55, leg: 0.4, arm: 0.5 },
  slim: { name: "F 5등신", head: 0.7, bw: 0.66, bh: 1.2, leg: 2.1, arm: 1.6 },
};

/** 표정은 캔버스에 그려서 머리 앞쪽에 붙인다 */
/** 윗머리는 둥글고 턱은 부드럽게 좁아지는 달걀형 머리 */
function headGeometry() {
  const R = 0.6;
  const geo = new THREE.SphereGeometry(R, 56, 40);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const yn = y / R;
    let k = 1;
    if (yn < 0) k = 1 - 0.2 * Math.pow(-yn, 1.5); // 턱 쪽으로 좁아짐
    else k = 1 + 0.03 * yn; // 이마는 약간 넓게
    const cheek = yn < 0 && yn > -0.6 ? 1 + 0.05 * Math.sin((-yn / 0.6) * Math.PI) : 1; // 볼살
    pos.setXYZ(i, x * k * cheek, y * 0.98, z * k * (1 + (yn < -0.3 ? 0.03 : 0)));
  }
  geo.computeVertexNormals();
  return geo;
}

function drawFace(a: Appearance): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = SKIN[a.skinColor % SKIN.length];
  g.fillRect(0, 0, 1024, 512);
  const cx = 256;
  const cy = 262;
  const ink = "#3b2d3d";
  const eye = EYE[a.eyeColor % EYE.length];
  g.lineCap = "round";
  g.lineJoin = "round";

  // 볼터치
  g.fillStyle = "rgba(255,130,150,0.35)";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * 96, cy + 58, 24, 14, 0, 0, Math.PI * 2);
    g.fill();
  }

  const skinDark = (() => {
    const c = new THREE.Color(SKIN[a.skinColor % SKIN.length]);
    c.multiplyScalar(0.72);
    return `#${c.getHexString()}`;
  })();
  const irisDark = (() => {
    const c = new THREE.Color(eye);
    c.multiplyScalar(0.45);
    return `#${c.getHexString()}`;
  })();
  // 크고 반짝이는 눈: 흰자, 그라데이션 홍채, 눈동자, 하이라이트, 위쪽 속눈썹 선
  const STYLES: Array<{ rx: number; ry: number; tilt: number; kind?: string }> = [
    { rx: 36, ry: 42, tilt: 0 }, // 0 동글 큰 눈
    { rx: 30, ry: 48, tilt: 0 }, // 1 세로로 긴 눈
    { rx: 34, ry: 34, tilt: 0, kind: "happy" }, // 2 웃는 눈
    { rx: 36, ry: 40, tilt: 0.05, kind: "sleepy" }, // 3 졸린 눈
    { rx: 40, ry: 34, tilt: -0.28 }, // 4 고양이 눈
    { rx: 36, ry: 44, tilt: 0, kind: "sparkle" }, // 5 별 눈
    { rx: 44, ry: 40, tilt: 0 }, // 6 넓은 눈
    { rx: 36, ry: 42, tilt: 0, kind: "wink" }, // 7 윙크
    { rx: 20, ry: 26, tilt: 0 }, // 8 작은 눈
    { rx: 36, ry: 40, tilt: 0.28 }, // 9 처진 눈
  ];
  const eyeAt = (s: number) => {
    const base = STYLES[a.eyes % 10];
    const st = { ...base, rx: base.rx * 1.2, ry: base.ry * 1.2 };
    const x = cx + s * 88;
    const y = cy - 6;
    g.save();
    g.translate(x, y);
    g.rotate(st.tilt * s);
    const closed = st.kind === "happy" || (st.kind === "wink" && s < 0);
    if (closed) {
      g.strokeStyle = ink;
      g.lineWidth = 9;
      g.beginPath();
      g.arc(0, 10, st.rx * 0.7, Math.PI * 1.12, Math.PI * 1.88);
      g.stroke();
      g.restore();
      return;
    }
    // 눈 위 그늘
    g.fillStyle = skinDark;
    g.globalAlpha = 0.25;
    g.beginPath();
    g.ellipse(0, -st.ry * 0.7, st.rx * 1.05, st.ry * 0.42, 0, 0, 7);
    g.fill();
    g.globalAlpha = 1;
    // 흰자
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(0, 0, st.rx, st.ry, 0, 0, 7);
    g.fill();
    // 홍채
    const ir = g.createLinearGradient(0, -st.ry, 0, st.ry);
    ir.addColorStop(0, irisDark);
    ir.addColorStop(0.55, eye);
    ir.addColorStop(1, "#ffffff55");
    g.fillStyle = ir;
    g.beginPath();
    g.ellipse(0, 2, st.rx * 0.82, st.ry * 0.9, 0, 0, 7);
    g.fill();
    g.fillStyle = "#1c1424";
    g.beginPath();
    g.ellipse(0, 3, st.rx * 0.42, st.ry * 0.5, 0, 0, 7);
    g.fill();
    // 하이라이트
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(-st.rx * 0.28, -st.ry * 0.3, st.rx * 0.24, 0, 7);
    g.fill();
    g.beginPath();
    g.arc(st.rx * 0.3, st.ry * 0.32, st.rx * 0.11, 0, 7);
    g.fill();
    if (st.kind === "sparkle") {
      g.beginPath();
      g.arc(st.rx * 0.1, -st.ry * 0.05, st.rx * 0.08, 0, 7);
      g.fill();
    }
    // 위쪽 속눈썹 선과 바깥 속눈썹
    g.strokeStyle = ink;
    g.lineWidth = st.kind === "sleepy" ? 12 : 8;
    g.beginPath();
    g.ellipse(0, 0, st.rx, st.ry, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(s * st.rx * 0.9, -st.ry * 0.45);
    g.quadraticCurveTo(s * st.rx * 1.25, -st.ry * 0.7, s * st.rx * 1.3, -st.ry * 0.95);
    g.stroke();
    if (st.kind === "sleepy") {
      g.fillStyle = SKIN[a.skinColor % SKIN.length];
      g.beginPath();
      g.rect(-st.rx - 4, -st.ry - 4, st.rx * 2 + 8, st.ry * 0.9);
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(-st.rx, -st.ry * 0.1);
      g.lineTo(st.rx, -st.ry * 0.1);
      g.stroke();
    }
    g.restore();
  };
  eyeAt(-1);
  eyeAt(1);

  // 코
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.lineWidth = 5;
  switch (a.nose % 6) {
    case 0: g.beginPath(); g.arc(cx, cy + 40, 6, 0, 7); g.fill(); break;
    case 1: g.beginPath(); g.ellipse(cx, cy + 42, 10, 7, 0, 0, 7); g.fill(); break;
    case 2: g.beginPath(); g.moveTo(cx - 9, cy + 46); g.lineTo(cx + 9, cy + 46); g.lineTo(cx, cy + 32); g.closePath(); g.fill(); break;
    case 3: g.beginPath(); g.moveTo(cx - 8, cy + 40); g.lineTo(cx + 8, cy + 40); g.stroke(); break;
    case 4: g.fillStyle = "rgba(210,110,120,0.85)"; g.beginPath(); g.arc(cx, cy + 40, 12, 0, 7); g.fill(); break;
    default: g.beginPath(); g.arc(cx - 7, cy + 44, 4, 0, 7); g.arc(cx + 7, cy + 44, 4, 0, 7); g.fill();
  }

  // 입
  const my = cy + 82;
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 7;
  switch (a.mouth % 8) {
    case 0: g.beginPath(); g.arc(cx, my - 14, 24, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); break;
    case 1: g.beginPath(); g.moveTo(cx - 24, my - 6); g.quadraticCurveTo(cx, my + 42, cx + 24, my - 6); g.closePath(); g.fill();
      g.fillStyle = "#e86a7a"; g.beginPath(); g.ellipse(cx, my + 12, 12, 7, 0, 0, 7); g.fill(); break;
    case 2: g.beginPath(); g.moveTo(cx - 28, my - 4); g.quadraticCurveTo(cx - 14, my + 14, cx, my - 2);
      g.quadraticCurveTo(cx + 14, my + 14, cx + 28, my - 4); g.stroke(); break;
    case 3: g.beginPath(); g.ellipse(cx, my + 4, 9, 11, 0, 0, 7); g.fill(); break;
    case 4: g.beginPath(); g.moveTo(cx - 18, my + 2); g.lineTo(cx + 18, my + 2); g.stroke(); break;
    case 5: g.beginPath(); g.moveTo(cx - 28, my - 8); g.lineTo(cx + 28, my - 8); g.lineTo(cx + 22, my + 16); g.lineTo(cx - 22, my + 16); g.closePath(); g.fill();
      g.fillStyle = "#fff"; g.fillRect(cx - 22, my - 6, 44, 10); break;
    case 6: g.beginPath(); g.arc(cx, my - 12, 22, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      g.fillStyle = "#f07a8a"; g.beginPath(); g.ellipse(cx + 6, my + 14, 9, 13, 0, 0, 7); g.fill(); break;
    default: g.beginPath(); g.moveTo(cx - 16, my + 4); g.quadraticCurveTo(cx + 6, my + 12, cx + 24, my - 6); g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function hairGroup(style: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const m = toon(color);
  const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rot: [number, number, number] = [0, 0, 0]) => {
    const mesh = addOutline(new THREE.Mesh(geo, m), 0.025);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const R = 0.58;
  const cap = (thetaLen: number, r = R) => new THREE.SphereGeometry(r, 32, 20, 0, Math.PI * 2, 0, thetaLen);
  switch (style % 15) {
    case 0: add(cap(Math.PI * 0.55), 0, 0.03, -0.02); break; // 짧은 머리
    case 1: add(cap(Math.PI * 0.62), 0, 0.02, -0.04); add(new THREE.SphereGeometry(0.2, 16, 12), 0, 0.5, 0.45, 1.6, 0.7, 0.6); break; // 앞머리
    case 2: add(cap(Math.PI * 0.5)); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; add(new THREE.ConeGeometry(0.1, 0.38, 8), Math.sin(a) * 0.38, 0.48, Math.cos(a) * 0.38, 1, 1, 1, [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5]); } break; // 뾰족머리
    case 3: add(cap(Math.PI * 0.6)); add(new THREE.CapsuleGeometry(0.5, 0.7, 8, 16), 0, -0.35, -0.2, 1, 1, 0.7); break; // 긴 머리
    case 4: add(cap(Math.PI * 0.55)); add(new THREE.CapsuleGeometry(0.14, 0.6, 6, 12), 0, 0.0, -0.62, 1, 1, 1, [0.3, 0, 0]); break; // 말총머리
    case 5: add(cap(Math.PI * 0.55)); for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.13, 0.5, 6, 12), s * 0.56, -0.05, -0.1); break; // 양갈래
    case 6: add(cap(Math.PI * 0.55)); add(new THREE.SphereGeometry(0.22, 16, 12), 0, 0.68, -0.08); break; // 올림머리
    case 7: add(new THREE.SphereGeometry(0.72, 24, 16), 0, 0.12, -0.12, 1, 0.9, 0.95); break; // 아프로
    case 8: add(cap(Math.PI * 0.45)); add(new THREE.BoxGeometry(0.12, 0.34, 0.8), 0, 0.5, -0.05); break; // 모히칸
    case 9: add(cap(Math.PI * 0.6), 0.04, 0.02, -0.04); add(new THREE.SphereGeometry(0.34, 16, 12), -0.28, 0.4, 0.38, 1.4, 0.6, 0.6, [0, 0, 0.5]); break; // 옆가르마
    case 10: add(cap(Math.PI * 0.62)); add(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 28, 1, true), 0, -0.2, -0.04); break; // 단발
    case 11: add(cap(Math.PI * 0.5)); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(new THREE.SphereGeometry(0.17, 10, 8), Math.sin(a) * 0.48, 0.28 + (i % 3) * 0.1, Math.cos(a) * 0.48); } break; // 곱슬
    case 12: add(cap(Math.PI * 0.3)); add(new THREE.ConeGeometry(0.1, 0.3, 8), 0, 0.68, 0.1); break; // 머리 한 가닥
    case 13: add(cap(Math.PI * 0.55)); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.13 - i * 0.02, 10, 8), s * 0.5, -0.1 - i * 0.2, -0.05); break; // 땋은 머리
    default: add(cap(Math.PI * 0.55)); for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.17, 0.4, 3), s * 0.12, 0.68, 0.0, 1, 1, 0.4, [0, 0, -s * 1.1]); break; // 리본
  }
  return g;
}

/** 이마를 덮는 여러 겹의 앞머리 가닥 */
function bangs(color: string): THREE.Group {
  const g = new THREE.Group();
  const m = toon(color, { roughness: 0.45 });
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1) - 0.5; // -0.5 ~ 0.5
    const a = k * 2.3;
    const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34 + (i % 3) * 0.06, 6, 12), m);
    const r = 0.57;
    strand.position.set(Math.sin(a) * r, 0.28 - Math.abs(k) * 0.12, Math.cos(a) * r * 0.97);
    strand.rotation.set(0.35, a, -k * 0.9);
    strand.scale.set(1.15, 1, 0.8);
    g.add(strand);
  }
  return g;
}

function hatGroup(id: string): THREE.Group | null {
  const g = new THREE.Group();
  if (id === "hat-straw") {
    const brim = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 32), toon("#f3d58a")), 0.02);
    const top = addOutline(new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon("#f3d58a")), 0.025);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.1, 24), toon("#e06a6a"));
    band.position.y = 0.06;
    top.position.y = 0.02;
    g.add(brim, top, band);
    g.position.y = 0.45;
  } else if (id === "hat-beanie") {
    const d = addOutline(new THREE.Mesh(new THREE.SphereGeometry(0.63, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), toon("#7fb6e8")), 0.025);
    const pom = addOutline(new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), toon("#ffffff")), 0.03);
    pom.position.y = 0.7;
    g.add(d, pom);
    g.position.y = 0.05;
  } else if (id === "hat-captain") {
    const top = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.28, 28), toon("#f5f5f5")), 0.025);
    const bill = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 20, 1, false, 0, Math.PI), toon("#2b3a55")), 0.03);
    bill.position.set(0, -0.1, 0.5);
    bill.rotation.x = Math.PI / 2 - 0.3;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.585, 0.585, 0.08, 28), toon("#2b3a55"));
    band.position.y = -0.08;
    g.add(top, band, bill);
    g.position.y = 0.52;
  } else return null;
  return g;
}

const EMOTE_ICON: Record<string, string> = {
  wave: "👋", angry: "💢", aegyo: "💕", dance: "🎵", cry: "💧", "legend-bow": "✨",
};

function iconSprite(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "88px 'Segoe UI Emoji','Apple Color Emoji',sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.setScalar(0.9);
  s.renderOrder = 10;
  return s;
}

export interface PoseState {
  moving: boolean;
  /** idle | waiting | bite | minigame */
  fishing: string;
}

/** 캐릭터 한 명: 3D 모델과 걷기, 이모트, 낚시 자세 애니메이션 */
export class CharacterRig {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private head!: THREE.Group;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private legL!: THREE.Object3D;
  private legR!: THREE.Object3D;
  /** 새 모델일 때: 위 팔/다리/머리 그룹은 회전값만 담고, 실제 뼈가 그 값을 따라간다 */
  private driven: Array<{ bone: THREE.Bone; rest: THREE.Quaternion; key: string }> = [];
  private model: THREE.Group | null = null;
  private moveBlend = 0;
  private blink = 0;
  private nextBlink = 2;
  private eyes: THREE.Object3D[] = [];
  /** 걷기에서 나오는 보조 값(골반 비틀림, 무릎 굽힘 등) */
  private ex = { hipTwist: 0, hipRoll: 0, spineTwist: 0, lean: 0, kneeP: 0, kneeN: 0 };
  readonly rodTip = new THREE.Object3D();
  private rod = new THREE.Group();
  private auraGroup: THREE.Group | null = null;
  private icon: THREE.Sprite | null = null;
  private emote = "";
  private emoteT = 0;
  private walkPhase = 0;
  private t = Math.random() * 10;
  facing = 0;

  private outfitId = "";

  constructor(look: Look) {
    this.outfitId = look.equipped.outfit ?? "";
    if (glb) this.buildGlb(look);
    else this.build(look);
  }

  private buildGlb(look: Look) {
    const { appearance: a, equipped } = look;
    // 체형(가로·세로 늘리기)은 쓰지 않는다. 몸만 늘어나고 머리카락·옷은 그대로라 정수리가 드러난다
    this.body.scale.set(1, 1, 1);
    this.root.add(this.body);

    const model = cloneSkinned((a.gender === 1 && glbMale ? glbMale : glb)!) as THREE.Group;
    this.model = model;
    const skin = SKIN[a.skinColor % SKIN.length];
    const have = new Set<string>(); // 이 몸 파일에 들어 있는 옷 메시(종류_이름)
    model.traverse((o) => { const pm = outfitPart(o.name); if ((o as THREE.Mesh).isMesh && pm) have.add(`${pm[1]}_${pm[2]}`); });
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // 몸 GLB에는 옷 세트가 모두 들어 있다. 입은 것만 보이게 한다. 이 몸에 없는 옷이면 기본 옷으로 대신한다
      const part = outfitPart(m.name);
      if (part) {
        const kind = part[1] as "top" | "pants" | "shoes";
        const want = ITEM_MESH[equipped[kind] ?? ""] ?? "basic";
        m.visible = part[2] === (have.has(`${kind}_${want}`) ? want : "basic");
      }
      // 얼굴(눈·눈썹·홍조)은 텍스처에 구워져 있다. 게임 장면이 평평한 톤이라 텍스처를 약하게 스스로 빛나게 한다
      const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      m.material = new THREE.MeshStandardMaterial({ map: src.map, roughness: 0.8, emissive: new THREE.Color("#ffffff"), emissiveMap: src.map, emissiveIntensity: 0.22, side: part ? THREE.DoubleSide : THREE.FrontSide, alphaTest: part ? 0.5 : 0 }); // 옷은 한 겹짜리 껍질이라 양면, 가장자리는 알파로 오려낸다
      if (!part && src.map) {
        // 몸(머리 포함): 정수리와 뒷머리 부분에만 머리색을 칠한다(머리카락 틈으로 살색이 비치지 않게)
        const male = a.gender === 1;
        const mask = male && scalpM ? scalpM : scalpF;
        const eyeMask = male && eyeM ? eyeM : eyeF;
        if (mask && eyeMask) {
          const mat = m.material as THREE.MeshStandardMaterial;
          const hairC = new THREE.Color(HAIR[a.hairColor % HAIR.length]);
          const sc = hairC.clone().multiplyScalar(0.55);
          const irisC = new THREE.Color(EYE[a.eyeColor % EYE.length]);
          const browC = hairC.clone().multiplyScalar(0.7); // 눈썹은 머리색보다 살짝 진하게
          mat.customProgramCacheKey = () => "scalp-eye";
          mat.onBeforeCompile = (sh) => {
            sh.uniforms.uScalp = { value: mask };
            sh.uniforms.uScalpColor = { value: sc };
            sh.uniforms.uEye = { value: eyeMask };
            sh.uniforms.uIris = { value: irisC };
            sh.uniforms.uBrow = { value: browC };
            sh.fragmentShader = sh.fragmentShader
              .replace("#include <common>", "#include <common>\nuniform sampler2D uScalp;\nuniform vec3 uScalpColor;\nuniform sampler2D uEye;\nuniform vec3 uIris;\nuniform vec3 uBrow;")
              .replace("#include <map_fragment>", `#include <map_fragment>
float scalpM = texture2D(uScalp, vMapUv).r;
vec2 eyeMk = texture2D(uEye, vMapUv).rg;
float lumE = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, uScalpColor, scalpM);
diffuseColor.rgb = mix(diffuseColor.rgb, uIris * (lumE / 0.26), eyeMk.r);
diffuseColor.rgb = mix(diffuseColor.rgb, uBrow * (lumE / 0.17), eyeMk.g);`)
              .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= (1.0 - scalpM * 0.9) * (1.0 - clamp(eyeMk.r * 0.9 + eyeMk.g * 0.5, 0.0, 1.0));");
          };
        }
      }
      m.castShadow = true;
      m.frustumCulled = false;
    });
    this.body.add(model);
    model.updateMatrixWorld(true);
    // 머리카락(4종 중 하나)을 머리 뼈에 붙인다. 머리카락 GLB는 마네킹과 같은 좌표(발 중심 원점)라 붙일 때 위치가 그대로 유지된다
    const hairNode = (a.gender === 1 && glbMale ? hairGlbsM : hairGlbs)[a.hair % 4] ?? hairGlbs[a.hair % 4];
    let headBone: THREE.Bone | null = null;
    model.traverse((o) => { if ((o as THREE.Bone).isBone && /Head$/.test(o.name)) headBone = o as THREE.Bone; });
    if (hairNode && headBone) {
      const hm = hairNode.clone(true);
      hm.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const src = m.material as THREE.MeshStandardMaterial;
        const gm = src.map ? grayTexture(src.map) : null; // 회색조 × 머리색
        const tint = new THREE.Color(HAIR[a.hairColor % HAIR.length]);
        m.material = new THREE.MeshStandardMaterial({ map: gm, color: tint, roughness: 0.75, emissive: tint, emissiveMap: gm, emissiveIntensity: 0.12, side: THREE.DoubleSide });
        m.castShadow = true;
        m.frustumCulled = false;
        m.userData.sharedGeometry = true;
      });
      (headBone as THREE.Bone).attach(hm);
    }
    model.scale.setScalar(MODEL_SCALE);
    model.updateMatrixWorld(true);

    // 위 팔·다리·머리를 움직이는 값 그릇(옛 코드의 회전값을 그대로 쓰려고 남겨 둔다)
    const bone = (re: RegExp) => {
      let f: THREE.Bone | null = null;
      model.traverse((o) => { if ((o as THREE.Bone).isBone && re.test(o.name)) f = o as THREE.Bone; });
      return f as THREE.Bone | null;
    };
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.legL = new THREE.Object3D();
    this.legR = new THREE.Object3D();
    this.head = new THREE.Group();
    this.armR.position.set(0.2, 1.47, 0);
    this.head.position.y = 0.82 * MODEL_SCALE;
    this.head.scale.setScalar(0.72);
    this.body.add(this.armR, this.head);
    const m0 = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    // 캐릭터 왼쪽(+x)이 옛 코드의 armR/legR. 값은 poseBones에서 키 이름으로 계산한다
    const keys: Array<[RegExp, string]> = [
      [/Hips$/, "hips"], [/Spine$/, "spine"], [/Spine1$/, "spine"], [/Spine2$/, "spine"], [/Neck$/, "neck"], [/Head$/, "head"],
      [/LeftArm$/, "armP"], [/RightArm$/, "armN"], [/LeftForeArm$/, "foreP"], [/RightForeArm$/, "foreN"],
      [/LeftUpLeg$/, "thighP"], [/RightUpLeg$/, "thighN"], [/LeftLeg$/, "shinP"], [/RightLeg$/, "shinN"], [/LeftFoot$/, "footP"], [/RightFoot$/, "footN"],
    ];
    for (const [re, key] of keys) {
      const b = bone(re);
      if (b) this.driven.push({ bone: b, rest: m0.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())), key });
    }
    model.traverse((o) => { if (o.name === "eyeL" || o.name === "eyeR") this.eyes.push(o); });

    const hat = equipped.hat ? hatGroup(equipped.hat) : null;
    if (hat) this.head.add(hat);

    // 낚싯대는 낚시 중에만 보이고 왼쪽 위 팔(옛 armR)의 손 위치에 붙인다
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.2, 8), toon("#9a6a3a"));
    stick.rotation.x = Math.PI / 2 - 0.5;
    stick.position.set(0, 0.2, 0.9);
    this.rod.add(stick);
    this.rodTip.position.set(0, 1.1, 1.95);
    this.rod.add(this.rodTip);
    this.rod.position.set(0.18, -0.52, 0);
    this.rod.visible = false;
    this.armR.add(this.rod);

    if (equipped.aura) this.makeAura(equipped.aura);
    this.poseBones();
  }

  /** 값 그릇의 회전을 모델 뼈에 옮긴다 */
  private poseBones() {
    if (!this.model) return;
    const M = this.model.getWorldQuaternion(new THREE.Quaternion());
    const parentQ = new THREE.Quaternion();
    const E = (x: number, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    const ex = this.ex;
    const ER = (a: number) => E(0, 0, a);
    const aP = this.armR.rotation, aN = this.armL.rotation; // 캐릭터 왼쪽(+x) 팔이 옛 armR
    const tP = this.legR.rotation.x, tN = this.legL.rotation.x;
    const elbow = (r: THREE.Euler) => 0.18 + 0.55 * Math.max(0, -r.x);
    const body = E(ex.lean, ex.spineTwist, 0); // 상체(허리 비틀림 + 앞기울임)
    const noTwist = E(ex.lean, 0, 0);
    const Q: Record<string, THREE.Quaternion> = {
      hips: E(0, ex.hipTwist, ex.hipRoll),
      spine: body,
      neck: body,
      head: noTwist.clone().multiply(E(this.head.rotation.x, this.head.rotation.y, this.head.rotation.z)),
      armP: body.clone().multiply(new THREE.Quaternion().setFromEuler(aP)).multiply(ER(-ARM_DOWN)),
      armN: body.clone().multiply(new THREE.Quaternion().setFromEuler(aN)).multiply(ER(ARM_DOWN)),
      foreP: body.clone().multiply(new THREE.Quaternion().setFromEuler(aP)).multiply(E(-elbow(aP))).multiply(ER(-ARM_DOWN)),
      foreN: body.clone().multiply(new THREE.Quaternion().setFromEuler(aN)).multiply(E(-elbow(aN))).multiply(ER(ARM_DOWN)),
      thighP: E(0, ex.hipTwist, 0).multiply(E(tP)),
      thighN: E(0, ex.hipTwist, 0).multiply(E(tN)),
      shinP: E(0, ex.hipTwist, 0).multiply(E(tP + ex.kneeP)),
      shinN: E(0, ex.hipTwist, 0).multiply(E(tN + ex.kneeN)),
      footP: E(0, ex.hipTwist, 0).multiply(E((tP + ex.kneeP) * 0.1)),
      footN: E(0, ex.hipTwist, 0).multiply(E((tN + ex.kneeN) * 0.1)),
    };
    for (const d of this.driven) {
      const desired = M.clone().multiply(Q[d.key]).multiply(d.rest);
      d.bone.parent!.getWorldQuaternion(parentQ);
      d.bone.quaternion.copy(parentQ.invert()).multiply(desired);
      d.bone.updateMatrixWorld(true);
    }
  }

  private build(look: Look) {
    const { appearance: a, equipped } = look;
    const [sw, sh] = BODY_SCALE[a.body % 3];
    this.body.scale.set(sw, sh, sw);
    const P = SHAPES[look.shape ?? "ref"] ?? SHAPES.ref;
    const hipY = 0.14 + 0.46 * P.leg;
    const torsoY = hipY + 0.35 * P.bh;
    const torsoTop = hipY + 0.995 * P.bh;
    this.root.add(this.body);

    const skin = SKIN[a.skinColor % SKIN.length];
    const outfitId = equipped.outfit;
    const shirt = outfitId === "outfit-raincoat" ? "#f5d54a" : outfitId === "outfit-hanbok" ? "#f4a3b8" : outfitId === "outfit-overalls" ? "#f4f1e8" : "#f2c94c";
    const pants = outfitId === "outfit-overalls" ? "#4f7cc4" : outfitId === "outfit-hanbok" ? "#6f9be0" : "#9ba1ad";

    const torso = addOutline(new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.42, 10, 24), toon(shirt)), 0.03);
    torso.position.y = torsoY;
    torso.scale.set(P.bw, P.bh, P.bw);
    torso.castShadow = true;
    this.body.add(torso);
    if (outfitId === "outfit-overalls") {
      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.12), toon(pants));
      bib.position.set(0, torsoY, 0.4 * P.bw);
      bib.scale.set(P.bw, P.bh, 1);
      this.body.add(bib);
    }
    if (outfitId === "outfit-hanbok") {
      const skirt = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.72, 0.6, 24), toon("#6f9be0")), 0.025);
      skirt.position.y = hipY - 0.05;
      skirt.scale.set(P.bw, P.leg, P.bw);
      this.body.add(skirt);
    }
    if (outfitId === "outfit-raincoat") {
      const hood = addOutline(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 10, 20), toon("#f5d54a")), 0.03);
      hood.position.set(0, torsoTop - 0.24, -0.05);
      hood.scale.setScalar(P.bw);
      hood.rotation.x = Math.PI / 2;
      this.body.add(hood);
    }

    for (const s of [-1, 1]) {
      const leg = addOutline(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 8, 16), toon(pants)), 0.04);
      leg.geometry.translate(0, -0.12, 0);
      leg.position.set(s * 0.2 * P.bw, hipY, 0);
      leg.scale.set(P.bw, P.leg, P.bw);
      leg.castShadow = true;
      this.body.add(leg);
      if (s < 0) this.legL = leg;
      else this.legR = leg;
      // 운동화: 둥근 앞코, 흰 밑창, 포인트 색 띠
      const shoe = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.2, 8, 14), toon(outfitId === "outfit-raincoat" ? "#f5d54a" : "#ffe27a"));
      upper.rotation.x = Math.PI / 2;
      upper.scale.set(1, 1, 0.8);
      upper.position.set(0, 0.0, 0.08);
      const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.24, 6, 14), toon("#ffffff"));
      sole.rotation.x = Math.PI / 2;
      sole.scale.set(1.02, 1, 0.38);
      sole.position.set(0, -0.1, 0.08);
      shoe.add(upper, sole);
      shoe.position.set(0, -0.4, 0.02);
      leg.add(shoe);

      const arm = new THREE.Group();
      arm.position.set(s * 0.52 * P.bw, torsoY + 0.25 * P.bh, 0);
      arm.scale.set(1, P.arm, 1);
      const a1 = addOutline(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.34, 8, 16), toon(shirt)), 0.04);
      a1.position.y = -0.22;
      const hand = addOutline(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), toon(skin)), 0.04);
      hand.position.y = -0.5;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), toon("#c9c4cc"));
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.4;
      arm.add(cuff);
      arm.add(a1, hand);
      arm.rotation.z = s * 0.15;
      this.body.add(arm);
      if (s < 0) this.armL = arm;
      else this.armR = arm;
    }

    // 머리
    this.head = new THREE.Group();
    this.head.position.y = torsoTop + 0.186 * P.head;
    this.head.scale.setScalar(P.head);
    const faceTex = drawFace(a);
    const head = addOutline(new THREE.Mesh(headGeometry(), toon("#ffffff", { map: faceTex, roughness: 0.5, emissive: new THREE.Color("#ffd2bd"), emissiveMap: faceTex, emissiveIntensity: 0.16 })), 0.025);
    head.castShadow = true;
    head.scale.set(1.05, 0.95, 1);
    this.head.add(head);
    for (const s of [-1, 1]) {
      const ear = addOutline(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(skin)), 0.05);
      ear.position.set(s * 0.6, -0.02, 0);
      this.head.add(ear);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.3, 14), toon(skin));
    neck.position.y = -0.62;
    this.head.add(neck);
    this.head.add(buildHair(a.hair, HAIR[a.hairColor % HAIR.length]));
    const hat = equipped.hat ? hatGroup(equipped.hat) : null;
    if (hat) this.head.add(hat);
    this.body.add(this.head);

    // 낚싯대는 오른손에 들고, 낚시 중이 아니면 숨긴다
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.2, 8), toon("#9a6a3a"));
    stick.position.y = 1.0;
    stick.rotation.x = Math.PI / 2 - 0.5;
    stick.position.set(0, 0.2, 0.9);
    this.rod.add(stick);
    this.rodTip.position.set(0, 1.1, 1.95);
    this.rod.add(this.rodTip);
    this.rod.position.set(0, -0.45, 0);
    this.rod.visible = false;
    this.armR.add(this.rod);

    if (equipped.aura) this.makeAura(equipped.aura);
  }

  private makeAura(id: string) {
    const g = new THREE.Group();
    const color = id === "aura-bubble" ? 0x9fe3ff : id === "aura-legend" ? 0xffd45a : 0xfff1a8;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: id === "aura-bubble" ? 0.55 : 0.9 });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(id === "aura-bubble" ? 0.1 : 0.06, 8, 6), mat);
      m.userData.phase = (i / 10) * Math.PI * 2;
      g.add(m);
    }
    if (id === "aura-legend") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);
    }
    g.userData.id = id;
    this.root.add(g);
    this.auraGroup = g;
  }

  playEmote(id: string) {
    this.emote = id;
    this.emoteT = 0;
    if (this.icon) {
      this.root.remove(this.icon);
      this.icon = null;
    }
    const e = EMOTE_ICON[id];
    if (e) {
      this.icon = iconSprite(e);
      this.icon.position.set(1.3, 3.2, 0); // 닉네임표 옆(표 위로 가리지 않게)
      this.root.add(this.icon);
    }
  }

  update(dt: number, pose: PoseState, targetFacing?: number) {
    this.t += dt;
    if (targetFacing !== undefined) this.facing = lerpAngle(this.facing, targetFacing, Math.min(1, dt * 12));
    this.root.rotation.y = this.facing;

    const fishing = pose.fishing !== "idle";
    this.rod.visible = fishing;
    // 멈춤↔걷기 전환을 부드럽게(갑자기 자세가 튀지 않게)
    this.moveBlend += ((pose.moving && !fishing ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 9);
    const swing = this.moveBlend;
    this.walkPhase += dt * 9 * swing;
    const s = Math.sin(this.walkPhase);
    const c = Math.cos(this.walkPhase);
    this.legL.rotation.x = s * 0.55 * swing;
    this.legR.rotation.x = -s * 0.55 * swing;
    // 다리가 앞으로 나올 때만 무릎이 굽는다(걸음마다 무릎 굽힘)
    this.ex.kneeN = swing * (0.08 + 0.8 * Math.max(0, -c));
    this.ex.kneeP = swing * (0.08 + 0.8 * Math.max(0, c));
    this.ex.hipTwist = s * 0.1 * swing;
    this.ex.hipRoll = c * 0.035 * swing;
    this.ex.spineTwist = -s * 0.16 * swing;
    this.ex.lean = 0.06 * swing + Math.sin(this.t * 1.9) * 0.012;
    // 두 걸음에 한 번 바닥을 딛는 순간 가장 낮고, 다리가 모일 때 가장 높다
    this.body.position.y = swing * (0.07 * Math.abs(Math.cos(this.walkPhase)) - 0.03) + (1 - swing) * Math.sin(this.t * 1.9) * 0.012;
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(Math.sin(this.t * 0.7) * 0.02 * (1 - swing), -this.ex.spineTwist * 0.7 - this.ex.hipTwist * 0.7, 0);
    this.armL.rotation.set(-s * 0.6 * swing, 0, -0.2 - 0.04 * swing);
    this.armR.rotation.set(s * 0.6 * swing, 0, 0.2 + 0.04 * swing);
    // 눈 깜빡임
    this.nextBlink -= dt;
    if (this.nextBlink < 0) { this.blink = 0.14; this.nextBlink = 2.5 + Math.random() * 3; }
    this.blink = Math.max(0, this.blink - dt);
    const eyeY = this.blink > 0 ? 0.08 : 1;
    for (const e of this.eyes) e.scale.y = eyeY;
    if (fishing) {
      this.armR.rotation.set(-1.2, 0, 0.1);
      this.armL.rotation.set(-0.7, 0, -0.2);
      if (pose.fishing === "bite") this.body.position.y = Math.abs(Math.sin(this.t * 24)) * 0.06;
      if (pose.fishing === "minigame") {
        this.armR.rotation.x = -1.05 + Math.sin(this.t * 22) * 0.2;
        this.armL.rotation.x = -0.9 + Math.sin(this.t * 19 + 1) * 0.15;
        this.body.rotation.x = -0.14 + Math.sin(this.t * 17) * 0.04;
        this.body.position.y = Math.abs(Math.sin(this.t * 14)) * 0.05;
      }
    }

    if (this.emote) {
      this.emoteT += dt;
      const k = this.emoteT;
      switch (this.emote) {
        // 팔을 바깥 위로 들고(춤과 같은 방향) 손목을 좌우로 흔든다
        case "wave": this.armR.rotation.set(-0.25, 0, 2.0 + Math.sin(k * 12) * 0.28); break;
        case "angry": this.body.rotation.z = Math.sin(k * 40) * 0.05; this.armL.rotation.z = -0.9; this.armR.rotation.z = 0.9; break;
        case "aegyo": this.head.rotation.z = Math.sin(k * 5) * 0.25; this.body.rotation.z = Math.sin(k * 5) * 0.06; this.armL.rotation.set(-1.9, 0, -0.5); this.armR.rotation.set(-1.9, 0, 0.5); break;
        case "dance": this.body.position.y += Math.abs(Math.sin(k * 7)) * 0.3; this.body.rotation.y = k * 4; this.armL.rotation.z = -2.2 + Math.sin(k * 14) * 0.3; this.armR.rotation.z = 2.2 - Math.sin(k * 14) * 0.3; break;
        case "cry": this.head.rotation.x = 0.35; this.body.position.y -= 0.02; this.armL.rotation.set(-2.2, 0, -0.1); this.armR.rotation.set(-2.2, 0, 0.1); this.head.position.x = Math.sin(k * 30) * 0.02; break;
        case "legend-bow": this.body.rotation.x = Math.sin(Math.min(k, 1.2) * Math.PI / 1.2) * 0.9; break;
      }
      if (this.icon) {
        this.icon.position.y = 3.2 + Math.sin(k * 3) * 0.08;
        (this.icon.material as THREE.SpriteMaterial).opacity = k > 2.2 ? Math.max(0, 1 - (k - 2.2) / 0.3) : 1;
      }
      if (k > 2.5) {
        this.emote = "";
        if (this.icon) {
          this.root.remove(this.icon);
          this.icon = null;
        }
      }
    }

    this.poseBones();

    if (this.auraGroup) {
      const id = this.auraGroup.userData.id as string;
      this.auraGroup.children.forEach((c, i) => {
        const ph = c.userData.phase as number | undefined;
        if (ph === undefined) return;
        if (id === "aura-bubble") {
          const up = (this.t * 0.4 + i * 0.37) % 1;
          c.position.set(Math.sin(ph + this.t) * 0.7, 0.2 + up * 2.6, Math.cos(ph + this.t) * 0.7);
          c.scale.setScalar(1 - up * 0.5);
        } else {
          const a = ph + this.t * 1.4;
          c.position.set(Math.sin(a) * 0.9, 1.2 + Math.sin(this.t * 2 + i) * 0.9, Math.cos(a) * 0.9);
        }
      });
    }
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.userData?.sharedGeometry) m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }
}
