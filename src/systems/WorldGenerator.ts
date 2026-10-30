import { CATEGORY_PREFERENCES, GENERATOR_CONFIG, TEMPLATE_ORDER } from '../data/dioramas';
import type {
  AnchorTag,
  DioramaPlan,
  MemoryData,
  ObjectCategory,
  SceneDefinition,
  TemplateId,
} from '../data/types';
import { hashString } from '../utils/paint';

/** Un lugar del diorama donde puede ir un objeto (lo define cada plantilla). */
export interface AnchorSpec {
  id: string;
  tags: AnchorTag[];
  /** Importancia visual del lugar (el primer recuerdo va al más importante). */
  priority: number;
}

type GeneratorConfig = typeof GENERATOR_CONFIG;

/**
 * Generador procedural del diorama. Sin Babylon: solo reglas y datos, para poder probarlo y ajustarlo.
 *
 * 1. Peso de cada universo: P_i = T_i + λ·V_i
 *    - T_i: tiempo de permanencia normalizado (tiempo / tiempo máximo).
 *    - V_i: visitas recurrentes normalizadas ((visitas − 1) / máximo de regresos).
 *    Normalizar evita que el tiempo acumulado domine el resultado.
 * 2. Puntaje de cada plantilla: Σ P_i · afinidad(universo_i, plantilla). Gana la mayor.
 * 3. Los universos de mayor peso aportan elementos, colores y luz (acentos).
 * 4. Los objetos de infancia se ubican por orden de selección y categoría.
 */
export function generateDiorama(
  memory: MemoryData,
  scenes: SceneDefinition[],
  anchorsFor: (template: TemplateId) => AnchorSpec[],
  config: GeneratorConfig = GENERATOR_CONFIG,
): DioramaPlan {
  // ---- 1. Pesos ----
  const raw = scenes.map((s) => {
    const st = memory.sceneStats[s.id];
    return {
      id: s.id,
      time: st?.timeSpent ?? 0,
      returns: Math.max((st?.visitCount ?? 0) - 1, 0),
    };
  });
  const maxTime = Math.max(...raw.map((r) => r.time), 0);
  const maxReturns = Math.max(...raw.map((r) => r.returns), 0);
  let weights = raw.map((r) => {
    const T = maxTime > 0 ? r.time / maxTime : 0;
    const V = maxReturns > 0 ? r.returns / maxReturns : 0;
    return { id: r.id, T, V, P: T + config.lambda * V };
  });
  // Sin datos (no debería pasar): todos pesan igual
  if (weights.every((w) => w.P === 0)) weights = weights.map((w) => ({ ...w, P: 1 }));

  // ---- 2. Plantilla ----
  const scores: Record<TemplateId, number> = { bosque: 0, castillo: 0, isla: 0, habitacion: 0 };
  for (const w of weights) {
    const scene = scenes.find((s) => s.id === w.id)!;
    for (const t of TEMPLATE_ORDER) scores[t] += w.P * (scene.affinity[t] ?? 0);
  }
  let template: TemplateId = TEMPLATE_ORDER[0];
  for (const t of TEMPLATE_ORDER) if (scores[t] > scores[template] + 1e-9) template = t;

  // ---- 3. Acentos y luz ----
  const totalP = weights.reduce((a, w) => a + w.P, 0) || 1;
  const ranked = [...weights].filter((w) => w.P > 0).sort((a, b) => b.P - a.P);
  const accents = ranked.slice(0, config.accentScenes).map((w) => {
    const scene = scenes.find((s) => s.id === w.id)!;
    const share = w.P / totalP;
    return {
      sceneId: w.id,
      share,
      motif: scene.motif,
      palette: scene.palette,
      count: Math.max(1, Math.min(config.maxMotifsPerScene, Math.round(share * 6))),
    };
  });
  const lightTint = mixHex(
    weights.map((w) => ({ hex: scenes.find((s) => s.id === w.id)!.light, weight: w.P })),
  );

  // ---- 4. Objetos de infancia ----
  const anchors = [...anchorsFor(template)].sort((a, b) => b.priority - a.priority);
  const used = new Set<string>();
  const objects = [...memory.selectedObjects].sort((a, b) => a.order - b.order);
  const placements = objects.map((obj, i) => {
    let chosen: AnchorSpec | undefined;
    if (i === 0) {
      // El primer recuerdo elegido ocupa el lugar más importante
      chosen = anchors.find((a) => !used.has(a.id));
    } else {
      const prefs = CATEGORY_PREFERENCES[obj.category as ObjectCategory] ?? [];
      let best = -Infinity;
      for (const a of anchors) {
        if (used.has(a.id)) continue;
        // Coincidencia con las preferencias (las primeras pesan más) + importancia del lugar
        const match = prefs.reduce((acc, tag, k) => acc + (a.tags.includes(tag) ? 4 - k : 0), 0);
        const score = match * 3 + a.priority * 0.5;
        if (score > best) {
          best = score;
          chosen = a;
        }
      }
    }
    chosen ??= anchors[i % anchors.length];
    used.add(chosen.id);
    return {
      objectId: obj.id,
      anchorId: chosen.id,
      order: obj.order,
      color: obj.color,
      scale: config.objectBaseScale * (config.objectScaleByOrder[i] ?? 0.7),
    };
  });

  const seed = hashString(JSON.stringify({ weights, objects: objects.map((o) => o.id) }));
  return { template, weights, scores, accents, lightTint, placements, seed };
}

/** Promedio ponderado de colores hex. */
function mixHex(items: { hex: string; weight: number }[]): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (const { hex, weight } of items) {
    if (weight <= 0) continue;
    const n = parseInt(hex.slice(1), 16);
    r += ((n >> 16) & 255) * weight;
    g += ((n >> 8) & 255) * weight;
    b += (n & 255) * weight;
    total += weight;
  }
  if (total === 0) return '#ffffff';
  const to = (v: number) => Math.round(v / total).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
