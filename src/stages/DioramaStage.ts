import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
  type UniversalCamera,
} from '@babylonjs/core';
import gsap from 'gsap';
import { DIORAMA_TEMPLATES, GENERATOR_CONFIG } from '../data/dioramas';
import type { DioramaPlan, MotifId, ObjectDefinition, SceneDefinition, TemplateId } from '../data/types';
import { DioramaKit, type TemplateBuild } from '../entities/diorama/DioramaKit';
import { MOTIFS } from '../entities/diorama/motifs';
import { ANCHORS, TEMPLATE_BUILDERS, anchorById } from '../entities/diorama/templates';
import { createObjectVisual } from '../entities/objectVisual';
import type { AudioManager } from '../systems/AudioManager';
import { DioramaEditor, EDITOR_BOUNDS, type Floater } from '../systems/DioramaEditor';
import type { MemorySystem } from '../systems/MemorySystem';
import type { MemoryParticleField } from '../systems/ParticleSystem';
import { generateDiorama } from '../systems/WorldGenerator';
import type { UIManager } from '../ui/UIManager';
import { mulberry32 } from '../utils/paint';
import type { ExperienceStage, StageContext } from './StageBase';

const CONFIG = {
  flightDuration: 6.5,
  /** Cámara elevada: distancia, inclinación y vaivén. */
  radius: 19.5,
  elevation: 0.52,
  target: new Vector3(0, 1.4, 0),
  swayAmplitude: 0.45,
  swaySpeed: 0.05,
  /** Momento (s) en que aparece cada grupo de la plantilla. */
  stageTimes: [2.2, 4.2, 6.0],
  motifStart: 7.6,
  motifInterval: 0.35,
  objectStart: 9.4,
  objectInterval: 1.3,
  condenseTime: 1.5,
  /** Control de cámara del usuario. */
  pitchMin: 0.18,
  pitchMax: 1.25,
  radiusMin: 10,
  radiusMax: 30,
  orbitSpeed: 0.0055,
  /** La habitación solo se mira desde su lado abierto. */
  roomYawLimit: 1.2,
  /** Segundos sin tocar nada antes de que vuelva el vaivén automático. */
  idleResume: 8,
};

const MOTIF_NAMES: Record<MotifId, string> = {
  farola: 'farola',
  acacia: 'acacia',
  'farol-papel': 'farol de papel',
  hongo: 'hongo',
  coral: 'coral',
  planeta: 'planeta',
  pagoda: 'pagoda',
};

/** Ángulo de vista frontal de cada plantilla (la habitación se mira desde su lado abierto). */
const FRONT_ANGLE: Record<TemplateId, number> = { castillo: Math.PI + 0.25, habitacion: 0.62, bosque: 0.2, isla: 0.35 };

interface Revealable {
  node: TransformNode;
  /** Si lo controla el editor, la aparición anima este valor en vez de la escala. */
  grow?: { v: number };
  at: number;
  float?: boolean;
  /** Partículas que se agrupan antes de que aparezca. */
  particles: number;
}

/**
 * Etapa 3 — Nuestro rincón.
 * El generador decide la plantilla a partir del recorrido por la cinta; los universos más visitados
 * aportan elementos, colores y luz, y los objetos de infancia se ubican según su categoría y orden.
 * Las partículas que formaban los escenarios se agrupan y construyen el diorama pieza por pieza.
 */
export class DioramaStage implements ExperienceStage {
  private scene: Scene;
  private camera: UniversalCamera;
  private memory: MemorySystem;
  private ui: UIManager;
  private field: MemoryParticleField;
  private canvas: HTMLCanvasElement;
  private audio: AudioManager;
  private scenes: SceneDefinition[];
  private catalog: ObjectDefinition[];

