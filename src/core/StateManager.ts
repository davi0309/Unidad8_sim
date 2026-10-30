/** Las cinco etapas narrativas de la experiencia. */
export const Stage = {
  Origin: 'origin',
  Childhood: 'childhood',
  CinemaJourney: 'cinemaJourney',
  Diorama: 'diorama',
  Ending: 'ending',
} as const;

export type StageId = (typeof Stage)[keyof typeof Stage];

const ORDER: StageId[] = [
  Stage.Origin,
  Stage.Childhood,
  Stage.CinemaJourney,
  Stage.Diorama,
  Stage.Ending,
];

type StageListener = (next: StageId, previous: StageId | null) => void;

/** Controla en qué etapa está la experiencia. Solo avanza, nunca salta hacia atrás. */
export class StateManager {
  private current: StageId | null = null;
  private listeners = new Set<StageListener>();

  get stage(): StageId | null {
    return this.current;
  }

  /** Cambia de etapa. Ignora cambios repetidos o hacia atrás. */
  goTo(next: StageId): boolean {
    if (next === this.current) return false;
    if (this.current && ORDER.indexOf(next) < ORDER.indexOf(this.current)) return false;

    const previous = this.current;
    this.current = next;
    for (const listener of this.listeners) listener(next, previous);
    return true;
  }

  onChange(listener: StageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
