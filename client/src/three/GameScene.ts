import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Room } from "colyseus.js";
import { BASE_MAPS, speciesById } from "@fishing/shared";
import type { MapDef, MapId } from "@fishing/shared";
import { CharacterRig } from "./character";
import type { Look } from "./character";
import { clamp, createEngine } from "./engine";
import type { Engine } from "./engine";
import { asSilhouette, bodyBox, buildFish } from "./fishModel";
import { buildWorld } from "./world";
import type { World } from "./world";

type Handler = (data: any) => void;

/** 화면(React)과 3D 장면이 서로 알리는 통로 */
export class Bus {
  private map = new Map<string, Set<Handler>>();
  on(type: string, fn: Handler) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type)!.add(fn);
    return () => this.map.get(type)!.delete(fn);
  }
  emit(type: string, data?: unknown) {
    this.map.get(type)?.forEach((fn) => fn(data));
  }
}

interface CatchAnim {
  fish: THREE.Group;
  t: number;
  from: THREE.Vector3;
  len: number;
  /** 전설·신화: 몸 앞쪽 눈높이에 크게 띄워 보여 준다(len은 몸 크기) */
  big?: boolean;
  notified: boolean;
  done: () => void;
}

interface Peer {
  rig: CharacterRig;
  look: string;
  tag: THREE.Sprite;
  tagText: string;
  bubble: THREE.Sprite | null;
  bubbleUntil: number;
  alert: THREE.Sprite | null;
  line: THREE.Line;
  bobber: THREE.Group;
  prev: THREE.Vector3;
  moving: boolean;
  emoteSeq: number;
  bobPhase: number;
  silhouette: THREE.Group | null;
  /** 입질 전에 찌 주변을 맴도는 물속 그림자 */
  shadow: THREE.Group | null;
  waitT: number;
  catch: CatchAnim | null;
  nibbleIdx: number;
  shadowAngle: number;
  thrashT: number;
}

const SPEED = 6.5;

function textSprite(text: string, opts: { bg: string; fg: string; size: number; sub?: string; subFg?: string; compact?: boolean }) {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = `${opts.size}px 'Jua', 'Malgun Gothic', sans-serif`;
  g.font = font;
  const lines = text.split("\n"); // 줄바꿈은 채팅 말풍선용
  const lineH = opts.size * 1.15;
  const w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width), opts.sub ? g.measureText(opts.sub).width * 0.7 : 0)) + (opts.compact ? 30 : 44);
  const h = Math.round(opts.size + (lines.length - 1) * lineH + (opts.compact ? 16 : 30) + (opts.sub ? 26 : 0));
  c.width = w;
  c.height = h;
  g.font = font;
  g.fillStyle = opts.bg;
  g.beginPath();
  g.roundRect(0, 0, w, h, h / 2.6);
  g.fill();
  g.fillStyle = opts.fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (opts.sub) {
    g.font = `${Math.round(opts.size * 0.62)}px 'Jua', sans-serif`;
    g.fillStyle = opts.subFg ?? "#c2780f";
    g.fillText(opts.sub, w / 2, 20);
    g.font = font;
    g.fillStyle = opts.fg;
    g.fillText(text, w / 2, h / 2 + 12);
  } else lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + 2 + (i - (lines.length - 1) / 2) * lineH));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false, toneMapped: false }));
  const k = 0.012;
  s.scale.set(w * k, h * k, 1);
  s.renderOrder = 20;
  return s;
}

export class GameScene {
  readonly bus = new Bus();
  private engine: Engine;
  private world: World;
  private map: MapDef;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  private peers = new Map<string, Peer>();
  private raf = 0;
  private clock = new THREE.Clock();
  private t = 0;
  private serverOffset = 0;
  private keys = new Set<string>();
  private camYaw = Math.PI;
  private camPitch = 0.42;
  private camDist = 11;
  private camTargetDist = 11;
  private joystick = { x: 0, y: 0 };
  private dragging = false;
  private lastSend = 0;
  private lastSent = { x: 0, z: 0, yaw: 0 };
  private chargeStart = 0;
  private charging = false;
  private pending: { species: string; size: number; payload: any } | null = null;
  private disposers: Array<() => void> = [];
  private phase = "idle";
  private myMinigame = false;
  /** 힘겨루기(연타) 중: E 키도 당기기로 쓴다 */
  private tugging = false;
  private resultAt = -1e9;
  /** 한 번 쓰고 끝나는 연출들. true를 돌려주는 동안 계속 돌아간다 */
  private fx: Array<(dt: number) => boolean> = [];
  private npc: { rig: CharacterRig | null; body: THREE.Group; pos: THREE.Vector3; near: boolean } | null = null;
  private smith: { rig: CharacterRig | null; body: THREE.Group; pos: THREE.Vector3; near: boolean } | null = null;

  constructor(
    private container: HTMLElement,
    private room: Room<any>,
    private mapId: MapId | string,
    private mySession: string,
  ) {
    this.map = BASE_MAPS[mapId as MapId] ?? BASE_MAPS.lake;
    this.engine = createEngine(container, this.scene, this.camera);
    this.world = buildWorld(mapId, this.scene);
    this.buildNpc();
    this.bindInput();
    this.bindRoom();
    this.loop();
  }

