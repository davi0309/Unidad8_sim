import { Engine, GlowLayer, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import gsap from 'gsap';
import { MUSIC } from '../data/audio';
import { CHILDHOOD_OBJECTS } from '../data/objects/childhood';
import { CINEMA_SCENES } from '../data/scenes';
import { ChildhoodStage } from '../stages/ChildhoodStage';
import { CinemaJourneyStage } from '../stages/CinemaJourneyStage';
import { DioramaStage } from '../stages/DioramaStage';
import { OriginStage } from '../stages/OriginStage';
import type { ExperienceStage } from '../stages/StageBase';
import { AudioManager } from '../systems/AudioManager';
import { MemorySystem } from '../systems/MemorySystem';
import { MemoryParticleField } from '../systems/ParticleSystem';
import { UIManager } from '../ui/UIManager';
import { Stage, StateManager, type StageId } from './StateManager';

const CAMERA_HOME = new Vector3(0, 0, -14);

/**
 * Punto de coordinación: motor, escena, cámara y etapas.
 * Cada etapa construye y libera sus propios recursos.
 */
export class Experience {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: UniversalCamera;
  readonly state = new StateManager();
  readonly memory = new MemorySystem(5);
  readonly ui: UIManager;
  readonly audio = new AudioManager();
  /** Campo de partículas compartido: vive durante toda la experiencia. */
  readonly field: MemoryParticleField;

  private canvas: HTMLCanvasElement;
  private currentStage: ExperienceStage | null = null;
  private pointer = { x: 0, y: 0 };
  private parallaxEnabled = true;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    // Las animaciones siguen el tiempo real, igual que la música.
    // Sin esto GSAP "frena" en equipos lentos y se desincroniza del audio y las partículas.
    gsap.ticker.lagSmoothing(0);
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true }, true);
    this.scene = new Scene(this.engine);

    this.camera = new UniversalCamera('main-camera', CAMERA_HOME.clone(), this.scene);
    this.camera.setTarget(Vector3.Zero());
    this.camera.fov = 0.9;
    this.camera.minZ = 0.1;
    // La cámara no se controla libremente: es guiada por la experiencia
    this.camera.inputs.clear();

    const glow = new GlowLayer('glow', this.scene, { mainTextureSamples: 2 });
    glow.intensity = 0.55;

    this.field = new MemoryParticleField(this.scene, 4000);
    this.ui = new UIManager(uiRoot);
    this.memory.onChange((data) => this.ui.updateDebug(data, this.state.stage));
    this.state.onChange((next) => {
      this.ui.updateDebug(this.memory.snapshot(), next);
      void this.loadStage(next);
    });

    this.setupParallax();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeys);
  }

  async start(): Promise<void> {
    this.scene.clearColor.set(0, 0, 0, 1);
    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
      this.currentStage?.update(dt);
      this.scene.render();
    });

    this.audio.preload(MUSIC.origin);
    await this.ui.showIntro();
    await this.audio.unlock();

    // Atajos de desarrollo: ?etapa=infancia, ?etapa=cinta o ?etapa=diorama
    const params = new URLSearchParams(window.location.search);
    if (params.get('etapa') === 'diorama') {
      this.field.settle();
      this.simulateMemory(params);
      this.state.goTo(Stage.Diorama);
      return;
    }
    if (params.get('etapa') === 'cinta') {
      this.field.settle();
      this.state.goTo(Stage.CinemaJourney);
      return;
    }
    if (params.get('etapa') === 'infancia') {
      this.field.settle();
      void this.audio.playMusic(MUSIC.origin, 2);
      this.state.goTo(Stage.Childhood);
      return;
    }
    this.state.goTo(Stage.Origin);
  }

  private async loadStage(id: StageId): Promise<void> {
    this.currentStage?.dispose();
    this.currentStage = this.createStage(id);
    if (!this.currentStage) return;

    await this.currentStage.enter({
      complete: () => this.onStageComplete(id),
      setParallax: (enabled) => this.setParallax(enabled),
    });
  }

  private createStage(id: StageId): ExperienceStage | null {
    switch (id) {
      case Stage.Origin:
        return new OriginStage(this.scene, this.camera, this.field, this.audio, this.ui);
      case Stage.Childhood:
        return new ChildhoodStage(this.scene, this.canvas, this.memory, this.ui, this.field, CHILDHOOD_OBJECTS);
      case Stage.CinemaJourney:
        return new CinemaJourneyStage(
          this.scene,
          this.canvas,
          this.camera,
          this.memory,
          this.audio,
          this.ui,
          this.field,
          CINEMA_SCENES,
        );
      case Stage.Diorama:
        return new DioramaStage(
          this.scene,
          this.camera,
          this.memory,
          this.ui,
          this.field,
          this.canvas,
          this.audio,
          CINEMA_SCENES,
          CHILDHOOD_OBJECTS,
        );
      default:
        return null; // Etapas de fases posteriores
    }
  }

  private onStageComplete(id: StageId): void {
    console.info(`[Experience] etapa completada: ${id}`, this.memory.snapshot());
    if (id === Stage.Origin) this.state.goTo(Stage.Childhood);
    else if (id === Stage.Childhood) this.state.goTo(Stage.CinemaJourney);
    else if (id === Stage.CinemaJourney) this.state.goTo(Stage.Diorama);
    // La Fase 6 conectará: Diorama → Ending
  }

  /** Leve movimiento de cámara con el mouse para dar profundidad. */
  private setupParallax(): void {
    window.addEventListener('pointermove', (e) => {
      if (!this.parallaxEnabled) return;
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      gsap.to(this.camera.position, {
        x: CAMERA_HOME.x + this.pointer.x * 0.6,
        y: CAMERA_HOME.y - this.pointer.y * 0.35,
        duration: 1.6,
        ease: 'power2.out',
        overwrite: 'auto',
        onUpdate: () => this.camera.setTarget(Vector3.Zero()),
      });
    });
  }

  /**
   * Solo desarrollo: llena la memoria como si el usuario hubiera hecho el recorrido.
   *  ?sim=nemo:60:1,la-la-land:10:4   (escenario:segundos:visitas)
   *  ?obj=peluche,audifonos            (objetos en orden de selección)
   * Sin parámetros, inventa un recorrido al azar.
   */
  private simulateMemory(params: URLSearchParams): void {
    const objIds = params.get('obj')?.split(',').filter(Boolean) ??
      [...CHILDHOOD_OBJECTS].sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 3)).map((o) => o.id);
    for (const id of objIds) {
      const def = CHILDHOOD_OBJECTS.find((o) => o.id === id);
      if (def) this.memory.select(def, def.colors[0]);
    }
    this.memory.lockSelection();

    const sim = params.get('sim');
    const entries = sim
      ? sim.split(',').map((e) => e.split(':'))
      : CINEMA_SCENES.map((s) => [s.id, String(3 + Math.random() * 60), String(1 + Math.floor(Math.random() * 3))]);
    for (const s of CINEMA_SCENES) {
      const e = entries.find((x) => x[0] === s.id);
      const time = e ? Number(e[1]) : 3;
      const visits = e ? Number(e[2] ?? 1) : 1;
      for (let v = 0; v < visits; v++) this.memory.recordVisit(s.id);
      this.memory.addTime(s.id, time);
    }
  }

  private setParallax(enabled: boolean): void {
    this.parallaxEnabled = enabled;
    if (!enabled) gsap.killTweensOf(this.camera.position);
  }

  /** M: silenciar / activar sonido. */
  private handleKeys = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.key.toLowerCase() === 'm') this.audio.toggleMute();
  };

  private handleResize = (): void => {
    this.engine.resize();
  };

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeys);
    this.currentStage?.dispose();
    this.field.dispose();
    this.audio.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
