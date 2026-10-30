import {
  Color3,
  ImportMeshAsync,
  MeshBuilder,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Material,
  type Scene,
} from '@babylonjs/core';
import gsap from 'gsap';
import type { ObjectDefinition } from '../data/types';
import { buildPlaceholder } from './placeholders';

export type MemoryObjectState = 'appearing' | 'idle' | 'focusing' | 'kept' | 'dissolving' | 'gone';

/** Parámetros de movimiento autónomo. */
interface Motion {
  anchor: Vector3;
  drift: Vector3; // amplitud de flotación por eje
  depth: number; // amplitud de acercamiento/alejamiento
  speed: number;
  phase: number;
  spin: Vector3;
}

type WithEmissive = Material & { emissiveColor?: Color3 };

/**
 * Un objeto-recuerdo flotante. Sabe moverse, reaccionar y desvanecerse.
 * No sabe nada de reglas de selección (eso es del MemorySystem).
 */
export class MemoryObject {
  readonly definition: ObjectDefinition;
  readonly color: string;
  readonly root: TransformNode;
  state: MemoryObjectState = 'appearing';

  private meshes: AbstractMesh[] = [];
  private materials: WithEmissive[] = [];
  private baseEmissive: Color3[] = [];
  private hitArea: AbstractMesh | null = null;
  private motion: Motion;
  private baseColor: Color3;

  // Valores animados por GSAP
  private anim = { scale: 0, visibility: 0, glow: 0, focus: 0, hover: 0, rise: 0 };
  private focusPoint = Vector3.Zero();
  private keptAnchor = Vector3.Zero();
  private time = 0;

  private constructor(scene: Scene, definition: ObjectDefinition, color: string, motion: Motion) {
    this.definition = definition;
    this.color = color;
    this.motion = motion;
    this.baseColor = Color3.FromHexString(color);
    this.root = new TransformNode(`memory-${definition.id}`, scene);
  }

  /** Crea el objeto cargando el .glb si existe o, si no, el placeholder. */
  static async create(
    scene: Scene,
    definition: ObjectDefinition,
    color: string,
    motion: Motion,
  ): Promise<MemoryObject> {
    const obj = new MemoryObject(scene, definition, color, motion);
    await obj.buildVisual(scene);
    obj.applyVisuals();
    obj.updatePosition();
    return obj;
  }

  private async buildVisual(scene: Scene): Promise<void> {
    let visual: TransformNode | null = null;

    if (this.definition.model) {
      try {
        const url = `${import.meta.env.BASE_URL}${this.definition.model}`;
        const result = await ImportMeshAsync(url, scene);
        visual = new TransformNode(`${this.definition.id}-glb`, scene);
        for (const m of result.meshes) if (!m.parent) m.parent = visual;
      } catch (err) {
        console.warn(`No se pudo cargar ${this.definition.model}, uso placeholder.`, err);
      }
    }

    visual ??= buildPlaceholder(scene, this.definition.placeholder, this.definition.id, this.baseColor);
    visual.parent = this.root;

    this.meshes = visual.getChildMeshes(false);
    const mats = new Set<WithEmissive>();
    for (const mesh of this.meshes) {
      mesh.isPickable = true;
      mesh.metadata = { memoryId: this.definition.id };
      if (mesh.material) mats.add(mesh.material as WithEmissive);
    }
    this.materials = [...mats];

    // Zona de clic invisible: los objetos huecos (audífonos, bicicleta) se pueden elegir
    // aunque el cursor caiga en un espacio vacío del modelo.
    const { min, max } = visual.getHierarchyBoundingVectors(true);
    const size = max.subtract(min);
    const hitArea = MeshBuilder.CreateSphere(
      `${this.definition.id}-hit`,
      { diameterX: size.x, diameterY: size.y, diameterZ: Math.max(size.z, 0.6), segments: 8 },
      scene,
    );
    hitArea.parent = this.root;
    hitArea.position = min.add(size.scale(0.5)).subtract(this.root.position);
    hitArea.isVisible = false;
    hitArea.isPickable = true;
    this.hitArea = hitArea;
    this.baseEmissive = this.materials.map((m) => m.emissiveColor?.clone() ?? Color3.Black());
  }

  get pickableMeshes(): readonly AbstractMesh[] {
    return this.hitArea ? [...this.meshes, this.hitArea] : this.meshes;
  }

  get isInteractive(): boolean {
    return this.state === 'idle';
  }

  // ---------- Ciclo de vida ----------

