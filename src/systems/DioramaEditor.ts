import {
  Color3,
  Color4,
  DynamicTexture,
  HighlightLayer,
  Mesh,
  ParticleSystem,
  PointerEventTypes,
  PointLight,
  Ray,
  StandardMaterial,
  Vector3,
  type AbstractMesh,
  type Camera,
  type Nullable,
  type Observer,
  type PointerInfo,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';
import gsap from 'gsap';
import { SFX } from '../data/audio';
import type { ObjectEffect, TemplateId } from '../data/types';
import { createGlowTexture } from '../utils/textures';
import type { AudioManager } from './AudioManager';

/** Algo que el usuario puede mover en el diorama (recuerdo de infancia o elemento de un universo). */
export interface EditableItem {
  node: TransformNode;
  name: string;
  kind: 'objeto' | 'motivo';
  effect: ObjectEffect | null;
  sound: string | null;
  /** Flota por sí mismo (planeta). */
  selfFloat: boolean;
  /** Paleta para las partículas de su efecto. */
  colors: string[];
}

/** Nodo flotante del diorama (rocas, islotes, ramas): lo que está encima se mece con él. */
export interface Floater {
  node: TransformNode;
  baseY: number;
}

interface Pose {
  x: number;
  z: number;
  surfaceY: number;
  rotY: number;
  scale: number;
  ride: Floater | null;
}

interface ItemState extends Pose {
  item: EditableItem;
  meshes: AbstractMesh[];
  home: Pose;
  /** Altura sobre la superficie (el planeta flota por encima). */
  hover: number;
  phase: number;
  /** Aparición (0 → 1), la anima la etapa. */
  grow: { v: number };
  lift: number;
  /** Desplazamientos temporales de los efectos. */
  fx: { y: number; ox: number; oz: number; sx: number; sy: number; sz: number; rotX: number; rotY: number; rotZ: number };
  target: { x: number; z: number; surfaceY: number } | null;
  busy: gsap.core.Timeline | null;
}

export interface CameraControl {
  orbit: (dx: number, dy: number) => void;
  zoom: (factor: number) => void;
  /** Avisa que el usuario está interactuando (la cámara automática se detiene). */
  touch: () => void;
}

export interface EditorBounds {
  /** Radio máximo desde el centro (plantillas redondas). */
  radius?: number;
  /** Medio ancho de la caja (habitación). */
  box?: number;
  /** Altura mínima válida (evita "caer" por los acantilados). */
  minY: number;
}

export const EDITOR_BOUNDS: Record<TemplateId, EditorBounds> = {
  castillo: { radius: 8.2, minY: 0.1 },
  bosque: { radius: 8.0, minY: 0.1 },
  isla: { radius: 8.4, minY: 0.1 },
  habitacion: { box: 4.65, minY: -0.1 },
};

const CONFIG = {
  dragThreshold: 6,
  dragLift: 0.55,
  stepUp: 1.6,
  followSpeed: 14,
  rotateStep: Math.PI / 8,
  scaleStep: 1.12,
  scaleMin: 0.6,
  scaleMax: 1.6,
  hoverColor: new Color3(0.95, 0.88, 0.72),
  selectColor: new Color3(1, 0.78, 0.4),
};

/**
 * Edición del diorama: seleccionar, arrastrar sobre las superficies, girar, escalar, restablecer
 * y tocar los recuerdos para ver su efecto. El fondo arrastrado mueve la cámara.
 */
export class DioramaEditor {
  private scene: Scene;
  private camera: Camera;
  private canvas: HTMLCanvasElement;
  private audio: AudioManager;
  private bounds: EditorBounds;
  private cam: CameraControl;
  private floaterSet = new Map<TransformNode, Floater>();

  private states: ItemState[] = [];
  private byMesh = new Map<AbstractMesh, ItemState>();
  private highlight: HighlightLayer;
  private flash: PointLight;
  private bursts: Record<'notes' | 'sparkle' | 'dust', ParticleSystem>;
  private textures: DynamicTexture[] = [];

  private enabled = false;
  private time = 0;
  private hovered: ItemState | null = null;
  private selected: ItemState | null = null;
  private press: { x: number; y: number; state: ItemState | null; dragging: boolean; lastX: number; lastY: number; planeY: number } | null = null;
  private observer: Nullable<Observer<PointerInfo>> = null;
  private tweens: gsap.core.Animation[] = [];

  /** Cambia el recuerdo seleccionado (para la interfaz). */
  onSelect: (name: string | null) => void = () => {};

  constructor(
    scene: Scene,
    camera: Camera,
    canvas: HTMLCanvasElement,
    audio: AudioManager,
    bounds: EditorBounds,
    cam: CameraControl,
    floaters: Floater[],
  ) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.audio = audio;
    this.bounds = bounds;
    this.cam = cam;
    for (const f of floaters) this.floaterSet.set(f.node, f);

    this.highlight = new HighlightLayer('dio-highlight', scene, { blurHorizontalSize: 0.7, blurVerticalSize: 0.7 });
    this.highlight.innerGlow = false;
    // Luz del efecto "brillo": se crea desde el principio para no recompilar materiales al primer toque
    this.flash = new PointLight('dio-flash', Vector3.Zero(), scene);
    this.flash.intensity = 0;
    this.flash.range = 6;
    this.flash.diffuse = new Color3(1, 0.85, 0.55);

    const glow = createGlowTexture(scene, 'dio-burst', 64);
    const note = createNoteTexture(scene);
    this.textures.push(glow, note);
    this.bursts = {
      notes: makeBurst(scene, 'dio-notas', note, { size: [0.28, 0.42], life: [1.4, 2.0], power: [0.5, 0.9], dir1: [-0.5, 1, -0.5], dir2: [0.5, 1.6, 0.5], gravity: [0, 0.2, 0], additive: false }),
      sparkle: makeBurst(scene, 'dio-destellos', glow, { size: [0.12, 0.3], life: [0.6, 1.1], power: [1.2, 2.4], dir1: [-1, 0.2, -1], dir2: [1, 1.4, 1], gravity: [0, -1.5, 0], additive: true }),
      dust: makeBurst(scene, 'dio-polvo', glow, { size: [0.2, 0.45], life: [0.5, 0.9], power: [0.6, 1.2], dir1: [-1, 0.1, -1], dir2: [1, 0.4, 1], gravity: [0, -0.4, 0], additive: false }),
    };
  }

  /**
   * Registra un elemento editable. Debe llamarse con el diorama ya construido (antes de la aparición):
   * calcula sobre qué superficie descansa y si se apoya en algo que flota.
   */
  add(item: EditableItem): { v: number } {
    const node = item.node;
    const meshes = node.getChildMeshes().filter((m) => m.isPickable);
    const state: ItemState = {
      item,
      meshes,
      x: node.position.x,
      z: node.position.z,
      surfaceY: node.position.y,
      rotY: node.rotation.y,
      scale: node.scaling.x,
      ride: null,
      home: null as unknown as Pose,
      hover: 0,
      phase: (node.position.x + node.position.z) * 0.37,
      grow: { v: 0.0001 },
      lift: 0,
      fx: { y: 0, ox: 0, oz: 0, sx: 1, sy: 1, sz: 1, rotX: 0, rotY: 0, rotZ: 0 },
      target: null,
      busy: null,
    };
    for (const m of meshes) this.byMesh.set(m, state);
    this.states.push(state);
    return state.grow;
  }

  /** Con todo registrado: busca la superficie de cada elemento (después de construir, antes de aparecer). */
  settle(): void {
    for (const m of this.scene.meshes) m.computeWorldMatrix(true);
    for (const s of this.states) {
      const y = s.item.node.position.y;
      const hit = this.surfaceBelow(s.x, s.z, y + 0.4, Infinity);
      if (hit) {
        s.hover = Math.max(y - hit.y, 0);
        s.ride = hit.ride;
        s.surfaceY = hit.y - this.rideDelta(hit.ride);
      } else {
        s.surfaceY = y;
      }
      s.home = { x: s.x, z: s.z, surfaceY: s.surfaceY, rotY: s.rotY, scale: s.scale, ride: s.ride };
    }
  }

  /** Activa la interacción (cuando el diorama terminó de construirse). */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.observer = this.scene.onPointerObservable.add((info) => this.handlePointer(info));
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKey);
  }

  // ---------- Acciones públicas (botones y teclado) ----------

  rotateSelected(dir: number): void {
    const s = this.selected;
    if (!s) return;
    this.cam.touch();
    this.tweens.push(gsap.to(s, { rotY: s.rotY + dir * CONFIG.rotateStep, duration: 0.45, ease: 'back.out(1.8)' }));
  }

  scaleSelected(dir: number): void {
    const s = this.selected;
    if (!s) return;
    this.cam.touch();
    const next = Math.min(Math.max(s.scale * (dir > 0 ? CONFIG.scaleStep : 1 / CONFIG.scaleStep), s.home.scale * CONFIG.scaleMin), s.home.scale * CONFIG.scaleMax);
    if (Math.abs(next - s.scale) < 1e-3) {
      // Ya está en el límite: un pequeño "no" visual
      this.tweens.push(gsap.fromTo(s.fx, { sx: 1, sz: 1 }, { sx: dir > 0 ? 1.05 : 0.95, sz: dir > 0 ? 1.05 : 0.95, duration: 0.12, yoyo: true, repeat: 1 }));
      return;
    }
    this.tweens.push(gsap.to(s, { scale: next, duration: 0.4, ease: 'back.out(2)' }));
  }

  /** Devuelve todo a la composición original. */
  resetAll(): void {
    this.select(null);
    this.states.forEach((s, i) => {
      s.target = null;
      s.ride = s.home.ride;
      this.tweens.push(
        gsap.to(s, {
          x: s.home.x,
          z: s.home.z,
          surfaceY: s.home.surfaceY,
          rotY: s.home.rotY,
          scale: s.home.scale,
          lift: 0,
          duration: 1.1,
          delay: i * 0.04,
          ease: 'power3.inOut',
        }),
      );
      this.tweens.push(gsap.fromTo(s.fx, { y: 0 }, { y: 0.35, duration: 0.55, delay: i * 0.04, yoyo: true, repeat: 1, ease: 'sine.inOut' }));
    });
  }

  /** Simula un toque sobre el elemento (pruebas). */
  tapByName(name: string): boolean {
    const s = this.states.find((st) => st.item.name === name || st.item.node.name === name);
    if (!s) return false;
    this.select(s);
    this.playEffect(s);
    return true;
  }

  /** Estado de un elemento para pruebas. */
  debugItems(): { name: string; x: number; y: number; z: number; rotY: number; scale: number; ride: string | null }[] {
    return this.states.map((s) => ({
      name: s.item.node.name,
      x: s.item.node.position.x,
      y: s.item.node.position.y,
      z: s.item.node.position.z,
      rotY: s.rotY,
      scale: s.scale,
      ride: s.ride?.node.name ?? null,
    }));
  }

  // ---------- Puntero ----------

  private handlePointer(info: PointerInfo): void {
    const x = this.scene.pointerX;
    const y = this.scene.pointerY;
    switch (info.type) {
      case PointerEventTypes.POINTERDOWN: {
        if ((info.event as PointerEvent).button !== 0) return;
        const state = this.pickItem();
        this.press = { x, y, state, dragging: false, lastX: x, lastY: y, planeY: state ? state.item.node.position.y : 0 };
        this.cam.touch();
        break;
      }
      case PointerEventTypes.POINTERMOVE: {
        const p = this.press;
        if (!p) {
          this.setHovered(this.pickItem());
          return;
        }
        const moved = Math.hypot(x - p.x, y - p.y) > CONFIG.dragThreshold;
        if (p.state) {
          if (!p.dragging && moved) this.beginDrag(p.state);
          if (p.dragging || moved) {
            p.dragging = true;
            this.dragTo(p.state, p.planeY);
          }
        } else if (p.dragging || moved) {
          p.dragging = true;
          this.cam.orbit(x - p.lastX, y - p.lastY);
          this.canvas.style.cursor = 'grabbing';
        }
        p.lastX = x;
        p.lastY = y;
        this.cam.touch();
        break;
      }
      case PointerEventTypes.POINTERUP: {
        const p = this.press;
        this.press = null;
        if (!p) return;
        if (p.state && p.dragging) this.drop(p.state);
        else if (p.state) {
          this.select(p.state);
          this.playEffect(p.state);
        } else if (!p.dragging) this.select(null);
        this.setHovered(this.pickItem());
        break;
      }
    }
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cam.zoom(Math.exp(Math.max(Math.min(e.deltaY, 120), -120) * 0.0015));
    this.cam.touch();
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'q') this.rotateSelected(1);
    else if (k === 'e') this.rotateSelected(-1);
    else if (k === '+' || k === '=') this.scaleSelected(1);
    else if (k === '-' || k === '_') this.scaleSelected(-1);
    else if (k === 'escape') this.select(null);
  };

  private pickItem(): ItemState | null {
    const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m) => m.isPickable && m.isEnabled() && m.isVisible && !m.metadata?.decor);
    const mesh = pick?.pickedMesh;
    return mesh ? (this.byMesh.get(mesh) ?? null) : null;
  }

  private setHovered(state: ItemState | null): void {
    if (state === this.hovered) return;
    if (this.hovered && this.hovered !== this.selected) this.setGlow(this.hovered, null);
    this.hovered = state;
    if (state && state !== this.selected) this.setGlow(state, CONFIG.hoverColor);
    this.canvas.style.cursor = state ? 'grab' : '';
  }

  private select(state: ItemState | null): void {
    if (state === this.selected) return;
    const prev = this.selected;
    this.selected = state;
    if (prev) this.setGlow(prev, prev === this.hovered ? CONFIG.hoverColor : null);
    if (state) {
      this.setGlow(state, CONFIG.selectColor);
      this.sfx('seleccion');
    }
    this.onSelect(state ? state.item.name : null);
  }

  private setGlow(state: ItemState, color: Color3 | null): void {
    for (const m of state.meshes) {
      if (!(m instanceof Mesh)) continue;
      this.highlight.removeMesh(m);
      if (color) this.highlight.addMesh(m, color);
    }
  }

  // ---------- Arrastre ----------

  private beginDrag(state: ItemState): void {
    this.select(state);
    state.busy?.progress(1).kill();
    this.tweens.push(gsap.to(state, { lift: CONFIG.dragLift, duration: 0.35, ease: 'power2.out' }));
    this.tweens.push(gsap.to(state.fx, { rotZ: 0.12, duration: 0.3, ease: 'sine.out' }));
    this.canvas.style.cursor = 'grabbing';
  }

  private dragTo(state: ItemState, planeY: number): void {
    const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, null, this.camera);
    const current = state.surfaceY + this.rideDelta(state.ride);

    // 1) Si el cursor apunta a una superficie que mira hacia arriba, se apoya ahí
    let spot: { x: number; z: number; y: number; ride: Floater | null } | null = null;
    const direct = this.scene.pickWithRay(ray, (m) => this.isSurface(m));
    if (direct?.hit && direct.pickedPoint) {
      const n = direct.getNormal(true);
      if (n && n.y > 0.55 && direct.pickedPoint.y >= this.bounds.minY) {
        const p = direct.pickedPoint;
        spot = { x: p.x, z: p.z, y: p.y, ride: this.findRide(direct.pickedMesh) };
      }
    }
    // 2) Si no, se proyecta en el plano de arrastre y se busca el suelo debajo
    if (!spot && Math.abs(ray.direction.y) > 1e-4) {
      const t = (planeY - ray.origin.y) / ray.direction.y;
      if (t > 0) {
        const p = ray.origin.add(ray.direction.scale(t));
        const hit = this.surfaceBelow(p.x, p.z, 30, current + CONFIG.stepUp);
        if (hit) spot = { x: p.x, z: p.z, y: hit.y, ride: hit.ride };
      }
    }
    if (!spot) return;

    // 3) Límites del diorama
    const c = this.clamp(spot.x, spot.z);
    if (c.x !== spot.x || c.z !== spot.z) {
      const hit = this.surfaceBelow(c.x, c.z, 30, current + CONFIG.stepUp);
      if (!hit) return;
      spot = { x: c.x, z: c.z, y: hit.y, ride: hit.ride };
    }
    state.ride = spot.ride;
    state.target = { x: spot.x, z: spot.z, surfaceY: spot.y - this.rideDelta(spot.ride) };
  }

  private drop(state: ItemState): void {
    if (state.target) {
      state.x = state.target.x;
      state.z = state.target.z;
      state.surfaceY = state.target.surfaceY;
      state.target = null;
    }
    this.tweens.push(gsap.to(state, { lift: 0, duration: 0.6, ease: 'bounce.out' }));
    this.tweens.push(gsap.to(state.fx, { rotZ: 0, duration: 0.5, ease: 'back.out(3)' }));
    const tl = gsap.timeline({ delay: 0.28 });
    tl.to(state.fx, { sy: 0.82, sx: 1.12, sz: 1.12, duration: 0.09, ease: 'power2.out' }).to(state.fx, { sy: 1, sx: 1, sz: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' });
    this.tweens.push(tl);
    this.tweens.push(gsap.delayedCall(0.3, () => this.emit('dust', state, ['#f3e6c8', '#d8c8a8'], 14)));
    this.sfx('soltar');
  }

  private clamp(x: number, z: number): { x: number; z: number } {
    const b = this.bounds;
    if (b.box !== undefined) return { x: Math.min(Math.max(x, -b.box), b.box), z: Math.min(Math.max(z, -b.box), b.box) };
    const r = Math.hypot(x, z);
    const max = b.radius ?? 8;
    return r > max ? { x: (x / r) * max, z: (z / r) * max } : { x, z };
  }

  private isSurface(m: AbstractMesh): boolean {
    if (!m.isPickable || !m.isEnabled() || !m.isVisible || m.metadata?.decor || this.byMesh.has(m)) return false;
    const mat = m.material;
    if (mat instanceof StandardMaterial && mat.alpha < 1) return false;
    return true;
  }

  /** Primera superficie bajo (x, z), ignorando lo que esté más alto que `maxY`. */
  private surfaceBelow(x: number, z: number, fromY: number, maxY: number): { y: number; ride: Floater | null } | null {
    const ray = new Ray(new Vector3(x, fromY, z), new Vector3(0, -1, 0), fromY + 30);
    const picks = this.scene.multiPickWithRay(ray, (m) => this.isSurface(m)) ?? [];
    picks.sort((a, b) => a.distance - b.distance);
    for (const p of picks) {
      if (!p.pickedPoint) continue;
      const y = p.pickedPoint.y;
      if (y > maxY) continue;
      if (y < this.bounds.minY) return null;
      return { y, ride: this.findRide(p.pickedMesh) };
    }
    return null;
  }

  private findRide(mesh: Nullable<AbstractMesh>): Floater | null {
    let n: Nullable<TransformNode | AbstractMesh> = mesh;
    while (n) {
      const f = this.floaterSet.get(n as TransformNode);
      if (f) return f;
      n = n.parent as Nullable<TransformNode>;
    }
    return null;
  }

  private rideDelta(ride: Floater | null): number {
    return ride ? ride.node.position.y - ride.baseY : 0;
  }

  // ---------- Efectos al tocar ----------

  private playEffect(s: ItemState): void {
    if (s.busy?.isActive()) return;
    const fx = s.fx;
    const size = s.scale;
    const tl = gsap.timeline({ onComplete: () => (s.busy = null) });
    switch (s.item.effect) {
      case 'bounce':
        tl.to(fx, { sy: 0.75, sx: 1.15, sz: 1.15, duration: 0.1 })
          .to(fx, { y: 1.1 * size, sy: 1.12, sx: 0.92, sz: 0.92, duration: 0.32, ease: 'power2.out' })
          .to(fx, { y: 0, sy: 1, sx: 1, sz: 1, duration: 0.42, ease: 'bounce.out' })
          .to(fx, { y: 0.35 * size, duration: 0.18, ease: 'power2.out' })
          .to(fx, { y: 0, duration: 0.3, ease: 'bounce.out' });
        tl.call(() => this.emit('dust', s, ['#f3e6c8', '#d8c8a8'], 10), [], 0.75);
        break;
      case 'squish':
        tl.to(fx, { sy: 0.62, sx: 1.25, sz: 1.25, duration: 0.14, ease: 'power2.out' }).to(fx, { sy: 1, sx: 1, sz: 1, duration: 0.9, ease: 'elastic.out(1.3, 0.3)' });
        tl.call(() => this.emit('sparkle', s, ['#ffb8c8', '#fff0f4'], 12), [], 0.1);
        break;
      case 'spin':
        tl.to(fx, { y: 0.4 * size, duration: 0.25, ease: 'power2.out' })
          .to(fx, { rotY: Math.PI * 2, duration: 0.8, ease: 'power2.inOut' }, 0)
          .to(fx, { y: 0, duration: 0.35, ease: 'bounce.out' }, 0.55)
          .set(fx, { rotY: 0 });
        tl.call(() => this.emit('sparkle', s, s.item.colors, 16), [], 0.4);
        break;
      case 'glow':
        tl.call(() => {
          this.flash.position.copyFrom(s.item.node.getAbsolutePosition()).addInPlace(new Vector3(0, 0.8 * size, 0));
          this.emit('sparkle', s, ['#9ff0ff', '#e8fbff', '#ffd47a'], 26);
        })
          .to(this.flash, { intensity: 2.2, duration: 0.15 }, 0)
          .to(fx, { sx: 1.1, sy: 1.1, sz: 1.1, duration: 0.15 }, 0)
          .to(fx, { sx: 1, sy: 1, sz: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 0.15)
          .to(this.flash, { intensity: 0, duration: 1.4, ease: 'sine.out' }, 0.2);
        break;
      case 'notes':
        tl.to(fx, { rotZ: 0.14, duration: 0.25, ease: 'sine.inOut' })
          .to(fx, { rotZ: -0.14, duration: 0.5, ease: 'sine.inOut' })
          .to(fx, { rotZ: 0.08, duration: 0.45, ease: 'sine.inOut' })
          .to(fx, { rotZ: 0, duration: 0.4, ease: 'sine.inOut' });
        tl.to(fx, { sy: 1.08, duration: 0.2, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0);
        tl.call(() => this.emit('notes', s, s.item.colors.length ? s.item.colors : ['#ffd47a'], 9), [], 0);
        tl.call(() => this.emit('notes', s, s.item.colors.length ? s.item.colors : ['#ffd47a'], 6), [], 0.7);
        break;
      case 'shake':
        tl.to(fx, { y: 0.25 * size, duration: 0.12 });
        for (let i = 0; i < 6; i++) tl.to(fx, { rotZ: i % 2 ? -0.12 : 0.12, rotY: i % 2 ? -0.1 : 0.1, duration: 0.07 });
        tl.to(fx, { rotZ: 0, rotY: 0, y: 0, duration: 0.3, ease: 'bounce.out' });
        tl.call(() => this.emit('dust', s, ['#c8b898', '#a89878'], 18), [], 0.55);
        break;
      case 'roll': {
        // Avanza un poco en la dirección en que mira y vuelve
        const a = s.rotY;
        const d = 0.9 * size;
        const dx = -Math.sin(a) * d;
        const dz = -Math.cos(a) * d;
        tl.to(fx, { ox: dx, oz: dz, rotX: 0.06, duration: 0.6, ease: 'power2.inOut' })
          .to(fx, { ox: -dx * 0.4, oz: -dz * 0.4, rotX: -0.04, duration: 0.7, ease: 'power2.inOut' })
          .to(fx, { ox: 0, oz: 0, rotX: 0, duration: 0.5, ease: 'power2.out' });
        tl.call(() => this.emit('dust', s, ['#e8dcc0', '#c8b898'], 8), [], 0.3);
        break;
      }
      case 'yoyo':
        for (let i = 0; i < 2; i++) {
          tl.to(fx, { y: 0.9 * size, rotY: `+=${Math.PI}`, duration: 0.32, ease: 'power2.out' }).to(fx, { y: 0, rotY: `+=${Math.PI}`, duration: 0.32, ease: 'power2.in' });
        }
        tl.set(fx, { rotY: 0 });
        tl.call(() => this.emit('sparkle', s, s.item.colors, 10), [], 0.3);
        break;
      default:
        // Elementos de los universos: un saltito con estiramiento
        tl.to(fx, { sy: 0.85, sx: 1.08, sz: 1.08, duration: 0.1 })
          .to(fx, { y: 0.45, sy: 1.08, sx: 0.95, sz: 0.95, duration: 0.25, ease: 'power2.out' })
          .to(fx, { y: 0, sy: 1, sx: 1, sz: 1, duration: 0.45, ease: 'bounce.out' });
        tl.call(() => this.emit('sparkle', s, s.item.colors.length ? s.item.colors : ['#fff4d8'], 10), [], 0.2);
    }
    s.busy = tl;
    this.tweens.push(tl);
    if (s.item.sound) this.sfx(s.item.sound);
  }

  private emit(kind: 'notes' | 'sparkle' | 'dust', s: ItemState, colors: string[], count: number): void {
    const ps = this.bursts[kind];
    const pos = s.item.node.getAbsolutePosition();
    const h = kind === 'dust' ? 0.05 : 0.9 * s.scale;
    (ps.emitter as Vector3).set(pos.x, pos.y + h, pos.z);
    const c1 = Color3.FromHexString(colors[0] ?? '#ffffff');
    const c2 = Color3.FromHexString(colors[1] ?? colors[0] ?? '#ffffff');
    const a = kind === 'dust' ? 0.55 : 1;
    ps.color1 = new Color4(c1.r, c1.g, c1.b, a);
    ps.color2 = new Color4(c2.r, c2.g, c2.b, a);
    ps.colorDead = new Color4(c2.r, c2.g, c2.b, 0);
    ps.manualEmitCount = count;
    if (!ps.isStarted()) ps.start();
  }

  private sfx(key: string): void {
    const track = SFX[key];
    if (track) void this.audio.playSfx(track);
  }

  // ---------- Frame ----------

  update(dt: number): void {
    this.time += dt;
    const k = 1 - Math.exp(-dt * CONFIG.followSpeed);
    for (const s of this.states) {
      if (s.target) {
        s.x += (s.target.x - s.x) * k;
        s.z += (s.target.z - s.z) * k;
        s.surfaceY += (s.target.surfaceY - s.surfaceY) * k;
      }
      const node = s.item.node;
      const bob = s.item.selfFloat ? Math.sin(this.time * 0.6 + s.phase) * 0.18 : 0;
      node.position.set(
        s.x + s.fx.ox,
        s.surfaceY + this.rideDelta(s.ride) + s.hover + bob + s.lift + s.fx.y,
        s.z + s.fx.oz,
      );
      node.rotation.set(s.fx.rotX, s.rotY + s.fx.rotY + (s.item.selfFloat ? this.time * 0.05 : 0), s.fx.rotZ);
      const g = s.scale * s.grow.v;
      node.scaling.set(g * s.fx.sx, g * s.fx.sy, g * s.fx.sz);
    }
  }

  dispose(): void {
    for (const t of this.tweens) t.kill();
    this.tweens = [];
    if (this.observer) this.scene.onPointerObservable.remove(this.observer);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKey);
    this.canvas.style.cursor = '';
    this.highlight.dispose();
    this.flash.dispose();
    for (const ps of Object.values(this.bursts)) ps.dispose(false);
    for (const t of this.textures) t.dispose();
  }
}

function makeBurst(
  scene: Scene,
  name: string,
  texture: DynamicTexture,
  o: { size: [number, number]; life: [number, number]; power: [number, number]; dir1: [number, number, number]; dir2: [number, number, number]; gravity: [number, number, number]; additive: boolean },
): ParticleSystem {
  const ps = new ParticleSystem(name, 64, scene);
  ps.particleTexture = texture;
  ps.emitter = Vector3.Zero();
  ps.minEmitBox = new Vector3(-0.25, 0, -0.25);
  ps.maxEmitBox = new Vector3(0.25, 0.3, 0.25);
  ps.emitRate = 0;
  ps.manualEmitCount = 0;
  ps.minSize = o.size[0];
  ps.maxSize = o.size[1];
  ps.minLifeTime = o.life[0];
  ps.maxLifeTime = o.life[1];
  ps.minEmitPower = o.power[0];
  ps.maxEmitPower = o.power[1];
  ps.direction1 = new Vector3(...o.dir1);
  ps.direction2 = new Vector3(...o.dir2);
  ps.gravity = new Vector3(...o.gravity);
  ps.minAngularSpeed = -1;
  ps.maxAngularSpeed = 1;
  ps.blendMode = o.additive ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
  return ps;
}

/** Textura de una nota musical (para el efecto de la caja musical y los audífonos). */
function createNoteTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('dio-nota', { width: 64, height: 64 }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 6;
  ctx.font = 'bold 50px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♪', 32, 34);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}
