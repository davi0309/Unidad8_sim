import {
  Color3,
  Color4,
  Constants,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
  type DynamicTexture,
  type UniversalCamera,
} from '@babylonjs/core';
import gsap from 'gsap';
import { MUSIC } from '../data/audio';
import type { AudioManager } from '../systems/AudioManager';
import type { MemoryParticleField } from '../systems/ParticleSystem';
import type { UIManager } from '../ui/UIManager';
import { createGlowTexture } from '../utils/textures';
import type { ExperienceStage, StageContext } from './StageBase';

/** Línea de tiempo del Big Bang (segundos desde que empieza la etapa). */
const T = {
  coreAppears: 2.5,
  gatherStart: 3.2,
  gatherDuration: 8,
  implosion: 10.8,
  explosion: 11.6,
  /** Después de la explosión todo se apaga en capas: primero el núcleo, luego el halo y la luz. */
  coreFade: 6, // el núcleo blanco
  haloFade: 9, // el resplandor cálido que lo rodea
  lightFade: 9.5, // la luz que ilumina las partículas
  end: 22, // la etapa termina cuando ya no queda nada encendido
};

const CAMERA_START_Z = -14;
const CAMERA_CLOSE_Z = -10.5;

/**
 * Etapa 0 — El origen.
 * Oscuridad → punto de luz → acumulación de partículas → explosión → dispersión.
 * Las partículas no se destruyen al terminar: siguen vivas en el campo compartido.
 */
export class OriginStage implements ExperienceStage {
  private scene: Scene;
  private camera: UniversalCamera;
  private field: MemoryParticleField;
  private audio: AudioManager;
  private ui: UIManager;

