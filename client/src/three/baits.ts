import * as THREE from "three";
import { puff } from "./auras";

/** 미끼 3종(지렁이, 반짝이, 황금)의 작은 3D 모델. 상점 미리보기에서 돌려 보여 준다. 원점 중심, 가로 약 1.6 */
export interface BaitFx { group: THREE.Group; update: (t: number) => void }

const std = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, ...o });

function hook(mat: THREE.Material, scale = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.1 * scale, 0.012 * scale, 6, 14, Math.PI * 1.25), mat);
    arm.rotation.z = Math.PI * 0.9;
    const holder = new THREE.Group();
    holder.rotation.y = (i / 3) * Math.PI * 2;
    arm.position.set(0.1 * scale, 0, 0);
    holder.add(arm);
    g.add(holder);
  }
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.025 * scale, 0.008 * scale, 6, 12), mat);
  eye.position.y = 0.02 * scale;
  g.add(eye);
  return g;
}

function worm(): BaitFx {
  const g = new THREE.Group();
  const N = 11;
  const pink = std("#f2909f", { roughness: 0.5, emissive: "#8a3040", emissiveIntensity: 0.3 });
  const light = std("#f9bcc4", { roughness: 0.5, emissive: "#8a5058", emissiveIntensity: 0.25 });
  const segs = Array.from({ length: N }, (_, i) => {
    const r = 0.13 * (0.62 + 0.38 * Math.sin((Math.PI * (i + 0.5)) / N));
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), i % 2 ? light : pink);
    g.add(m);
    return m;
  });
  // 얼굴: 눈 두 개와 볼
  const black = std("#1c1420", { roughness: 0.3 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), black);
    eye.position.set(-0.07, 0.07, s * 0.06);
    segs[0].add(eye);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std("#ff7a90", { emissive: "#ff5a78", emissiveIntensity: 0.5 }));
    cheek.position.set(-0.08, -0.01, s * 0.085);
    segs[0].add(cheek);
  }
  const silver = std("#d9dde4", { metalness: 0.6, roughness: 0.3, emissive: "#555a62", emissiveIntensity: 0.3 });
  const h = hook(silver, 1.1);
  h.position.set(0.82, -0.05, 0);
  h.rotation.z = -0.5;
  g.add(h);
  return {
    group: g,
    update: (t) => {
      segs.forEach((m, i) => {
        const k = i - (N - 1) / 2;
        m.position.set(k * 0.14, Math.sin(i * 0.7 + t * 3) * 0.07, Math.cos(i * 0.5 + t * 2) * 0.03);
        m.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.04);
      });
    },
  };
}

interface LureOpts {
  body: THREE.Material;
  belly: THREE.Material;
  fin: THREE.Material;
  stripe: THREE.Material;
  hook: THREE.Material;
  size: number;
}
/** 물고기 모양 인조 미끼: 몸통, 배, 꼬리, 등지느러미, 큰 눈, 갈고리 */
function lureBody(o: LureOpts) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), o.body);
  body.scale.set(1.8, 0.78, 0.62);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), o.belly);
  belly.scale.set(1.78, 0.78, 0.6);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), o.fin);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(0.62, 0, 0);
  tail.scale.set(1, 1, 0.35);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 4), o.fin);
  dorsal.position.set(0.05, 0.27, 0);
  dorsal.scale.set(1.3, 1, 0.3);
  const white = std("#ffffff", { roughness: 0.2, emissive: "#8890a0", emissiveIntensity: 0.3 });
  const black = std("#15121c", { roughness: 0.2 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), white);
    eye.position.set(-0.36, 0.06, s * 0.17);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), black);
    pupil.position.set(-0.025, 0, s * 0.045);
    eye.add(pupil);
    g.add(eye);
  }
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.26 - i * 0.05, 0.012, 6, 20), o.stripe);
    st.rotation.y = Math.PI / 2;
    st.position.set(-0.05 + i * 0.2, 0, 0);
    st.scale.set(0.62 + i * 0.06, 0.78 + i * 0.02, 1);
    g.add(st);
  }
  const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 10), o.hook);
  eyelet.position.set(-0.56, 0.02, 0);
  eyelet.rotation.x = Math.PI / 2;
  const h = hook(o.hook, 1.2);
  h.position.set(0.1, -0.28, 0);
  g.add(body, belly, tail, dorsal, eyelet, h);
  g.scale.setScalar(o.size);
  return { group: g, tail };
}

