// 확인용 화면(게임 메뉴에는 없다): 수중 물고기 300종의 그림을 구역별로 늘어놓는다. 주소: /uwgallery.html?zone=0 (0~5)
import { UW_FISH, UW_ZONE_NAMES } from "@fishing/shared";
import { fishIconUrl } from "./three/fishIcon3d";
import { buildFish } from "./three/fishModel";
import { RARITY_COLOR, RARITY_LABEL } from "./ui/FishIcon";

const zone = Number(new URLSearchParams(location.search).get("zone") ?? 0);
const nav = document.getElementById("nav")!, grid = document.getElementById("g")!;
UW_ZONE_NAMES.forEach((n, i) => {
  const a = document.createElement("a");
  a.href = `?zone=${i}`; a.textContent = n; if (i === zone) a.className = "on";
  nav.append(a);
});
const top = new URLSearchParams(location.search).has("top"); // ?top: 전설·신화만 크게
if (top) grid.classList.add("big");
for (const sp of UW_FISH.filter((s) => s.id.startsWith(`uw-${zone}-`) && (!top || s.rarity === "legendary" || s.rarity === "mythic"))) {
  const d = document.createElement("div"), i = document.createElement("img"), b = document.createElement("b");
  b.textContent = RARITY_LABEL[sp.rarity]; b.style.background = RARITY_COLOR[sp.rarity];
  d.append(i, sp.name, b);
  d.style.cursor = "pointer"; d.title = "누르면 움직이는 모습을 크게 봅니다";
  d.addEventListener("click", () => { location.href = `?zone=${zone}&view=${encodeURIComponent(sp.name)}`; });
  grid.append(d);
  void fishIconUrl(sp).then((u) => { if (u) i.src = u; });
}
/** 전 종을 만들어 보며 오류를 모은다(확인용) */
(window as any).__check = () => {
  const thrown: string[] = [];
  for (const sp of UW_FISH) if (sp.body !== "shell") try { (buildFish(sp).userData.update as ((t: number) => void) | undefined)?.(1); } catch (e) { thrown.push(`${sp.name}: ${(e as Error).message}`); }
  return thrown;
};

// ?view=이름: 한 마리를 크게, 오라와 움직임까지 본다(끌어서 돌리고, 휠로 거리 조절)
const viewName = new URLSearchParams(location.search).get("view");
if (viewName) void import("three").then((THREE) => {
  const sp = UW_FISH.find((s) => s.name === viewName);
  if (!sp) return;
  grid.style.display = "none";
  const R = new THREE.WebGLRenderer({ antialias: true });
  R.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.append(R.domElement);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  sc.background = new THREE.Color("#0c3a56");
  sc.add(new THREE.HemisphereLight(0xcfeaff, 0x1a4a66, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(3, 6, 4); sc.add(sun);
  const fish = buildFish(sp), box = new THREE.Box3().setFromObject(fish), size = box.getSize(new THREE.Vector3()).length();
  sc.add(fish);
  let yaw = 0.7, pitch = 0.15, dist = size * 1.1, drag = false, auto = true;
  R.domElement.addEventListener("pointerdown", () => { drag = true; auto = false; });
  addEventListener("pointerup", () => (drag = false));
  addEventListener("pointermove", (e) => { if (drag) { yaw -= e.movementX * 0.008; pitch = Math.max(-1.2, Math.min(1.2, pitch + e.movementY * 0.006)); } });
  addEventListener("wheel", (e) => { dist *= e.deltaY > 0 ? 1.1 : 0.9; });
  (window as any).__view = { set: (y: number, p: number, d?: number) => { yaw = y; pitch = p; if (d) dist = size * d; auto = false; } };
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000, w = innerWidth, h = innerHeight - nav.offsetHeight;
    if (R.domElement.width !== w * R.getPixelRatio()) { R.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (auto) yaw += 0.004;
    (fish.userData.update as ((t: number) => void) | undefined)?.(t);
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(0, 0, 0);
    R.render(sc, cam);
    requestAnimationFrame(loop);
  };
  loop();
});
