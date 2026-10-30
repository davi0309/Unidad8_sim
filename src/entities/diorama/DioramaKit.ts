import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  StandardMaterial,
  TransformNode,
  Vector3,
  type DynamicTexture,
  type ShadowGenerator,
  type Scene,
} from '@babylonjs/core';
import type { AnchorTag } from '../../data/types';
import { createGlowTexture } from '../../utils/textures';

/** Función que anima algo del diorama en cada cuadro. */
export type Animator = (time: number, dt: number) => void;

export type V3 = [number, number, number];

/** Lugar del diorama donde puede ir un objeto de infancia. */
export interface Anchor {
  id: string;
  position: V3;
  tags: AnchorTag[];
  priority: number;
  /** Flota (se mece suavemente). */
  float?: boolean;
}

/** Resultado de construir una plantilla. */
export interface TemplateBuild {
  root: TransformNode;
  /** Grupos que aparecen uno tras otro durante la construcción. */
  stages: TransformNode[];
  /** Posiciones libres para los elementos de los universos visitados. */
  accentSlots: V3[];
  /** Nodos que flotan (se mecen) durante la contemplación. */
  floaters: TransformNode[];
}

interface MatOptions {
  emissive?: number;
  alpha?: number;
  gloss?: number;
}

/**
 * Herramientas para levantar los dioramas con primitivas, en estilo "maqueta":
 * colores mates y formas simples, coherentes con los objetos de infancia.
 */
export class DioramaKit {
  readonly scene: Scene;
  readonly root: TransformNode;
  private shadow: ShadowGenerator | null;
  private cache = new Map<string, StandardMaterial>();
  private rand: () => number;
  /** Animaciones de "vida" del diorama (pájaros, luces, hojas...). */
  readonly life: Animator[] = [];
  private particleSystems: ParticleSystem[] = [];
  private glowTex: DynamicTexture | null = null;

