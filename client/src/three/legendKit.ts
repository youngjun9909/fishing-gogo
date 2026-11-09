import * as THREE from "three";
import type { FishSpecies } from "@fishing/shared";
import { auraShell, makeEye, scaleMap, sparkField } from "./fishModel";
import type { Anim } from "./fishModel";

// 전설 물고기 모델이 함께 쓰는 재료와 도우미

export const C = (c: string) => new THREE.Color(c);
export const phys = (color: string, o: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, ...o });
export const glow = (color: string, i = 0.7) => new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.25, metalness: 0.3 });
export const glass = (color: string, op = 0.55) =>
  new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: op, roughness: 0.12, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.25, depthWrite: false });
export const flat = (m: THREE.Material, p: [number, number, number], s: [number, number, number], geo: THREE.BufferGeometry = new THREE.SphereGeometry(0.5, 24, 16)) => {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(...p);
  mesh.scale.set(...s);
  return mesh;
};
export const eyes = (g: THREE.Group, r: number, x: number, y: number, z: number, color?: string) => {
  for (const s of [-1, 1]) {
    const e = makeEye(r, s, C(color ?? "#f0b050"), !!color);
    e.position.set(x, y, s * z);
    g.add(e);
  }
};
export const rad = (r: number) => r; // 가독성용

export function finish(g: THREE.Group, anim: Anim, k: number, haloColor: string, halo: [number, number, number], spark = 22) {
  const shell = auraShell(new THREE.SphereGeometry(0.5, 32, 22), C(haloColor));
  shell.scale.set(...halo);
  g.add(shell);
  sparkField(g, anim, C(haloColor), spark, Math.max(halo[0], 1.1) * 0.8, Math.max(halo[1], 0.6) * 1.0);
  g.scale.setScalar(k);
  g.userData.designScale = k;
  g.userData.update = (t: number) => anim.forEach((f) => f(t));
  return g;
}

export type Maker = (sp: FishSpecies) => THREE.Group;


/** 위에서 아래로 색이 이어지는 몸 재질(등→배). 비늘 요철과 광택을 함께 준다 */
export function grad(top: string, bottom: string, o: { mid?: string; emissive?: string; ei?: number; bump?: boolean } = {}) {
  const c = document.createElement("canvas");
  c.width = 8; c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, top);
  if (o.mid) g.addColorStop(0.5, o.mid);
  g.addColorStop(1, bottom);
  x.fillStyle = g; x.fillRect(0, 0, 8, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.14, emissive: o.emissive ? new THREE.Color(o.emissive) : new THREE.Color(0), emissiveIntensity: o.ei ?? 0.12 });
  if (o.bump !== false) { m.bumpMap = scaleMap(); m.bumpScale = 0.22; }
  return m;
}
