import * as THREE from "three";
import { BOSS, BOSS_NAMES, HUNT_ZONES, SPECIES, UW_FISH, harpoonStats, huntHeading, huntPos, uwHitRadius, uwLength } from "@fishing/shared";
import type { FishSpecies, HuntPath, UwTug } from "@fishing/shared";
import type { Room } from "colyseus.js";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { FishIcon, RARITY_COLOR, RARITY_LABEL } from "./ui/FishIcon";
import { buildChest, buildHarpoonGun, buildShell } from "./three/uwProps";

// 수중 탐험의 작살총 사냥(화면 쪽): 서버가 만든 물고기를 경로 함수로 그리고, 작살총으로 조준해 쏜다.
// 조준점은 화면 가운데 십자선이고, 숨 쉬듯 흔들린다(이동 중에는 더 크게). 작살이 날아가는 동안 물고기가 움직이므로 앞서 쏴야 한다.
// 맞으면 작살에 매단 줄로 물고기를 끌어온다. 맞았는지는 서버가 정한다: 여기서는 쏜 작살과 서버가 알려 준 결과(맞음·잡음·줍기)를 보여 준다.

export interface HuntCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  player: { pos: THREE.Vector3; vel: THREE.Vector3 };
  isTouch: boolean;
  zone: () => number;
  room: () => Room<any> | null;
  /** 마우스 시점이 고정되어 클릭이 "쏘기"가 되는 상태인가(첫 클릭은 시점을 고정하는 데 쓴다) */
  aiming: () => boolean;
  /** 불러오는 중, 구역 이동 중, 채팅 입력 중 등 쏠 수 없는 때 */
  blocked: () => boolean;
  firstPerson: () => boolean;
  /** 캐릭터가 바라보는 방향을 정한다(겨누는 쪽을 보게 한다) */
  setYaw: (yaw: number) => void;
  setFirstPerson: (on: boolean) => void;
  /** 캐릭터 손의 위치(없으면 null). side: 캐릭터의 왼손 L, 오른손 R */
  hand: (side: "L" | "R", out: THREE.Vector3) => THREE.Vector3 | null;
  /** 같은 채널 사람의 위치(나 포함). 없으면 null */
  posOf: (sid: string) => THREE.Vector3 | null;
  makeFish: (sp: FishSpecies, len: number) => { root: THREE.Group; fish: THREE.Group };
  flatten: (fish: THREE.Object3D) => void;
  heightAt: (x: number, z: number) => number;
  say: (text: string) => void;
}

interface FishView { root: THREE.Group; fish: THREE.Group; len: number; hooked: boolean; reeling: boolean }
interface Spear {
  mesh: THREE.Group; rope: THREE.Mesh; o: THREE.Vector3; d: THREE.Vector3; t0: number; end: number;
  hit: boolean; fid: string; sid: string; mine: boolean; spd: number; flight: number;
  state: "fly" | "stuck" | "reel" | "sink"; st: number; view?: FishView; from: THREE.Vector3; dur: number; caught?: { name: string; cm: number; by: string; fid: string };
}
interface ShellState { zone: number; x: number; z: number; kind: string }
interface BossState { name: string; zone: number; ax: number; ay: number; az: number; t0: number; seed: number; spd: number; hp: number; until: number; wx: number; wy: number; wz: number; wUntil: number }
interface ChestState { zone: number; x: number; z: number; kind: string }
interface FishState { sp: string; zone: number; ax: number; ay: number; az: number; t0: number; seed: number; spd: number; cm: number }

const BAIT_NAME: Record<string, string> = { "bait-worm": "지렁이 미끼", "bait-plain": "그냥 미끼", "bait-glitter": "반짝이 미끼", "bait-gold": "황금 미끼" };
const pathOf = (f: FishState): HuntPath => ({ ax: f.ax, ay: f.ay, az: f.az, t0: f.t0, seed: f.seed, spd: f.spd });
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);