function glitter(): BaitFx {
  const g = new THREE.Group();
  const { group, tail } = lureBody({
    body: std("#cfe6ff", { metalness: 0.65, roughness: 0.18, emissive: "#5b8fe0", emissiveIntensity: 0.45 }),
    belly: std("#f4faff", { metalness: 0.4, roughness: 0.25, emissive: "#9fb8e0", emissiveIntensity: 0.35 }),
    fin: std("#a98bff", { roughness: 0.3, emissive: "#6a4ad0", emissiveIntensity: 0.5 }),
    stripe: std("#7a5af0", { roughness: 0.3, emissive: "#4a2ad0", emissiveIntensity: 0.6 }),
    hook: std("#e6e9ef", { metalness: 0.8, roughness: 0.2, emissive: "#6a6f78", emissiveIntensity: 0.4 }),
    size: 1,
  });
  g.add(group);
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const s = puff(i % 3 ? 0xdff0ff : 0xffd8ff, 0.08);
    g.add(s);
    return { s, a: (i / 12) * Math.PI * 2, r: 0.7 + (i % 3) * 0.1 };
  });
  return {
    group: g,
    update: (t) => {
      tail.rotation.y = Math.sin(t * 6) * 0.35;
      group.position.y = Math.sin(t * 2) * 0.04;
      for (const p of sparks) {
        p.s.position.set(Math.cos(p.a + t * 0.9) * p.r, Math.sin(p.a * 2 + t * 1.6) * 0.35, Math.sin(p.a + t * 0.9) * p.r * 0.6);
        (p.s.material as THREE.SpriteMaterial).opacity = 0.5 + 0.5 * Math.sin(t * 5 + p.a * 3);
      }
    },
  };
}

function gold(): BaitFx {
  const g = new THREE.Group();
  const goldM = std("#ffcf4a", { metalness: 0.55, roughness: 0.2, emissive: "#a8740a", emissiveIntensity: 0.7 });
  const deep = std("#c98a12", { metalness: 0.5, roughness: 0.3, emissive: "#6a4208", emissiveIntensity: 0.55 });
  const ruby = std("#ff3a5a", { roughness: 0.15, emissive: "#d11a3a", emissiveIntensity: 1 });
  const sapphire = std("#4a8aff", { roughness: 0.15, emissive: "#2a5ad0", emissiveIntensity: 1 });
  const { group, tail } = lureBody({
    body: goldM,
    belly: std("#fff0b0", { metalness: 0.4, roughness: 0.25, emissive: "#a88a30", emissiveIntensity: 0.5 }),
    fin: deep,
    stripe: ruby,
    hook: goldM,
    size: 1.12,
  });
  // 옆구리 보석과 등의 왕관 모양 뿔
  for (const s of [-1, 1]) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), s > 0 ? ruby : sapphire);
    gem.position.set(0.12, 0.03, s * 0.2);
    group.add(gem);
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), goldM);
      spike.position.set(-0.12 + i * 0.16, 0.34 + (i === 1 ? 0.05 : 0), 0);
      group.add(spike);
    }
  }
  g.add(group);
  const halo = puff(0xffe08a, 1.4);
  halo.position.set(0, 0, -0.1);
  g.add(halo);
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const s = puff(0xfff0a0, 0.09);
    g.add(s);
    return { s, a: (i / 14) * Math.PI * 2, r: 0.75 + (i % 4) * 0.08 };
  });
  return {
    group: g,
    update: (t) => {
      tail.rotation.y = Math.sin(t * 5) * 0.3;
      group.position.y = Math.sin(t * 1.8) * 0.045;
      (halo.material as THREE.SpriteMaterial).opacity = 0.35 + 0.15 * Math.sin(t * 3);
      for (const p of sparks) {
        p.s.position.set(Math.cos(p.a + t * 0.8) * p.r, Math.sin(p.a * 3 + t * 1.4) * 0.4, Math.sin(p.a + t * 0.8) * p.r * 0.55);
        (p.s.material as THREE.SpriteMaterial).opacity = 0.5 + 0.5 * Math.sin(t * 4 + p.a * 2);
      }
    },
  };
}

/** 그냥 미끼: 반죽 한 덩이와 바늘 */
function plain(): BaitFx {
  const g = new THREE.Group();
  const dough = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), std("#e8c98a", { roughness: 0.8 }));
  g.add(dough);
  const h = hook(std("#c9ced6", { metalness: 0.8, roughness: 0.3 }), 1.6);
  h.position.y = -0.3;
  g.add(h);
  return { group: g, update: (t) => { g.rotation.y = t * 0.8; g.position.y = Math.sin(t * 1.6) * 0.04; } };
}

export function buildBait(id: string): BaitFx {
  return id === "bait-glitter" ? glitter() : id === "bait-gold" ? gold() : id === "bait-plain" ? plain() : worm();
}