  private plan: DioramaPlan | null = null;
  private root: TransformNode | null = null;
  private kit: DioramaKit | null = null;
  private build: TemplateBuild | null = null;
  private lights: (HemisphericLight | DirectionalLight)[] = [];
  private shadow: ShadowGenerator | null = null;
  private tweens: (gsap.core.Tween | gsap.core.Timeline)[] = [];
  private floaters: (Floater & { phase: number })[] = [];
  private objects: TransformNode[] = [];
  private editor: DioramaEditor | null = null;
  /** Cámara del usuario (se suma a la vista automática) y su versión suavizada. */
  private view = { yaw: 0, pitch: CONFIG.elevation, radius: CONFIG.radius };
  private viewGoal = { yaw: 0, pitch: CONFIG.elevation, radius: CONFIG.radius };
  private lastTouch = -Infinity;
  private auto = 1;

  private rig = { flight: 0, angle: 0, front: 0 };
  private flightFrom = { pos: Vector3.Zero(), target: Vector3.Zero() };
  private time = 0;
  private parallax = { x: 0, y: 0 };

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    memory: MemorySystem,
    ui: UIManager,
    field: MemoryParticleField,
    canvas: HTMLCanvasElement,
    audio: AudioManager,
    scenes: SceneDefinition[],
    catalog: ObjectDefinition[],
  ) {
    this.canvas = canvas;
    this.audio = audio;
    this.scene = scene;
    this.camera = camera;
    this.memory = memory;
    this.ui = ui;
    this.field = field;
    this.scenes = scenes;
    this.catalog = catalog;
  }

  /** Plan generado (también útil para depurar). */
  get currentPlan(): DioramaPlan | null {
    return this.plan;
  }

  /** Editor del diorama (pruebas y depuración). */
  get currentEditor(): DioramaEditor | null {
    return this.editor;
  }

  async enter(context: StageContext): Promise<void> {
    context.setParallax(false);

    // ---- Decisión procedural ----
    const plan = generateDiorama(this.memory.snapshot(), this.scenes, (t) => ANCHORS[t]);
    this.plan = plan;
    const def = DIORAMA_TEMPLATES[plan.template];
    console.info('[Diorama] plan', plan);
    this.ui.setDebugExtra(describePlan(plan));

    // ---- Ambiente y luces ----
    this.setupEnvironment(def.sky, def.fogDensity);
    this.setupLights(plan);

    // ---- Construcción ----
    const root = new TransformNode('diorama', this.scene);
    this.root = root;
    const rand = mulberry32(plan.seed);
    this.kit = new DioramaKit(this.scene, root, this.shadow, rand);
    this.build = TEMPLATE_BUILDERS[plan.template](this.kit);

    // Lo que flota se mece según su posición: así lo que está encima se mueve con él
    for (const f of this.build.floaters) {
      this.floaters.push({ node: f, baseY: f.position.y, phase: (f.position.x + f.position.z) * 0.37 });
    }
    this.editor = new DioramaEditor(this.scene, this.camera, this.canvas, this.audio, EDITOR_BOUNDS[plan.template], {
      orbit: (dx, dy) => this.orbit(dx, dy),
      zoom: (f) => this.zoom(f),
      touch: () => (this.lastTouch = this.time),
    }, this.floaters);
    this.editor.onSelect = (name) => this.ui.setSelection(name);

    const items: Revealable[] = this.build.stages.map((node, i) => ({
      node,
      at: CONFIG.stageTimes[i] ?? CONFIG.stageTimes.at(-1)! + i,
      particles: 260,
    }));
    items.push(...this.placeMotifs(plan, rand));
    items.push(...(await this.placeObjects(plan)));
    this.editor.settle();

    // ---- Cámara: vuelo hasta la vista elevada ----
    this.rig.front = FRONT_ANGLE[plan.template];
    this.rig.angle = this.rig.front - 0.9;
    this.flightFrom.pos = this.camera.position.clone();
    this.flightFrom.target = this.camera.getTarget().clone();
    this.tweens.push(gsap.to(this.rig, { flight: 1, duration: CONFIG.flightDuration, ease: 'sine.inOut' }));
    this.tweens.push(gsap.to(this.rig, { angle: this.rig.front, duration: CONFIG.flightDuration + 3, ease: 'sine.out' }));

    // ---- Las partículas construyen el diorama ----
    this.field.ambient = 1;
    this.tweens.push(gsap.to(this.field, { brightness: 1, duration: 3 }));
    this.reveal(items);
    // La vida del diorama (agua, luciérnagas, humo...) empieza cuando ya está casi todo en pie
    this.tweens.push(gsap.delayedCall(CONFIG.stageTimes.at(-1)!, () => this.kit?.startParticles()));

    const last = Math.max(...items.map((i) => i.at)) + 1.8;
    this.tweens.push(
      gsap.delayedCall(last, () => {
        this.ui.setCaption('nuestro rincón', def.name);
        this.editor?.enable();
        this.ui.enableDioramaTools({
          rotate: (dir) => this.editor?.rotateSelected(-dir),
          scale: (dir) => this.editor?.scaleSelected(dir),
          reset: () => this.resetView(),
        });
        this.tweens.push(
          gsap.delayedCall(2.5, () =>
            this.ui.showHint('Arrastra un recuerdo para moverlo · arrastra el fondo para girar · rueda para acercar', 9000),
          ),
        );
        this.tweens.push(gsap.to(this.field, { brightness: 0.55, duration: 4 }));
        console.info('[Diorama] listo:', def.name);
      }),
    );
  }

  // ---------- Ambiente ----------

  private setupEnvironment(skyHex: string, fogDensity: number): void {
    const s = this.scene;
    const sky = Color3.FromHexString(skyHex);
    const from = s.clearColor.clone();
    s.fogMode = Scene.FOGMODE_EXP2;
    s.fogDensity = 0;
    s.fogColor = new Color3(from.r, from.g, from.b);
    const env = { t: 0 };
    this.tweens.push(
      gsap.to(env, {
        t: 1,
        duration: 7,
        ease: 'sine.inOut',
        onUpdate: () => {
          const r = from.r + (sky.r - from.r) * env.t;
          const g = from.g + (sky.g - from.g) * env.t;
          const b = from.b + (sky.b - from.b) * env.t;
          s.clearColor.set(r, g, b, 1);
          s.fogColor.set(r, g, b);
          s.fogDensity = fogDensity * env.t;
        },
      }),
    );
  }

  private setupLights(plan: DioramaPlan): void {
    const def = DIORAMA_TEMPLATES[plan.template];
    const tint = Color3.FromHexString(plan.lightTint);
    const amount = GENERATOR_CONFIG.lightTintAmount;

    const hemi = new HemisphericLight('dio-hemi', new Vector3(0.2, 1, -0.2), this.scene);
    hemi.diffuse = Color3.Lerp(Color3.FromHexString(def.hemi.sky), tint, amount);
    hemi.groundColor = Color3.FromHexString(def.hemi.ground);
    hemi.intensity = 0;

    const dir = new Vector3(...def.key.direction).normalize();
    const key = new DirectionalLight('dio-key', dir, this.scene);
    key.position = dir.scale(-30);
    key.diffuse = Color3.Lerp(Color3.FromHexString(def.key.color), tint, amount);
    key.intensity = 0;

    const shadow = new ShadowGenerator(1024, key);
    shadow.useBlurExponentialShadowMap = true;
    shadow.blurKernel = 24;
    shadow.darkness = 0.35;
    this.shadow = shadow;

    this.lights.push(hemi, key);
    this.tweens.push(gsap.to(hemi, { intensity: def.hemi.intensity, duration: 5, delay: 1.5, ease: 'sine.inOut' }));
    this.tweens.push(gsap.to(key, { intensity: def.key.intensity, duration: 5, delay: 2, ease: 'sine.inOut' }));
  }

  // ---------- Elementos de los universos ----------

  private placeMotifs(plan: DioramaPlan, rand: () => number): Revealable[] {
    const build = this.build!;
    const kit = this.kit!;
    // Los lugares se reparten en un orden propio de cada usuario
    const slots = [...build.accentSlots].sort(() => rand() - 0.5);
    const items: Revealable[] = [];
    let slot = 0;
    for (const accent of plan.accents) {
      for (let n = 0; n < accent.count && slot < slots.length; n++, slot++) {
        const { node, float } = MOTIFS[accent.motif](kit, build.root, slots[slot], accent.palette);
        node.rotation.y = rand() * Math.PI * 2;
        const grow = this.editor!.add({
          node,
          name: MOTIF_NAMES[accent.motif],
          kind: 'motivo',
          effect: null,
          sound: null,
          selfFloat: Boolean(float),
          colors: accent.palette,
        });
        items.push({ node, grow, at: CONFIG.motifStart + items.length * CONFIG.motifInterval, float, particles: 90 });
      }
    }
    return items;
  }

  // ---------- Objetos de infancia ----------

  private async placeObjects(plan: DioramaPlan): Promise<Revealable[]> {
    const items: Revealable[] = [];
    const front = FRONT_ANGLE[plan.template];
    for (const [i, p] of plan.placements.entries()) {
      const def = this.catalog.find((c) => c.id === p.objectId);
      const anchor = anchorById(plan.template, p.anchorId);
      if (!def || !anchor) continue;

      const holder = new TransformNode(`recuerdo-${p.objectId}`, this.scene);
      holder.parent = this.root;
      const visual = await createObjectVisual(this.scene, def, p.color, `recuerdo-visual-${p.objectId}`);
      visual.parent = holder;

      // Apoyado sobre su lugar: la base del modelo toca la superficie
      const { min } = visual.getHierarchyBoundingVectors(true);
      visual.position.y = -min.y;
      holder.position.set(anchor.position[0], anchor.position[1], anchor.position[2]);
      holder.scaling.setAll(p.scale);
      // Mira hacia el espectador, con un leve giro propio
      holder.rotation.y = -front + (((p.order * 37) % 10) / 10 - 0.5) * 0.6;

      for (const m of visual.getChildMeshes()) {
        m.isPickable = true;
        m.receiveShadows = true;
        this.shadow?.addShadowCaster(m, false);
      }
      this.objects.push(holder);
      const grow = this.editor!.add({
        node: holder,
        name: def.name.toLowerCase(),
        kind: 'objeto',
        effect: def.interaction,
        sound: def.sound,
        selfFloat: false,
        colors: [p.color, '#fff4d8'],
      });
      items.push({ node: holder, grow, at: CONFIG.objectStart + i * CONFIG.objectInterval, particles: 160 });
    }
    return items;
  }

  // ---------- Aparición pieza por pieza ----------

  private reveal(items: Revealable[]): void {
    for (const item of items) {
      const grow = item.grow;
      const target = item.node.scaling.clone();
      if (!grow) item.node.scaling.setAll(0.0001);
      item.node.setEnabled(false);

      // Las partículas se agrupan donde va a aparecer la pieza
      const world = () => item.node.getAbsolutePosition().add(new Vector3(0, 0.8, 0));
      const cluster = this.field.condense(world, Math.max(item.at - CONFIG.condenseTime, 0), CONFIG.condenseTime, item.particles);

      this.tweens.push(
        gsap.delayedCall(item.at, () => {
          item.node.setEnabled(true);
          const done = () => this.field.release(cluster);
          this.tweens.push(
            grow
              ? gsap.to(grow, { v: 1, duration: 1.6, ease: 'back.out(1.6)', onComplete: done })
              : gsap.to(item.node.scaling, { x: target.x, y: target.y, z: target.z, duration: 1.6, ease: 'back.out(1.6)', onComplete: done }),
          );
        }),
      );
    }
  }

  // ---------- Frame ----------

  // ---------- Cámara del usuario ----------

  private orbit(dx: number, dy: number): void {
    const g = this.viewGoal;
    g.yaw -= dx * CONFIG.orbitSpeed;
    if (this.plan?.template === 'habitacion') g.yaw = clamp(g.yaw, -CONFIG.roomYawLimit, CONFIG.roomYawLimit);
    g.pitch = clamp(g.pitch + dy * CONFIG.orbitSpeed * 0.8, CONFIG.pitchMin, CONFIG.pitchMax);
  }

  private zoom(factor: number): void {
    this.viewGoal.radius = clamp(this.viewGoal.radius * factor, CONFIG.radiusMin, CONFIG.radiusMax);
  }

  /** Botón "restablecer": recuerdos a su lugar y cámara a la vista inicial. */
  private resetView(): void {
    this.editor?.resetAll();
    // El giro vuelve por el camino más corto
    const turns = Math.round(this.viewGoal.yaw / (Math.PI * 2)) * Math.PI * 2;
    this.view.yaw -= turns;
    this.viewGoal.yaw = 0;
    this.viewGoal.pitch = CONFIG.elevation;
    this.viewGoal.radius = CONFIG.radius;
    this.lastTouch = this.time - CONFIG.idleResume + 2;
  }

  // ---------- Frame ----------

  update(dt: number): void {
    this.time += dt;
    for (const fn of this.kit?.life ?? []) fn(this.time, dt);

    // El vaivén automático se apaga mientras el usuario mira por su cuenta y vuelve despacio
    const idle = this.time - this.lastTouch > CONFIG.idleResume;
    this.auto += ((idle ? 1 : 0) - this.auto) * (1 - Math.exp(-dt * (idle ? 0.35 : 4)));

    const ptr = this.scene;
    const eng = this.scene.getEngine();
    const tx = ((ptr.pointerX / Math.max(eng.getRenderWidth(), 1)) * 2 - 1) * 0.15 * this.auto;
    const ty = ((ptr.pointerY / Math.max(eng.getRenderHeight(), 1)) * 2 - 1) * 0.06 * this.auto;
    const k = 1 - Math.exp(-dt * 1.5);
    this.parallax.x += (tx - this.parallax.x) * k;
    this.parallax.y += (ty - this.parallax.y) * k;

    const kv = 1 - Math.exp(-dt * 6);
    this.view.yaw += (this.viewGoal.yaw - this.view.yaw) * kv;
    this.view.pitch += (this.viewGoal.pitch - this.view.pitch) * kv;
    this.view.radius += (this.viewGoal.radius - this.view.radius) * kv;

    const sway = Math.sin(this.time * CONFIG.swaySpeed * Math.PI * 2) * CONFIG.swayAmplitude * this.rig.flight * this.auto;
    const a = this.rig.angle + this.view.yaw + sway + this.parallax.x;
    const e = this.view.pitch + this.parallax.y;
    const r = this.view.radius;
    const pos = new Vector3(
      CONFIG.target.x + Math.sin(a) * Math.cos(e) * r,
      CONFIG.target.y + Math.sin(e) * r,
      CONFIG.target.z - Math.cos(a) * Math.cos(e) * r,
    );
    const t = this.rig.flight;
    if (t < 1) {
      this.camera.position.copyFrom(Vector3.Lerp(this.flightFrom.pos, pos, t));
      this.camera.setTarget(Vector3.Lerp(this.flightFrom.target, CONFIG.target, Math.min(t * 1.3, 1)));
    } else {
      this.camera.position.copyFrom(pos);
      this.camera.setTarget(CONFIG.target);
    }

    for (const f of this.floaters) {
      f.node.position.y = f.baseY + Math.sin(this.time * 0.6 + f.phase) * 0.18;
    }
    this.editor?.update(dt);
  }

  dispose(): void {
    for (const t of this.tweens) t.kill();
    this.tweens = [];
    this.ui.setDebugExtra('');
    this.ui.disableDioramaTools();
    this.editor?.dispose();
    this.editor = null;
    this.shadow?.dispose();
    for (const l of this.lights) l.dispose();
    this.root?.dispose(false, true);
    this.kit?.dispose();
    this.root = null;
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(Math.max(v, a), b);
}

function describePlan(plan: DioramaPlan): string {
  const w = plan.weights
    .map((x) => `${x.id.padEnd(13)} T=${x.T.toFixed(2)} V=${x.V.toFixed(2)} P=${x.P.toFixed(2)}`)
    .join('\n');
  const s = Object.entries(plan.scores)
    .map(([k, v]) => `${k}=${v.toFixed(2)}`)
    .join('  ');
  const acc = plan.accents.map((a) => `${a.sceneId}:${a.motif}×${a.count}`).join(', ');
  const obj = plan.placements.map((p) => `${p.objectId}→${p.anchorId}`).join(', ');
  return `diorama: ${plan.template}\n${s}\n\npesos (λ=${GENERATOR_CONFIG.lambda}):\n${w}\n\nacentos: ${acc}\nobjetos: ${obj}`;
}
