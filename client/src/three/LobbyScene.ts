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
    if (!this.dragging && this.rig) this.rig.facing += (0.0 - this.rig.facing + Math.sin(this.t * 0.4) * 0.35) * Math.min(1, dt * 1.5);
    this.rig?.update(dt, { moving: false, fishing: "idle" });
    // 낮 시간으로 고정해서 보여 준다
    this.world.update(this.t, 3 * 60 * 1000);
    const w = this.engine.renderer.domElement.clientWidth;
    const h = this.engine.renderer.domElement.clientHeight;
    const wide = w > h;
    this.camera.position.set(wide ? 0.5 : 0, wide ? 2.6 : 3.1, wide ? 29.5 : 28.5);
    this.camera.lookAt(wide ? -1.9 : 0, wide ? 1.9 : 1.7, 21);
    this.engine.render();
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.disposers.forEach((d) => d());
    this.rig?.dispose();
    this.engine.dispose();
  }
}
