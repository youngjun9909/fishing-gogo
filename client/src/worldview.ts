import * as THREE from "three";
import { createEngine } from "./three/engine";
import { buildWorld } from "./three/world";
import { CharacterRig } from "./three/character";

// 맵을 게임 시점으로 미리 보는 화면: ?map=lake|pier|ice&t=시간(분)&cam=0~3
const params = new URLSearchParams(location.search);
const mapId = params.get("map") ?? "lake";
const minutes = Number(params.get("t") ?? 3);
const cam = Number(params.get("cam") ?? 0);

const root = document.getElementById("root")!;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
const eng = createEngine(root, scene, camera);
const world = buildWorld(mapId, scene);

const spawn = mapId === "pier" ? { x: 0, z: 10 } : mapId === "ice" ? { x: 0, z: 25 } : { x: 0, z: 20 };
const rig = new CharacterRig({ appearance: { eyes: 0, nose: 1, mouth: 0, hair: 4, skinColor: 0, hairColor: 1, eyeColor: 1, body: 1 }, equipped: {} });
rig.root.position.set(spawn.x, 0, spawn.z);
rig.facing = Math.PI;
scene.add(rig.root);

const views: Array<[THREE.Vector3, THREE.Vector3]> = [
  [new THREE.Vector3(spawn.x, 6, spawn.z + 10), new THREE.Vector3(spawn.x, 1.8, spawn.z - 6)],
  [new THREE.Vector3(spawn.x + 18, 5, spawn.z + 6), new THREE.Vector3(spawn.x - 4, 1, spawn.z - 8)],
  [new THREE.Vector3(spawn.x - 22, 9, spawn.z + 18), new THREE.Vector3(spawn.x, 0, spawn.z - 14)],
  [new THREE.Vector3(spawn.x, 30, spawn.z + 40), new THREE.Vector3(spawn.x, 0, spawn.z - 10)],
];
camera.position.copy(views[cam % views.length][0]);
camera.lookAt(views[cam % views.length][1]);

const clock = new THREE.Clock();
let t = 0;
function loop() {
  const dt = clock.getDelta();
  t += dt;
  world.update(t, minutes * 60 * 1000);
  rig.update(dt, { moving: false, fishing: "idle" });
  eng.render();
  requestAnimationFrame(loop);
}
loop();
(window as any).__scene = scene;