  /** NPC 두 명: 상인(판매·상점)과 대장장이(낚싯대 강화). 시작 지점 양옆 작은 가판대에 서 있고, 가까이 가면 "npcNear"·"smithNear"로 알린다 */
  private buildNpc() {
    this.npc = this.makeNpc({ dx: 5.5, dz: -2, name: "상인 아저씨", sub: "🛍️ 판매 · 상점", awning: 0xe0566a, forge: false, hair: 1, hairColor: 2, model: "/models/merchant.glb" });
    this.smith = this.makeNpc({ dx: -5.5, dz: -2, name: "대장장이 영감", sub: "🔨 낚싯대 강화", awning: 0x4a4f5a, forge: true, hair: 2, hairColor: 6, model: "/models/blacksmith.glb", arm: { x: 0.2, y: 0.5, fade: [0.58, 0.62] } });
  }

  private makeNpc(o: { dx: number; dz: number; name: string; sub: string; awning: number; forge: boolean; hair: number; hairColor: number; model?: string; arm?: ArmPose }) {
    const sp = this.map.spawn;
    const pos = new THREE.Vector3(sp.x + o.dx, 0, sp.z + o.dz);
    // model이 있으면 그 3D 모델이 NPC 몸이 되고, 없으면 꾸미기용 캐릭터를 쓴다
    const rig = o.model ? null : new CharacterRig({
      appearance: { eyes: 0, nose: 1, mouth: 0, hair: o.hair, skinColor: 0, hairColor: o.hairColor, eyeColor: 1, body: 1, gender: 1 },
      equipped: { top: "top-hoodie" },
    });
    const root: THREE.Object3D = rig ? rig.root : new THREE.Group();
    root.position.copy(pos);
    this.scene.add(root);
    const tag = textSprite(o.name, { bg: "rgba(74,59,82,0.72)", fg: "#ffffff", size: 28, sub: o.sub, subFg: "#ffd45a", compact: true });
    tag.position.set(0, 3.0 + tag.scale.y / 2, 0);
    root.add(tag);
    const body = new THREE.Group(); // 플레이어 쪽으로 몸을 돌릴 때 이 그룹을 돌린다
    root.add(body);
    if (o.model) {
      new GLTFLoader().loadAsync(o.model).then((g) => {
        lowerArms(g.scene, o.arm);
        const h = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3()).y || 1;
        g.scene.scale.setScalar(2.6 / h); // 플레이어 캐릭터와 비슷한 키
        body.add(g.scene);
      }).catch(() => {});
    }
    // 가판대: 받침 + 차양(대장장이는 돌 받침 위에 모루와 불씨)
    const wood = new THREE.MeshToonMaterial({ color: o.forge ? 0x6a6f7a : 0xb07a45 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.7), wood);
    counter.position.set(pos.x, 0.4, pos.z + 1.2);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 1.6), new THREE.MeshToonMaterial({ color: o.awning }));
    awning.position.set(pos.x, 3.5, pos.z + 0.2);
    awning.rotation.x = 0.18;
    const poles = [-1.4, 1.4].map((dx) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 8), wood);
      m.position.set(pos.x + dx, 1.75, pos.z - 0.5);
      return m;
    });
    this.scene.add(counter, awning, ...poles);
    if (o.forge) {
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.5), new THREE.MeshToonMaterial({ color: 0x2a2d36 }));
      anvil.position.set(pos.x - 0.6, 1.0, pos.z + 1.2);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), new THREE.MeshToonMaterial({ color: 0x2a2d36 }));
      horn.rotation.z = Math.PI / 2;
      horn.position.set(pos.x - 1.15, 1.05, pos.z + 1.2);
      const coal = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.45), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
      coal.position.set(pos.x + 0.7, 0.9, pos.z + 1.2);
      const glow = new THREE.PointLight(0xff8a30, 6, 6);
      glow.position.set(pos.x + 0.7, 1.4, pos.z + 1.2);
      this.scene.add(anvil, horn, coal, glow);
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.45), new THREE.MeshToonMaterial({ color: 0xf2c94c }));
      box.position.set(pos.x - 0.7, 1.02, pos.z + 1.2);
      this.scene.add(box);
    }
    return { rig, body, pos, near: false };
  }

  setServerNow(serverNow: number) {
    this.serverOffset = serverNow - Date.now();
  }
  private now() {
    return Date.now() + this.serverOffset;
  }

  // ---- 입력 ---------------------------------------------------------
  private bindInput() {
    const el = this.engine.renderer.domElement;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || document.querySelector(".modal-back")) return; // 글 쓰는 중이나 창이 떠 있으면 게임 키는 무시
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) this.keys.add(k);
      if (k === " " && !e.repeat) {
        e.preventDefault();
        this.actionDown();
      }
      if (/^[1-5]$/.test(k) && !e.repeat) this.bus.emit("emoteKey", Number(k) - 1);
      if (k === "e" && this.tugging) { if (!e.repeat) this.pull(); } // 꾹 누르기로는 안 되고 직접 연타해야 한다
      else if (k === "e" && !e.repeat && this.smith?.near) this.bus.emit("smithKey", true);
      else if (k === "e" && !e.repeat && this.npc?.near) this.bus.emit("npcKey", true);
      if (k === "escape" || k === "c") this.cancel();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === " ") this.actionUp();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.camTargetDist = clamp(this.camTargetDist + e.deltaY * 0.01, 5, 22);
    };
    let last: { x: number; y: number } | null = null;
    let moved = 0;
    const pdown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      last = { x: e.clientX, y: e.clientY };
      moved = 0;
      this.dragging = e.button === 2;
      if (e.button === 0) this.actionDown();
    };
    const pmove = (e: PointerEvent) => {
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      last = { x: e.clientX, y: e.clientY };
      if (this.dragging || e.pointerType === "touch") {
        this.camYaw -= dx * 0.006;
        this.camPitch = clamp(this.camPitch + dy * 0.005, 0.08, 1.25);
      }
    };
    const pup = (e: PointerEvent) => {
      last = null;
      this.dragging = false;
      if (e.button === 0) this.actionUp();
    };
    const ctx = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", pdown);
    el.addEventListener("pointermove", pmove);
    el.addEventListener("pointerup", pup);
    el.addEventListener("contextmenu", ctx);
    this.disposers.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", pdown);
      el.removeEventListener("pointermove", pmove);
      el.removeEventListener("pointerup", pup);
      el.removeEventListener("contextmenu", ctx);
    });
    void moved;
  }

  /** 모바일 조이스틱이 값을 넣어 준다 (-1 ~ 1) */
  setJoystick(x: number, y: number) {
    this.joystick = { x, y };
  }

  private me() {
    return this.room.state?.players?.get(this.mySession);
  }

  actionDown() {
    const me = this.me();
    if (!me) return;
    if (me.fishing === "idle") {
      // 연타하다가 결과가 뜬 직후의 남은 입력이 곧바로 낚싯대를 던지지 않게 잠깐 막는다
      // (잡는 연출이 끝나기 전과 결과 카드가 떠 있는 동안도 막는다. 카드는 스페이스로 닫히므로 그 키가 던지기로 이어지면 안 된다)
      if (this.peers.get(this.mySession)?.catch || document.querySelector(".catch")) this.resultAt = performance.now(); // 카드를 닫은 직후의 연타도 막으려고 시각을 계속 미룬다
      if (performance.now() - this.resultAt < 900) return;
      this.charging = true;
      this.chargeStart = performance.now();
    } else if (me.fishing === "bite") {
      this.room.send("hook");
    } else if (me.fishing === "minigame") {
      this.pull();
    }
  }

  /** 타이밍 칸 맞추기(reel)와 힘겨루기 당기기는 같은 메시지다 */
  private pull() {
    this.room.send("reel");
    if (this.tugging) this.bus.emit("pulled", 1);
  }

  actionUp() {
    const me = this.me();
    if (!this.charging) return;
    this.charging = false;
    this.bus.emit("charge", 0);
    if (!me || me.fishing !== "idle") return;
    const power = this.chargePower(performance.now());
    this.room.send("cast", { power, yaw: this.camYaw });
    const peer = this.peers.get(this.mySession);
    if (peer) peer.rig.facing = this.camYaw;
  }

  cancel() {
    this.room.send("cancel");
  }

  private chargePower(now: number) {
    const k = ((now - this.chargeStart) / 1100) % 2;
    return k < 1 ? k : 2 - k;
  }

  emote(id: string) {
    this.room.send("emote", { id });
  }

  // ---- 방 이벤트 -----------------------------------------------------
  private bindRoom() {
    const r = this.room;
    r.onMessage("welcome", (m: any) => this.setServerNow(m.serverNow));
    r.onMessage("chat", (m: any) => {
      this.bus.emit("chat", m);
      const peer = this.peers.get(m.sessionId);
      if (peer) this.showBubble(peer, m.text);
    });
    r.onMessage("ranking", (m: any) => this.bus.emit("ranking", m));
    r.onMessage("announce", (m: any) => this.bus.emit("announce", m));
    r.onMessage("chatBlocked", (m: any) => this.bus.emit("toast", m.reason));
    r.onMessage("baitLeft", (m: any) => this.bus.emit("baitLeft", m));
    r.onMessage("castFailed", (m: any) => this.bus.emit("toast", m.reason));
    r.onMessage("bite", (m: any) => {
      this.bus.emit("bite", m);
      const peer = this.peers.get(this.mySession);
      const sp = speciesById(m.speciesId);
      if (peer && sp) this.showSilhouette(peer, sp);
    });
    r.onMessage("minigame", (m: any) => {
      this.myMinigame = true;
      this.bus.emit("minigame", { ...m, startedAt: performance.now() });
    });
    r.onMessage("tug", (m: any) => {
      this.tugging = true;
      this.bus.emit("tug", { ...m, startedAt: performance.now() });
    });
    r.onMessage("result", (m: any) => {
      this.myMinigame = false;
      this.tugging = false;
      this.resultAt = performance.now();
      const peer = this.peers.get(this.mySession);
      if (peer?.silhouette) {
        peer.rig.root.parent?.remove(peer.silhouette);
        this.scene.remove(peer.silhouette);
        peer.silhouette = null;
      }
      if (m.success && peer) this.startCatchAnim(peer, m.catch.speciesId, m.catch.size, () => this.bus.emit("result", m));
      else this.bus.emit("result", m);
    });
    // 다른 사람이 잡은 물고기도 같이 보인다
    r.onMessage("caught", (m: any) => {
      const peer = this.peers.get(m.sessionId);
      if (peer && !peer.catch) this.startCatchAnim(peer, m.speciesId, m.size, () => {});
    });
  }

  private showBubble(peer: Peer, text: string) {
    if (peer.bubble) peer.rig.root.remove(peer.bubble);
    // 14자마다 줄을 바꿔 가로로 너무 길어지지 않게 한다(최대 28자)
    const cut = text.length > 28 ? text.slice(0, 28) + "…" : text;
    const wrapped = cut.length > 14 ? cut.slice(0, 14) + "\n" + cut.slice(14) : cut;
    peer.bubble = textSprite(wrapped, { bg: "rgba(255,255,255,0.95)", fg: "#4a3b52", size: 28 });
    // 닉네임표 바로 위에 아랫변을 맞춰 쌓는다(서로 가리지 않게)
    peer.bubble.center.set(0.5, 0);
    peer.bubble.position.set(0, peer.tag.position.y + peer.tag.scale.y / 2 + 0.1, 0);
    peer.rig.root.add(peer.bubble);
    peer.bubbleUntil = performance.now() + 5000;
  }

  private showSilhouette(peer: Peer, sp: NonNullable<ReturnType<typeof speciesById>>) {
    if (peer.silhouette) this.scene.remove(peer.silhouette);
    const f = buildFish(sp);
    asSilhouette(f, 0.42);
    const sdim = bodyBox(f).getSize(new THREE.Vector3());
    f.scale.setScalar(Math.min(3.2, 4.2 / Math.max(sdim.x, sdim.y, sdim.z, 0.01), Math.max(0.5, (sp.maxSize / 60) * (f.userData.designScale ?? 1) * 0.6)));
    f.userData.sp = sp;
    peer.silhouette = f;
    this.scene.add(f);
  }

  private startCatchAnim(peer: Peer, speciesId: string, size: number, done: () => void) {
    const sp = speciesById(speciesId);
    if (!sp) return done();
    const fish = buildFish(sp);
    const ds = (fish.userData.designScale as number) ?? 1;
    const big = sp.rarity === "legendary" || sp.rarity === "mythic";
    let len = Math.min(4.6, Math.max(0.7, Math.min(2.6, size / 45) * ds * (ds > 1.5 ? 0.62 : 1)));
    let bodySize = 0;
    if (big) {
      // 전설·신화는 몸의 가장 긴 변이 일정한 크기(신화 7, 전설 5.5)가 되게 키워서 눈에 잘 띄게 한다
      fish.scale.setScalar(1);
      const unit = bodyBox(fish).getSize(new THREE.Vector3());
      bodySize = sp.rarity === "mythic" ? 7 : 5.5;
      len = bodySize / Math.max(unit.x, unit.y * 1.3, unit.z, 0.01);
    }
    fish.scale.setScalar(len);
    const from = peer.bobber.position.clone();
    fish.position.copy(from);
    this.scene.add(fish);
    this.world.ripple(from.x, from.z);
    if (peer.shadow) peer.shadow.visible = false;
    peer.catch = { fish, t: 0, from, len: big ? bodySize : len, big, notified: false, done };
    if (sp.rarity === "mythic") {
      this.mythicBurst(from);
      this.bus.emit("flash", "mythic");
    }
  }

  /** 신화를 낚았을 때: 무지개 입자 폭발, 퍼지는 빛 고리, 하늘로 솟는 빛기둥 */
  private mythicBurst(at: THREE.Vector3) {
    const root = new THREE.Group();
    root.position.copy(at);
    this.scene.add(root);
    const N = 180;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel: THREE.Vector3[] = [];
    const palette = ["#ff7aa8", "#ffb070", "#ffe070", "#8aff9a", "#7ad8ff", "#b09aff", "#ffffff"].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 2 + Math.random() * 5;
      vel.push(new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.abs(Math.cos(ph)) * 0.8 + 0.3, Math.sin(ph) * Math.sin(th)).multiplyScalar(sp));
      const c = palette[i % palette.length];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pm = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, pm);
    pts.frustumCulled = false;
    root.add(pts);
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: palette[(i * 2) % 7], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      r.rotation.x = Math.PI / 2;
      root.add(r);
      rings.push(r);
    }
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 30, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    pillar.position.y = 15;
    root.add(pillar);
    let age = 0;
    this.fx.push((dt) => {
      age += dt;
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        const v = vel[i];
        v.y -= dt * 3;
        p.setXYZ(i, p.getX(i) + v.x * dt, p.getY(i) + v.y * dt, p.getZ(i) + v.z * dt);
      }
      p.needsUpdate = true;
      pm.opacity = Math.max(0, 1 - age / 2.4);
      rings.forEach((r, i) => {
        const u = Math.max(0, age - i * 0.25);
        r.scale.setScalar(0.5 + u * 7);
        (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - u * 0.6);
      });
      (pillar.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 - age * 0.22);
      pillar.scale.set(1 + age * 0.3, 1, 1 + age * 0.3);
      if (age > 2.6) {
        this.scene.remove(root);
        geo.dispose(); pm.dispose(); pillar.geometry.dispose(); rings.forEach((r) => r.geometry.dispose());
        return false;
      }
      return true;
    });
  }

  // ---- 동기화 --------------------------------------------------------
  private syncPeers(dt: number) {
    const players = this.room.state?.players;
    if (!players) return;
    const seen = new Set<string>();
    players.forEach((p: any, id: string) => {
      seen.add(id);
      let peer = this.peers.get(id);
      if (!peer || peer.look !== p.look) {
        if (peer) this.removePeer(id);
        peer = this.addPeer(id, p);
      }
      this.updatePeer(peer, id, p, dt);
    });
    for (const id of [...this.peers.keys()]) if (!seen.has(id)) this.removePeer(id);
  }

  private addPeer(id: string, p: any): Peer {
    let look: Look;
    try {
      look = JSON.parse(p.look);
    } catch {
      look = { appearance: { eyes: 0, nose: 0, mouth: 0, hair: 0, skinColor: 0, hairColor: 0, eyeColor: 0, body: 1 }, equipped: {} };
    }
    const rig = new CharacterRig(look);
    rig.root.position.set(p.x, 0, p.z);
    rig.facing = this.camYaw;
    this.scene.add(rig.root);

    const tagText = p.name;
    // 닉네임표는 작고 어두운 이름표로 만들어 흰 채팅 말풍선과 헷갈리지 않게 한다
    const tag = textSprite(p.name, { bg: "rgba(74,59,82,0.72)", fg: "#ffffff", size: 28, sub: p.title || undefined, subFg: "#ffd45a", compact: true });
    tag.position.set(0, 3.0 + tag.scale.y / 2, 0); // 표의 아랫변이 머리 위 3.0에 오도록
    rig.root.add(tag);

    const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 22 }, () => new THREE.Vector3()));
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    line.frustumCulled = false;
    line.visible = false;
    this.scene.add(line);

    const bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xff5a5a }));
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xffffff }));
    bobber.add(top, bottom);
    bobber.visible = false;
    this.scene.add(bobber);

    const peer: Peer = {
      rig, look: p.look, tag, tagText, bubble: null, bubbleUntil: 0, alert: null, line, bobber,
      prev: new THREE.Vector3(p.x, 0, p.z), moving: false, emoteSeq: p.emoteSeq, bobPhase: Math.random() * 6, silhouette: null,
      shadow: null, waitT: 0, catch: null, nibbleIdx: -1, shadowAngle: Math.random() * 6.28, thrashT: 0,
    };
    this.peers.set(id, peer);
    return peer;
  }

  private removePeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.scene.remove(peer.rig.root, peer.line, peer.bobber);
    if (peer.silhouette) this.scene.remove(peer.silhouette);
    if (peer.shadow) this.scene.remove(peer.shadow);
    if (peer.catch) this.scene.remove(peer.catch.fish);
    peer.rig.dispose();
    this.peers.delete(id);
  }

  private updatePeer(peer: Peer, id: string, p: any, dt: number) {
    const mine = id === this.mySession;
    const pos = peer.rig.root.position;
    if (!mine) {
      const k = 1 - Math.pow(0.0005, dt);
      pos.x += (p.x - pos.x) * k;
      pos.z += (p.z - pos.z) * k;
    }
    const dx = pos.x - peer.prev.x, dz = pos.z - peer.prev.z;
    const sp = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
    peer.moving = sp > 0.6;
    let facing: number | undefined;
    if (peer.moving && p.fishing === "idle") facing = Math.atan2(dx, dz);
    else if (!mine && p.fishing !== "idle") facing = p.yaw;
    else if (mine && p.fishing !== "idle") facing = p.yaw;
    peer.prev.copy(pos);

    if (p.emoteSeq !== peer.emoteSeq) {
      peer.emoteSeq = p.emoteSeq;
      if (p.emote) peer.rig.playEmote(p.emote);
    }
    peer.rig.update(dt, { moving: peer.moving, fishing: p.fishing }, facing);

    if (peer.bubble && performance.now() > peer.bubbleUntil) {
      peer.rig.root.remove(peer.bubble);
      peer.bubble = null;
    }

    // 낚싯줄, 찌, 물속의 물고기, 걸려 올라오는 물고기
    const fishing = p.fishing !== "idle";
    const c = peer.catch;
    peer.line.visible = fishing || !!c;
    peer.tag.visible = !(mine && (fishing || !!c));
    peer.bobber.visible = fishing && !c;
    if (p.fishing === "waiting") peer.waitT += dt;
    else if (p.fishing === "idle") peer.waitT = 0;
    peer.thrashT = p.fishing === "minigame" ? peer.thrashT + dt : 0;

    const tip = new THREE.Vector3();
    if (fishing || c) {
      peer.rig.root.updateMatrixWorld(true);
      peer.rig.rodTip.getWorldPosition(tip);
    }
    const waterY = this.world.waterY;
    let lineEnd: THREE.Vector3 | null = null;
    let sagAmount = 0.9;

    if (fishing && !c) {
      peer.bobPhase += dt;
      const bx = p.bobX, bz = p.bobZ;
      let dip = 0;
      const wantShadow = p.fishing === "waiting" ? peer.waitT > 1.0 : !peer.silhouette;
      if (wantShadow && !peer.shadow) {
        const base = speciesById("common-01")!;
        const g = buildFish(base);
        asSilhouette(g, 0.34);
        g.scale.setScalar(0.62);
        peer.shadow = g;
        this.scene.add(g);
      }
      const shadow = peer.shadow;
      if (shadow) shadow.visible = wantShadow;

      if (p.fishing === "waiting") {
        // 그림자가 멀리서 다가와 찌 주위를 돌다가 톡톡 건드린다
        const w = peer.waitT;
        const appear = Math.min(1, Math.max(0, (w - 1.0) / 2.0));
        const ease = 1 - Math.pow(1 - appear, 2);
        let radius = 6.5 - 5.4 * ease;
        let ang = peer.shadowAngle + (w > 3 ? (w - 3) * 0.9 : 0);
        if (w > 3.0) {
          const ph = (w - 3.0) % 1.7;
          const idx = Math.floor((w - 3.0) / 1.7);
          if (ph < 0.4) {
            const k = Math.sin((ph / 0.4) * Math.PI); // 0→1→0
            radius = 1.1 - 0.85 * k;
            dip = k * 0.13;
            if (idx !== peer.nibbleIdx && ph < 0.12) {
              peer.nibbleIdx = idx;
              this.world.ripple(bx, bz);
            }
          } else radius = 1.1;
        }
        if (shadow) {
          const nx = bx + Math.cos(ang) * radius, nz = bz + Math.sin(ang) * radius;
          const dx = nx - shadow.position.x, dz = nz - shadow.position.z;
          if (shadow.position.lengthSq() === 0) shadow.position.set(nx, waterY - 0.3, nz);
          shadow.position.set(nx, waterY - 0.3 - (1 - ease) * 0.2, nz);
          if (Math.abs(dx) + Math.abs(dz) > 1e-4) shadow.rotation.y = Math.atan2(-dz, dx);
          (shadow.userData.update as (t: number) => void)?.(this.t * 1.4);
        }
        const bob = Math.sin(peer.bobPhase * 2.2) * 0.04;
        peer.bobber.position.set(bx, waterY + 0.04 + bob - dip, bz);
        if (Math.random() < dt * 0.25) this.world.ripple(bx, bz);
      } else if (p.fishing === "bite") {
        const bob = -0.2 + Math.sin(this.t * 30) * 0.06;
        peer.bobber.position.set(bx, waterY + 0.04 + bob, bz);
        sagAmount = 0.2;
        const a = this.t * 3.2;
        const f = peer.silhouette ?? shadow;
        if (f) {
          f.position.set(bx + Math.cos(a) * 0.4, waterY - 0.3, bz + Math.sin(a) * 0.4);
          f.rotation.y = -a + Math.PI;
          (f.userData.update as (t: number) => void)?.(this.t * 2);
        }
        if (!peer.alert) {
          peer.alert = textSprite("!", { bg: "#ff6b6b", fg: "#ffffff", size: 56 });
          peer.alert.scale.multiplyScalar(0.5);
          peer.alert.position.set(0, peer.tag.position.y + peer.tag.scale.y / 2 + 0.3, 0);
          peer.rig.root.add(peer.alert);
          this.world.ripple(bx, bz);
        }
      } else if (p.fishing === "minigame") {
        // 낚싯바늘에 걸린 물고기가 줄 끝에서 거세게 퍼덕인다
        const w = peer.thrashT;
        const zig = Math.sin(w * 9) * 0.55;
        const zag = Math.cos(w * 7.3) * 0.45;
        peer.bobber.position.set(bx + zig * 0.5, waterY - 0.06 + Math.sin(w * 22) * 0.04, bz + zag * 0.5);
        sagAmount = 0.05;
        const f = peer.silhouette ?? shadow;
        if (f) {
          f.position.set(bx + zig, waterY - 0.28 + Math.abs(Math.sin(w * 6)) * 0.22, bz + zag);
          f.rotation.y = Math.sin(w * 9) * 1.3;
          f.rotation.z = Math.sin(w * 13) * 0.35;
          (f.userData.update as (t: number) => void)?.(this.t * 5);
        }
        if (Math.floor(w * 3) !== Math.floor((w - dt) * 3)) this.world.ripple(bx + zig, bz + zag);
      }
      lineEnd = peer.bobber.position;
    } else if (c) {
      // 줄에 걸려 물 밖으로 튀어 올라 낚싯대 끝에 매달린다
      c.t += dt;
      const face = peer.rig.facing;
      const root = peer.rig.root.position;
      // 큰 물고기는 몸 앞쪽 허공에 눈높이로 떠올라 옆모습을 보여 준다(발밑에 떨어지지 않게)
      const hang = c.big
        ? new THREE.Vector3(root.x + Math.sin(face) * (2.4 + c.len * 0.4), root.y + 1.5 + c.len * 0.5, root.z + Math.cos(face) * (2.4 + c.len * 0.4))
        : tip.clone().add(new THREE.Vector3(0, -(0.9 + c.len * 0.5), 0));
      const T1 = c.big ? 1.3 : 1.0;
      if (c.t < T1) {
        const u = c.t / T1;
        const e = 1 - Math.pow(1 - u, 3);
        c.fish.position.lerpVectors(c.from, hang, e);
        c.fish.position.y += Math.sin(u * Math.PI) * (c.big ? 2.6 + c.len * 0.4 : 2.6);
        if (c.big) c.fish.rotation.set(0, face + (1 - e) * Math.PI * 2, Math.sin(u * Math.PI) * 0.5);
        else c.fish.rotation.set(0, c.fish.rotation.y + dt * 3, u * Math.PI * 2.2 + Math.PI / 2 * u);
      } else if (c.big) {
        const s = c.t - T1;
        c.fish.position.set(hang.x, hang.y + Math.sin(s * 1.6) * 0.15, hang.z);
        c.fish.rotation.set(0, face + Math.sin(s * 1.1) * 0.35, Math.sin(s * 1.5) * 0.06);
      } else {
        const s = c.t - T1;
        c.fish.position.set(hang.x + Math.sin(s * 2.4) * 0.25, hang.y + Math.sin(s * 3.1) * 0.08, hang.z + Math.cos(s * 2.1) * 0.2);
        c.fish.rotation.set(0, c.fish.rotation.y + dt * 1.4, Math.PI / 2 + Math.sin(s * 3) * 0.18 + 0.3 * Math.max(0, 1 - s));
      }
      (c.fish.userData.update as (t: number) => void)?.(this.t * 4);
      if (!c.notified && c.t > (c.big ? 3.0 : 2.4)) {
        c.notified = true;
        c.done();
      }
      if (c.t > (c.big ? 4.8 : 4.2)) {
        this.scene.remove(c.fish);
        peer.catch = null;
      }
      lineEnd = c.fish.position.clone().add(new THREE.Vector3(0, c.len * 0.5, 0));
      sagAmount = Math.max(0.05, 0.5 - c.t * 0.3);
    }

    if (lineEnd) {
      const arr = peer.line.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < arr.count; i++) {
        const u = i / (arr.count - 1);
        const sag = Math.sin(u * Math.PI) * sagAmount;
        arr.setXYZ(i, tip.x + (lineEnd.x - tip.x) * u, tip.y + (lineEnd.y - tip.y) * u - sag, tip.z + (lineEnd.z - tip.z) * u);
      }
      arr.needsUpdate = true;
    }

    if (p.fishing === "idle" || p.fishing === "minigame") {
      if (peer.alert) {
        peer.rig.root.remove(peer.alert);
        peer.alert = null;
      }
    }
    if (p.fishing === "idle") {
      if (peer.shadow) peer.shadow.visible = false;
      peer.nibbleIdx = -1;
    }
  }

  // ---- 매 프레임 -----------------------------------------------------
  private moveMe(dt: number) {
    const me = this.me();
    const peer = this.peers.get(this.mySession);
    if (!me || !peer || me.fishing !== "idle") return;
    let ix = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0) + this.joystick.x;
    let iz = (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) - (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) + this.joystick.y;
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    if (len < 0.05) return;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const rx = -fz, rz = fx;
    const vx = (fx * iz + rx * ix) * SPEED * dt;
    const vz = (fz * iz + rz * ix) * SPEED * dt;
    const pos = peer.rig.root.position;
    if (this.map.isWalkable(pos.x + vx, pos.z + vz)) { pos.x += vx; pos.z += vz; }
    else if (this.map.isWalkable(pos.x + vx, pos.z)) pos.x += vx;
    else if (this.map.isWalkable(pos.x, pos.z + vz)) pos.z += vz;
    const now = performance.now();
    if (now - this.lastSend > 70 && (Math.abs(pos.x - this.lastSent.x) > 0.01 || Math.abs(pos.z - this.lastSent.z) > 0.01)) {
      const yaw = Math.atan2(vx, vz);
      this.room.send("move", { x: pos.x, z: pos.z, yaw });
      this.lastSent = { x: pos.x, z: pos.z, yaw };
      this.lastSend = now;
    }
  }

  private updateNpc(dt: number) {
    const mine = this.peers.get(this.mySession)?.rig.root.position;
    for (const [n, ev] of [[this.npc, "npcNear"], [this.smith, "smithNear"]] as const) {
      if (!n) continue;
      const dx = mine ? mine.x - n.pos.x : 0, dz = mine ? mine.z - n.pos.z : 1;
      const near = !!mine && Math.hypot(dx, dz) < 4.5;
      if (near !== n.near) { n.near = near; this.bus.emit(ev, near); }
      const face = near ? Math.atan2(dx, dz) : 0;
      if (n.rig) n.rig.update(dt, { moving: false, fishing: "idle" }, face);
      else n.body.rotation.y += Math.atan2(Math.sin(face - n.body.rotation.y), Math.cos(face - n.body.rotation.y)) * Math.min(1, dt * 6);
    }
  }

  private updateCamera(dt: number) {
    const peer = this.peers.get(this.mySession);
    this.camDist += (this.camTargetDist - this.camDist) * Math.min(1, dt * 8);
    let target = peer ? peer.rig.root.position.clone().add(new THREE.Vector3(0, 1.9, 0)) : new THREE.Vector3(0, 1.9, 20);
    // 낚시 중에는 찌 쪽을 같이 보여 준다 (입질 전 그림자, 퍼덕이는 모습이 잘 보이게)
    const me = this.me();
    if (peer && me && me.fishing !== "idle") {
      const bob = new THREE.Vector3(me.bobX, this.world.waterY + 0.6, me.bobZ);
      target = target.lerp(bob, 0.5);
    }
    if (peer?.catch) target = peer.catch.fish.position.clone().lerp(target, 0.4);
    const cp = Math.cos(this.camPitch);
    const dist = this.camDist + (me && me.fishing !== "idle" ? 4 : 0);
    const want = new THREE.Vector3(
      target.x - Math.sin(this.camYaw) * cp * dist,
      target.y + Math.sin(this.camPitch) * dist,
      target.z - Math.cos(this.camYaw) * cp * dist,
    );
    want.y = Math.max(want.y, 0.6);
    // 맵 가장자리 밖으로 나가지 않게 한다
    want.x = clamp(want.x, -this.map.halfSize, this.map.halfSize);
    want.z = clamp(want.z, -this.map.halfSize, this.map.halfSize);
    this.camera.position.lerp(want, Math.min(1, dt * 10));
    this.camera.lookAt(target);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.t += dt;
    this.syncPeers(dt);
    this.moveMe(dt);
    this.updateNpc(dt);
    this.updateCamera(dt);
    this.fx = this.fx.filter((f) => f(dt));
    this.world.update(this.t, this.now());
    if (this.charging) this.bus.emit("charge", this.chargePower(performance.now()));
    const me = this.me();
    const phase = me?.fishing ?? "idle";
    if (phase !== this.phase) {
      this.phase = phase;
      this.bus.emit("phase", phase);
    }
    this.engine.render();
  };

  /** 화면 오른쪽 위 시계용: 0~1, 하루 중 지금 위치 */
  timeOfDayInfo() {
    return this.now();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.disposers.forEach((d) => d());
    for (const id of [...this.peers.keys()]) this.removePeer(id);
    this.npc?.rig?.dispose();
    this.smith?.rig?.dispose();
    this.engine.dispose();
  }
}

