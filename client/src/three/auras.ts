import * as THREE from "three";

/** 화려한 오라 5종. 캐릭터 발밑 원점 기준(키 약 2.6), 반지름 약 1m. update(t)는 초 단위 시간으로 매 프레임 부른다 */
export interface AuraFx { group: THREE.Group; update: (t: number) => void }

const fract = (x: number) => x - Math.floor(x);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

let glowTex: THREE.CanvasTexture | null = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** 빛나는 점(더하기 혼합이라 겹치면 밝아지고, 블룸으로 번진다) */
function puff(color: THREE.ColorRepresentation, size: number, additive = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, toneMapped: false }));
  s.scale.setScalar(size * 1.7); // 낮의 밝은 배경에서도 보이도록 크게
  s.renderOrder = 5;
  return s;
}
const mat = (s: THREE.Sprite) => s.material as THREE.SpriteMaterial;

function groundRing(inner: number, outer: number, color: THREE.ColorRepresentation, opacity: number) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  m.renderOrder = 4;
  return m;
}
const ringMat = (m: THREE.Mesh) => m.material as THREE.MeshBasicMaterial;

function circle(r: number, color: THREE.ColorRepresentation, opacity: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 80; i++) pts.push(new THREE.Vector3(Math.cos((i / 80) * Math.PI * 2) * r, 0, Math.sin((i / 80) * Math.PI * 2) * r));
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }),
  );
}

/** 불꽃: 발밑에서 올라오며 노랑→주황→빨강으로 식는 불길 */
function flame(): AuraFx {
  const g = new THREE.Group();
  const ps = Array.from({ length: 56 }, (_, i) => {
    const s = puff(0xff8a1a, 0.5, false); // 일반 혼합: 낮의 밝은 배경에서도 주황·빨강이 묻히지 않게
    g.add(s);
    return { s, off: i / 56, a: rand(0, 6.28), r: rand(0.4, 0.85), sp: rand(0.8, 1.3) };
  });
  const ring = groundRing(0.7, 1.2, 0xff5a1a, 0.5);
  const ring2 = groundRing(0.35, 0.7, 0xffb02a, 0.3);
  g.add(ring, ring2);
  const col = new THREE.Color();
  return {
    group: g,
    update(t) {
      for (const p of ps) {
        const k = fract(t * 0.5 * p.sp + p.off);
        const a = p.a + t * 0.9 + k * 2.2;
        const r = p.r * (1 - k * 0.6);
        p.s.position.set(Math.sin(a) * r, 0.1 + k * 2.6, Math.cos(a) * r);
        p.s.scale.setScalar((0.62 * (1 - k) + 0.1) * (0.85 + 0.15 * Math.sin(t * 22 + p.off * 40)));
        col.setHSL(0.085 * (1 - k), 1, 0.48);
        mat(p.s).color.copy(col);
        mat(p.s).opacity = Math.min(1, k * 8) * (1 - k * 0.8);
      }
      ringMat(ring).opacity = 0.4 + 0.2 * Math.sin(t * 7);
      ringMat(ring2).opacity = 0.3 + 0.2 * Math.sin(t * 9 + 1);
    },
  };
}

