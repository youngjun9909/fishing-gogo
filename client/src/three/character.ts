import * as THREE from "three";
import type { Appearance } from "@fishing/shared";
import { lerpAngle } from "./engine";
import { buildHair } from "./hair";

/** 참고 이미지처럼 부드러운 질감. 거친 윤곽선 대신 은은한 음영으로 입체감을 낸다 */
const soft = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra });
const toon = soft;
const addOutline = <T,>(m: T, _t?: number) => m;

export const SKIN = ["#ffe0c8", "#fcd2b0", "#f5bf98", "#e8a87c", "#cf8a5e", "#a5683f", "#7d4a2b", "#fbe3ea", "#e8f3d9", "#d7ecf7", "#e6d9f5", "#fff1b8"];
export const HAIR = ["#3a2a22", "#6b4630", "#a8744a", "#e8c07a", "#f4f0e4", "#d05d6a", "#f29bb8", "#6fa8dc", "#7bc67e", "#9b7bd0", "#ff9d4d", "#2b2f44"];
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
  private legL!: THREE.Mesh;
  private legR!: THREE.Mesh;
  readonly rodTip = new THREE.Object3D();
  private rod = new THREE.Group();
  private auraGroup: THREE.Group | null = null;
  private icon: THREE.Sprite | null = null;
  private emote = "";
  private emoteT = 0;
  private walkPhase = 0;
  private t = Math.random() * 10;
  facing = 0;

  constructor(look: Look) {
    this.build(look);
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
      this.icon.position.set(0.7, 3.1, 0);
      this.root.add(this.icon);
    }
  }

  update(dt: number, pose: PoseState, targetFacing?: number) {
    this.t += dt;
    if (targetFacing !== undefined) this.facing = lerpAngle(this.facing, targetFacing, Math.min(1, dt * 12));
    this.root.rotation.y = this.facing;

    const fishing = pose.fishing !== "idle";
    this.rod.visible = fishing;
    const swing = pose.moving && !fishing ? 1 : 0;
    this.walkPhase += dt * 10 * swing;
    const s = Math.sin(this.walkPhase);
    this.legL.rotation.x = s * 0.7 * swing;
    this.legR.rotation.x = -s * 0.7 * swing;
    this.body.position.y = swing ? Math.abs(Math.sin(this.walkPhase)) * 0.08 : Math.sin(this.t * 2) * 0.015;
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.armL.rotation.set(-s * 0.7 * swing, 0, -0.15);
    this.armR.rotation.set(s * 0.7 * swing, 0, 0.15);
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
        case "wave": this.armR.rotation.set(0, 0, -2.6 + Math.sin(k * 12) * 0.35); break;
        case "angry": this.body.rotation.z = Math.sin(k * 40) * 0.05; this.armL.rotation.z = -0.9; this.armR.rotation.z = 0.9; break;
        case "aegyo": this.head.rotation.z = Math.sin(k * 5) * 0.25; this.body.rotation.z = Math.sin(k * 5) * 0.06; this.armL.rotation.set(-1.9, 0, -0.5); this.armR.rotation.set(-1.9, 0, 0.5); break;
        case "dance": this.body.position.y += Math.abs(Math.sin(k * 7)) * 0.3; this.body.rotation.y = k * 4; this.armL.rotation.z = -2.2 + Math.sin(k * 14) * 0.3; this.armR.rotation.z = 2.2 - Math.sin(k * 14) * 0.3; break;
        case "cry": this.head.rotation.x = 0.35; this.body.position.y -= 0.02; this.armL.rotation.set(-2.2, 0, -0.1); this.armR.rotation.set(-2.2, 0, 0.1); this.head.position.x = Math.sin(k * 30) * 0.02; break;
        case "legend-bow": this.body.rotation.x = Math.sin(Math.min(k, 1.2) * Math.PI / 1.2) * 0.9; break;
      }
      if (this.icon) {
        this.icon.position.y = 3.1 + Math.sin(k * 3) * 0.08;
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
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }
}
