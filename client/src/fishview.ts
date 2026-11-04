import * as THREE from "three";
import { SPECIES } from "@fishing/shared";
import { createEngine } from "./three/engine";
import { buildFish } from "./three/fishModel";

// 물고기 디자인 확인용: ?ids=common-01,lake-12,... 또는 체형별 대표 12종
const params = new URLSearchParams(location.search);
const root = document.getElementById("root")!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(params.get("raw") && params.get("bg") !== "light" ? "#0a1a33" : "#cfe9f5");
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const eng = createEngine(root, scene, camera);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9bb8d0, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(4, 8, 6);
scene.add(sun);

const bodies = [...new Set(SPECIES.map((s) => s.body))];
const ids = params.get("ids")?.split(",") ?? [...bodies.map((b) => SPECIES.find((s) => s.body === b)!.id), "lake-24", "pier-30", "ice-26", "lake-28"];
const cols = Number(params.get("cols") ?? 4);
const fishes = ids.map((id, i) => {
  const sp = SPECIES.find((s) => s.id === id)!;
  const f = buildFish(sp);
  const row = Math.floor(i / cols), col = i % cols;
  f.position.set((col - (cols - 1) / 2) * 3.4, -row * 2.6, 0);
  const ds = (f.userData.designScale as number) ?? 1;
  const k = (params.get("raw") ? 1 : Math.min(1.1, 2.4 / Math.max(1.2, sp.body === "whale" ? 2.6 : sp.body === "eel" ? 2.2 : 1.4))) * (params.get("raw") ? 1 : 1);
  void ds;
  f.scale.setScalar(params.get("raw") ? ds * Number(params.get("raw")) : k);
  f.rotation.y = -0.5;
  scene.add(f);
  return f;
});
const rows = Math.ceil(ids.length / cols);
camera.position.set(0, -((rows - 1) * 2.6) / 2 + 0.2, params.get("raw") ? 22 + Number(params.get("dist") ?? 0) : 20 + rows * 2);
camera.lookAt(0, -((rows - 1) * 2.6) / 2, 0);
const clock = new THREE.Clock();
let t = 0;
function loop() {
  t += clock.getDelta();
  fishes.forEach((f) => f.userData.update?.(t));
  eng.render();
  requestAnimationFrame(loop);
}
loop();
