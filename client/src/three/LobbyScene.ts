import * as THREE from "three";
import { CharacterRig } from "./character";
import type { Look } from "./character";
import { createEngine } from "./engine";
import type { Engine } from "./engine";
import { buildWorld } from "./world";
import type { World } from "./world";

/** 방 밖 메인 화면: 내 캐릭터가 호숫가에 서 있다 */
export class LobbyScene {
  private engine: Engine;
  private world: World;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);
  private rig: CharacterRig | null = null;
  private raf = 0;
  private clock = new THREE.Clock();
  private t = 0;
  private spin = 0.35;
  private dragging = false;
  private disposers: Array<() => void> = [];
  private emote: string | null = null;
  private creatorMode = false;        // 꾸미기 중: 캐릭터는 왼쪽, 메뉴는 오른쪽
  private faceTarget = 0.35;          // 꾸미기 중 돌려 본 각도
  private camPos = new THREE.Vector3(0.5, 2.6, 29.5);
  private camLook = new THREE.Vector3(-1.9, 1.9, 21);

  constructor(container: HTMLElement, look: Look) {
    this.engine = createEngine(container, this.scene, this.camera);
    this.world = buildWorld("lake", this.scene);
    this.setLook(look);
    const el = this.engine.renderer.domElement;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      this.dragging = true;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging || !this.rig) return;
      this.rig.facing -= (e.clientX - lastX) * 0.012;
      this.faceTarget = this.rig.facing;
      lastX = e.clientX;
    };
    const up = () => (this.dragging = false);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    this.disposers.push(() => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    });
    this.loop();
  }

  setLook(look: Look) {
    const facing = this.rig?.facing ?? 0.35;
    if (this.rig) {
      this.scene.remove(this.rig.root);
      this.rig.dispose();
    }
    this.rig = new CharacterRig(look);
    this.rig.root.position.set(0, 0, 21);
    this.rig.facing = facing;
    this.scene.add(this.rig.root);
  }

  /** 꾸미기 화면: 캐릭터를 왼쪽에 놓고 마우스로 돌려 볼 수 있게 한다 */
  setCreatorMode(on: boolean) {
    this.creatorMode = on;
    if (on && this.rig) this.faceTarget = this.rig.facing;
  }
  rotateBy(rad: number) {
    this.faceTarget = (this.rig?.facing ?? 0) + rad;
  }
  faceTo(rad: number) {
    const cur = this.rig?.facing ?? 0;
    this.faceTarget = cur + Math.atan2(Math.sin(rad - cur), Math.cos(rad - cur)); // 가까운 쪽으로 돈다
  }

  playEmote(id: string) {
    this.emote = id;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.t += dt;
    if (this.emote && this.rig) {
      this.rig.playEmote(this.emote);
      this.emote = null;
    }
    if (!this.dragging && this.rig) {
      if (this.creatorMode) this.rig.facing += (this.faceTarget - this.rig.facing) * Math.min(1, dt * 8); // 돌려 본 자리에 멈춘다
      else this.rig.facing += (0.0 - this.rig.facing + Math.sin(this.t * 0.4) * 0.35) * Math.min(1, dt * 1.5);
    }
    this.rig?.update(dt, { moving: false, fishing: "idle" });
    // 낮 시간으로 고정해서 보여 준다
    this.world.update(this.t, 3 * 60 * 1000);
    const w = this.engine.renderer.domElement.clientWidth;
    const h = this.engine.renderer.domElement.clientHeight;
    const wide = w > 720 || w > h; // 720px 이하(CSS의 좁은 화면과 같은 기준)면 메뉴가 아래를 덮는다
    const tp = this.creatorMode ? (wide ? [-0.6, 2.5, 28.6] : [0, 2.0, 34.4]) : (wide ? [0.5, 2.6, 29.5] : [0, 2.8, 31]);
    // 좁은 화면은 아래쪽을 메뉴가 덮으니, 캐릭터가 화면 윗부분에 오도록 바라보는 곳을 낮춘다
    const tl = this.creatorMode ? (wide ? [1.0, 1.8, 21] : [0, -0.3, 21]) : (wide ? [-1.9, 1.9, 21] : [0, 0.4, 21]);
    const f = Math.min(1, dt * 4);
    this.camPos.lerp(new THREE.Vector3(tp[0], tp[1], tp[2]), f);
    this.camLook.lerp(new THREE.Vector3(tl[0], tl[1], tl[2]), f);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.engine.render();
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.disposers.forEach((d) => d());
    this.rig?.dispose();
    this.engine.dispose();
  }
}
