import * as THREE from "three";
import { createEngine } from "./three/engine";
import { buildWorld } from "./three/world";
import { CharacterRig, loadCharacterModel } from "./three/character";

// 맵을 게임 시점으로 미리 보는 화면: ?map=lake|pier|ice&t=시간(분)&cam=0~3
// 캐릭터 동작 확인: &pose=walk|waiting|bite|minigame&emote=wave|dance|...&close=1(가까이)&face=front
const params = new URLSearchParams(location.search);
const mapId = params.get("map") ?? "lake";
const minutes = Number(params.get("t") ?? 3);
const cam = Number(params.get("cam") ?? 0);
const pose = params.get("pose") ?? "idle";

const root = document.getElementById("root")!;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
const eng = createEngine(root, scene, camera);
const world = buildWorld(mapId, scene);

const spawn = mapId === "pier" ? { x: 0, z: 10 } : mapId === "ice" ? { x: 0, z: 25 } : { x: 0, z: 20 };

const views: Array<[THREE.Vector3, THREE.Vector3]> = [
  [new THREE.Vector3(spawn.x, 6, spawn.z + 10), new THREE.Vector3(spawn.x, 1.8, spawn.z - 6)],
  [new THREE.Vector3(spawn.x + 18, 5, spawn.z + 6), new THREE.Vector3(spawn.x - 4, 1, spawn.z - 8)],
  [new THREE.Vector3(spawn.x - 22, 9, spawn.z + 18), new THREE.Vector3(spawn.x, 0, spawn.z - 14)],
  [new THREE.Vector3(spawn.x, 30, spawn.z + 40), new THREE.Vector3(spawn.x, 0, spawn.z - 10)],
];
if (params.get("close")) {
  const cx = Number(params.get("cx") ?? 0);
  if (params.get("head")) { // 머리 클로즈업
    camera.position.set(spawn.x + cx, 2.25, spawn.z + 3.4);
    camera.lookAt(spawn.x, 2.05, spawn.z);
  } else {
    camera.position.set(spawn.x + cx, 2.4, spawn.z + 7);
    camera.lookAt(spawn.x, 1.4, spawn.z);
  }
} else {
  camera.position.copy(views[cam % views.length][0]);
  camera.lookAt(views[cam % views.length][1]);
}

let rig: CharacterRig | null = null;
const gallery = params.get("gallery"); // hair | eyes | nose | mouth : 번호 0~9를 5명씩(from=0 또는 5) 나란히 본다
if (gallery) {
  const gap = Number(params.get("gap") ?? 2.3);
  const gd = Number(params.get("dist") ?? 7.2);
  camera.position.set(spawn.x, params.get("dist") ? 2.1 : 2.3, spawn.z + gd);
  camera.lookAt(spawn.x, params.get("dist") ? 2.1 : 1.95, spawn.z);
  void loadCharacterModel().then(() => {
    const from = Number(params.get("from") ?? 0);
    const cnt = gallery === "turn" ? Number(params.get("n") ?? 6) : 5;
    for (let i = 0; i < cnt; i++) {
      const k = from + i;
      const ap = { eyes: Number(params.get("eyes") ?? 0), nose: Number(params.get("nose") ?? 1), mouth: Number(params.get("mouth") ?? 0), hair: Number(params.get("hair") ?? 0), skinColor: 0, hairColor: Number(params.get("hc") ?? 0), eyeColor: Number(params.get("ec") ?? 1), body: 1, gender: Number(params.get("gender") ?? 0) };
      if (gallery === "turn") { /* 같은 캐릭터를 여섯 방향으로 */ }
      else if (gallery === "hair") ap.hair = k;
      else if (gallery === "eyes") ap.eyes = k;
      else if (gallery === "nose") ap.nose = k % 6;
      else if (gallery === "mouth") ap.mouth = k % 8;
      const r = new CharacterRig({ appearance: ap, equipped: params.get("outfit") ? { outfit: `outfit-${params.get("outfit")}` } : {} });
      r.root.position.set(spawn.x + (i - (cnt - 1) / 2) * gap, 0, spawn.z);
      r.facing = gallery === "turn" ? (i * Math.PI * 2) / cnt : 0;
      scene.add(r.root);
      const st = { moving: pose === "walk", fishing: ["waiting", "bite", "minigame"].includes(pose) ? pose : "idle" };
      for (let k = 0; k < Number(params.get("steps") ?? 1); k++) r.update(1 / 60, st);
    }
  });
}
void loadCharacterModel().then(() => {
  if (gallery) return;
  const n = (k: string, d: number) => Number(params.get(k) ?? d);
  rig = new CharacterRig({ appearance: { eyes: n("eyes", 0), nose: n("nose", 1), mouth: n("mouth", 0), hair: n("hair", 0), skinColor: n("skin", 0), hairColor: n("hc", 0), eyeColor: n("ec", 1), body: 1, gender: n("gender", 0) }, equipped: params.get("outfit") ? { outfit: `outfit-${params.get("outfit")}` } : {} });
  rig.root.position.set(spawn.x, 0, spawn.z);
  rig.facing = params.get("ang") !== null ? (Number(params.get("ang")) * Math.PI) / 180 : params.get("face") === "front" ? 0 : Math.PI;
  scene.add(rig.root);
  (window as any).__rig = rig;
  if (params.get("emote")) rig.playEmote(params.get("emote")!);
});

// 한 명 보기: 마우스로 끌면 돌고, &spin=1이면 천천히 계속 돈다
let dragX: number | null = null;
root.addEventListener("pointerdown", (e) => { dragX = e.clientX; });
window.addEventListener("pointerup", () => { dragX = null; });
window.addEventListener("pointermove", (e) => { if (dragX !== null && rig) { rig.facing -= (e.clientX - dragX) * 0.012; dragX = e.clientX; } });
const spin = Number(params.get("spin") ?? 0);
const clock = new THREE.Clock();
let t = 0;
function loop() {
  const dt = clock.getDelta();
  t += dt;
  world.update(t, minutes * 60 * 1000);
  // &steps=N : 1/60초씩 N번만 진행해 멈춘 장면으로 본다(걷기 자세 비교용)
  const steps = Number(params.get("steps") ?? 0);
  const st = { moving: pose === "walk", fishing: ["waiting", "bite", "minigame"].includes(pose) ? pose : "idle" };
  if (steps && rig) { if (!(window as any).__done) { for (let i = 0; i < steps; i++) rig.update(1 / 60, st); (window as any).__done = true; } }
  else { if (rig && spin) rig.facing += dt * spin; rig?.update(dt, st); }
  eng.render();
  requestAnimationFrame(loop);
}
loop();
(window as any).__scene = scene;
(window as any).__camera = camera;
