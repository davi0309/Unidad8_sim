import {
  Color4,
  ParticleSystem as BabylonParticleSystem,
  Vector3,
  type DynamicTexture,
  type Particle,
  type Scene,
} from '@babylonjs/core';
import { createGlowTexture } from '../utils/textures';

/** Fases globales del campo de partículas. */
export type FieldPhase = 'hidden' | 'gather' | 'expanding' | 'drift';

/**
 * Enfriamiento del color tras la explosión (segundos).
 * Blanco → cálido → colores de la memoria, de forma gradual y escalonada:
 * cada partícula empieza con un pequeño desfase para que no cambien todas a la vez.
 */
const COOLING = {
  duration: 16, // tiempo total hasta llegar a los colores de la infancia
  warmAt: 0.25, // punto (0–1) en el que el color es plenamente cálido
  stagger: 3, // desfase máximo entre partículas
};

const MODE_FREE = 0;
const MODE_CONDENSE = 1;

interface Cluster {
  target: () => Vector3;
  start: number;
  duration: number;
  released: boolean;
}

/** Paleta: blanco caliente → cálido → violetas y azules de la memoria. */
const HOT = [1, 0.96, 0.88];
const WARM = [1, 0.62, 0.38];
const PALETTE = [
  [0.62, 0.48, 1],
  [0.42, 0.62, 1],
  [1, 0.76, 0.56],
  [0.95, 0.55, 0.8],
];

/**
 * Campo de partículas persistente de la experiencia.
 * Nace en el Big Bang y sobrevive a las etapas: las partículas no desaparecen,
 * se transforman (se agrupan en objetos y quedan como ambiente).
 *
 * Renderiza con un ParticleSystem de Babylon y controla cada partícula
 * con su propia simulación (updateFunction).
 */
export class MemoryParticleField {
  readonly count: number;
  phase: FieldPhase = 'hidden';

  /** 0–1. Avance de la acumulación hacia el núcleo (lo anima la etapa). */
  gatherProgress = 0;
  /** Multiplicador global de brillo. */
  brightness = 1;
  /** 0–1. Atenúa el campo cuando pasa a ser ambiente. */
  ambient = 0;
  /** Nivel de la música (0–1) para pulsos. */
  level = 0;

  private system: BabylonParticleSystem;
  private texture: DynamicTexture;
  private scene: Scene;
  private time = 0;
  private expansionTime = 0;

  // Estado por partícula
  private pos: Float32Array;
  private vel: Float32Array;
  private dir: Float32Array;
  private shell: Float32Array; // radio inicial de la acumulación
  private coreR: Float32Array; // radio final alrededor del núcleo
  private act: Float32Array; // momento de activación (0–1)
  private seed: Float32Array;
  private size: Float32Array;
  private hue: Uint8Array;
  private mode: Uint8Array;
  private cluster: Int16Array;
  private clusters: Cluster[] = [];

  constructor(scene: Scene, count = 4000) {
    this.scene = scene;
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.dir = new Float32Array(count * 3);
    this.shell = new Float32Array(count);
    this.coreR = new Float32Array(count);
    this.act = new Float32Array(count);
    this.seed = new Float32Array(count);
    this.size = new Float32Array(count);
    this.hue = new Uint8Array(count);
    this.mode = new Uint8Array(count);
    this.cluster = new Int16Array(count).fill(-1);

    for (let i = 0; i < count; i++) {
      // Dirección uniforme en la esfera
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      this.dir[i * 3] = s * Math.cos(a);
      this.dir[i * 3 + 1] = u;
      this.dir[i * 3 + 2] = s * Math.sin(a);
      this.shell[i] = 5 + Math.random() * 9;
      this.coreR[i] = 0.08 + Math.pow(Math.random(), 2) * 0.55;
      this.act[i] = Math.random();
      this.seed[i] = Math.random();
      this.size[i] = 0.05 + Math.pow(Math.random(), 3) * 0.22;
      this.hue[i] = Math.floor(Math.random() * PALETTE.length);
    }

    this.texture = createGlowTexture(scene, 'field-glow', 64);
    const ps = new BabylonParticleSystem('memory-field', count, scene);
    ps.particleTexture = this.texture;
    ps.blendMode = BabylonParticleSystem.BLENDMODE_ADD;
    ps.emitter = Vector3.Zero();
    ps.minLifeTime = ps.maxLifeTime = 1e9;
    ps.minSize = ps.maxSize = 0;
    ps.minEmitPower = ps.maxEmitPower = 0;
    ps.emitRate = 0;
    ps.manualEmitCount = count;
    ps.updateFunction = (particles) => this.step(particles);
    ps.start();
    this.system = ps;
  }

