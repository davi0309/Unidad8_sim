import {
  Constants,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  VertexData,
  type GlowLayer,
  type Scene,
} from '@babylonjs/core';
import type { MotionType, SceneLayer } from '../data/types';
import { MEMORY_POINTS_SHADER } from '../shaders/memoryPoints';
import { Painter } from '../utils/paint';

export const MOTION: Record<MotionType, number> = {
  still: 0,
  twinkle: 1,
  rise: 2,
  sway: 3,
  drift: 4,
  orbit: 5,
  fall: 6,
  flow: 7,
  pulse: 8,
};

const ORBIT_MODE = { rigid: 0, kepler: 1, front: 2 } as const;

export interface PointData {
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  motion: Float32Array;
  param: Float32Array;
}

/** Resolución del canvas de pintura (16:9). */
export const PAINT_W = 480;
export const PAINT_H = 270;

/** Calidad global: ?calidad=baja reduce las partículas a la mitad (equipos lentos). */
export const QUALITY = (() => {
  const q = new URLSearchParams(window.location.search).get('calidad');
  return q === 'baja' ? 0.5 : 1;
})();

/**
 * Pinta una capa y coloca partículas sobre lo pintado.
 * Las coordenadas resultantes son locales al fotograma (centro = 0,0).
 */
export function buildLayerData(
  layer: SceneLayer,
  frame: { w: number; h: number },
  rand: () => number,
  depth: number,
): PointData {
  const canvas = document.createElement('canvas');
  canvas.width = PAINT_W;
  canvas.height = PAINT_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  layer.draw(new Painter(ctx, PAINT_W, PAINT_H, rand));
  const pixels = ctx.getImageData(0, 0, PAINT_W, PAINT_H).data;

  // Distribución acumulada: más partículas donde hay más pintura (o más luz)
  const n = PAINT_W * PAINT_H;
  const cdf = new Float64Array(n);
  let total = 0;
  const byLuma = layer.weight === 'luma';
  for (let i = 0; i < n; i++) {
    const a = pixels[i * 4 + 3] / 255;
    let w = a;
    if (byLuma && a > 0) {
      const l = (0.3 * pixels[i * 4] + 0.59 * pixels[i * 4 + 1] + 0.11 * pixels[i * 4 + 2]) / 255;
      w = a * (0.15 + l * l);
    }
    total += w;
    cdf[i] = total;
  }

  const count = total > 0 ? Math.max(1, Math.round(layer.count * QUALITY)) : 0;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const motion = new Float32Array(count * 4);
  const param = new Float32Array(count * 4);

  const type = MOTION[layer.motion ?? 'still'];
  const size = layer.size ?? 0.14;
  const opacity = layer.opacity ?? 1;
  const jitter = layer.jitter ?? 0.08;
  const [sMin, sMax] = Array.isArray(layer.speed) ? layer.speed : [layer.speed ?? 1, layer.speed ?? 1];
  const toX = (u: number) => (u - 0.5) * frame.w;
  const toY = (v: number) => (0.5 - v) * frame.h;

  for (let k = 0; k < count; k++) {
    // Búsqueda binaria en la distribución
    const r = rand() * total;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const px = lo % PAINT_W;
    const py = (lo / PAINT_W) | 0;
    const u = (px + rand()) / PAINT_W;
    const v = (py + rand()) / PAINT_H;

    positions[k * 3] = toX(u);
    positions[k * 3 + 1] = toY(v);
    positions[k * 3 + 2] = depth + (rand() - 0.5) * 0.02;

    const shade = 1 + (rand() - 0.5) * 2 * jitter;
    colors[k * 4] = Math.min((pixels[lo * 4] / 255) * shade, 1);
    colors[k * 4 + 1] = Math.min((pixels[lo * 4 + 1] / 255) * shade, 1);
    colors[k * 4 + 2] = Math.min((pixels[lo * 4 + 2] / 255) * shade, 1);
    colors[k * 4 + 3] = (pixels[lo * 4 + 3] / 255) * opacity;

    motion[k * 4] = type;
    motion[k * 4 + 1] = rand();
    motion[k * 4 + 2] = sMin + (sMax - sMin) * rand();
    motion[k * 4 + 3] = size * (0.7 + rand() * 0.6);

    // Parámetros según el movimiento
    if (layer.motion === 'orbit') {
      const [cu, cv] = layer.center ?? [0.5, 0.5];
      param[k * 4] = toX(cu);
      param[k * 4 + 1] = toY(cv);
      param[k * 4 + 2] = layer.flatten ?? 1;
      param[k * 4 + 3] = ORBIT_MODE[layer.orbitMode ?? 'kepler'];
    } else if (layer.motion === 'sway') {
      param[k * 4] = layer.phase ?? 0;
      param[k * 4 + 1] = toY(layer.baseY ?? 1);
    } else if (layer.motion === 'drift') {
      const [ax, ay] = layer.amp ?? [0.3, 0.2];
      param[k * 4] = layer.phase ?? 0;
      param[k * 4 + 2] = ax;
      param[k * 4 + 3] = ay;
    } else if (layer.motion === 'pulse') {
      param[k * 4] = layer.phase ?? 0;
    }
  }

  return { count, positions, colors, motion, param };
}

export interface PointMesh {
  mesh: Mesh;
  material: ShaderMaterial;
}

/** Crea la malla de puntos con su material animado. */
export function createPointMesh(
  scene: Scene,
  name: string,
  data: PointData,
  blend: 'alpha' | 'add',
  frame: { w: number; h: number },
): PointMesh {
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = data.positions;
  vd.colors = data.colors;
  const indices = new Uint32Array(data.count);
  for (let i = 0; i < data.count; i++) indices[i] = i;
  vd.indices = indices;
  vd.applyToMesh(mesh, false);
  mesh.setVerticesData('motion', data.motion, false, 4);
  mesh.setVerticesData('param', data.param, false, 4);

  const material = new ShaderMaterial(
    `${name}-mat`,
    scene,
    { vertex: MEMORY_POINTS_SHADER, fragment: MEMORY_POINTS_SHADER },
    {
      attributes: ['position', 'color', 'motion', 'param'],
      uniforms: ['world', 'viewProjection', 'uTime', 'uScale', 'uSize', 'uAssemble', 'uIntensity', 'uFrame', 'uPointer'],
      needAlphaBlending: true,
    },
  );
  material.pointsCloud = true;
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  material.alphaMode = blend === 'add' ? Constants.ALPHA_ADD : Constants.ALPHA_COMBINE;
  material.setFloat('uTime', 0);
  material.setFloat('uScale', 600);
  material.setFloat('uSize', 1);
  material.setFloat('uAssemble', 0);
  material.setFloat('uIntensity', 1);
  material.setVector2('uFrame', new Vector2(frame.w, frame.h));
  material.setVector3('uPointer', Vector3.Zero());
  mesh.material = material;

  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true; // el shader mueve los puntos: no recortar por bounding box

  // El GlowLayer no sabe dibujar este shader: se excluye
  const glow = scene.effectLayers.find((l) => l.name === 'glow') as GlowLayer | undefined;
  glow?.addExcludedMesh(mesh);

  return { mesh, material };
}