export function createHunt(ctx: HuntCtx) {
  const { scene, camera, player } = ctx;
  let room: Room<any> | null = null;
  let off = 0, bestRtt = Infinity, pingT = 0; // 서버 시계와 내 시계의 차이(ms). 가장 빨리 돌아온 확인으로 잰다
  const serverNow = () => Date.now() + off;
  const views = new Map<string, FishView>();
  const shellMeshes = new Map<string, THREE.Group>();
  const chestMeshes = new Map<string, THREE.Group>();
  const spears: Spear[] = [];
  let mySpear: Spear | null = null;
  let stats = harpoonStats(0);
  let cool = 0, kick = 0, T = 0, shoulder = 0, aimPitch = 0, wasOn = false, prevFp = false;
  const handA = new THREE.Vector3(), handB = new THREE.Vector3();
  let wobAmp = 0.04;
  const wob = new THREE.Vector2();
  let nearShell = "", nearChest = "";
  let tug: { fid: string; p: UwTug; t0: number; tire: number; ten: number; phase: "rest" | "run" | "hold" | "beat"; soon: boolean; band: [number, number] | null; hold: number; beats: number[] | null; beatI: number } | null = null; // 힘겨루기 중(상태는 서버가 0.1초마다 보내 준다)
  let reelOn = false; // 감기 단추(마우스·Space·화면 단추)를 누르고 있는지
  let mySid = "";
  let chestAt: THREE.Vector3 | null = null;
  const bossBar = document.createElement("div");
  bossBar.style.cssText = "position:fixed;left:50%;top:64px;transform:translateX(-50%);width:min(300px,52vw);box-sizing:border-box;padding:6px 14px 9px;border-radius:18px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink);display:none;z-index:6;font:15px var(--font);text-align:center;pointer-events:none";
  bossBar.innerHTML = '<div id="bossName"></div><div style="height:14px;margin-top:4px;border-radius:999px;background:#f0eaf5;overflow:hidden"><div id="bossHp" style="height:100%;width:100%;border-radius:999px;background:var(--danger)"></div></div>';
  document.body.append(bossBar);
  const weakMark = new THREE.Group(); // 보스의 약점: 붉게 깜빡이는 표시
  weakMark.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: "#ff3b4d", transparent: true, opacity: 0.85, depthTest: false })), new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 20), new THREE.MeshBasicMaterial({ color: "#ffd24d", depthTest: false })));
  weakMark.renderOrder = 5; weakMark.visible = false;
  scene.add(weakMark);
  const newFish = new Set<string>(); // 도감에 처음 등록된 물고기(서버가 알려 준 것)

  // ---- 화면 요소 -----------------------------------------------------------------
  const cross = document.createElement("div");
  cross.style.cssText = "position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px solid #fff;border-radius:50%;pointer-events:none;z-index:4;display:none;box-shadow:0 0 6px rgba(0,30,50,.6)";
  cross.innerHTML = '<i style="position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:#fff"></i>';
  const toast = document.createElement("div");
  toast.style.cssText = "position:fixed;left:50%;top:23%;transform:translateX(-50%);width:max-content;max-width:92vw;box-sizing:border-box;text-align:center;padding:9px 20px;border-radius:999px;background:var(--ink);color:#fff;font:17px var(--font);pointer-events:none;z-index:7;opacity:0;transition:opacity .3s";
  const prompt = document.createElement("div");
  prompt.style.cssText = "position:fixed;left:50%;bottom:150px;transform:translateX(-50%);padding:6px 16px;border-radius:999px;background:rgba(255,255,255,.85);color:var(--ink);font:16px var(--font);pointer-events:none;z-index:5;display:none";
  prompt.textContent = "E  조개 줍기";
  const PROMPT_SHELL = "E  조개 줍기", PROMPT_CHEST = "E  상자 열기";
  // 힘겨루기 표시: 아래 글자 막대 대신 십자선 둘레의 고리와 화면 가장자리의 색으로 알려 준다(바깥 고리=진행, 안쪽 고리=장력, 가장자리 빛=발작)
  const gauge = document.createElement("div");
  gauge.style.cssText = "position:fixed;left:50%;top:50%;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;pointer-events:none;z-index:6;display:none;filter:drop-shadow(0 0 2px rgba(10,20,40,.95)) drop-shadow(0 0 5px rgba(10,20,40,.6))"; // 물빛과 겹쳐도 보이게 어두운 테두리를 두른다
  gauge.innerHTML = '<div id="tugProg" style="position:absolute;inset:0;border-radius:50%;-webkit-mask:radial-gradient(circle,transparent 42px,#000 43px);mask:radial-gradient(circle,transparent 42px,#000 43px)"></div><div id="tugBand0" style="position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px;border-radius:50%;border:2px dashed #b6ff5c;box-sizing:border-box;display:none"></div><div id="tugBand1" style="position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px;border-radius:50%;border:2px dashed #b6ff5c;box-sizing:border-box;display:none"></div><div id="tugTen" style="position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px;border-radius:50%;border:7px solid #fff;box-sizing:border-box"></div><div id="tugBeat" style="position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px;border-radius:50%;border:5px solid #ffd23f;box-sizing:border-box;display:none"></div>';
  const cue = document.createElement("div"); // 발작 때만 뜨는 큰 신호(글자는 짧게)
  cue.style.cssText = "position:fixed;left:50%;top:calc(50% + 70px);transform:translateX(-50%);pointer-events:none;z-index:6;display:none;font:bold 28px var(--font);color:#fff;text-shadow:0 2px 6px rgba(120,0,0,.9),0 0 18px rgba(255,60,60,.9);width:max-content;max-width:92vw;text-align:center;word-break:keep-all";
  // 처음 힘겨루기를 할 때 한 번 보여 주는 요령(이후에는 H 안내에서 다시 볼 수 있다)
  const guide = document.createElement("div");
  guide.style.cssText = "position:fixed;left:50%;top:13%;transform:translateX(-50%);width:min(440px,92vw);box-sizing:border-box;padding:12px 16px;border-radius:18px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink);font:14px/1.55 var(--font);pointer-events:none;z-index:7;display:none";
  guide.innerHTML = `<b style="font-size:16px;font-weight:normal">🎣 힘겨루기 요령</b><br>① <b>쉴 때</b>는 ${ctx.isTouch ? "발사 단추" : "마우스(또는 Space)"}를 <b>꾹 눌러 감고</b>, 화면이 주황으로 번쩍이며 <b>✋ 놓아요!</b>가 뜨면(돌진) <b>손을 떼서 풀어</b> 주세요. 계속 감으면 안쪽 고리(장력)가 빨개지며 줄이 끊어져요. 바깥 노란 고리가 가득 차면 지친 거예요.<br>② (전설·신화) <b>⚖ 띠 안에 유지</b>: 안쪽 고리를 두 점선 고리 사이에 일정 시간 두세요. 누르면 커지고 떼면 작아져요.<br>③ (신화) <b>♪ 박자</b>: 바깥에서 모여드는 링이 안쪽 고리에 닿는 순간에 세 번 눌러요.`;
  const edge = document.createElement("div");
  edge.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .12s";
  // 잡았을 때: 낚시 방의 결과 카드를 작게 줄인 것. 누를 필요 없이 잠깐 떴다 사라져서 바로 다음 물고기를 노릴 수 있다
  const card = document.createElement("div");
  card.style.cssText = "position:fixed;left:50%;top:9%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:8px 18px 8px 10px;border-radius:22px;background:var(--paper);border:3px solid #fff;outline:3px solid rgba(74,59,82,.12);box-shadow:var(--shadow);color:var(--ink);pointer-events:none;z-index:7;opacity:0;transition:opacity .35s;width:max-content;max-width:92vw;box-sizing:border-box";
  const cardIcon = document.createElement("div"), cardText = document.createElement("div");
  cardIcon.style.cssText = "width:72px;height:72px;flex:none;display:grid;place-items:center;font-size:44px";
  card.append(cardIcon, cardText);
  const cardRoot = createRoot(cardIcon);
  let cardUntil = 0;
  const showCatch = (name: string, cm: number, isNew: boolean) => {
    const sp = UW_FISH.find((x) => x.name === name);
    cardRoot.render(sp ? createElement(FishIcon, { sp, size: 72, key: sp.id }) : "🐚"); // key: 종이 바뀌면 앞 물고기의 그림이 남지 않게 새로 그린다
    cardText.replaceChildren();
    if (isNew) { const n = document.createElement("div"); n.textContent = "✨ 새로운 발견! 도감에 등록됐어요"; n.style.cssText = "color:var(--danger);font-size:14px"; cardText.append(n); }
    const nm = document.createElement("div"); nm.textContent = name; nm.style.cssText = "font-size:22px;line-height:1.2";
    const meta = document.createElement("div"); meta.style.cssText = "display:flex;gap:6px;align-items:center;margin-top:3px";
    if (sp) { const bd = document.createElement("span"); bd.className = "badge"; bd.textContent = RARITY_LABEL[sp.rarity]; bd.style.background = RARITY_COLOR[sp.rarity]; meta.append(bd); }
    const size = document.createElement("span"); size.textContent = `📏 ${cm}cm`; size.style.fontSize = "15px"; meta.append(size);
    cardText.append(nm, meta);
    card.style.borderColor = sp ? RARITY_COLOR[sp.rarity] : "#fff";
    card.style.opacity = "1"; cardUntil = performance.now() + 2600;
  };
  document.body.append(card);
  document.body.append(cross, toast, prompt, gauge, edge, cue, guide);
  let toastUntil = 0, guideUntil = 0;
  const say = (text: string, ms = 1800) => { toast.textContent = text; toast.style.opacity = "1"; toastUntil = performance.now() + ms; };

  let throwBtn: HTMLButtonElement | null = null, gatherBtn: HTMLButtonElement | null = null;
  if (ctx.isTouch) {
    const mk = (label: string, size: number, right: number, bottom: number, color: string) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = `position:fixed;right:${right}px;bottom:${bottom}px;width:${size}px;height:${size}px;border-radius:50%;border:0;background:var(--${color});box-shadow:0 5px 0 var(--${color}-deep);color:var(--ink);font:${size > 70 ? 20 : 16}px var(--font);z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;display:none`;
      document.body.append(b);
      return b;
    };
    throwBtn = mk("발사", 76, 100, 106, "pink");
    gatherBtn = mk("줍기", 64, 108, 196, "mint");
    throwBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); throwNow(); });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) throwBtn.addEventListener(ev, () => setReel(false));
    gatherBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); gather(); });
  }

  // ---- 작살총: 손에 들고 있는 모습(장전된 작살이 앞으로 나와 있다) -----------------------
  const gun = new THREE.Group();
  let gunFx = buildHarpoonGun(0), loaded = gunFx.loaded;
  gun.add(gunFx.group);
  /** 강화 단계가 바뀌면 그 단계의 모양으로 바꾼다 */
  const setGun = (level: number) => { gun.remove(gunFx.group); gunFx = buildHarpoonGun(level); loaded = gunFx.loaded; gun.add(gunFx.group); };
  gun.visible = false;
  scene.add(gun);
  const MUZZLE = V(0, 0.02, 1.35);
  const muzzle = () => gun.localToWorld(MUZZLE.clone());

  // ---- 날아가는 작살과 줄 -----------------------------------------------------------
  const shaftGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), tipGeo = new THREE.ConeGeometry(0.18, 0.5, 6), ropeGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5);
  const spearMat = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false }), tipMat = new THREE.MeshBasicMaterial({ color: "#ffb52e", fog: false });
  const ropeMat = new THREE.MeshBasicMaterial({ color: "#f4f4f4", transparent: true, opacity: 0.85 });
  const stretch = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
    const d = b.clone().sub(a), len = d.length();
    m.visible = len > 0.05;
    if (!m.visible) return;
    m.position.copy(a).addScaledVector(d, 0.5);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
  };
  function spawnSpear(o: THREE.Vector3, d: THREE.Vector3, end: number, sid: string, mine: boolean, spd: number, flight: number, hit = false, fid = ""): Spear {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(shaftGeo, spearMat), tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 1.35;
    g.add(shaft, tip);
    g.quaternion.setFromUnitVectors(Y, d);
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    scene.add(g, rope);
    const s: Spear = { mesh: g, rope, o, d, t0: T, end, hit, fid, sid, mine, spd, flight, state: "fly", st: 0, from: V(), dur: 1 };
    spears.push(s);
    return s;
  }
  const endSpear = (s: Spear, i: number) => { scene.remove(s.mesh, s.rope); spears.splice(i, 1); if (mySpear === s) mySpear = null; };
  /** 쏜 사람 쪽 줄의 끝: 나는 총구, 다른 사람은 그 사람 가슴께 */
  const shooterEnd = (s: Spear) => {
    if (s.mine) return muzzle();
    const p = ctx.posOf(s.sid);
    return p ? p.clone().add(V(0, 1.3, 0)).addScaledVector(s.d, 0.9) : s.o.clone();
  };

  // ---- 물방울(발사·명중·끌려오는 물고기) --------------------------------------------------
  const N = 160;
  const bGeo = new THREE.BufferGeometry(), bPos = new Float32Array(N * 3).fill(1e6), bVel = new Float32Array(N * 3), bLife = new Float32Array(N);
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  const bubbles = new THREE.Points(bGeo, new THREE.PointsMaterial({ color: "#eafcff", size: 0.34, transparent: true, opacity: 0.9, depthWrite: false }));
  bubbles.frustumCulled = false;
  scene.add(bubbles);
  let bi = 0;
  function burst(p: THREE.Vector3, n: number, speed: number) {
    for (let k = 0; k < n; k++) {
      bi = (bi + 1) % N;
      bPos.set([p.x, p.y, p.z], bi * 3);
      bVel.set([(Math.random() - 0.5) * speed, (Math.random() - 0.3) * speed, (Math.random() - 0.5) * speed], bi * 3);
      bLife[bi] = 0.5 + Math.random() * 0.7;
    }
  }

  // ---- 서버와 주고받기 -----------------------------------------------------------
  function attach(r: Room<any>) {
    room = r;
    mySid = r.sessionId;
    bestRtt = Infinity;
    pingT = 0;
    r.onMessage("pong", (m: { c: number; s: number }) => {
      const rtt = Date.now() - m.c;
      if (rtt < bestRtt) { bestRtt = rtt; off = m.s + rtt / 2 - Date.now(); }
    });
    r.onMessage("spear", (m: { sid: string; ox: number; oy: number; oz: number; dx: number; dy: number; dz: number; tau: number; hit: boolean; fid: string; spd: number; rng: number }) => {
      if (m.sid === mySid && mySpear) { // 내 작살은 쏠 때 이미 그렸다: 어디서 끝나는지만 알려 준다
        mySpear.end = m.hit ? m.tau : mySpear.flight; mySpear.hit = m.hit; mySpear.fid = m.fid; mySpear = null;
        return;
      }
      if (m.sid === mySid) return;
      const o = V(m.ox, m.oy, m.oz);
      spawnSpear(o, V(m.dx, m.dy, m.dz), m.hit ? m.tau : m.rng / m.spd, m.sid, false, m.spd, m.rng / m.spd, m.hit, m.fid);
      burst(o, 6, 2);
    });
    r.onMessage("caught", (m: { sid: string; by: string; name: string; cm: number; fid: string }) => {
      if (tug?.fid === m.fid) tug = null;
      const s = spears.find((q) => q.fid === m.fid && q.fid !== "");
      const info = { name: m.name, cm: m.cm, by: m.by, fid: m.fid };
      if (!s) { finishCatch(m.sid, info); return; } // 작살이 이미 사라졌다: 결과만 알린다
      s.caught = info;
      if (s.state === "stuck") startReel(s);
    });
    r.onMessage("chest", (m: { kind: string; coins: number; stones: number; baitId: string; bait: number }) => {
      const got = [m.coins ? `🪙 ${m.coins}` : "", m.stones ? `💎 ${m.stones}` : "", m.bait ? `${BAIT_NAME[m.baitId] ?? "미끼"} ${m.bait}개` : ""].filter(Boolean).join(" · ");
      say(got ? `${m.kind} 상자! ${got}` : `${m.kind} 상자는 텅 비어 있었어요…`, 2600);
      if (chestAt) burst(chestAt, 24, 5);
    });
    r.onMessage("tug", (m: UwTug & { fid: string }) => {
      if (!spears.some((s) => s.fid === m.fid && s.mine)) return; // 내가 쏜 물고기의 힘겨루기만 내 것이다
      tug = { fid: m.fid, p: m, t0: performance.now(), tire: 0, ten: 0, phase: "rest", soon: false, band: null, hold: 0, beats: null, beatI: 0 };
      let seen = false; try { seen = !!localStorage.getItem("uwTugGuide3"); localStorage.setItem("uwTugGuide3", "1"); } catch { /* 저장소를 못 쓰면 매번 보여 준다 */ }
      if (!seen) { guide.style.display = "block"; guideUntil = performance.now() + 14000; } else say("맞았다! 꾹 눌러 감아요!", 1500);
    });
    r.onMessage("tugst", (m: { fid: string; tire: number; ten: number; phase: "rest" | "run" | "hold" | "beat"; soon: boolean; band: [number, number] | null; hold: number; beats: number[] | null; beatI: number }) => {
      if (!tug || tug.fid !== m.fid) return;
      if (m.phase !== tug.phase) {
        if (m.phase === "hold") { say("지쳤어요! 장력을 띠 안에 유지해요!", 1600); setReel(false); }
        else if (m.phase === "beat") { say("마지막! 박자에 맞춰 눌러요!", 1600); setReel(false); }
      }
      tug.tire = m.tire; tug.ten = m.ten; tug.phase = m.phase; tug.soon = m.soon; tug.band = m.band; tug.hold = m.hold; tug.beats = m.beats; tug.beatI = m.beatI;
    });
    r.onMessage("beatres", (m: { r: string }) => { if (m.r === "hit") say("♪ 좋아요!", 600); else if (m.r === "miss") say("너무 일렀어요! 처음부터", 1100); });
    r.onMessage("escaped", (m: { fid: string; sid: string }) => {
      if (tug?.fid === m.fid) tug = null;
      const s = spears.find((q) => q.fid === m.fid);
      if (s) { if (s.view) s.view.hooked = false; if (s.mine) say("줄이 끊어졌어요… 놓쳤어요", 1800); s.state = "sink"; s.st = T; }
    });
    r.onMessage("boss", (m: { text: string }) => say(m.text, 4500));
    r.onMessage("bosshit", (m: { sid: string; weak: boolean }) => {
      if (m.sid === mySid) say(m.weak ? "💥 약점 명중!!" : "명중!", 900);
      const b = room?.state?.boss as BossState | undefined;
      if (b && m.weak) burst(weakMark.position.clone(), 26, 6);
    });
    r.onMessage("bossend", (m: { rank: number; total: number; coins: number; stones: number; title: string }) => say(`🏆 보스 격파! ${m.rank}위/${m.total}명 · 🪙 ${m.coins} 💎 ${m.stones} · 칭호「${m.title}」`, 7000));
    r.onMessage("newfish", (m: { fid: string }) => { newFish.add(m.fid); });
    r.onMessage("gathered", (m: { kind: string; cm: number; isNew: boolean }) => { showCatch(m.kind, m.cm, m.isNew); });
  }

  function finishCatch(sid: string, c: { name: string; cm: number; by: string; fid: string }) {
    if (sid === mySid) { showCatch(c.name, c.cm, newFish.delete(c.fid)); }
    else ctx.say(`${c.by}님이 ${c.name} ${c.cm}cm를 잡았어요`);
  }

  function startReel(s: Spear) {
    if (!s.view || !s.caught) return;
    s.state = "reel"; s.st = T;
    s.view.reeling = true;
    s.from = s.view.root.position.clone();
    s.dur = Math.min(1.3, Math.max(0.55, s.from.distanceTo(shooterEnd(s)) / 22));
  }

  const ray = new THREE.Raycaster();
  const huntable = () => !!room && HUNT_ZONES.includes(ctx.zone());

  function throwNow() {
    if (tug) { if (tug.phase === "beat") room?.send("beat", { at: serverNow() }); else setReel(true); return; } // 힘겨루기 중에는 쏘기 대신 줄을 감는다(박자 단계에서는 박자에 맞춰 누른다)
    if (!room || !huntable() || ctx.blocked() || cool > 0) return;
    ray.setFromCamera(wob, camera);
    // 십자선이 물고기에 겹쳐 있으면 그 물고기까지의 거리를 겨냥 거리로 쓴다(카메라와 손의 위치 차이로 어긋나지 않게). 아니면 멀리 겨냥한다
    let aimDist = 45, best = Infinity;
    for (const v of views.values()) {
      if (!v.root.visible || v.hooked) continue;
      const along = v.root.position.clone().sub(ray.ray.origin).dot(ray.ray.direction);
      if (along > 1 && along < best && ray.ray.distanceSqToPoint(v.root.position) <= (uwHitRadius(v.len) + 0.4) ** 2) { best = along; aimDist = along; }
    }
    const aim = ray.ray.origin.clone().addScaledVector(ray.ray.direction, aimDist);
    const o = muzzle();
    const d = aim.sub(o).normalize();
    room.send("throw", { ox: o.x, oy: o.y, oz: o.z, dx: d.x, dy: d.y, dz: d.z, at: serverNow() });
    mySpear = spawnSpear(o, d, stats.range / stats.speed, mySid, true, stats.speed, stats.range / stats.speed);
    burst(o, 10, 3);
    cool = stats.cooldownMs / 1000;
    kick = 1;
  }

  function setReel(on: boolean) {
    if (on && !tug) return;
    if (reelOn === on) return;
    reelOn = on;
    room?.send("reel", { on });
  }

  function gather() {
    if (!room || ctx.blocked()) return;
    if (nearChest) { chestAt = chestMeshes.get(nearChest)?.position.clone().add(V(0, 0.5, 0)) ?? null; room.send("open", { id: nearChest }); }
    else if (nearShell) room.send("gather", { id: nearShell });
  }

  window.addEventListener("keyup", (e) => { if (e.key === " ") setReel(false); });
  window.addEventListener("blur", () => setReel(false));
  document.addEventListener("mouseup", (e) => { if (e.button === 0) setReel(false); });
  window.addEventListener("keydown", (e) => { if (e.key === " " && !e.repeat && tug) throwNow(); if (e.key.toLowerCase() === "e" && !e.repeat && !e.ctrlKey && !e.metaKey) gather(); });
  document.addEventListener("mousedown", (e) => {
    if (e.button === 0 && ctx.aiming() && (e.target as HTMLElement)?.tagName === "CANVAS") throwNow();
  });

  // ---- 매 프레임 -----------------------------------------------------------------
  function syncFish(zone: number, now: number, t: number) {
    const live = new Set<string>();
    (room?.state?.fish as Map<string, FishState> | undefined)?.forEach((f, id) => {
      live.add(id);
      if (f.zone !== zone) return; // 다른 구역 물고기는 그리지 않는다(만들지도 않는다)
      let v = views.get(id);
      if (!v) {
        const sp = UW_FISH.find((s) => s.id === f.sp);
        if (!sp) return;
        const len = uwLength(f.cm), m = ctx.makeFish(sp, len);
        try { ctx.flatten(m.fish); } catch { /* 부품을 합치지 못하는 모델은 그대로 쓴다 */ }
        scene.add(m.root);
        v = { root: m.root, fish: m.fish, len, hooked: false, reeling: false };
        views.set(id, v);
      }
      if (v.reeling) return;
      const p = pathOf(f), pos = huntPos(p, now);
      v.root.position.set(pos.x, Math.min(-3, pos.y), pos.z);
      v.root.rotation.y = -huntHeading(p, now);
      v.root.visible = f.zone === zone && v.root.position.distanceTo(camera.position) < 120;
      if (v.root.visible) (v.fish.userData.update as ((t: number) => void) | undefined)?.(t * 2 + Number(id) + (v.hooked ? t * 6 : 0)); // 작살에 맞으면 퍼덕인다
    });
    // 서버에서 사라진 물고기도, 그것을 향해 날아가는 작살이 있으면 닿을 때까지 남겨 둔다(끌려오는 모습을 보여 주려고)
    for (const [id, v] of views) if (id !== "boss" && (!live.has(id) || (room?.state?.fish?.get(id)?.zone ?? zone) !== zone) && !v.hooked && !spears.some((s) => s.fid === id)) { scene.remove(v.root); views.delete(id); }
  }

  function syncShells(zone: number, t: number) {
    const live = new Set<string>();
    let nearest = "", nd = 3.6;
    (room?.state?.shells as Map<string, ShellState> | undefined)?.forEach((s, id) => {
      live.add(id);
      let g = shellMeshes.get(id);
      if (!g) {
        const made = buildShell(s.kind);
        g = made.group;
        made.spark.position.y = 1.3;
        g.userData.glow = made.spark;
        g.position.set(s.x, ctx.heightAt(s.x, s.z) + 0.05, s.z);
        g.rotation.y = (Number(id) * 2.3) % 6.28;
        scene.add(g);
        shellMeshes.set(id, g);
      }
      g.visible = s.zone === zone;
      const sg = g.userData.glow as THREE.Object3D;
      sg.position.y = 1.3 + Math.sin(t * 2 + Number(id)) * 0.12; sg.rotation.y = t * 1.5;
      const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z);
      if (g.visible && d < nd) { nd = d; nearest = id; }
    });
    for (const [id, g] of shellMeshes) if (!live.has(id)) { scene.remove(g); shellMeshes.delete(id); }
    nearShell = nearest;
  }

  function syncChests(zone: number, t: number) {
    const live = new Set<string>();
    let nearest = "", nd = 4.2;
    (room?.state?.chests as Map<string, ChestState> | undefined)?.forEach((c, id) => {
      live.add(id);
      let g = chestMeshes.get(id);
      if (!g) {
        const made = buildChest(c.kind);
        g = made.group;
        made.glow.position.y = 2.0;
        g.userData.glow = made.glow;
        g.position.set(c.x, ctx.heightAt(c.x, c.z) + 0.05, c.z);
        g.rotation.y = (Number(id) * 1.7) % 6.28;
        scene.add(g);
        chestMeshes.set(id, g);
      }
      g.visible = c.zone === zone;
      const cg = g.userData.glow as THREE.Object3D;
      cg.position.y = 2.0 + Math.sin(t * 2 + Number(id)) * 0.15; cg.rotation.y = t * 1.5;
      const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z);
      if (g.visible && d < nd) { nd = d; nearest = id; }
    });
    for (const [id, g] of chestMeshes) if (!live.has(id)) { scene.remove(g); chestMeshes.delete(id); }
    nearChest = nearest;
  }

  function syncBoss(zone: number, now: number, t: number) {
    const b = room?.state?.boss as BossState | undefined;
    const old = views.get("boss");
    if (!b || b.zone !== zone) { // 없거나 다른 구역에 있다
      if (old) { scene.remove(old.root); views.delete("boss"); }
      weakMark.visible = false;
      bossBar.style.display = "none";
      return;
    }
    let v = old;
    if (!v) {
      const base = SPECIES.find((s) => s.name === BOSS_NAMES[b.zone]?.base) ?? SPECIES.find((s) => s.body === "whale")!;
      const m = ctx.makeFish(base, BOSS.len);
      ctx.flatten(m.fish);
      scene.add(m.root);
      v = { root: m.root, fish: m.fish, len: BOSS.len, hooked: false, reeling: false };
      views.set("boss", v);
    }
    const p = pathOf(b as unknown as FishState), pos = huntPos(p, now);
    v.root.position.set(pos.x, Math.min(-4, pos.y), pos.z);
    v.root.rotation.y = -huntHeading(p, now);
    (v.fish.userData.update as ((t: number) => void) | undefined)?.(t * 1.2);
    const showWeak = b.wUntil > now && b.hp > 0;
    weakMark.visible = showWeak;
    if (showWeak) { weakMark.position.set(pos.x + b.wx, pos.y + b.wy, pos.z + b.wz); weakMark.scale.setScalar(1 + 0.25 * Math.sin(t * 9)); weakMark.lookAt(camera.position); }
    bossBar.style.display = "block";
    bossBar.querySelector("#bossName")!.textContent = `🐋 ${b.name}  (남은 시간 ${Math.max(0, Math.round((b.until - now) / 60000))}분)`;
    (bossBar.querySelector("#bossHp") as HTMLElement).style.width = `${Math.max(0, b.hp / BOSS.hp) * 100}%`;
  }

  function updateSpears(dt: number, zone: number) {
    for (let i = spears.length - 1; i >= 0; i--) {
      const s = spears[i], e = T - s.t0;
      const rope = (to: THREE.Vector3) => stretch(s.rope, shooterEnd(s), to);
      s.mesh.visible = s.rope.visible = ctx.zone() === zone;
      if (s.state === "fly") {
        const tail = s.o.clone().addScaledVector(s.d, s.spd * Math.min(e, s.end));
        s.mesh.position.copy(tail);
        rope(tail);
        burst(tail, 1, 0.6); // 날아가는 길에 물방울이 남는다
        if (e >= s.end) {
          const view = s.hit ? [...views.entries()].find(([id]) => id === s.fid)?.[1] : undefined;
          if (view) { // 맞았다: 작살이 물고기에 박힌다
            s.state = "stuck"; s.st = T; s.view = view; if (s.fid !== "boss") view.hooked = true;
            burst(view.root.position, 18, 5);
            if (s.mine) say("명중!", 900);
            if (s.caught) startReel(s);
          } else if (s.hit) endSpear(s, i); // 맞았다고 했는데 그 물고기가 없다(다른 구역 등)
          else { s.state = "sink"; s.st = T; burst(tail, 8, 2); if (s.mine) say("빗나갔어요", 900); }
        }
      } else if (s.state === "stuck" && s.view) {
        s.mesh.position.copy(s.view.root.position);
        rope(s.view.root.position);
        if (s.fid === "boss" ? T - s.st > 0.5 : T - s.st > 3 && tug?.fid !== s.fid) { s.view.hooked = false; endSpear(s, i); } // 잡았다는 소식이 안 오면 놓아 준다
      } else if (s.state === "reel" && s.view) {
        const k = Math.min(1, (T - s.st) / s.dur), a = k * k, to = shooterEnd(s);
        s.view.root.position.lerpVectors(s.from, to, a);
        s.view.root.scale.setScalar(1 - 0.35 * a);
        s.view.root.visible = true;
        (s.view.fish.userData.update as ((t: number) => void) | undefined)?.(T * 14); // 몸부림친다
        s.mesh.position.copy(s.view.root.position);
        rope(s.view.root.position);
        burst(s.view.root.position, 1, 1.2);
        if (k >= 1) {
          burst(to, 20, 4);
          scene.remove(s.view.root);
          for (const [id, v] of views) if (v === s.view) views.delete(id);
          finishCatch(s.sid, s.caught!);
          endSpear(s, i);
        }
      } else if (s.state === "sink") {
        s.mesh.position.y -= dt * 2;
        rope(s.mesh.position);
        if (T - s.st > 0.7) endSpear(s, i);
      } else endSpear(s, i);
    }
  }

  function update(dt: number, t: number) {
    T = t;
    const zone = ctx.zone(), cur = ctx.room();
    if (cur !== room) { // 채널을 옮기거나 떠났다: 그리던 것을 치우고 새 채널에 붙는다
      for (const v of views.values()) scene.remove(v.root);
      for (const g of shellMeshes.values()) scene.remove(g);
      for (const g of chestMeshes.values()) scene.remove(g);
      chestMeshes.clear();
      for (const s of spears) scene.remove(s.mesh, s.rope);
      views.clear(); shellMeshes.clear(); spears.length = 0; mySpear = null; weakMark.visible = false; bossBar.style.display = "none";
      room = null; nearShell = ""; nearChest = "";
      if (cur) attach(cur);
    }
    if (room && (pingT -= dt) <= 0) { pingT = bestRtt === Infinity ? 1 : 10; room.send("ping", { c: Date.now() }); }
    const now = serverNow();
    if (room) { syncFish(zone, now, t); syncShells(zone, t); syncChests(zone, t); syncBoss(zone, now, t); }
    updateSpears(dt, zone);
    cool = Math.max(0, cool - dt);
    if (tug && performance.now() - tug.t0 > tug.p.durationMs + 1500) tug = null; // 서버 결과가 안 오면 접는다
    if (!tug && reelOn) { reelOn = false; room?.send("reel", { on: false }); }
    gauge.style.display = tug ? "block" : "none";
    const run = tug?.phase === "run", holdOn = tug?.phase === "hold", beatOn = tug?.phase === "beat";
    const q = (id: string) => gauge.querySelector<HTMLElement>("#" + id)!;
    if (tug) {
      const pr = q("tugProg"), tn = q("tugTen"), b0 = q("tugBand0"), b1 = q("tugBand1"), br = q("tugBeat");
      const k = performance.now() / 1000, hot = tug.ten > 0.8, mid = tug.ten > 0.55, pulse = hot ? 1 + 0.08 * Math.sin(k * 22) : 1;
      const sc = (x: number) => 0.55 + Math.min(1, x) * 0.7; // 장력 → 고리 크기
      const inBand = holdOn && !!tug.band && tug.ten >= tug.band[0] && tug.ten <= tug.band[1];
      // 바깥 고리: 지친 정도(노랑) → 버티기 진행(연두) → 박자 진행(노랑)
      const frac = holdOn ? tug.hold : beatOn ? tug.beatI / Math.max(1, tug.beats?.length ?? 3) : tug.tire;
      pr.style.background = `conic-gradient(${holdOn ? "#b6ff5c" : "#ffd23f"} ${Math.max(0, Math.min(1, frac)) * 360}deg, rgba(10,25,50,.55) 0)`;
      tn.style.borderColor = inBand ? "#b6ff5c" : hot ? "#ff3d3d" : mid ? "#ff9f1c" : "#ffffff"; // 안쪽 고리: 장력(하양 → 주황 → 빨강, 띠 안이면 연두)
      tn.style.transform = beatOn ? "scale(1)" : `scale(${sc(tug.ten) * pulse})`;
      b0.style.display = b1.style.display = holdOn && tug.band ? "block" : "none"; // 목표 띠: 안쪽 고리가 이 두 점선 고리 사이에 있어야 한다
      if (holdOn && tug.band) { b0.style.transform = `scale(${sc(tug.band[0])})`; b1.style.transform = `scale(${sc(tug.band[1])})`; }
      br.style.display = beatOn && tug.beats && tug.beatI < tug.beats.length ? "block" : "none"; // 박자 링: 안쪽 고리로 모이는 순간이 박자
      if (beatOn && tug.beats && tug.beatI < tug.beats.length) { const d = (tug.beats[tug.beatI] - serverNow()) / 800; br.style.transform = `scale(${1 + 1.6 * Math.max(0, Math.min(1, d))})`; br.style.opacity = d < -0.25 ? "0.3" : "1"; }
      gauge.style.transform = run && reelOn ? `translate(${(Math.random() - 0.5) * 8}px,${(Math.random() - 0.5) * 8}px)` : ""; // 돌진 때 감고 있으면 고리가 떨린다
      // 가장자리 빛: 돌진은 주황(감고 있으면 붉게), 곧 돌진은 노랑 깜빡, 띠 안이면 연두, 박자 단계는 금빛
      if (run && reelOn) { edge.style.boxShadow = "inset 0 0 160px 55px rgba(255,40,40,.95)"; edge.style.opacity = String(0.7 + 0.3 * Math.sin(k * 14)); }
      else if (run) { edge.style.boxShadow = "inset 0 0 130px 35px rgba(255,150,40,.85)"; edge.style.opacity = String(0.5 + 0.2 * Math.sin(k * 9)); }
      else if (tug.soon) { edge.style.boxShadow = "inset 0 0 120px 30px rgba(255,200,60,.9)"; edge.style.opacity = String(0.4 + 0.35 * Math.sin(k * 12)); }
      else if (holdOn) { edge.style.boxShadow = hot ? "inset 0 0 100px 25px rgba(255,90,90,.8)" : "inset 0 0 110px 25px rgba(182,255,92,.75)"; edge.style.opacity = hot ? String(0.4 + 0.3 * Math.sin(k * 20)) : inBand ? "0.5" : "0"; }
      else if (beatOn) { edge.style.boxShadow = "inset 0 0 110px 25px rgba(255,230,120,.8)"; edge.style.opacity = String(0.3 + 0.2 * Math.sin(k * 6)); }
      else if (hot) { edge.style.boxShadow = "inset 0 0 100px 20px rgba(255,90,90,.7)"; edge.style.opacity = String(0.25 + 0.2 * Math.sin(k * 20)); }
      else edge.style.opacity = "0";
    } else edge.style.opacity = "0";
    if (guideUntil && performance.now() > guideUntil) { guide.style.display = "none"; guideUntil = 0; }
    // 큰 신호(짧은 글자)
    const showCue = !!tug && (run || holdOn || beatOn || tug.soon);
    cue.style.display = showCue ? "block" : "none";
    if (tug && showCue) {
      cue.textContent = beatOn ? `♪ 박자에 맞춰 눌러요! ${"●".repeat(tug.beatI)}${"○".repeat(Math.max(0, (tug.beats?.length ?? 3) - tug.beatI))}` : holdOn ? "⚖ 띠 안에 유지해요!" : run ? "✋ 놓아요!" : "⚠ 곧 돌진!";
      cue.style.color = holdOn || beatOn ? "#fff3b0" : "#fff";
      cue.style.transform = `translateX(-50%) scale(${1 + (run ? 0.1 : 0.04) * Math.sin(performance.now() / 70)})`;
    }
    const hv = tug ? views.get(tug.fid) : undefined; // 돌진 중에는 걸린 물고기가 조금 퍼덕인다
    if (hv) hv.fish.rotation.z = run ? Math.sin(performance.now() / 40) * 0.12 : 0;
    kick = Math.max(0, kick - dt * 5);
    shoulder += ((huntable() && !ctx.firstPerson() ? 1 : 0) - shoulder) * Math.min(1, dt * 5);
    loaded.visible = cool < 0.25; // 쏘고 나면 작살이 비었다가, 다시 장전된다
    if (gun.visible) gunFx.update(t);

    // 조준 흔들림: 이동 중에는 크고, 가만히 있으면 작다
    const live = huntable();
    if (live !== wasOn) { // 사냥 구역에 들어서면 1인칭으로 바꾼다(조준하기 쉽다). 나가면 원래 시점으로. V 로 언제든 바꿀 수 있다
      wasOn = live;
      if (live) { prevFp = ctx.firstPerson(); ctx.setFirstPerson(true); } else ctx.setFirstPerson(prevFp);
    }
    const moving = player.vel.length() > 1.5;
    wobAmp += ((moving ? 0.075 : 0.04) * stats.steady - wobAmp) * Math.min(1, dt * 4);
    wob.set((Math.sin(t * 1.7) + 0.6 * Math.sin(t * 3.9 + 1)) * wobAmp * 0.62, (Math.cos(t * 1.3) + 0.5 * Math.sin(t * 3.1 + 2)) * wobAmp * 0.66);

    for (let i = 0; i < N; i++) { // 물방울
      if (bLife[i] <= 0) { bPos[i * 3 + 1] = 1e6; continue; }
      bLife[i] -= dt;
      bVel[i * 3 + 1] += dt * 1.2;
      for (let k = 0; k < 3; k++) bPos[i * 3 + k] += bVel[i * 3 + k] * dt;
    }
    bGeo.attributes.position.needsUpdate = true;

    const on = huntable() && !ctx.blocked();
    cross.style.display = on ? "block" : "none";
    if (on) {
      cross.style.transform = `translate(${innerWidth / 2 + (wob.x * innerWidth) / 2}px,${innerHeight / 2 - (wob.y * innerHeight) / 2}px)`;
      cross.style.opacity = cool > 0 ? "0.35" : "1";
      cross.style.borderColor = cool > 0 ? "#9fb4c0" : "#fff";
    }
    const showPrompt = huntable() && !!(nearChest || nearShell) && !ctx.blocked();
    prompt.textContent = nearChest ? PROMPT_CHEST : PROMPT_SHELL;
    prompt.style.display = showPrompt && !ctx.isTouch ? "block" : "none";
    if (throwBtn) throwBtn.style.display = on ? "block" : "none";
    if (gatherBtn) gatherBtn.style.display = showPrompt ? "block" : "none";
    if (toastUntil && performance.now() > toastUntil) { toast.style.opacity = "0"; toastUntil = 0; }
    if (cardUntil && performance.now() > cardUntil) { card.style.opacity = "0"; cardUntil = 0; }
  }

  /** 카메라 위치가 정해진 뒤에 부른다: 손에 든 작살총을 카메라와 십자선에 맞춰 놓는다 */
  function late() {
    if (tug?.phase === "run" && reelOn) { // 돌진 중에 계속 감고 있으면 화면이 흔들린다(손을 떼라는 신호)
      const a = 0.09;
      camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; camera.position.z += (Math.random() - 0.5) * a;
    }
    gun.visible = huntable();
    if (!gun.visible) return;
    camera.updateMatrixWorld();
    ray.setFromCamera(wob, camera);
    const aim = ray.ray.origin.clone().addScaledVector(ray.ray.direction, 45);
    const hl = ctx.hand("L", handA), hr = ctx.hand("R", handB);
    if (ctx.firstPerson()) {
      gun.scale.setScalar(0.4);
      gun.position.copy(camera.localToWorld(V(0.22, -0.27, -1.0)));
    } else if (hl && hr) { // 캐릭터의 두 손 사이에 총을 놓는다(손은 겨누는 방향으로 든 팔 끝에 있다)
      gun.scale.setScalar(1.05);
      gun.position.copy(hr).lerp(hl, 0.2); // 오른손 쪽에 치우쳐 잡는다: 뒤에서 볼 때 몸에 가려지지 않는다
    } else {
      gun.scale.setScalar(0.85);
      gun.position.copy(player.pos).add(V(0, 1.2, 0)).addScaledVector(ray.ray.direction.clone().setY(0).normalize(), 0.7);
    }
    const back = aim.clone().sub(gun.position).normalize();
    aimPitch = Math.asin(Math.max(-1, Math.min(1, back.y)));
    gun.position.addScaledVector(back, -0.3 * kick); // 쏠 때 뒤로 밀린다
    gun.lookAt(aim);
    ctx.setYaw(Math.atan2(back.x, back.z)); // 캐릭터는 늘 겨누는 쪽을 본다
    gun.updateMatrixWorld();
  }

  return { setLevel: (l: number) => { stats = harpoonStats(l); setGun(l); }, showCatch, say, update, late, throwNow, views, spears, gun, shoulder: () => shoulder, aimPose: () => (gun.visible ? { pitch: aimPitch } : undefined) }; // 뒤의 둘은 확인용(__dbg)
}