/** 벚꽃: 분홍 꽃잎이 빙글빙글 돌며 떨어진다 */
function sakura(): AuraFx {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.17, 0.12);
  const colors = ["#ffc2d6", "#ffb0c8", "#ffd9e5", "#ff9fbd"];
  const ps = Array.from({ length: 36 }, (_, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % 4], side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    m.renderOrder = 5;
    g.add(m);
    return { m, off: i / 36, a: rand(0, 6.28), r: rand(0.45, 1.05), sp: rand(0.8, 1.25) };
  });
  const sparkles = Array.from({ length: 10 }, (_, i) => {
    const s = puff(0xffd0e0, 0.22);
    g.add(s);
    return { s, a: (i / 10) * 6.28, y: rand(0.3, 2.4) };
  });
  const ring = groundRing(0.9, 1.15, 0xff9fbd, 0.35);
  g.add(ring);
  return {
    group: g,
    update(t) {
      for (const p of ps) {
        const k = fract(t * 0.13 * p.sp + p.off);
        const a = p.a + t * 0.8 * p.sp + k * 5;
        const r = p.r + 0.12 * Math.sin(t * 2 + p.off * 20);
        p.m.position.set(Math.sin(a) * r, 3.0 - k * 2.95, Math.cos(a) * r);
        p.m.rotation.set(t * 2 + p.off * 9, t * 1.5 + p.off * 5, t * 2.5);
        (p.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, k * 8, (1 - k) * 6);
      }
      for (const s of sparkles) {
        s.s.position.set(Math.sin(s.a + t * 0.7) * 0.9, s.y + Math.sin(t * 1.3 + s.a) * 0.2, Math.cos(s.a + t * 0.7) * 0.9);
        mat(s.s).opacity = 0.5 + 0.5 * Math.sin(t * 5 + s.a * 3);
      }
      ringMat(ring).opacity = 0.25 + 0.12 * Math.sin(t * 3);
    },
  };
}

/** 번개: 몸 주위로 푸른 번개가 짧게 번쩍이며 튄다 */
function lightning(): AuraFx {
  const g = new THREE.Group();
  const SEG = 10;
  const arcs = Array.from({ length: 6 }, () => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3)),
      new THREE.LineBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }),
    );
    line.frustumCulled = false;
    const dots = Array.from({ length: SEG + 1 }, () => {
      const s = puff(0x7ab8ff, 0.09);
      g.add(s);
      return s;
    });
    g.add(line);
    return { line, dots };
  });
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const s = puff(0xdff0ff, 0.1);
    g.add(s);
    return { s, a: (i / 12) * 6.28, y: rand(0.2, 2.5), sp: rand(1.2, 2.4) };
  });
  const ring = groundRing(0.8, 1.2, 0x4a90ff, 0.45);
  const ring2 = groundRing(0.5, 0.8, 0xbfe0ff, 0.3);
  g.add(ring, ring2);
  let next = 0;
  const regen = () => {
    for (const arc of arcs) {
      arc.line.visible = Math.random() < 0.8;
      const a0 = rand(0, 6.28), a1 = a0 + rand(0.5, 1.3), y0 = rand(0.2, 2.5), y1 = y0 + rand(-0.9, 0.9), r = rand(0.65, 1.0);
      const pos = arc.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i <= SEG; i++) {
        const k = i / SEG, a = a0 + (a1 - a0) * k, jag = i === 0 || i === SEG ? 0 : rand(-0.14, 0.14);
        const rr = r + jag;
        pos.setXYZ(i, Math.sin(a) * rr, y0 + (y1 - y0) * k + (i === 0 || i === SEG ? 0 : rand(-0.1, 0.1)), Math.cos(a) * rr);
        arc.dots[i].position.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        arc.dots[i].visible = arc.line.visible;
      }
      pos.needsUpdate = true;
    }
  };
  regen();
  return {
    group: g,
    update(t) {
      if (t > next) { regen(); next = t + rand(0.05, 0.12); }
      for (const s of sparks) {
        s.s.position.set(Math.sin(s.a + t * s.sp) * 0.85, s.y + Math.sin(t * 4 + s.a) * 0.25, Math.cos(s.a + t * s.sp) * 0.85);
        mat(s.s).opacity = Math.random() < 0.2 ? 0.2 : 1;
      }
      ringMat(ring).opacity = 0.3 + 0.25 * Math.sin(t * 14);
      ringMat(ring2).opacity = 0.2 + 0.2 * Math.sin(t * 11 + 2);
    },
  };
}

