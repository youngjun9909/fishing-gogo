import * as THREE from "three";
import { createEngine } from "./three/engine";
import { buildWorld } from "./three/world";
import { CharacterRig, SHAPES } from "./three/character";
import type { Look } from "./three/character";

const root = document.getElementById("root")!;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
const eng = createEngine(root, scene, camera);
const world = buildWorld("lake", scene);
const params = new URLSearchParams(location.search);

const looks: Array<{ label: string; look: Look }> = params.get("only") === "ref"
  ? [
      { label: "포니테일 소녀", look: { shape: "ref", equipped: {}, appearance: { eyes: 0, nose: 1, mouth: 0, hair: 4, skinColor: 0, hairColor: 1, eyeColor: 1, body: 1 } } },
      { label: "짧은 머리 소년", look: { shape: "ref", equipped: { outfit: "outfit-overalls" }, appearance: { eyes: 6, nose: 1, mouth: 1, hair: 9, skinColor: 1, hairColor: 0, eyeColor: 1, body: 1 } } },
      { label: "별눈 친구", look: { shape: "ref", equipped: { hat: "hat-beanie" }, appearance: { eyes: 5, nose: 3, mouth: 3, hair: 10, skinColor: 7, hairColor: 6, eyeColor: 9, body: 1 } } },
      { label: "고양이눈", look: { shape: "ref", equipped: {}, appearance: { eyes: 4, nose: 5, mouth: 2, hair: 13, skinColor: 2, hairColor: 11, eyeColor: 2, body: 1 } } },
    ]
  : Object.keys(SHAPES).map((id) => ({
      label: SHAPES[id].name,
      look: { shape: id, equipped: {}, appearance: { eyes: 0, nose: 1, mouth: 0, hair: 4, skinColor: 0, hairColor: 1, eyeColor: 1, body: 1 } },
    }));

const solo = params.get("solo");
const shown = solo === null ? looks : [looks[Number(solo) % looks.length]];
const spacing = shown.length <= 4 ? 3.2 : 2.5;
const rigs = shown.map(({ label, look }, i) => {
  const r = new CharacterRig(look);
  r.root.position.set((i - (shown.length - 1) / 2) * spacing, 0, 20);
  r.facing = 0.0;
  scene.add(r.root);
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.textContent = label;
  document.body.appendChild(lb);
  return { r, lb };
});
if (solo !== null) {
  camera.position.set(0, 2.2, 28.6);
  camera.lookAt(0, 1.75, 20);
} else if (shown.length <= 4) {
  camera.position.set(0, 2.6, 30);
  camera.lookAt(0, 1.7, 20);
} else {
  camera.position.set(0, 3.6, 39);
  camera.lookAt(0, 1.5, 20);
}
const clock = new THREE.Clock();
let t = 0;
function loop() {
  const dt = clock.getDelta();
  t += dt;
  world.update(t, 3 * 60 * 1000);
  rigs.forEach(({ r, lb }) => {
    r.update(dt, { moving: false, fishing: "idle" });
    const v = new THREE.Vector3(r.root.position.x, -0.35, r.root.position.z).project(camera);
    lb.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
    lb.style.top = `${((1 - v.y) / 2) * innerHeight}px`;
  });
  eng.render();
  requestAnimationFrame(loop);
}
loop();
(window as any).__scene = scene;
