import type { SceneDefinition } from '../types';
import type { Painter } from '../../utils/paint';

const SUN: [number, number] = [0.4, 0.42];
const RING = 0.27;

/**
 * Amanecer encendido sobre la sabana: un sol enorme rodeado por un anillo de luz,
 * nubes rojas con bordes dorados, un risco que se asoma y manadas cruzando la llanura.
 */
export const reyLeon: SceneDefinition = {
  id: 'rey-leon',
  reference: 'El rey león',
  title: 'El amanecer de todo',
  music: 'rey-leon',
  base: '#c8501c',
  affinity: { bosque: 0.35, castillo: 0.35, isla: 0.2, habitacion: 0.1 },
  palette: ['#f6901c', '#c8401a', '#ffe46a'],
  light: '#ffb050',
  motif: 'acacia',
  layers: [
    {
      name: 'cielo',
      count: 16000,
      size: 0.22,
      jitter: 0.07,
      draw: (p) => {
        p.glow(SUN[0], SUN[1], 1.25, [
          [0, '#fff7c8'],
          [0.08, '#ffe46a'],
          [0.2, '#ffc22a'],
          [0.36, '#f6901c'],
          [0.56, '#e05a18'],
          [0.78, '#a8301a'],
          [1, '#5a1410'],
        ]);
        // Disco del sol
        p.glow(SUN[0], SUN[1], RING, [
          [0, 'rgba(255,250,200,0.95)'],
          [0.85, 'rgba(255,220,90,0.55)'],
          [1, 'rgba(255,200,60,0)'],
        ]);
        // Colinas lejanas y llanura dorada
        hills(p, 0.66, 0.018, '#9a4a2a');
        p.vgrad([[0, '#d89a3a'], [0.45, '#a8642a'], [1, '#3a1a0e']], 0.665, 1);
        p.glow(0.3, 0.7, 0.4, [
          [0, 'rgba(255,214,120,0.6)'],
          [1, 'rgba(255,214,120,0)'],
        ]);
      },
    },
    {
      name: 'rayos',
      blend: 'add',
      count: 2600,
      motion: 'pulse',
      speed: 0.6,
      size: 0.14,
      weight: 'luma',
      opacity: 0.85,
      draw: (p) => {
        const X = p.x(SUN[0]);
        const Y = p.y(SUN[1]);
        const R = p.s(1.4);
        // Haces que caen sobre la llanura desde debajo del sol
        for (let k = 0; k < 9; k++) {
          const a = Math.PI * (0.32 + k * 0.045);
          const w = 0.018 + (k % 3) * 0.008;
          p.ppoly(
            [
              [X, Y],
              [X + Math.cos(a - w) * R, Y + Math.sin(a - w) * R],
              [X + Math.cos(a + w) * R, Y + Math.sin(a + w) * R],
            ],
            k % 2 === 0 ? 'rgba(255,224,140,0.32)' : 'rgba(255,200,110,0.18)',
          );
        }
      },
    },
    {
      name: 'nubes',
      count: 5200,
      motion: 'flow',
      speed: 0.08,
      size: 0.2,
      draw: (p) => {
        const shade = '#9a2c16';
        const light = '#ffaa48';
        p.cloud(0.12, 0.1, 1.5, shade, light, 18);
        p.cloud(0.5, 0.05, 1.3, shade, light, 16);
        p.cloud(0.86, 0.12, 1.4, shade, light, 18);
        p.cloud(0.06, 0.4, 1.2, shade, light, 14);
        p.cloud(0.82, 0.42, 1.1, shade, light, 14);
        p.cloud(0.24, 0.6, 0.9, '#b8401a', '#ffc060', 12);
        // Nubes alargadas que cruzan delante del sol
        for (const [u, v, w] of [[0.48, 0.38, 0.16], [0.62, 0.46, 0.12], [0.3, 0.5, 0.1]] as const) {
          p.ellipse(u, v, w, 0.008, '#6a1c12');
          p.ellipse(u - 0.01, v - 0.006, w * 0.8, 0.004, '#e0602a');
        }
      },
    },
    {
      name: 'anillo',
      blend: 'add',
      count: 2400,
      motion: 'pulse',
      speed: 1.1,
      size: 0.07,
      weight: 'luma',
      draw: (p) => {
        const c = p.ctx;
        c.lineWidth = p.s(0.012);
        c.strokeStyle = 'rgba(255,248,190,1)';
        c.beginPath();
        c.arc(p.x(SUN[0]), p.y(SUN[1]), p.s(RING), 0, Math.PI * 2);
        c.stroke();
        c.lineWidth = p.s(0.035);
        c.strokeStyle = 'rgba(255,214,90,0.35)';
        c.beginPath();
        c.arc(p.x(SUN[0]), p.y(SUN[1]), p.s(RING), 0, Math.PI * 2);
        c.stroke();
      },
    },
    {
      name: 'risco',
      count: 15000,
      size: 0.22,
      jitter: 0.08,
      draw: (p) => {
        // Losa que se asoma hacia el sol, con el borde superior encendido
        p.poly(
          [[1.02, 0.5], [0.86, 0.505], [0.68, 0.52], [0.5, 0.525], [0.44, 0.545], [0.47, 0.57], [0.58, 0.585], [0.68, 0.6], [0.72, 0.64], [1.02, 0.64]],
          '#4a2216',
        );
        p.line([[0.44, 0.545], [0.5, 0.525], [0.68, 0.52], [0.86, 0.505], [1.02, 0.5]], 0.009, '#d88a48');
        p.line([[0.46, 0.565], [0.58, 0.58]], 0.004, '#7a3a20');
        // Pilar que la sostiene
        p.poly([[0.62, 0.6], [0.78, 0.6], [0.8, 0.74], [0.74, 0.8], [0.58, 0.8], [0.6, 0.7]], '#3a1a10');
        p.line([[0.62, 0.62], [0.6, 0.7], [0.6, 0.79]], 0.005, '#8a4426');
        // Rocas del primer plano
        p.poly([[-0.02, 0.88], [0.1, 0.84], [0.22, 0.87], [0.3, 0.93], [0.34, 1.02], [-0.02, 1.02]], '#24100a');
        p.poly([[0.84, 0.86], [0.92, 0.82], [1.02, 0.83], [1.02, 1.02], [0.8, 1.02]], '#24100a');
      },
    },
    {
      name: 'manadas',
      count: 7500,
      size: 0.075,
      jitter: 0.05,
      draw: (p) => {
        // Las de atrás, pequeñas y nubladas; las del frente, grandes y oscuras
        for (let i = 0; i < 70; i++) {
          const t = p.rand();
          const v = 0.69 + t * 0.2;
          const u = p.rand();
          if (u > 0.6 && u < 0.8 && v < 0.8) continue; // detrás del pilar
          const s = 0.35 + t * 0.75;
          const shade = t < 0.4 ? '#7a3818' : t < 0.7 ? '#4a2010' : '#2a120a';
          const kind = p.rand();
          if (kind < 0.55) grazer(p, u, v, s, shade);
          else if (kind < 0.72) elephant(p, u, v, s * 0.9, shade);
          else if (kind < 0.86) giraffe(p, u, v, s * 0.9, shade);
          else rhino(p, u, v, s * 0.85, shade);
        }
      },
    },
    {
      name: 'acacias',
      count: 2600,
      size: 0.1,
      draw: (p) => {
        acacia(p, 0.08, 0.86, 1.1);
        acacia(p, 0.93, 0.82, 1.3);
        acacia(p, 0.36, 0.68, 0.35);
      },
    },
    {
      name: 'brasas',
      blend: 'add',
      count: 420,
      motion: 'rise',
      speed: [0.08, 0.2],
      size: 0.06,
      weight: 'luma',
      draw: (p) => p.dots(180, [0.3, 0.3, 1, 1], [0.0018, 0.0035], ['#ffe08a', '#ffb050']),
    },
  ],
};

