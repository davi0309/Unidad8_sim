import type { AnchorTag, DioramaDefinition, ObjectCategory, TemplateId } from '../types';

/** Las cuatro plantillas de diorama: datos de ambiente. La geometría vive en entities/diorama. */
export const DIORAMA_TEMPLATES: Record<TemplateId, DioramaDefinition> = {
  castillo: {
    id: 'castillo',
    name: 'Castillo entre las nubes',
    sky: '#e89c8c',
    fogDensity: 0.012,
    hemi: { sky: '#ffe0c4', ground: '#b07890', intensity: 0.85 },
    key: { color: '#ffcf9a', intensity: 1.0, direction: [-0.6, -1, 0.5] },
    ambient: ['#fff0d8', '#ffd0b8', '#ffe8a0'],
  },
  habitacion: {
    id: 'habitacion',
    name: 'Habitación bajo la luna',
    sky: '#0d1130',
    fogDensity: 0.006,
    hemi: { sky: '#6a78b8', ground: '#2a2440', intensity: 0.45 },
    key: { color: '#a8c0ff', intensity: 1.3, direction: [-0.1, -0.7, -1] },
    ambient: ['#cfe0ff', '#a8b8ff', '#fff4d8'],
  },
  bosque: {
    id: 'bosque',
    name: 'Bosque de los recuerdos',
    sky: '#10241e',
    fogDensity: 0.02,
    hemi: { sky: '#cfe8d0', ground: '#2a3a2a', intensity: 0.6 },
    key: { color: '#ffe8b0', intensity: 0.85, direction: [0.5, -1, 0.4] },
    ambient: ['#e8ff9a', '#fff2a0', '#b8ffd8'],
  },
  isla: {
    id: 'isla',
    name: 'Isla suspendida',
    sky: '#8cc6ff',
    fogDensity: 0.009,
    hemi: { sky: '#f2f8ff', ground: '#7aa080', intensity: 0.85 },
    key: { color: '#fff2d4', intensity: 1.05, direction: [-0.5, -1, -0.3] },
    ambient: ['#ffffff', '#d8f0ff', '#fff4e0'],
  },
};

/** Orden fijo para desempatar plantillas. */
export const TEMPLATE_ORDER: TemplateId[] = ['bosque', 'castillo', 'isla', 'habitacion'];

/** Parámetros ajustables del generador. */
export const GENERATOR_CONFIG = {
  /** λ: peso adicional de las visitas recurrentes frente al tiempo de permanencia. */
  lambda: 0.6,
  /** Cuántos universos aportan elementos al diorama. */
  accentScenes: 3,
  /** Máximo de elementos por universo. */
  maxMotifsPerScene: 3,
  /** Cuánto tiñen los universos visitados la luz de la plantilla (0–1). */
  lightTintAmount: 0.3,
  /** Escala de los objetos de infancia según su orden de selección (el primero es el más grande). */
  objectScaleByOrder: [1, 0.86, 0.78, 0.74, 0.7],
  objectBaseScale: 0.95,
};

/**
 * Lugares preferidos de cada categoría de objeto.
 * Un objeto busca un sitio con estas etiquetas; si no hay, toma el de mayor prioridad libre.
 */
export const CATEGORY_PREFERENCES: Record<ObjectCategory, AnchorTag[]> = {
  juego: ['mesa', 'estante', 'juego'],
  peluche: ['suave', 'descanso'],
  movimiento: ['movimiento', 'abierto', 'suelo'],
  deporte: ['abierto', 'movimiento', 'suelo'],
  musica: ['musica', 'luz', 'alto', 'mesa'],
  juguete: ['juego', 'suelo', 'suave'],
  figura: ['estante', 'alto', 'mesa'],
};
