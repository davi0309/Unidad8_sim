import type { MemorySystem } from './MemorySystem';

/**
 * Registra, sin mostrarlo, cómo recorre el usuario los escenarios:
 * - timeSpent: segundos acumulados mientras el escenario está en pantalla.
 * - visitCount: veces que llegó y se quedó (no cuenta pasar de largo).
 * - interactionCount: acercarse, tocar las partículas.
 * - lastVisit: momento de la última visita.
 *
 * Tiempo y visitas son independientes: volver muchas veces pesa distinto que quedarse mucho.
 * No interpreta emociones: solo cuenta.
 */
export class ExperienceTracker {
  /** Segundos que hay que quedarse para que cuente como visita. */
  static readonly DWELL_TO_VISIT = 1.2;

  private memory: MemorySystem;
  private current: string | null = null;
  private dwell = 0;
  private counted = false;
  private paused = false;
  private lastTick: number | null = null;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  get currentScene(): string | null {
    return this.current;
  }

  /** El usuario se detuvo en un escenario. */
  enter(id: string): void {
    if (id === this.current) return;
    this.current = id;
    this.dwell = 0;
    this.counted = false;
  }

  /** El usuario se fue del escenario (está en movimiento). */
  leave(): void {
    this.current = null;
  }

  /** Detiene el conteo (por ejemplo, cuando la pestaña no está visible). */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  interaction(id: string): void {
    this.memory.recordInteraction(id);
  }

  /**
   * Avanza el conteo con el reloj real (no con el tiempo de animación),
   * para que el tiempo registrado sea correcto aunque el equipo vaya lento.
   */
  update(): void {
    const now = performance.now();
    const dt = this.lastTick === null ? 0 : Math.min((now - this.lastTick) / 1000, 1);
    this.lastTick = now;
    if (!this.current || this.paused) return;
    this.dwell += dt;
    if (!this.counted) {
      if (this.dwell >= ExperienceTracker.DWELL_TO_VISIT) {
        this.counted = true;
        this.memory.recordVisit(this.current);
        this.memory.addTime(this.current, this.dwell);
      }
      return;
    }
    this.memory.addTime(this.current, dt);
  }

  hasVisitedAll(ids: readonly string[]): boolean {
    return ids.every((id) => (this.memory.getSceneStats(id)?.visitCount ?? 0) > 0);
  }
}
