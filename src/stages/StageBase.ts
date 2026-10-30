/** Contrato común de las cinco etapas. */
export interface StageContext {
  /** Avisa a la experiencia que la etapa terminó. */
  complete: () => void;
  /** Activa o desactiva el paralaje de cámara con el mouse (las etapas con cámara propia lo apagan). */
  setParallax: (enabled: boolean) => void;
}

export interface ExperienceStage {
  enter(context: StageContext): Promise<void>;
  update(dt: number): void;
  dispose(): void;
}