  private timeline: gsap.core.Timeline | null = null;
  private core: Mesh | null = null;
  private halo: Mesh | null = null;
  private coreTexture: DynamicTexture | null = null;
  private light: PointLight | null = null;
  private coreState = { scale: 0, alpha: 0, flicker: 0, haloAlpha: 0, haloScale: 3.2 };
  private time = 0;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    field: MemoryParticleField,
    audio: AudioManager,
    ui: UIManager,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.field = field;
    this.audio = audio;
    this.ui = ui;
  }

  async enter(context: StageContext): Promise<void> {
    this.scene.clearColor = new Color4(0, 0, 0, 1);
    this.scene.fogMode = Scene.FOGMODE_NONE;
    this.camera.position.z = CAMERA_START_Z;

    this.buildCore();
    void this.audio.playMusic(MUSIC.origin, 4);

    const field = this.field;
    const core = this.coreState;
    const light = this.light!;
    const cam = this.camera.position;

    const tl = gsap.timeline({ onComplete: () => context.complete() });
    this.timeline = tl;

    // 1. Aparece un pequeño punto luminoso
    tl.to(core, { scale: 0.35, alpha: 1, haloAlpha: 0.55, duration: 2.2, ease: 'sine.out' }, T.coreAppears);

    // 2. Las partículas se acumulan alrededor del punto; la cámara se acerca
    tl.add(() => {
      field.phase = 'gather';
    }, T.gatherStart);
    tl.to(field, { gatherProgress: 1, duration: T.gatherDuration, ease: 'power1.in' }, T.gatherStart);
    tl.to(core, { scale: 1.4, duration: T.gatherDuration, ease: 'power2.in' }, T.gatherStart);
    tl.to(light, { intensity: 2.2, duration: T.gatherDuration, ease: 'power2.in' }, T.gatherStart);
    tl.to(cam, { z: CAMERA_CLOSE_Z, duration: T.gatherDuration + 0.6, ease: 'sine.inOut' }, T.gatherStart);

    // 3. Tensión: el núcleo se contrae y titila
    tl.to(core, { scale: 0.55, flicker: 1, duration: T.explosion - T.implosion, ease: 'power3.in' }, T.implosion);

    // 4. Explosión
    tl.add(() => {
      field.explode();
      this.ui.flash();
      this.shakeCamera();
    }, T.explosion);
    tl.set(core, { flicker: 0 }, T.explosion);
    tl.to(core, { scale: 9, duration: 0.6, ease: 'expo.out' }, T.explosion);
    // El núcleo se sostiene un instante y luego se apaga despacio, encogiéndose un poco
    tl.to(core, { alpha: 0, duration: T.coreFade, ease: 'sine.inOut' }, T.explosion + 0.5);
    tl.to(core, { scale: 5, duration: T.coreFade + 0.5, ease: 'sine.inOut' }, T.explosion + 0.6);
    // El halo se expande lentamente mientras se desvanece: queda como un recuerdo de la luz
    tl.to(core, { haloAlpha: 0.75, duration: 0.6, ease: 'power2.out' }, T.explosion);
    tl.to(core, { haloScale: 4, duration: T.haloFade, ease: 'sine.out' }, T.explosion);
    tl.to(core, { haloAlpha: 0, duration: T.haloFade - 0.8, ease: 'sine.inOut' }, T.explosion + 0.8);
    tl.fromTo(
      light,
      { intensity: 7 },
      { intensity: 0, duration: T.lightFade, ease: 'sine.inOut', immediateRender: false },
      T.explosion,
    );
    tl.to(cam, { z: CAMERA_START_Z, duration: 6, ease: 'power2.out' }, T.explosion);

    // 5. Dispersión: el universo se expande y se calma
    tl.to({}, { duration: 0.1 }, T.end - 0.1);
  }

  private buildCore(): void {
    const tex = createGlowTexture(this.scene, 'core-glow', 128);
    this.coreTexture = tex;

    const makeSprite = (name: string, color: Color3): Mesh => {
      const mat = new StandardMaterial(`${name}-mat`, this.scene);
      mat.disableLighting = true;
      mat.emissiveColor = color;
      mat.opacityTexture = tex;
      mat.alphaMode = Constants.ALPHA_ADD;
      mat.fogEnabled = false;
      const plane = MeshBuilder.CreatePlane(name, { size: 1 }, this.scene);
      plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      plane.material = mat;
      plane.isPickable = false;
      plane.visibility = 0;
      return plane;
    };

    this.core = makeSprite('origin-core', new Color3(1, 0.97, 0.9));
    this.halo = makeSprite('origin-halo', new Color3(1, 0.62, 0.4));

    const light = new PointLight('origin-light', Vector3.Zero(), this.scene);
    light.diffuse = new Color3(1, 0.8, 0.6);
    light.intensity = 0;
    this.light = light;
  }

  private shakeCamera(): void {
    const target = this.camera.position;
    gsap.fromTo(
      target,
      { y: target.y + 0.35 },
      { y: target.y, duration: 0.9, ease: 'elastic.out(1.2, 0.25)' },
    );
  }

  update(dt: number): void {
    this.time += dt;
    const level = this.audio.getLevel();
    this.field.level = level;

    if (!this.core || !this.halo) return;
    const s = this.coreState;
    const pulse = 1 + level * 0.35 + Math.sin(this.time * 2.2) * 0.05;
    const flicker = s.flicker > 0 ? 1 - s.flicker * 0.5 * Math.abs(Math.sin(this.time * 38)) : 1;
    const coreSize = s.scale * pulse * flicker;
    this.core.scaling.setAll(Math.max(coreSize, 0.0001));
    this.core.visibility = s.alpha;
    this.halo.scaling.setAll(Math.max(s.scale * pulse * s.haloScale, 0.0001));
    this.halo.visibility = s.haloAlpha;
  }

  dispose(): void {
    this.timeline?.kill();
    this.timeline = null;
    this.core?.dispose(false, true);
    this.halo?.dispose(false, true);
    this.coreTexture?.dispose();
    this.light?.dispose();
    this.core = this.halo = null;
    this.light = null;
  }
}
