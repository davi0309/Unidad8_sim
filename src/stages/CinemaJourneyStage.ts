import {
  Color3,
  PointerEventTypes,
  Scene,
  Vector3,
  type Nullable,
  type Observer,
  type PointerInfo,
  type UniversalCamera,
} from '@babylonjs/core';
import gsap from 'gsap';
import { MUSIC } from '../data/audio';
import type { SceneDefinition } from '../data/types';
import { BokehBackdrop } from '../entities/BokehBackdrop';
import { CinematicScene } from '../entities/CinematicScene';
import { FILM, FilmStrip } from '../entities/FilmStrip';
import { createPointMesh, type PointMesh } from '../entities/PointLayer';
import type { AudioManager } from '../systems/AudioManager';
import { ExperienceTracker } from '../systems/ExperienceTracker';
import { InteractionSystem } from '../systems/InteractionSystem';
import type { MemorySystem } from '../systems/MemorySystem';
import type { MemoryParticleField } from '../systems/ParticleSystem';
import type { UIManager } from '../ui/UIManager';
import type { ExperienceStage, StageContext } from './StageBase';

const CONFIG = {
  /** Dónde está suspendida la cinta (lejos del campo de partículas del Big Bang). */
  origin: new Vector3(0, 0, 72),
  background: new Color3(0.02, 0.016, 0.04),
  /** Fondo final de la cinta: azul índigo con círculos de luz. */
  dreamBackground: Color3.FromHexString('#252262'),
  /** Segundos que tarda el fondo en transformarse en luces de colores. */
  dreamTransition: 22,
  flightDuration: 7,
  moveDuration: 1.7,
  approachDuration: 1.4,
  /** Distancia de la vista "cinta" respecto a la vista "acercado". */
  stripViewFactor: 2.3,
  /** Segundos detenido antes de cambiar la música. */
  musicDelay: 0.4,
  /** Cuánto mover el cursor sobre la imagen para contar una interacción. */
  stirPerInteraction: 6,
  stirCooldown: 1.5,
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

interface CameraRig {
  /** Posición a lo largo de la cinta (0 = primer fotograma). */
  s: number;
  /** 0 = vista de cinta, 1 = acercado al fotograma. */
  approach: number;
  /** 0 → 1 durante el vuelo de entrada. */
  flight: number;
}

/**
 * Etapa 2 — Lo que nos hizo sentir.
 * La cámara viaja hasta una cinta de película suspendida; cada fotograma es un universo
 * dibujado con partículas. El usuario decide dónde detenerse, cuánto quedarse y a dónde volver.
 */
export class CinemaJourneyStage implements ExperienceStage {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private camera: UniversalCamera;
  private audio: AudioManager;
  private ui: UIManager;
  private field: MemoryParticleField;
  private definitions: SceneDefinition[];

  private context: StageContext | null = null;
  private strip: FilmStrip | null = null;
  private frames: CinematicScene[] = [];
  private stars: PointMesh | null = null;
  private bokeh: BokehBackdrop | null = null;
  private starsIntensity = { value: 1 };
  private tracker: ExperienceTracker;
  private interaction: InteractionSystem<CinematicScene> | null = null;
  private pointerObserver: Nullable<Observer<PointerInfo>> = null;
  private tweens: (gsap.core.Tween | gsap.core.Timeline)[] = [];

  private rig: CameraRig = { s: 0, approach: 0, flight: 0 };
  private flightFrom = { pos: Vector3.Zero(), target: Vector3.Zero() };
  private parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  private index = 0;
  private ready = false;
  private finishing = false;
  private continueShown = false;
  private time = 0;

  private settledIndex: number | null = null;
  private settledFor = 0;
  private musicIndex: number | null = null;

  private stir = { amount: 0, last: 0, strength: 0, local: Vector3.Zero(), lastLocal: null as Vector3 | null };

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    camera: UniversalCamera,
    memory: MemorySystem,
    audio: AudioManager,
    ui: UIManager,
    field: MemoryParticleField,
    definitions: SceneDefinition[],
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.camera = camera;
    this.audio = audio;
    this.ui = ui;
    this.field = field;
    this.definitions = definitions;
    this.tracker = new ExperienceTracker(memory);
  }

  async enter(context: StageContext): Promise<void> {
    this.context = context;
    context.setParallax(false);
    // El teclado responde desde el inicio (aunque algunos escenarios sigan pintándose)
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('keydown', this.handleKeys);

    // Precarga la música de los universos mientras la cámara viaja
    for (const def of this.definitions) {
      const track = MUSIC[def.music];
      if (track) this.audio.preload(track);
    }

    this.fadeEnvironment();
    this.strip = new FilmStrip(this.scene, this.definitions.length, CONFIG.origin);
    this.frames = this.definitions.map(
      (def, i) => new CinematicScene(this.scene, def, i, this.strip!.frames[i], { w: FILM.frameW, h: FILM.frameH }),
    );
    this.createStars();
    const stripCenter = CONFIG.origin.add(new Vector3((FILM.spacing * (this.definitions.length - 1)) / 2, 0, 0));
    this.bokeh = new BokehBackdrop(this.scene, stripCenter, FILM.spacing * this.definitions.length);

    // Vuelo de entrada: la cámara deja el espacio de la infancia y viaja hacia la cinta
    this.flightFrom.pos = this.camera.position.clone();
    this.flightFrom.target = this.camera.getTarget().clone();
    this.tweens.push(
      gsap.to(this.rig, {
        flight: 1,
        duration: CONFIG.flightDuration,
        ease: 'sine.inOut',
        onComplete: () => this.onArrived(),
      }),
    );
    this.tweens.push(gsap.to(this.field, { brightness: 0.55, duration: CONFIG.flightDuration }));

    // Los dos primeros fotogramas se forman durante el vuelo; el resto se pinta en segundo plano
    await this.frames[0].build();
    this.tweens.push(gsap.to(this.frames[0], { assemble: 1, duration: 3.5, delay: 2.2, ease: 'sine.out' }));
    for (const f of this.frames.slice(1)) await f.build();
  }

  // ---------- Ambiente ----------

  private fadeEnvironment(): void {
    const s = this.scene;
    const from = s.clearColor.clone();
    const fogFrom = s.fogDensity;
    const bg = CONFIG.background;
    const env = { t: 0 };
    this.tweens.push(
      gsap.to(env, {
        t: 1,
        duration: CONFIG.flightDuration,
        ease: 'sine.inOut',
        onUpdate: () => {
          const r = from.r + (bg.r - from.r) * env.t;
          const g = from.g + (bg.g - from.g) * env.t;
          const b = from.b + (bg.b - from.b) * env.t;
          s.clearColor.set(r, g, b, 1);
          s.fogColor.set(r, g, b);
          s.fogDensity = fogFrom * (1 - env.t);
        },
        onComplete: () => {
          s.fogMode = Scene.FOGMODE_NONE;
        },
      }),
    );
  }

  /** Estrellas lejanas alrededor de la cinta (mismo shader de puntos). */
  private createStars(): void {
    const n = 2600;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 4);
    const motion = new Float32Array(n * 4);
    const param = new Float32Array(n * 4);
    const center = CONFIG.origin.add(new Vector3((FILM.spacing * (this.definitions.length - 1)) / 2, 0, 0));
    const palette = [
      [1, 1, 1],
      [0.8, 0.86, 1],
      [1, 0.88, 0.75],
      [0.85, 0.75, 1],
    ];
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 120 + Math.random() * 160;
      positions[i * 3] = center.x + s * Math.cos(a) * r;
      positions[i * 3 + 1] = center.y + u * r * 0.7;
      positions[i * 3 + 2] = center.z + Math.abs(s * Math.sin(a)) * r;
      const c = palette[i % palette.length];
      colors.set([c[0], c[1], c[2], 0.35 + Math.random() * 0.5], i * 4);
      motion.set([1, Math.random(), 0.5 + Math.random() * 1.5, 0.5 + Math.random() * 1.2], i * 4);
    }
    const big = { w: 1e5, h: 1e5 };
    this.stars = createPointMesh(this.scene, 'cinema-stars', { count: n, positions, colors, motion, param }, 'add', big);
    this.stars.material.setFloat('uAssemble', 1);
    this.stars.mesh.alphaIndex = -20;
  }

  // ---------- Llegada y navegación ----------

  private onArrived(): void {
    if (this.finishing) return;
    this.ready = true;
    this.startDreamBackground();
    this.ui.showNav({ prev: () => this.go(-1), next: () => this.go(1) });
    this.updateNavState();
    this.updateCaption();
    this.ui.showHint('← → para recorrer la cinta · clic en la imagen para acercarte', 7000);

    this.interaction = new InteractionSystem<CinematicScene>(this.scene, this.canvas, {
      resolve: (mesh) => this.frames.find((f) => f.backing === mesh) ?? null,
      canInteract: () => this.ready && !this.finishing,
      onHover: () => undefined,
      onSelect: (frame) => {
        if (frame.index === this.index) this.toggleApproach();
        else this.goTo(frame.index);
      },
    });
    this.pointerObserver = this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERMOVE) this.handleStir();
    });
  }

  /** El espacio oscuro se transforma lentamente en un fondo índigo con círculos de luz. */
  private startDreamBackground(): void {
    const s = this.scene;
    const from = s.clearColor.clone();
    const to = CONFIG.dreamBackground;
    const env = { t: 0 };
    this.tweens.push(
      gsap.to(env, {
        t: 1,
        duration: CONFIG.dreamTransition,
        ease: 'sine.inOut',
        onUpdate: () => {
          s.clearColor.set(
            from.r + (to.r - from.r) * env.t,
            from.g + (to.g - from.g) * env.t,
            from.b + (to.b - from.b) * env.t,
            1,
          );
        },
      }),
    );
    if (this.bokeh) {
      this.tweens.push(gsap.to(this.bokeh, { reveal: 1, duration: CONFIG.dreamTransition * 1.1, ease: 'sine.inOut' }));
    }
    // Las estrellas se apagan casi del todo: el fondo pasa a ser de luces
    this.tweens.push(gsap.to(this.starsIntensity, { value: 0.25, duration: CONFIG.dreamTransition, ease: 'sine.inOut' }));
    this.tweens.push(gsap.to(this.field, { brightness: 0.2, duration: CONFIG.dreamTransition }));
  }

  private go(delta: number): void {
    this.goTo(this.index + delta);
  }

  private goTo(target: number): void {
    if (!this.ready || this.finishing) return;
    const next = Math.min(Math.max(target, 0), this.frames.length - 1);
    if (next === this.index) return;
    this.index = next;
    const distance = Math.abs(this.rig.s - next);
    gsap.killTweensOf(this.rig, 's');
    this.tweens.push(
      gsap.to(this.rig, {
        s: next,
        duration: CONFIG.moveDuration + Math.max(distance - 1, 0) * 0.5,
        ease: 'power2.inOut',
      }),
    );
    if (this.rig.approach > 0) this.setApproach(0);
    this.updateNavState();
    this.updateCaption();
  }

  private toggleApproach(): void {
    this.setApproach(this.rig.approach > 0.5 ? 0 : 1);
  }

  private setApproach(value: number): void {
    if (!this.ready || this.finishing) return;
    if (value === 1) this.tracker.interaction(this.definitions[this.index].id);
    gsap.killTweensOf(this.rig, 'approach');
    this.tweens.push(
      gsap.to(this.rig, { approach: value, duration: CONFIG.approachDuration, ease: 'power2.inOut' }),
    );
  }

  private updateNavState(): void {
    this.ui.setNavState(this.index > 0, this.index < this.frames.length - 1);
  }

  private updateCaption(): void {
    this.ui.setCaption(ROMAN[this.index] ?? String(this.index + 1), this.definitions[this.index].title);
  }

  private handleKeys = (e: KeyboardEvent): void => {
    if (!this.ready || this.finishing) return;
    switch (e.key) {
      case 'ArrowRight':
        this.go(1);
        break;
      case 'ArrowLeft':
        this.go(-1);
        break;
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        if (!e.repeat) this.setApproach(1);
        break;
      case 'ArrowDown':
      case 'Escape':
        if (!e.repeat) this.setApproach(0);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  private handleVisibility = (): void => {
    this.tracker.setPaused(document.hidden);
  };

  /** Mover el cursor sobre la imagen aparta las partículas y cuenta como interacción. */
  private handleStir(): void {
    if (!this.ready || this.finishing) return;
    const frame = this.frames[this.index];
    const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m) => m === frame.backing);
    if (!pick?.hit || !pick.pickedPoint) {
      this.stir.lastLocal = null;
      return;
    }
    const local = frame.toLocal(pick.pickedPoint);
    this.stir.local.copyFrom(local);
    this.stir.strength = 1;
    if (this.stir.lastLocal) {
      this.stir.amount += Vector3.Distance(local, this.stir.lastLocal);
      if (this.stir.amount >= CONFIG.stirPerInteraction && this.time - this.stir.last > CONFIG.stirCooldown) {
        this.stir.amount = 0;
        this.stir.last = this.time;
        this.tracker.interaction(frame.definition.id);
      }
    }
    this.stir.lastLocal = local;
  }

  // ---------- Cierre ----------

  private finish(): void {
    if (this.finishing) return;
    this.finishing = true;
    this.ui.hideNav();
    this.ui.hideCaption();
    this.ui.hideHint();
    this.ui.hideContinue();
    this.interaction?.setEnabled(false);
    gsap.killTweensOf(this.rig, 'approach');
    this.tweens.push(gsap.to(this.rig, { approach: 0, duration: 1.2, ease: 'power2.inOut' }));

    // Los escenarios se desprenden de los fotogramas y vuelven a ser partículas;
    // después la cinta, las luces del fondo y las estrellas se apagan (nada desaparece de golpe)
    const tl = gsap.timeline({ onComplete: () => this.context?.complete() });
    this.frames.forEach((f, i) => {
      tl.to(f, { assemble: 0, duration: 3.2, ease: 'sine.in' }, 0.6 + Math.abs(i - this.index) * 0.25);
    });
    const fade = { v: 1 };
    tl.to(fade, { v: 0, duration: 3, ease: 'sine.inOut', onUpdate: () => this.strip?.setVisibility(fade.v) }, 2.4);
    if (this.bokeh) tl.to(this.bokeh, { reveal: 0, duration: 3.4, ease: 'sine.inOut' }, 2.2);
    tl.to(this.starsIntensity, { value: 0, duration: 3, ease: 'sine.inOut' }, 2.4);
    this.frames.forEach((f) => tl.to(f, { intensity: 0, duration: 2 }, 3.6));
    this.tweens.push(tl);
  }

  // ---------- Frame ----------

  private viewFor(s: number, approach: number): { pos: Vector3; target: Vector3 } {
    const strip = this.strip!;
    const center = strip.pointAt(s);
    const normal = strip.normalAt(s);
    const tan = Math.tan(this.camera.fov / 2);
    const aspect = this.scene.getEngine().getAspectRatio(this.camera);
    const fitH = FILM.frameH / 2 / tan;
    const fitW = FILM.frameW / 2 / (tan * aspect);
    const close = Math.max(fitH, fitW) * 0.97;
    const dist = close * (CONFIG.stripViewFactor + (1 - CONFIG.stripViewFactor) * approach);
    const tangent = strip.tangentAt(s);
    const side = tangent.scale(this.parallax.x * (1 - approach * 0.6));
    const up = new Vector3(0, this.parallax.y * (1 - approach * 0.6), 0);
    return {
      pos: center.add(normal.scale(dist)).add(side).add(up),
      target: center.add(side.scale(0.3)).add(up.scale(0.3)),
    };
  }

  update(dt: number): void {
    if (!this.strip) return;
    this.time += dt;

    // Paralaje propio, suave
    const ptr = this.scene;
    const w = this.scene.getEngine().getRenderWidth();
    const h = this.scene.getEngine().getRenderHeight();
    this.parallax.tx = ((ptr.pointerX / Math.max(w, 1)) * 2 - 1) * 0.7;
    this.parallax.ty = -((ptr.pointerY / Math.max(h, 1)) * 2 - 1) * 0.4;
    const k = 1 - Math.exp(-dt * 2);
    this.parallax.x += (this.parallax.tx - this.parallax.x) * k;
    this.parallax.y += (this.parallax.ty - this.parallax.y) * k;

    // Cámara
    const view = this.viewFor(this.rig.s, this.rig.approach);
    if (this.rig.flight < 1) {
      const t = this.rig.flight;
      this.camera.position.copyFrom(Vector3.Lerp(this.flightFrom.pos, view.pos, t));
      this.camera.setTarget(Vector3.Lerp(this.flightFrom.target, view.target, Math.min(t * 1.4, 1)));
    } else {
      this.camera.position.copyFrom(view.pos);
      this.camera.setTarget(view.target);
    }

    // Fotogramas: se forman al acercarse, se atenúan los lejanos
    const scale = this.scene.getEngine().getRenderHeight() / (2 * Math.tan(this.camera.fov / 2));
    this.stir.strength *= Math.exp(-dt * 1.6);
    for (const f of this.frames) {
      const d = Math.abs(f.index - this.rig.s);
      if (!this.finishing) f.intensity = 0.42 + 0.58 * Math.max(0, 1 - d);
      if (this.ready && !this.finishing && f.built && f.assemble === 0 && d < 1.6) {
        this.tweens.push(gsap.to(f, { assemble: 1, duration: 3.2, ease: 'sine.out' }));
        f.assemble = 0.0001;
      }
      if (f.index === this.index) f.setPointer(this.stir.local.x, this.stir.local.y, this.stir.strength);
      else f.setPointer(0, 0, 0);
      f.update(this.time, scale);
    }
    if (this.stars) {
      this.stars.material.setFloat('uTime', this.time);
      this.stars.material.setFloat('uScale', scale);
      this.stars.material.setFloat('uIntensity', this.starsIntensity.value);
    }
    this.bokeh?.update();

    if (this.ready && !this.finishing) this.updateSettled(dt);
    this.tracker.update();
  }

  /** Detecta cuándo la cámara se detuvo en un fotograma: visita, tiempo y música. */
  private updateSettled(dt: number): void {
    const nearest = Math.round(this.rig.s);
    const settled = Math.abs(this.rig.s - nearest) < 0.03 ? nearest : null;

    if (settled !== this.settledIndex) {
      this.settledIndex = settled;
      this.settledFor = 0;
      if (settled === null) this.tracker.leave();
      else this.tracker.enter(this.definitions[settled].id);
    }
    if (settled === null) return;

    this.settledFor += dt;
    if (this.settledFor >= CONFIG.musicDelay && this.musicIndex !== settled) {
      this.musicIndex = settled;
      const track = MUSIC[this.definitions[settled].music];
      if (track) void this.audio.playMusic(track, 2.5);
    }

    // "continuar" aparece cuando el usuario ya se detuvo en los seis universos
    if (!this.continueShown && this.tracker.hasVisitedAll(this.definitions.map((d) => d.id))) {
      this.continueShown = true;
      this.ui.showContinue(() => this.finish());
    }
  }

  dispose(): void {
    for (const t of this.tweens) t.kill();
    this.tweens = [];
    gsap.killTweensOf(this.rig);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('keydown', this.handleKeys);
    this.scene.onPointerObservable.remove(this.pointerObserver);
    this.interaction?.dispose();
    for (const f of this.frames) f.dispose();
    this.frames = [];
    this.bokeh?.dispose();
    this.bokeh = null;
    this.stars?.mesh.dispose();
    this.stars?.material.dispose();
    this.strip?.dispose();
    this.strip = null;
  }
}
