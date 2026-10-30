import type { MemoryData, ObjectDefinition, SceneStatistics, SelectedMemory } from '../data/types';

type MemoryListener = (data: Readonly<MemoryData>) => void;

/**
 * Registro de los recuerdos del usuario.
 * No depende de Babylon: solo datos y reglas.
 */
export class MemorySystem {
  readonly maxSelections: number;
  private data: MemoryData = {
    selectedObjects: [],
    sceneStats: {},
    finalObjectId: null,
  };
  private locked = false;
  private listeners = new Set<MemoryListener>();

  constructor(maxSelections = 5) {
    this.maxSelections = maxSelections;
  }

  get count(): number {
    return this.data.selectedObjects.length;
  }

  get isFull(): boolean {
    return this.count >= this.maxSelections;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  has(id: string): boolean {
    return this.data.selectedObjects.some((m) => m.id === id);
  }

  canSelect(id: string): boolean {
    return !this.locked && !this.isFull && !this.has(id);
  }

  /** Registra un objeto. Devuelve null si no se puede (lleno, repetido o bloqueado). */
  select(definition: ObjectDefinition, color: string): SelectedMemory | null {
    if (!this.canSelect(definition.id)) return null;

    const memory: SelectedMemory = {
      id: definition.id,
      category: definition.category,
      model: definition.model,
      color,
      order: this.count + 1,
      selectedAt: Date.now(),
    };
    this.data.selectedObjects.push(memory);
    this.emit();
    return memory;
  }

  /** Cierra la selección de infancia. Después no se aceptan más objetos. */
  lockSelection(): void {
    this.locked = true;
    this.emit();
  }

  getSelected(): readonly SelectedMemory[] {
    return this.data.selectedObjects;
  }

  // ---------- Estadísticas de escenarios (cinta cinematográfica) ----------

  private stats(id: string): SceneStatistics {
    let st = this.data.sceneStats[id];
    if (!st) {
      st = { timeSpent: 0, visitCount: 0, interactionCount: 0, lastVisit: null };
      this.data.sceneStats[id] = st;
    }
    return st;
  }

  recordVisit(id: string): void {
    const st = this.stats(id);
    st.visitCount++;
    st.lastVisit = Date.now();
    this.emit();
  }

  addTime(id: string, seconds: number): void {
    const st = this.stats(id);
    const before = Math.floor(st.timeSpent);
    st.timeSpent += seconds;
    // Solo avisa una vez por segundo para no saturar a los oyentes
    if (Math.floor(st.timeSpent) !== before) this.emit();
  }

  recordInteraction(id: string): void {
    this.stats(id).interactionCount++;
    this.emit();
  }

  getSceneStats(id: string): Readonly<SceneStatistics> | null {
    return this.data.sceneStats[id] ?? null;
  }

  /** Copia profunda para que nadie modifique el estado desde fuera. */
  snapshot(): MemoryData {
    return structuredClone(this.data);
  }

  onChange(listener: MemoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.data);
  }
}