function hills(p: Painter, base: number, height: number, color: string): void {
  const pts: [number, number][] = [[0, 1]];
  for (let i = 0; i <= 50; i++) {
    const u = i / 50;
    pts.push([u, base - height * (0.5 + 0.5 * Math.sin(u * 13 + 1) * Math.cos(u * 5))]);
  }
  pts.push([1, 1]);
  p.poly(pts, color);
}

/** Antílope o cebra genérica: cuerpo, cuello, cabeza, patas. */
function grazer(p: Painter, u: number, v: number, scale: number, c: string): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  const dir = p.rand() < 0.5 ? -1 : 1;
  p.pellipse(X, Y, S * 0.03, S * 0.014, c);
  p.pline([[X + dir * S * 0.024, Y - S * 0.004], [X + dir * S * 0.034, Y - S * 0.026]], S * 0.007, c);
  p.pellipse(X + dir * S * 0.038, Y - S * 0.028, S * 0.009, S * 0.005, c, dir * 0.4);
  for (const dx of [-0.02, -0.01, 0.012, 0.022]) p.pline([[X + S * dx, Y + S * 0.008], [X + S * dx, Y + S * 0.042]], S * 0.004, c);
}

function elephant(p: Painter, u: number, v: number, scale: number, c: string): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  p.pellipse(X, Y, S * 0.055, S * 0.035, c);
  p.pcircle(X + S * 0.048, Y - S * 0.012, S * 0.024, c);
  p.pline([[X + S * 0.066, Y - S * 0.006], [X + S * 0.072, Y + S * 0.03], [X + S * 0.066, Y + S * 0.045]], S * 0.009, c);
  for (const dx of [-0.036, -0.018, 0.014, 0.032]) {
    p.ppoly([[X + S * dx - S * 0.008, Y + S * 0.015], [X + S * dx + S * 0.008, Y + S * 0.015], [X + S * dx + S * 0.007, Y + S * 0.062], [X + S * dx - S * 0.007, Y + S * 0.062]], c);
  }
}

