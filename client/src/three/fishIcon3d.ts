import * as THREE from "three";
import type { FishSpecies } from "@fishing/shared";
import { bodyBox, buildFish } from "./fishModel";

// 전설·신화 물고기의 2D 그림: 3D 모델을 한 번 찍어서(투명 배경) 그림으로 쓴다. 한 번 만든 그림은 기억해 둔다.
const W = 300, H = 200;
const cache = new Map<string, string>();
const queue: Array<() => void> = [];
let busy = false;
let rig: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null;

function getRig() {
  if (!rig) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9ab0, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
    rig = { renderer, scene, cam };
  }
  return rig;
}

function render(sp: FishSpecies): string {
  const { renderer, scene, cam } = getRig();
  const fish = buildFish(sp);
  (fish.userData.update as ((t: number) => void) | undefined)?.(1.3);
  // 후광·빛 줄기·입자 같은 꾸밈은 그림에서 뺀다
  fish.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.material as THREE.Material | undefined;
    if (o.name === "fx" || (o as THREE.Sprite).isSprite || (mat && (mat.type === "ShaderMaterial" || mat.blending === THREE.AdditiveBlending || mat.type === "PointsMaterial"))) o.visible = false;
  });
  const box = bodyBox(fish);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  fish.position.sub(c);
  wrap.add(fish);
  wrap.scale.setScalar(3.4 / Math.max(size.x, size.y * 1.5, size.z * 0.8, 0.01));
  scene.add(wrap);
  cam.position.set(Math.sin(0.55) * 8.5, 1.8, Math.cos(0.55) * 8.5);
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL("image/png");
  scene.remove(wrap);
  wrap.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
  });
  return url;
}

function pump() {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  setTimeout(() => { try { job(); } finally { busy = false; pump(); } }, 0);
}

/** 그림 주소를 비동기로 만든다(여러 개를 동시에 부탁해도 하나씩 차례로 찍는다) */
export function fishIconUrl(sp: FishSpecies): Promise<string | null> {
  const hit = cache.get(sp.id);
  if (hit) return Promise.resolve(hit);
  return new Promise((ok) => {
    queue.push(() => {
      try {
        const url = cache.get(sp.id) ?? render(sp);
        cache.set(sp.id, url);
        ok(url);
      } catch {
        ok(null); // 그림을 못 만들면 기본 그림을 계속 쓴다
      }
    });
    pump();
  });
}

export const cachedFishIcon = (id: string) => cache.get(id) ?? null;
