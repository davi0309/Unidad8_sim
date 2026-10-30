import {
  Color3,
  Color4,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
  type AbstractMesh,
} from '@babylonjs/core';
import gsap from 'gsap';
import type { ObjectDefinition } from '../data/types';
import { MemoryObject } from '../entities/MemoryObject';
import { InteractionSystem } from '../systems/InteractionSystem';
import type { MemorySystem } from '../systems/MemorySystem';
import type { MemoryParticleField } from '../systems/ParticleSystem';
import { createGlowTexture } from '../utils/textures';
import type { UIManager } from '../ui/UIManager';
import type { ExperienceStage, StageContext } from './StageBase';

/** Ajustes de la etapa, en un solo lugar para iterar rápido. */
const CONFIG = {
  background: new Color3(0.035, 0.03, 0.07),
  fogDensity: 0.032,
  environmentFade: 9, // s para pasar del negro del origen al fondo de la infancia
  spread: { x: 11, y: 4.6, zNear: -1, zFar: 7 },
  appearInterval: 0.9, // segundos entre la aparición de cada objeto
  firstAppear: 1.8, // da tiempo a que las primeras partículas se agrupen
  condenseTime: 1.6, // lo que tardan las partículas en formar cada objeto
  particlesPerObject: 110,
  focusPoint: new Vector3(0, 0.3, -5.5), // frente a la cámara
  keptRow: { y: -3.6, z: -2.5, gap: 2.4 },
  hintDelay: 4,
  clickCooldown: 1.8, // s antes de aceptar otro clic tras seleccionar
};

export class ChildhoodStage implements ExperienceStage {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private memory: MemorySystem;
  private ui: UIManager;
  private field: MemoryParticleField;
  private catalog: ObjectDefinition[];

  private objects: MemoryObject[] = [];
  private byMesh = new Map<AbstractMesh, MemoryObject>();
  private interaction: InteractionSystem<MemoryObject> | null = null;
  private context: StageContext | null = null;
  private finishing = false;