function giraffe(p: Painter, u: number, v: number, scale: number, c: string): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  p.pellipse(X, Y, S * 0.03, S * 0.016, c, -0.1);
  p.pline([[X + S * 0.018, Y - S * 0.008], [X + S * 0.034, Y - S * 0.09]], S * 0.011, c);
  p.pellipse(X + S * 0.042, Y - S * 0.094, S * 0.012, S * 0.007, c, 0.3);
  for (const dx of [-0.022, -0.01, 0.012, 0.024]) p.pline([[X + S * dx, Y + S * 0.008], [X + S * dx, Y + S * 0.075]], S * 0.005, c);
}

function rhino(p: Painter, u: number, v: number, scale: number, c: string): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  p.pellipse(X, Y, S * 0.045, S * 0.026, c);
  p.pellipse(X + S * 0.046, Y + S * 0.006, S * 0.024, S * 0.017, c, 0.25);
  p.ppoly([[X + S * 0.062, Y - S * 0.004], [X + S * 0.078, Y - S * 0.032], [X + S * 0.07, Y + S * 0.002]], c);
  for (const dx of [-0.028, -0.012, 0.016, 0.03]) {
    p.ppoly([[X + S * dx - S * 0.008, Y + S * 0.012], [X + S * dx + S * 0.008, Y + S * 0.012], [X + S * dx + S * 0.007, Y + S * 0.045], [X + S * dx - S * 0.007, Y + S * 0.045]], c);
  }
}

/** Acacia: tronco que se abre en ramas y copa plana. */
function acacia(p: Painter, u: number, v: number, scale: number): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  const c = '#1a0a06';
  p.pline([[X, Y], [X, Y - S * 0.1]], S * 0.012, c);
  p.pline([[X, Y - S * 0.08], [X - S * 0.06, Y - S * 0.14]], S * 0.007, c);
  p.pline([[X, Y - S * 0.09], [X + S * 0.05, Y - S * 0.145]], S * 0.007, c);
  for (let i = 0; i < 14; i++) {
    p.pellipse(X + S * p.range(-0.1, 0.09), Y - S * p.range(0.14, 0.17), S * p.range(0.02, 0.04), S * 0.012, c);
  }
}
