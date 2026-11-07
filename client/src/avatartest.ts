import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createEngine, addSkinnedOutline } from "./three/engine";
import { buildFace, FACE_V3 } from "./three/face";

// 새 베이스 캐릭터(GLB) 불러오기 시험: ?hide=Skin_Legs,Skin_Feet&color=ffb0c0&anim=Walk&t=0.4
const params = new URLSearchParams(location.search);
const root = document.getElementById("root")!;
const info = document.getElementById("info")!;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#cfe9f5");
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
const eng = createEngine(root, scene, camera);
if (params.get("studio") !== "0") {
  const pm = new THREE.PMREMGenerator(eng.renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  eng.renderer.toneMapping = THREE.NeutralToneMapping;
  eng.renderer.toneMappingExposure = 1.0;
  (eng.composer.passes[1] as any).enabled = false; // bloom off
}
scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa07a, 0.7));
const sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
sun.position.set(2.5, 3, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -1; sun.shadow.camera.right = 1; sun.shadow.camera.top = 1.5; sun.shadow.camera.bottom = -0.5;
const rim = new THREE.DirectionalLight(0xbfe0ff, 1.2);
rim.position.set(-3, 2, -3);
scene.add(rim);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: "#9bd08c" }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

let mixer: THREE.AnimationMixer | null = null;
new GLTFLoader().load("/models/" + (params.get("model") ?? "base_test.glb"), (gltf) => {
  const model = gltf.scene;
  scene.add(model);
  const hide = (params.get("hide") ?? "").split(",").filter(Boolean);
  const names: string[] = [];
  let bones = 0;
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if ((o as THREE.Bone).isBone) bones++;
    if (m.isMesh) {
      const old = m.material as THREE.MeshStandardMaterial;
      const isHair = old.name === "Hair";
      const mat = new THREE.MeshPhysicalMaterial(isHair
        ? { color: new THREE.Color("#3a2420"), roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.35 }
        : { color: old.color, roughness: 0.62, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffd2c0") });
      mat.name = old.name;
      m.material = mat;
      names.push(mat.name);
      m.castShadow = true;
      if (hide.includes(mat.name)) m.visible = false;
      if (params.get("color")) mat.color.set("#" + params.get("color"));
    }
  });
  // v3 베이스는 머리가 더 크고 눈 위치가 달라서 얼굴 값을 따로 쓴다
  const v3 = (params.get("model") ?? "").includes("v3");
  if (params.get("face") !== "0") buildFace(model, v3 ? FACE_V3 : undefined);
  if (params.get("outline") === "1") addSkinnedOutline(model);
  const clip = gltf.animations.find((a) => a.name === (params.get("anim") ?? "Walk"));
  if (clip) {
    mixer = new THREE.AnimationMixer(model);
    const act = mixer.clipAction(clip);
    act.play();
    if (params.get("t")) { mixer.setTime(Number(params.get("t"))); act.paused = true; }
  }
  info.textContent = `부위 ${names.length}개 [${names.join(", ")}] | 뼈 ${bones}개 | 동작 ${gltf.animations.map((a) => a.name).join(",")} ${hide.length ? "| 숨김: " + hide.join(",") : ""}`;
}, undefined, (e) => (info.textContent = "불러오기 실패: " + (e as Error).message));

const dist = Number(params.get("dist") ?? 3.0);
camera.position.set(Number(params.get("cx") ?? 1.2), 0.9, dist);
camera.lookAt(0, 0.48, 0);
const clock = new THREE.Clock();
function loop() {
  const dt = clock.getDelta();
  mixer?.update(dt);
  eng.render();
  requestAnimationFrame(loop);
}
loop();