  // Recursos de ambiente a liberar
  private lights: (HemisphericLight | PointLight)[] = [];
  private dust: ParticleSystem | null = null;
  private bokeh: Mesh[] = [];
  private glowTexture: DynamicTexture | null = null;
  private tweens: gsap.core.Tween[] = [];

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    memory: MemorySystem,
    ui: UIManager,
    field: MemoryParticleField,
    catalog: ObjectDefinition[],
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.memory = memory;
    this.ui = ui;
    this.field = field;
    this.catalog = catalog;
  }

  async enter(context: StageContext): Promise<void> {
    this.context = context;
    this.buildEnvironment();
    await this.spawnObjects();

    this.interaction = new InteractionSystem<MemoryObject>(this.scene, this.canvas, {
      resolve: (mesh) => this.byMesh.get(mesh) ?? null,
      canInteract: (obj) => obj.isInteractive && !this.finishing,
      onHover: (obj) => this.handleHover(obj),
      onSelect: (obj) => this.handleSelect(obj),
    });

    this.tweens.push(
      gsap.delayedCall(CONFIG.hintDelay, () => {
        if (this.memory.count === 0 && !this.finishing) this.ui.showHint('Elige lo que quieras conservar');
      }),
    );
    this.ui.setMemoryDots(0, this.memory.maxSelections);
  }

  // ---------- Ambiente ----------

  private buildEnvironment(): void {
    const s = this.scene;
    const bg = CONFIG.background;
    // Fondo y niebla llegan con un fundido lento desde el negro del Big Bang (sin saltos)
    s.fogMode = Scene.FOGMODE_EXP2;
    s.fogColor = new Color3(s.clearColor.r, s.clearColor.g, s.clearColor.b);
    s.fogDensity = 0;
    const env = { t: 0 };
    const from = s.clearColor.clone();
    this.tweens.push(
      gsap.to(env, {
        t: 1,
        duration: CONFIG.environmentFade,
        ease: 'sine.inOut',
        onUpdate: () => {
          const r = from.r + (bg.r - from.r) * env.t;
          const g = from.g + (bg.g - from.g) * env.t;
          const b = from.b + (bg.b - from.b) * env.t;
          s.clearColor.set(r, g, b, 1);
          s.fogColor.set(r, g, b);
          s.fogDensity = CONFIG.fogDensity * env.t;
        },
      }),
    );

    const hemi = new HemisphericLight('childhood-hemi', new Vector3(0.2, 1, -0.3), s);
    hemi.intensity = 0.75;
    hemi.diffuse = new Color3(0.95, 0.85, 1);
    hemi.groundColor = new Color3(0.2, 0.15, 0.3);

    const warm = new PointLight('childhood-warm', new Vector3(-3, 3, -9), s);
    warm.diffuse = new Color3(1, 0.78, 0.55);
    warm.intensity = 0.6;

    this.lights.push(hemi, warm);
    this.createBokeh();
    this.createDust();

    // Lo que queda del Big Bang pasa a ser ambiente
    this.tweens.push(gsap.to(this.field, { ambient: 1, duration: 10, ease: 'sine.inOut' }));
  }

  private getGlowTexture(): DynamicTexture {
    this.glowTexture ??= createGlowTexture(this.scene, 'childhood-glow');
    return this.glowTexture;
  }

  /** Luces grandes fuera de foco al fondo. Planos que siempre miran a la cámara. */
  private createBokeh(): void {
    const tex = this.getGlowTexture();
    const tints = [new Color3(0.55, 0.38, 0.85), new Color3(0.95, 0.55, 0.42), new Color3(0.38, 0.55, 0.9)];

    for (let i = 0; i < 12; i++) {
      const size = 6 + Math.random() * 10;
      const orb = MeshBuilder.CreatePlane(`bokeh-${i}`, { size }, this.scene);
      orb.billboardMode = Mesh.BILLBOARDMODE_ALL;
      orb.position.set((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 24, 16 + Math.random() * 18);
      orb.isPickable = false;

      const m = new StandardMaterial(`bokeh-mat-${i}`, this.scene);
      m.disableLighting = true;
      m.fogEnabled = false;
      m.emissiveColor = tints[i % tints.length];
      m.opacityTexture = tex;
      m.alpha = 0;
      orb.material = m;
      this.bokeh.push(orb);
      this.tweens.push(gsap.to(m, { alpha: 0.18 + Math.random() * 0.14, duration: 6, delay: 1 + Math.random() * 4 }));

      this.tweens.push(
        gsap.to(orb.position, {
          y: orb.position.y + (Math.random() - 0.5) * 5,
          x: orb.position.x + (Math.random() - 0.5) * 5,
          duration: 12 + Math.random() * 10,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        }),
      );
    }
  }

  /** Polvo luminoso suspendido. */
  private createDust(): void {
    const ps = new ParticleSystem('childhood-dust', 900, this.scene);
    ps.particleTexture = this.getGlowTexture().clone();
    ps.createBoxEmitter(
      new Vector3(-0.1, 0.05, -0.1),
      new Vector3(0.1, 0.15, 0.1),
      new Vector3(-22, -11, -10),
      new Vector3(22, 11, 25),
    );
    ps.emitter = Vector3.Zero();
    ps.color1 = new Color4(1, 0.9, 0.8, 0.8);
    ps.color2 = new Color4(0.75, 0.7, 1, 0.6);
    ps.colorDead = new Color4(0.5, 0.5, 1, 0);
    ps.minSize = 0.04;
    ps.maxSize = 0.16;
    ps.minLifeTime = 8;
    ps.maxLifeTime = 16;
    ps.emitRate = 30;
    ps.minEmitPower = 0.05;
    ps.maxEmitPower = 0.25;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.preWarmCycles = 300;
    ps.preWarmStepOffset = 5;
    ps.start();
    this.dust = ps;
  }

  // ---------- Objetos ----------

  private async spawnObjects(): Promise<void> {
    const { spread } = CONFIG;
    const n = this.catalog.length;

    const created = await Promise.all(
      this.catalog.map((def, i) => {
        // Distribución en espiral áurea: repartida pero orgánica
        const a = i * 2.39996;
        const r = Math.sqrt((i + 0.5) / n);
        const anchor = new Vector3(
          Math.cos(a) * r * spread.x,
          Math.sin(a) * r * spread.y,
          spread.zNear + Math.random() * (spread.zFar - spread.zNear),
        );
        const color = def.colors[Math.floor(Math.random() * def.colors.length)];
        return MemoryObject.create(this.scene, def, color, {
          anchor,
          drift: new Vector3(0.4 + Math.random() * 0.5, 0.3 + Math.random() * 0.4, 0.3),
          depth: 1.5 + Math.random() * 2.5,
          speed: 0.35 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
          spin: new Vector3((Math.random() - 0.5) * 0.3, 0.15 + Math.random() * 0.35, (Math.random() - 0.5) * 0.2),
        });
      }),
    );

    // Orden de aparición aleatorio
    const order = [...created].sort(() => Math.random() - 0.5);
    order.forEach((obj, i) => {
      this.objects.push(obj);
      for (const mesh of obj.pickableMeshes) this.byMesh.set(mesh, obj);

      // Las partículas se agrupan y el objeto se materializa donde se juntaron
      const appearAt = CONFIG.firstAppear + i * CONFIG.appearInterval;
      const cluster = this.field.condense(
        () => obj.root.position,
        Math.max(appearAt - CONFIG.condenseTime, 0),
        CONFIG.condenseTime,
        CONFIG.particlesPerObject,
      );
      void obj.appear(appearAt);
      this.tweens.push(gsap.delayedCall(appearAt + 0.5, () => this.field.release(cluster)));
    });
  }

  private handleHover(obj: MemoryObject | null): void {
    for (const o of this.objects) o.setHover(o === obj);
    this.ui.setHoverLabel(obj ? obj.definition.name : null);
  }

  private handleSelect(obj: MemoryObject): void {
    if (this.finishing || !this.interaction) return;

    if (!this.memory.canSelect(obj.definition.id)) return;
    const record = this.memory.select(obj.definition, obj.color);
    if (!record) return;

    const interaction = this.interaction;
    interaction.lock();
    this.ui.hideHint();
    this.ui.setHoverLabel(null);
    this.ui.setMemoryDots(this.memory.count, this.memory.maxSelections);

    const { keptRow, focusPoint } = CONFIG;
    const slot = record.order - 1;
    const kept = new Vector3(
      (slot - (this.memory.maxSelections - 1) / 2) * keptRow.gap,
      keptRow.y,
      keptRow.z,
    );

    const done = obj.focus(focusPoint, kept);
    this.tweens.push(gsap.delayedCall(CONFIG.clickCooldown, () => interaction.release()));

    if (this.memory.isFull) {
      this.ui.hideContinue();
      void done.then(() => this.finish());
    } else if (this.memory.count === 1) {
      void done.then(() => {
        if (!this.finishing) this.ui.showContinue(() => this.finish());
      });
    }
  }

  /** Cierra la selección: todos los objetos se desvanecen por igual. */
  private async finish(): Promise<void> {
    if (this.finishing) return;
    this.finishing = true;
    this.memory.lockSelection();
    this.interaction?.setEnabled(false);
    this.ui.hideContinue();
    this.ui.hideHint();
    this.ui.setHoverLabel(null);
    this.ui.hideMemoryDots();

    // El ambiente de la infancia también se apaga despacio (no de golpe al cambiar de etapa)
    this.dust?.stop();
    for (const orb of this.bokeh) {
      const mat = orb.material as StandardMaterial;
      this.tweens.push(gsap.to(mat, { alpha: 0, duration: 3.5, ease: 'sine.inOut' }));
    }
    await Promise.all(this.objects.map((o) => o.dissolve(0)));
    this.context?.complete();
  }

  update(dt: number): void {
    for (const o of this.objects) o.update(dt);
  }

  dispose(): void {
    for (const t of this.tweens) t.kill();
    this.tweens = [];
    this.interaction?.dispose();
    this.interaction = null;
    for (const o of this.objects) o.dispose();
    this.objects = [];
    this.byMesh.clear();
    this.dust?.dispose(true);
    this.dust = null;
    for (const b of this.bokeh) b.dispose(false, true);
    this.bokeh = [];
    this.glowTexture?.dispose();
    this.glowTexture = null;
    for (const l of this.lights) l.dispose();
    this.lights = [];
  }
}