/** 은하: 기울어진 별 궤도 세 개와 보랏빛 성운이 몸을 감싼다 */
function galaxy(): AuraFx {
  const g = new THREE.Group();
  const center = new THREE.Group();
  center.position.y = 1.3;
  g.add(center);
  const palette = [0xb48cff, 0x6aa8ff, 0xff9ad6];
  const orbits = [0, 1, 2].map((i) => {
    const holder = new THREE.Group();
    holder.rotation.set(0.5 + i * 0.35, i * 1.2, i % 2 ? 0.5 : -0.4);
    const r = 0.95 + i * 0.22;
    holder.add(circle(r, palette[i], 0.9));
    const stars = Array.from({ length: 10 }, (_, j) => {
      const s = puff(j % 3 === 0 ? 0xffffff : palette[i], 0.12);
      holder.add(s);
      return { s, a: (j / 10) * 6.28 };
    });
    center.add(holder);
    return { holder, r, stars, sp: (i % 2 ? -1 : 1) * (0.6 + i * 0.25) };
  });
  const neb = Array.from({ length: 14 }, (_, i) => {
    const s = puff([0x7a4aff, 0x4a7aff, 0xd05ae0][i % 3], 0.95, false);
    g.add(s);
    return { s, a: (i / 14) * 6.28, y: 0.3 + (i % 7) * 0.33, r: rand(0.4, 0.8) };
  });
  const ring = groundRing(0.7, 1.35, 0x8a5aff, 0.3);
  g.add(ring);
  return {
    group: g,
    update(t) {
      for (const o of orbits) {
        for (const st of o.stars) {
          const a = st.a + t * o.sp;
          st.s.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
          mat(st.s).opacity = 0.55 + 0.45 * Math.sin(t * 4 + st.a * 5);
        }
      }
      for (const n of neb) {
        const a = n.a + t * 0.35;
        n.s.position.set(Math.sin(a) * n.r, n.y + Math.sin(t + n.a) * 0.15, Math.cos(a) * n.r);
        mat(n.s).opacity = 0.34 + 0.12 * Math.sin(t * 1.5 + n.a * 2);
      }
      ringMat(ring).opacity = 0.2 + 0.1 * Math.sin(t * 2);
    },
  };
}

/** 무지개: 일곱 빛깔 나선이 위로 오르고 발밑에 무지개 물결이 퍼진다 */
function rainbow(): AuraFx {
  const g = new THREE.Group();
  const N = 36;
  const ps = Array.from({ length: N * 2 }, (_, i) => {
    const s = puff(0xffffff, 0.26, false);
    g.add(s);
    return { s, strand: i % 2, off: Math.floor(i / 2) / N };
  });
  const rings = Array.from({ length: 7 }, (_, i) => {
    const r = groundRing(0.55 + i * 0.1, 0.63 + i * 0.1, new THREE.Color().setHSL(i / 7, 1, 0.55), 0.6);
    g.add(r);
    return r;
  });
  const col = new THREE.Color();
  return {
    group: g,
    update(t) {
      for (const p of ps) {
        const k = fract(p.off + t * 0.16);
        const a = p.strand * Math.PI + k * 8 + t * 1.1;
        const r = 0.8 + 0.1 * Math.sin(k * 12 + t * 2);
        p.s.position.set(Math.sin(a) * r, 0.05 + k * 2.7, Math.cos(a) * r);
        col.setHSL(fract(k * 1.2 + t * 0.12), 1, 0.6);
        mat(p.s).color.copy(col);
        mat(p.s).opacity = Math.min(1, k * 6, (1 - k) * 5);
      }
      rings.forEach((r, i) => { ringMat(r).opacity = 0.35 + 0.3 * Math.sin(t * 4 - i * 0.7); });
    },
  };
}

const BUILDERS: Record<string, () => AuraFx> = {
  "aura-flame": flame,
  "aura-sakura": sakura,
  "aura-lightning": lightning,
  "aura-galaxy": galaxy,
  "aura-rainbow": rainbow,
};

export function buildAura(id: string): AuraFx | null {
  return BUILDERS[id]?.() ?? null;
}
