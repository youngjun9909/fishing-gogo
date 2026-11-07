import * as THREE from "three";

/** 얼굴 값(모두 머리 크기 기준 m 단위). 눈/눈썹/코/입 위치와 크기를 바꿔 개성을 만든다 */
export interface FaceLook {
  eyeX: number; eyeY: number; eyeW: number; eyeH: number;
  browY: number; browW: number; browTilt: number;
  noseY: number; noseSize: number;
  mouthY: number; mouthW: number; mouthCurve: number;
  eyeColor: string; browColor: string; mouthColor: string; noseColor: string;
  /** 눈 홍채 색(없으면 기본 갈색) */
  iris?: string;
}

/** 눈 10종, 코 6종, 입 8종 중에서 고른 번호 */
export interface FaceStyle { eyes: number; nose: number; mouth: number }

export const DEFAULT_FACE: FaceLook = {
  eyeX: 0.090, eyeY: 0.692, eyeW: 0.044, eyeH: 0.048,
  browY: 0.775, browW: 0.05, browTilt: 0.12,
  noseY: 0.662, noseSize: 0.011,
  mouthY: 0.622, mouthW: 0.05, mouthCurve: 0.014,
  eyeColor: "#2a1f27", browColor: "#5b4048", mouthColor: "#b5524f", noseColor: "#e2a38e",
};

/** 새 베이스 캐릭터(머리 약 36%)용 얼굴 값 */
export const FACE_V3: FaceLook = { ...DEFAULT_FACE, eyeX: 0.080, eyeY: 0.734, eyeW: 0.050, eyeH: 0.056, browY: 0.810, browW: 0.055, browTilt: 0.04, noseY: 0.703, mouthY: 0.675, mouthW: 0.048, noseSize: 0.011 };

const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 });

/** 머리 표면 위의 점과 바깥 방향을 구한다 */
function surface(heads: THREE.Object3D[], x: number, y: number) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1.5), new THREE.Vector3(0, 0, -1), 0, 3);
  const hit = ray.intersectObjects(heads, false)[0];
  if (!hit) return null;
  const n = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  return { p: hit.point.clone(), n };
}

