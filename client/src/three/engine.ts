import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/** 동물의 숲 느낌의 부드러운 단계 음영(4단계) */
const gradient = (() => {
  const data = new Uint8Array([90, 160, 215, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

export function toon(color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });
}

/** 뒤집은 껍질로 만드는 부드러운 윤곽선 */
export function addOutline(mesh: THREE.Mesh, thickness = 0.03, color = 0x4a3b52) {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }),
  );
  outline.scale.setScalar(1 + thickness);
  outline.userData.isOutline = true;
  mesh.add(outline);
  return mesh;
}

export interface Engine {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(): void;
  render(): void;
  dispose(): void;
}

export function createEngine(container: HTMLElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera): Engine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.6, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  return {
    renderer, composer, scene, camera, resize,
    render: () => composer.render(),
    dispose() {
      ro.disconnect();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** 각도 보간(최단 방향) */
export function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