  appear(delay: number): Promise<void> {
    return new Promise((resolve) => {
      // Nace brillando (como luz condensada) y se asienta en su color
      this.anim.glow = 1.6;
      gsap.to(this.anim, {
        scale: 1,
        visibility: 1,
        glow: 0,
        duration: 2.4,
        delay,
        ease: 'power2.out',
        onComplete: () => {
          if (this.state === 'appearing') this.state = 'idle';
          resolve();
        },
      });
    });
  }

  setHover(active: boolean): void {
    if (this.state !== 'idle') return;
    gsap.to(this.anim, { hover: active ? 1 : 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
  }

  /**
   * Respuesta a la selección: se ilumina, se acerca al espectador,
   * y luego se queda flotando en su lugar de "conservado".
   */
  focus(focusPoint: Vector3, keptAnchor: Vector3): Promise<void> {
    if (this.state !== 'idle') return Promise.resolve();
    this.state = 'focusing';
    this.focusPoint.copyFrom(focusPoint);
    this.keptAnchor.copyFrom(keptAnchor);

    return new Promise((resolve) => {
      gsap
        .timeline({
          onComplete: () => {
            this.state = 'kept';
            resolve();
          },
        })
        .to(this.anim, { hover: 0, focus: 1, glow: 1, scale: 1.2, duration: 1.2, ease: 'power3.inOut' })
        .to(this.anim, { duration: 0.6 })
        .add(() => {
          // El "hogar" pasa a ser el lugar de conservado mientras focus = 1 (sin salto visible)
          this.state = 'kept';
        })
        .to(this.anim, { focus: 0, glow: 0.7, scale: 0.75, duration: 1.6, ease: 'power2.inOut' });
    });
  }

  /** Desaparición suave: se encoge, sube y se vuelve transparente. */
  dissolve(delay = 0): Promise<void> {
    if (this.state === 'dissolving' || this.state === 'gone') return Promise.resolve();
    this.state = 'dissolving';
    gsap.killTweensOf(this.anim);
    return new Promise((resolve) => {
      gsap
        .timeline({
          delay,
          onComplete: () => {
            this.state = 'gone';
            resolve();
          },
        })
        .to(this.anim, { glow: 1, hover: 0, focus: 0, duration: 0.8, ease: 'sine.out' })
        .to(this.anim, { visibility: 0, scale: 0.15, rise: 2.2, glow: 0, duration: 3, ease: 'power2.in' }, '<0.3');
    });
  }

  // ---------- Frame ----------

  update(dt: number): void {
    if (this.state === 'gone') return;
    this.time += dt;
    const { spin } = this.motion;
    const spinFactor = this.state === 'kept' || this.state === 'focusing' ? 0.4 : 1;
    this.root.rotation.x += spin.x * dt * spinFactor;
    this.root.rotation.y += spin.y * dt * spinFactor;
    this.root.rotation.z += spin.z * dt * spinFactor;
    this.updatePosition();
    this.applyVisuals();
  }

  private homePosition(): Vector3 {
    const t = this.time * this.motion.speed + this.motion.phase;
    if (this.state === 'kept') {
      return this.keptAnchor.add(new Vector3(Math.sin(t * 0.7) * 0.15, Math.sin(t) * 0.2, 0));
    }
    const { anchor, drift, depth } = this.motion;
    return new Vector3(
      anchor.x + Math.sin(t * 0.8) * drift.x,
      anchor.y + Math.sin(t * 1.1 + 1.3) * drift.y,
      // Unos se acercan y otros se alejan según su fase
      anchor.z + Math.sin(t * 0.35) * depth + Math.cos(t * 0.9) * drift.z,
    );
  }

  private updatePosition(): void {
    const home = this.homePosition();
    const pos = Vector3.Lerp(home, this.focusPoint, this.anim.focus);
    pos.y += this.anim.rise;
    this.root.position.copyFrom(pos);
  }

  private applyVisuals(): void {
    const s = this.anim.scale * (1 + this.anim.hover * 0.12);
    this.root.scaling.setAll(Math.max(s, 0.0001));

    for (const mesh of this.meshes) mesh.visibility = this.anim.visibility;

    const intensity = this.anim.glow * 0.32 + this.anim.hover * 0.2;
    const emissive = this.baseColor.scale(intensity);
    this.materials.forEach((m, i) => {
      if (m.emissiveColor) this.baseEmissive[i].addToRef(emissive, m.emissiveColor);
    });
  }

  dispose(): void {
    gsap.killTweensOf(this.anim);
    this.root.dispose(false, true);
    this.meshes = [];
    this.materials = [];
  }
}

export type { Motion as MemoryObjectMotion };