  constructor(scene: Scene, root: TransformNode, shadow: ShadowGenerator | null, rand: () => number) {
    this.scene = scene;
    this.root = root;
    this.shadow = shadow;
    this.rand = rand;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.rand();
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.rand() * items.length)];
  }

  group(name: string, parent: TransformNode = this.root, pos: V3 = [0, 0, 0]): TransformNode {
    const g = new TransformNode(name, this.scene);
    g.parent = parent;
    g.position.set(...pos);
    return g;
  }

  mat(hex: string, opts: MatOptions = {}): StandardMaterial {
    const key = `${hex}|${opts.emissive ?? 0}|${opts.alpha ?? 1}|${opts.gloss ?? 0}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new StandardMaterial(`dio-${key}`, this.scene);
      const c = Color3.FromHexString(hex);
      m.diffuseColor = c;
      m.specularColor = new Color3(1, 1, 1).scale(opts.gloss ?? 0.05);
      m.specularPower = opts.gloss ? 64 : 12;
      if (opts.emissive) m.emissiveColor = c.scale(opts.emissive);
      if (opts.alpha !== undefined && opts.alpha < 1) m.alpha = opts.alpha;
      this.cache.set(key, m);
    }
    return m;
  }

  private finish(mesh: Mesh, parent: TransformNode, mat: StandardMaterial, pos: V3, rot?: V3, opts?: { shadow?: boolean; flat?: boolean }): Mesh {
    mesh.parent = parent;
    mesh.material = mat;
    mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    // Seleccionable por rayos: sirve para saber sobre qué superficie se apoya un objeto
    mesh.isPickable = true;
    if (opts?.flat) mesh.convertToFlatShadedMesh();
    mesh.receiveShadows = true;
    if (opts?.shadow !== false && this.shadow && mat.alpha >= 1) this.shadow.addShadowCaster(mesh, false);
    return mesh;
  }

  box(parent: TransformNode, size: V3, mat: StandardMaterial, pos: V3, rot?: V3, opts?: { shadow?: boolean }): Mesh {
    const m = MeshBuilder.CreateBox('dio-box', { width: size[0], height: size[1], depth: size[2] }, this.scene);
    return this.finish(m, parent, mat, pos, rot, opts);
  }

  cyl(
    parent: TransformNode,
    o: { top: number; bottom: number; h: number; tess?: number },
    mat: StandardMaterial,
    pos: V3,
    rot?: V3,
    opts?: { shadow?: boolean; flat?: boolean },
  ): Mesh {
    const m = MeshBuilder.CreateCylinder(
      'dio-cyl',
      { diameterTop: o.top, diameterBottom: o.bottom, height: o.h, tessellation: o.tess ?? 18 },
      this.scene,
    );
    return this.finish(m, parent, mat, pos, rot, opts);
  }

  sphere(parent: TransformNode, size: V3, mat: StandardMaterial, pos: V3, opts?: { seg?: number; shadow?: boolean; flat?: boolean }): Mesh {
    const m = MeshBuilder.CreateSphere(
      'dio-sphere',
      { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments: opts?.seg ?? 14 },
      this.scene,
    );
    return this.finish(m, parent, mat, pos, undefined, opts);
  }

  torus(parent: TransformNode, o: { d: number; t: number }, mat: StandardMaterial, pos: V3, rot?: V3): Mesh {
    const m = MeshBuilder.CreateTorus('dio-torus', { diameter: o.d, thickness: o.t, tessellation: 32 }, this.scene);
    return this.finish(m, parent, mat, pos, rot);
  }

  /** Copa de árbol / nube: varios cuerpos facetados juntos. */
  cluster(parent: TransformNode, center: V3, radius: number, count: number, colors: string[], opts?: { flat?: boolean; squash?: number }): void {
    for (let i = 0; i < count; i++) {
      const r = radius * this.range(0.45, 0.8);
      const a = this.range(0, Math.PI * 2);
      const d = radius * this.range(0, 0.55);
      this.sphere(
        parent,
        [r * 2, r * 2 * (opts?.squash ?? 1), r * 2],
        this.mat(this.pick(colors)),
        [center[0] + Math.cos(a) * d, center[1] + this.range(-0.3, 0.3) * radius, center[2] + Math.sin(a) * d],
        { seg: opts?.flat ? 5 : 10, flat: opts?.flat },
      );
    }
  }

  static v(p: V3): Vector3 {
    return new Vector3(...p);
  }

  /** Registra una animación que corre en cada cuadro. */
  onFrame(fn: Animator): void {
    this.life.push(fn);
  }

  /**
   * Marca un grupo como decoración viva: no es una superficie donde apoyar objetos
   * ni se puede seleccionar (pájaros, nubes, tren, móviles...).
   */
  decor(node: TransformNode): TransformNode {
    for (const m of node.getChildMeshes()) {
      m.isPickable = false;
      m.metadata = { ...(m.metadata ?? {}), decor: true };
    }
    return node;
  }

  /** Sistema de partículas suave (luciérnagas, polvo, hojas, agua). */
  particles(o: {
    name: string;
    capacity: number;
    min: V3;
    max: V3;
    colors: [string, string];
    alpha?: number;
    size: [number, number];
    life: [number, number];
    rate: number;
    dir1?: V3;
    dir2?: V3;
    power?: [number, number];
    gravity?: V3;
    additive?: boolean;
  }): ParticleSystem {
    this.glowTex ??= createGlowTexture(this.scene, 'dio-particle', 64);
    const ps = new ParticleSystem(o.name, o.capacity, this.scene);
    ps.particleTexture = this.glowTex;
    ps.emitter = Vector3.Zero();
    ps.minEmitBox = new Vector3(...o.min);
    ps.maxEmitBox = new Vector3(...o.max);
    const a = o.alpha ?? 0.9;
    const c1 = Color3.FromHexString(o.colors[0]);
    const c2 = Color3.FromHexString(o.colors[1]);
    ps.color1 = new Color4(c1.r, c1.g, c1.b, a);
    ps.color2 = new Color4(c2.r, c2.g, c2.b, a);
    ps.colorDead = new Color4(c2.r, c2.g, c2.b, 0);
    ps.minSize = o.size[0];
    ps.maxSize = o.size[1];
    ps.minLifeTime = o.life[0];
    ps.maxLifeTime = o.life[1];
    ps.emitRate = o.rate;
    ps.direction1 = new Vector3(...(o.dir1 ?? [-0.2, 0.1, -0.2]));
    ps.direction2 = new Vector3(...(o.dir2 ?? [0.2, 0.3, 0.2]));
    ps.minEmitPower = o.power?.[0] ?? 0.1;
    ps.maxEmitPower = o.power?.[1] ?? 0.4;
    ps.gravity = new Vector3(...(o.gravity ?? [0, 0, 0]));
    ps.blendMode = o.additive === false ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ADD;
    ps.preWarmCycles = 120;
    ps.preWarmStepOffset = 4;
    this.particleSystems.push(ps);
    return ps;
  }

  /** Arranca las partículas registradas (al terminar de construir el diorama). */
  startParticles(): void {
    for (const ps of this.particleSystems) ps.start();
  }

  /** Pájaro sencillo: cuerpo y dos alas que aletean. */
  bird(parent: TransformNode, color: string, scale = 1): { node: TransformNode; flap: (t: number) => void } {
    const node = this.group('pajaro', parent);
    node.scaling.setAll(scale);
    const mat = this.mat(color);
    this.sphere(node, [0.16, 0.12, 0.34], mat, [0, 0, 0], { seg: 6, shadow: false });
    const wings: TransformNode[] = [];
    for (const side of [-1, 1]) {
      const pivot = this.group('ala', node, [side * 0.06, 0.02, 0]);
      this.box(pivot, [0.42, 0.02, 0.18], mat, [side * 0.21, 0, 0], undefined, { shadow: false });
      wings.push(pivot);
    }
    this.decor(node);
    return {
      node,
      flap: (t) => {
        const a = Math.sin(t * 9) * 0.6;
        wings[0].rotation.z = a;
        wings[1].rotation.z = -a;
      },
    };
  }

  dispose(): void {
    for (const ps of this.particleSystems) ps.dispose(false);
    this.particleSystems = [];
    this.glowTex?.dispose();
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}