interface EyeDef { rx: number; ry: number; kind?: "happy" | "sleepy" | "sparkle"; tilt: number; scale: number }
const EYES: EyeDef[] = [
  { rx: 112, ry: 122, tilt: 0, scale: 1 }, // 0 동글 큰 눈
  { rx: 92, ry: 126, tilt: 0, scale: 1 }, // 1 세로로 긴 눈
  { rx: 100, ry: 100, kind: "happy", tilt: 0, scale: 1 }, // 2 웃는 눈
  { rx: 112, ry: 118, kind: "sleepy", tilt: 0.05, scale: 1 }, // 3 졸린 눈
  { rx: 118, ry: 98, tilt: -0.26, scale: 1 }, // 4 고양이 눈(바깥이 올라감)
  { rx: 108, ry: 122, kind: "sparkle", tilt: 0, scale: 1 }, // 5 별 눈
  { rx: 124, ry: 100, tilt: 0, scale: 1.08 }, // 6 넓은 눈
  { rx: 112, ry: 122, tilt: 0, scale: 1 }, // 7 윙크(왼쪽 눈만 감음)
  { rx: 72, ry: 86, tilt: 0, scale: 0.8 }, // 8 작은 눈
  { rx: 110, ry: 112, tilt: 0.26, scale: 1 }, // 9 처진 눈
];

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.32;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** 크고 반짝이는 눈 그림(하이라이트, 홍채 그라데이션, 속눈썹)을 캔버스에 그린다 */
function eyeTexture(iris: string, style: number, closed = false) {
  const d = EYES[style % EYES.length];
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  g.lineCap = "round";
  if (closed || d.kind === "happy") {
    g.strokeStyle = "#2a1a20"; g.lineWidth = 20;
    g.beginPath(); g.arc(128, 168, d.rx * 0.78, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(128 + d.rx * 0.74, 108); g.lineTo(128 + d.rx * 0.9, 92); g.stroke();
  } else {
    g.save();
    g.beginPath(); g.ellipse(128, 132, d.rx, d.ry, 0, 0, Math.PI * 2); g.clip();
    if (d.kind === "sleepy") { g.beginPath(); g.rect(0, 132 - d.ry * 0.25, 256, 256); g.clip(); }
    g.fillStyle = "#1c1216"; g.fillRect(0, 0, 256, 256);
    const grad = g.createRadialGradient(128, 200, 10, 128, 150, d.ry + 14);
    grad.addColorStop(0, "#a0706a"); grad.addColorStop(0.42, iris); grad.addColorStop(1, "#1c1216");
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#120a0e"; g.beginPath(); g.ellipse(128, 138, d.rx * 0.42, d.ry * 0.44, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // 하이라이트: 위쪽 오른쪽에 크게, 왼쪽 아래에 작게
    g.fillStyle = "#ffffff";
    if (d.kind === "sparkle") star(g, 128 + d.rx * 0.38, 132 - d.ry * 0.42, d.rx * 0.34);
    else { g.beginPath(); g.ellipse(128 + d.rx * 0.38, 132 - d.ry * 0.42, d.rx * 0.24, d.ry * 0.25, 0, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 0.85;
    g.beginPath(); g.ellipse(128 - d.rx * 0.42, 132 + d.ry * 0.5, d.rx * 0.11, d.rx * 0.11, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    // 윗 속눈썹(굵게) + 아래 눈가 연한 선
    g.strokeStyle = "#140c10"; g.lineWidth = 15;
    g.beginPath(); g.ellipse(128, 132, d.rx, d.ry, 0, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
    g.strokeStyle = "rgba(255,230,230,0.35)"; g.lineWidth = 6;
    g.beginPath(); g.ellipse(128, 132, d.rx - 6, d.ry - 6, 0, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 머리 곡면에 붙는 그림 판(데칼): 평면 격자를 머리 표면에 맞게 휘어 붙인다 */
function decal(heads: THREE.Object3D[], cx: number, cy: number, w: number, h: number, tex: THREE.Texture, tilt = 0, push = 0.0012) {
  const s = surface(heads, cx, cy);
  if (!s) return null;
  const geo = new THREE.PlaneGeometry(w, h, 12, 12);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.n);
  const rz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
  const v = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), 0).applyQuaternion(rz).applyQuaternion(q).add(s.p);
    ray.set(v.clone().addScaledVector(s.n, 0.08), s.n.clone().negate());
    const hit = ray.intersectObjects(heads, false)[0];
    const p = hit ? hit.point.clone().addScaledVector(s.n, push) : v;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  return m;
}

function arc(w: number, curve: number, r = 0.0045, up = false) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12 - 0.5;
    pts.push(new THREE.Vector3(t * w, (up ? 1 : -1) * curve * (1 - 4 * t * t), 0));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 8);
}

/**
 * 머리 메시(Skin_Head)를 찾아 얼굴 파츠를 머리 뼈에 붙인다. 모델은 기본 자세(뼈 움직임 전)여야 한다.
 * 파츠 이름: eyeL eyeR browL browR nose mouth
 */
export function buildFace(model: THREE.Object3D, look: FaceLook = DEFAULT_FACE, style: FaceStyle = { eyes: 0, nose: 0, mouth: 0 }) {
  model.updateMatrixWorld(true);
  const heads: THREE.Object3D[] = [];
  let headBone: THREE.Bone | null = null;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material).name === "Skin_Head" && !o.name.startsWith("Ear")) heads.push(o);
    if ((o as THREE.Bone).isBone && /Head$/.test(o.name) && !/Top/.test(o.name)) headBone = o as THREE.Bone;
  });
  const group = new THREE.Group();
  group.name = "face";
  const up = new THREE.Vector3(0, 0, 1);

  const place = (mesh: THREE.Mesh, x: number, y: number, tilt = 0, push = -0.0015) => {
    const s = surface(heads, x, y);
    if (!s) return;
    mesh.position.copy(s.p).addScaledVector(s.n, push);
    mesh.quaternion.setFromUnitVectors(up, s.n);
    mesh.rotateZ(tilt);
    group.add(mesh);
  };

  const flat = (w: number, h: number, color: string) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat(color));
    m.scale.set(w, h, Math.min(w, h) * 0.35);
    return m;
  };

  const ed = EYES[style.eyes % EYES.length];
  const iris = look.iris ?? "#5a3a3c";
  const texOpen = eyeTexture(iris, style.eyes);
  const texClosed = style.eyes === 7 ? eyeTexture(iris, style.eyes, true) : texOpen;
  for (const side of [-1, 1]) {
    const eye = decal(heads, side * look.eyeX, look.eyeY, look.eyeW * 2 * ed.scale, look.eyeH * 2 * ed.scale, side < 0 ? texClosed : texOpen, side * ed.tilt);
    if (eye) { eye.name = side < 0 ? "eyeL" : "eyeR"; group.add(eye); }
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0032, look.browW * 0.8, 6, 12), mat(look.browColor));
    brow.rotation.z = Math.PI / 2;
    const bw = new THREE.Group();
    bw.add(brow);
    const bm = new THREE.Mesh();
    bm.add(bw);
    bm.name = side < 0 ? "browL" : "browR";
    place(bm, side * look.eyeX, look.browY + (style.eyes === 8 ? -0.008 : 0), -side * (look.browTilt + (style.eyes === 9 ? -0.25 : 0) + (style.eyes === 4 ? 0.12 : 0)), -0.001);
  }

  // 볼 홍조(살짝 투명한 분홍 원판)
  for (const side of [-1, 1]) {
    const cheek = flat(look.eyeW * 0.85, look.eyeW * 0.55, "#ff9a8c");
    const cm = cheek.material as THREE.MeshStandardMaterial;
    cm.transparent = true; cm.opacity = 0.28; cm.depthWrite = false;
    cheek.name = side < 0 ? "cheekL" : "cheekR";
    place(cheek, side * (look.eyeX + 0.02), look.noseY - 0.008, 0, -0.002);
  }

  // 코 6종: 작은 점 / 아주 작은 점 / 없음 / 동글 / 세로 선 / 뾰족한 삼각
  const ns = look.noseSize;
  if (style.nose !== 2) {
    const nose = style.nose === 1 ? flat(ns * 0.6, ns * 0.5, look.noseColor)
      : style.nose === 3 ? flat(ns * 1.5, ns * 1.2, look.noseColor)
      : style.nose === 4 ? flat(ns * 0.35, ns * 1.0, look.noseColor)
      : style.nose === 5 ? flat(ns * 1.1, ns * 1.3, look.noseColor)
      : flat(ns, ns * 0.75, look.noseColor);
    nose.name = "nose";
    place(nose, 0, look.noseY, 0, 0.001);
  }

  // 입 8종
  const mc = look.mouthColor;
  const mouth = new THREE.Group();
  const add = (g: THREE.BufferGeometry, color = mc, x = 0, y = 0) => { const m = new THREE.Mesh(g, mat(color)); m.position.set(x, y, 0); mouth.add(m); return m; };
  switch (style.mouth % 8) {
    case 0: add(arc(look.mouthW, look.mouthCurve)); break; // 웃는 입
    case 1: { const m = flat(look.mouthW * 0.55, look.mouthCurve * 1.6, "#8f2f3f"); m.position.y = -look.mouthCurve * 0.6; mouth.add(m); add(arc(look.mouthW * 1.05, look.mouthCurve * 0.8)); break; } // 크게 웃는 입
    case 2: { const m = flat(look.mouthW * 0.18, look.mouthW * 0.2, "#8f2f3f"); mouth.add(m); break; } // 오
    case 3: add(arc(look.mouthW * 0.5, look.mouthCurve * 0.9), mc, -look.mouthW * 0.25, 0); add(arc(look.mouthW * 0.5, look.mouthCurve * 0.9), mc, look.mouthW * 0.25, 0); break; // 고양이 w
    case 4: add(arc(look.mouthW * 0.8, 0.0015)); break; // 일자
    case 5: add(arc(look.mouthW * 0.5, look.mouthCurve * 0.5)); break; // 작은 입
    case 6: add(arc(look.mouthW * 1.4, look.mouthCurve * 1.5)); break; // 활짝
    default: { add(arc(look.mouthW, look.mouthCurve)); const t = flat(look.mouthW * 0.2, look.mouthW * 0.26, "#ff8fa0"); t.position.set(look.mouthW * 0.12, -look.mouthCurve - 0.004, 0); mouth.add(t); } // 메롱
  }
  const mouthHost = new THREE.Mesh();
  mouthHost.add(mouth);
  mouthHost.name = "mouth";
  place(mouthHost, 0, look.mouthY, 0, 0.002);

  if (headBone) (headBone as THREE.Bone).attach(group);
  else model.add(group);
  return group;
}
