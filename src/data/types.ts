// Estructuras de datos de la experiencia. Separadas de la presentación visual.

export type ObjectCategory =
  | 'juego'
  | 'peluche'
  | 'movimiento'
  | 'deporte'
  | 'musica'
  | 'juguete'
  | 'figura';

/** Forma provisional usada mientras no exista el modelo .glb real. */
export type PlaceholderShape =
  | 'handheldConsole'
  | 'plush'
  | 'bicycle'
  | 'ball'
  | 'headphones'
  | 'musicBox'
  | 'yoyo'
  | 'actionFigure'
  | 'doll'
  | 'brick'
  | 'dinosaur';

/** Efectos visuales configurables al tocar un objeto en el diorama. */
export type ObjectEffect = 'bounce' | 'squish' | 'spin' | 'glow' | 'notes' | 'shake' | 'roll' | 'yoyo';

export interface ObjectDefinition {
  id: string;
  name: string;
  category: ObjectCategory;
  /** Ruta a un .glb/.gltf dentro de /public/models. null = usar placeholder. */
  model: string | null;
  placeholder: PlaceholderShape;
  /** Variantes de color (hex). Se elige una al aparecer el objeto. */
  colors: string[];
  /** Efecto de sonido al tocarlo en el diorama (clave en SFX). */
  sound: string | null;
  /** Efecto visual al tocarlo en el diorama. */
  interaction: ObjectEffect | null;
}

/** Registro de un objeto elegido por el usuario en la etapa de infancia. */
export interface SelectedMemory {
  id: string;
  category: ObjectCategory;
  model: string | null;
  color: string;
  /** 1 = primer objeto elegido. */
  order: number;
  selectedAt: number;
}

export interface SceneStatistics {
  timeSpent: number;
  visitCount: number;
  interactionCount: number;
  lastVisit: number | null;
}

export interface MemoryData {
  selectedObjects: SelectedMemory[];
  /** Se llena en la Fase 3 (cinta cinematográfica). */
  sceneStats: Record<string, SceneStatistics>;
  /** Se llena en la Fase 6 (último recuerdo). */
  finalObjectId: string | null;
}

// ---------- Escenarios de la cinta cinematográfica ----------

export type MotionType =
  | 'still'
  | 'twinkle'
  | 'rise'
  | 'sway'
  | 'drift'
  | 'orbit'
  | 'fall'
  | 'flow'
  | 'pulse';

/**
 * Una capa de partículas de un escenario.
 * `draw` pinta en un canvas 2D; las partículas toman forma y color de esa pintura.
 */
export interface SceneLayer {
  name: string;
  draw: (p: import('../utils/paint').Painter) => void;
  count: number;
  /** 'alpha' pinta encima (formas); 'add' suma luz (brillos, rayos). */
  blend?: 'alpha' | 'add';
  motion?: MotionType;
  /** Velocidad del movimiento (fija o rango aleatorio). */
  speed?: number | [number, number];
  /** Tamaño de cada partícula en unidades de mundo (el fotograma mide 16 × 9). */
  size?: number;
  opacity?: number;
  /** 'alpha' reparte por cobertura; 'luma' concentra partículas donde la pintura es más brillante. */
  weight?: 'alpha' | 'luma';
  /** Variación de brillo por partícula (textura pictórica). */
  jitter?: number;
  /** Centro de la órbita (u, v normalizados). */
  center?: [number, number];
  /** Achatamiento de la órbita (1 = círculo). */
  flatten?: number;
  orbitMode?: 'rigid' | 'kepler' | 'front';
  /** Base del balanceo (v normalizado): lo que está más arriba se mueve más. */
  baseY?: number;
  /** Amplitud de la deriva en grupo (unidades de mundo). */
  amp?: [number, number];
  phase?: number;
}

export interface SceneDefinition {
  id: string;
  /** Obra de referencia (solo como dato; no se muestra). */
  reference: string;
  /** Título que se muestra en la cinta. */
  title: string;
  /** Clave de la pista en MUSIC. */
  music: string;
  /** Color del fondo del fotograma (se ve entre partículas). */
  base: string;
  layers: SceneLayer[];
  /** Cuánto se parece este universo a cada plantilla de diorama (suma ≈ 1). */
  affinity: Record<TemplateId, number>;
  /** Colores que aporta al diorama. */
  palette: string[];
  /** Color de luz que aporta al diorama. */
  light: string;
  /** Elemento decorativo que deja en el diorama. */
  motif: MotifId;
}

// ---------- Diorama ----------

export type TemplateId = 'castillo' | 'habitacion' | 'bosque' | 'isla';

export type MotifId = 'farola' | 'acacia' | 'farol-papel' | 'hongo' | 'coral' | 'planeta' | 'pagoda';

/** Etiquetas de los lugares del diorama donde puede ir un objeto. */
export type AnchorTag =
  | 'centro'
  | 'abierto'
  | 'suelo'
  | 'suave'
  | 'descanso'
  | 'alto'
  | 'estante'
  | 'mesa'
  | 'musica'
  | 'juego'
  | 'luz'
  | 'agua'
  | 'movimiento'
  | 'suspendido';

export interface DioramaDefinition {
  id: TemplateId;
  name: string;
  /** Color del cielo (fondo). */
  sky: string;
  fogDensity: number;
  /** Luz ambiental (cielo / suelo) y luz principal. */
  hemi: { sky: string; ground: string; intensity: number };
  key: { color: string; intensity: number; direction: [number, number, number] };
  /** Colores de las partículas de ambiente. */
  ambient: string[];
}

/** Resultado del generador: todo lo necesario para construir un diorama. */
export interface DioramaPlan {
  template: TemplateId;
  /** Peso de cada escenario: P_i = T_i + λ·V_i (con datos normalizados). */
  weights: { id: string; T: number; V: number; P: number }[];
  /** Puntaje de cada plantilla. */
  scores: Record<TemplateId, number>;
  /** Universos que aportan elementos, color y luz (los de mayor peso). */
  accents: { sceneId: string; share: number; motif: MotifId; palette: string[]; count: number }[];
  /** Luz del diorama teñida por los universos visitados. */
  lightTint: string;
  /** Dónde va cada objeto de infancia. */
  placements: { objectId: string; anchorId: string; scale: number; color: string; order: number }[];
  seed: number;
}