/** 모델이 T자(팔 벌림)로 만들어져 있어서, 어깨 쪽을 축으로 팔 부분 정점만 아래로 돌려 팔을 내린다(뼈대 없는 모델용) */
/** 어깨 위치(x는 몸 가운데에서 어깨까지 거리)와, 팔 위쪽 경계(이 높이 위는 머리·모자라 그대로 둔다) */
interface ArmPose { x: number; y: number; fade: [number, number] }
function lowerArms(root: THREE.Object3D, pose: ArmPose = { x: 0.15, y: 0.45, fade: [0.5, 0.55] }) {
  const ss = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const SHOULDER_X = pose.x, SHOULDER_Y = pose.y, DOWN = 1.3; // 모델 높이 1 기준, 약 75도
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const nor = m.geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const w = ss(SHOULDER_X, SHOULDER_X + 0.09, Math.abs(x)) * (1 - ss(pose.fade[0], pose.fade[1], y)); // 몸통·모자는 그대로, 팔만
      if (w <= 0) continue;
      const side = Math.sign(x);
      const a = -side * DOWN * w, c = Math.cos(a), s = Math.sin(a);
      const dx = x - side * SHOULDER_X, dy = y - SHOULDER_Y;
      pos.setXY(i, side * SHOULDER_X + dx * c - dy * s, SHOULDER_Y + dx * s + dy * c);
      if (nor) { const nx = nor.getX(i), ny = nor.getY(i); nor.setXY(i, nx * c - ny * s, nx * s + ny * c); }
    }
    pos.needsUpdate = true;
    if (nor) nor.needsUpdate = true;
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
  });
}