  /** Paso de la acumulación a la explosión: cada partícula sale disparada. */
  explode(): void {
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      // Dirección propia algo perturbada; unas pocas muy rápidas, la mayoría medias
      const speed = 3 + Math.pow(this.seed[i], 2.2) * 34;
      const jitter = 0.35;
      let dx = this.dir[k] + (Math.random() - 0.5) * jitter;
      let dy = this.dir[k + 1] * 0.75 + (Math.random() - 0.5) * jitter;
      let dz = this.dir[k + 2] + (Math.random() - 0.5) * jitter;
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len; dy /= len; dz /= len;
      this.vel[k] = dx * speed;
      this.vel[k + 1] = dy * speed;
      this.vel[k + 2] = dz * speed;
    }
    this.phase = 'expanding';
    this.expansionTime = 0;
  }

  /** Deja el campo ya disperso y con los colores finales (atajo de desarrollo). */
  settle(): void {
    if (this.phase === 'hidden' || this.phase === 'gather') this.explode();
    this.expansionTime = COOLING.duration + COOLING.stagger;
    this.phase = 'drift';
  }

  /**
   * Agrupa un puñado de partículas alrededor de un punto (que puede moverse).
   * Devuelve el id del grupo para liberarlo después.
   */
  condense(target: () => Vector3, delay: number, duration: number, amount = 120): number {
    const id = this.clusters.length;
    this.clusters.push({ target, start: this.time + delay, duration, released: false });
    let taken = 0;
    // Recorre desde un punto aleatorio para no tomar siempre las mismas
    const offset = Math.floor(Math.random() * this.count);
    for (let n = 0; n < this.count && taken < amount; n++) {
      const i = (n + offset) % this.count;
      if (this.mode[i] !== MODE_FREE) continue;
      this.mode[i] = MODE_CONDENSE;
      this.cluster[i] = id;
      taken++;
    }
    return id;
  }

  /** Suelta un grupo: sus partículas se expanden suavemente y vuelven a flotar. */
  release(id: number): void {
    const c = this.clusters[id];
    if (!c || c.released) return;
    c.released = true;
    const center = c.target();
    for (let i = 0; i < this.count; i++) {
      if (this.cluster[i] !== id) continue;
      const k = i * 3;
      const dx = this.pos[k] - center.x;
      const dy = this.pos[k + 1] - center.y;
      const dz = this.pos[k + 2] - center.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const speed = 1.5 + this.seed[i] * 3.5;
      this.vel[k] = (dx / len) * speed;
      this.vel[k + 1] = (dy / len) * speed;
      this.vel[k + 2] = (dz / len) * speed;
      this.mode[i] = MODE_FREE;
      this.cluster[i] = -1;
    }
  }

  // ---------- Simulación ----------

  private step(particles: Particle[]): void {
    // El reloj sigue el tiempo real (igual que GSAP) para no desincronizarse si bajan los FPS;
    // la integración usa un paso acotado para mantenerse estable.
    const raw = this.scene.getEngine().getDeltaTime() / 1000;
    const dt = Math.min(raw, 0.1);
    this.time += Math.min(raw, 0.5);
    if (this.phase === 'expanding' || this.phase === 'drift') this.expansionTime += Math.min(raw, 0.5);
    if (this.phase === 'expanding' && this.expansionTime > 6) this.phase = 'drift';

    const n = Math.min(particles.length, this.count);
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      if (this.phase === 'hidden') {
        p.size = 0;
        continue;
      }
      if (this.phase === 'gather') this.stepGather(i, p);
      else this.stepFree(i, p, dt);
    }
  }

  private stepGather(i: number, p: Particle): void {
    const k = i * 3;
    // Cada partícula viaja en su propia ventana de tiempo
    const startAt = this.act[i] * 0.7;
    const lp = Math.min(Math.max((this.gatherProgress - startAt) / 0.3, 0), 1);
    if (lp <= 0) {
      p.size = 0;
      return;
    }
    const e = lp * lp * (3 - 2 * lp);
    const radius = this.shell[i] + (this.coreR[i] - this.shell[i]) * e;
    // Remolino que se acelera al acercarse
    const ang = this.time * (0.25 + this.seed[i] * 0.4) * (1 + e * 4) + e * 5;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const dx = this.dir[k];
    const dz = this.dir[k + 2];
    this.pos[k] = (dx * c - dz * s) * radius;
    this.pos[k + 1] = this.dir[k + 1] * radius * (1 - e * 0.35);
    this.pos[k + 2] = (dx * s + dz * c) * radius;

    p.position.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
    const pulse = 1 + this.level * 0.5;
    p.size = this.size[i] * (0.5 + e * 0.6) * pulse;
    const alpha = Math.min(lp * 3, 1) * (0.35 + e * 0.65) * this.brightness;
    this.setColor(p, HOT, WARM, 0.3 * (1 - e), alpha);
  }

  private stepFree(i: number, p: Particle, dt: number): void {
    const k = i * 3;
    const t = this.time;
    const sd = this.seed[i];
    let px = this.pos[k];
    let py = this.pos[k + 1];
    let pz = this.pos[k + 2];
    let vx = this.vel[k];
    let vy = this.vel[k + 1];
    let vz = this.vel[k + 2];
    let glowBoost = 0;

    const cid = this.cluster[i];
    const cl = cid >= 0 ? this.clusters[cid] : null;

    if (cl && t >= cl.start) {
      // Condensación: resorte hacia el objeto con órbita que se cierra
      const lp = Math.min((t - cl.start) / cl.duration, 1);
      const target = cl.target();
      const orbitR = 1.8 - lp * 1.35;
      const ang = t * (1.5 + sd * 2) + sd * 20;
      const ox = this.dir[k] * Math.cos(ang) * orbitR;
      const oy = this.dir[k + 1] * orbitR * 0.8;
      const oz = this.dir[k + 2] * Math.sin(ang) * orbitR;
      const stiffness = 5 + lp * 22;
      vx += (target.x + ox - px) * stiffness * dt;
      vy += (target.y + oy - py) * stiffness * dt;
      vz += (target.z + oz - pz) * stiffness * dt;
      const damp = Math.exp(-4.5 * dt);
      vx *= damp; vy *= damp; vz *= damp;
      glowBoost = lp;
      if (lp >= 1 && t > cl.start + cl.duration + 0.6) this.release(cid);
    } else {
      // Deriva libre: frenado + corrientes suaves (movimiento autónomo)
      const drag = Math.exp(-(this.phase === 'expanding' ? 1.15 : 0.6) * dt);
      vx *= drag; vy *= drag; vz *= drag;
      const flow = 0.35;
      vx += Math.sin(py * 0.21 + t * 0.17 + sd * 6.3) * flow * dt;
      vy += Math.sin(pz * 0.19 + t * 0.13 + sd * 4.1) * flow * 0.6 * dt;
      vz += Math.sin(px * 0.23 + t * 0.11 + sd * 2.7) * flow * dt;
      // Límite blando: el universo no se dispersa al infinito
      const r2 = px * px + py * py + pz * pz;
      if (r2 > 900) {
        const pull = 0.04 * dt;
        vx -= px * pull; vy -= py * pull; vz -= pz * pull;
      }
    }

    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
    this.pos[k] = px; this.pos[k + 1] = py; this.pos[k + 2] = pz;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    p.position.set(px, py, pz);

    // Color: se enfría poco a poco desde la explosión (curva suave + desfase por partícula)
    const local = (this.expansionTime - this.seed[i] * COOLING.stagger) / COOLING.duration;
    const lc = Math.min(Math.max(local, 0), 1);
    const cool = lc * lc * (3 - 2 * lc);
    const twinkle = 0.75 + 0.25 * Math.sin(t * (1.5 + sd * 3) + sd * 40);
    // Las partículas que forman un objeto no se atenúan con el ambiente: deben leerse
    const dim = 1 - this.ambient * 0.55 * (1 - glowBoost);
    const alpha = (0.55 + glowBoost * 1.1) * twinkle * dim * this.brightness * (1 + this.level * 0.4);
    const sizeBase = this.size[i] * (1.15 - cool * 0.45) * (1 + glowBoost * 0.9);
    p.size = sizeBase * (1 + this.level * 0.25);
    const w = COOLING.warmAt;
    if (cool < w) this.setColor(p, HOT, WARM, smooth(cool / w), alpha);
    else this.setColor(p, WARM, PALETTE[this.hue[i]], smooth((cool - w) / (1 - w)), alpha);
  }

  private setColor(p: Particle, a: number[], b: number[], t: number, alpha: number): void {
    const c: Color4 = p.color;
    c.r = a[0] + (b[0] - a[0]) * t;
    c.g = a[1] + (b[1] - a[1]) * t;
    c.b = a[2] + (b[2] - a[2]) * t;
    c.a = Math.min(alpha, 1);
  }

  dispose(): void {
    this.system.dispose(true);
    this.texture.dispose();
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
