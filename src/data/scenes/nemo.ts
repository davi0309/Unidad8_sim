import type { SceneDefinition } from '../types';
import type { Painter } from '../../utils/paint';

/** Arrecife turquesa con luz que atraviesa el agua, corales que se mecen y un banco de peces. */
export const nemo: SceneDefinition = {
  id: 'nemo',
  reference: 'Buscando a Nemo',
  title: 'Lo que vive bajo el agua',
  music: 'nemo',
  base: '#2a8cc0',
  affinity: { isla: 0.6, bosque: 0.15, habitacion: 0.1, castillo: 0.15 },
  palette: ['#ff7a3a', '#3cbcc8', '#5462c8'],
  light: '#6ad0d8',
  motif: 'coral',
  layers: [
    {
      name: 'agua',
      count: 16000,
      size: 0.22,
      jitter: 0.08,
      draw: (p) => {
        p.lgrad(1, 0, 0.1, 1, [
          [0, '#8ae6d9'],
          [0.35, '#3cbcc8'],
          [0.65, '#2a86c0'],
          [1, '#173f8f'],
        ]);
        for (let i = 0; i < 600; i++) {
          const u = p.rand();
          const v = p.rand();
          p.line([[u, v], [u + 0.025, v - 0.012]], 0.003, p.pick(['rgba(255,255,255,0.1)', 'rgba(20,60,140,0.14)']));
        }
        // Base del arrecife (densa, oscura)
        p.poly([[0, 0.3], [0.2, 0.55], [0.45, 0.8], [0.62, 1.02], [0, 1.02]], '#2a3f8a');
      },
    },
    {
      name: 'rayos',
      blend: 'add',
      count: 1200,
      motion: 'pulse',
      speed: 0.5,
      size: 0.18,
      weight: 'luma',
      opacity: 0.7,
      draw: (p) => {
        for (const u of [0.55, 0.7, 0.83, 0.96]) {
          p.poly([[u, -0.02], [u + 0.05, -0.02], [u - 0.25, 1.02], [u - 0.34, 1.02]], 'rgba(220,255,250,0.16)');
        }
      },
    },
    {
      name: 'causticas',
      blend: 'add',
      count: 1900,
      motion: 'drift',
      amp: [0.15, 0.05],
      speed: 0.5,
      size: 0.09,
      weight: 'luma',
      draw: (p) => {
        for (let i = 0; i < 260; i++) {
          const u = p.range(0.35, 1);
          const v = p.range(0, 0.38) * (u - 0.2);
          p.ellipse(u, v, p.range(0.004, 0.014), p.range(0.002, 0.006), 'rgba(255,233,150,0.85)', p.range(0, Math.PI));
        }
      },
    },
    {
      name: 'coral-fondo',
      count: 4600,
      motion: 'sway',
      speed: 0.8,
      baseY: 1,
      size: 0.13,
      jitter: 0.1,
      draw: (p) => {
        coral(p, 0.12, 0.55, 1.3, '#4f5fc4', '#7f8ff0');
        coral(p, 0.3, 0.72, 1.2, '#3d9fb5', '#7fd4e0');
        coral(p, 0.04, 0.8, 1.4, '#8a5ad0', '#b98af0');
        coral(p, 0.24, 0.96, 1.5, '#5462c8', '#8e9cf2');
        coral(p, 0.47, 0.97, 1.1, '#2f6fb0', '#6faee8');
        coral(p, 0.02, 0.38, 1, '#3d7fc0', '#7ab8f0');
      },
    },
    {
      name: 'coral-frente',
      count: 4600,
      motion: 'sway',
      speed: 1,
      baseY: 1,
      phase: 2,
      size: 0.13,
      jitter: 0.1,
      draw: (p) => {
        coral(p, 0.14, 0.43, 1.1, '#ff7a3a', '#ffb070');
        coral(p, 0.07, 0.66, 1, '#f0607a', '#ff9aac');
        coral(p, 0.4, 0.84, 1.6, '#ff8a3a', '#ffc080');
        coral(p, 0.2, 0.86, 1.1, '#e04a5a', '#ff8090');
        coral(p, 0.6, 1.0, 1.4, '#ff7040', '#ffb080');
        coral(p, 0.32, 0.62, 0.8, '#f3d0b0', '#fff0e0');
        coral(p, 0.72, 0.96, 0.9, '#c84aa0', '#f080c8');
      },
    },
    {
      name: 'cardumen',
      count: 1100,
      motion: 'drift',
      amp: [0.6, 0.35],
      speed: 0.35,
      size: 0.05,
      jitter: 0.03,
      draw: (p) => {
        for (let i = 0; i < 26; i++) {
          const t = p.rand();
          const u = 0.45 + t * 0.48 + p.range(-0.04, 0.04);
          const v = 0.38 + t * 0.26 + p.range(-0.05, 0.05);
          stripedFish(p, u, v, p.range(0.8, 1.2));
        }
      },
    },
    {
      name: 'pez-azul',
      count: 300,
      motion: 'drift',
      amp: [0.5, 0.3],
      speed: 0.3,
      phase: 2,
      size: 0.06,
      draw: (p) => {
        const X = p.x(0.66);
        const Y = p.y(0.68);
        const S = p.s(2.4);
        p.ppoly([[X + S * 0.02, Y], [X + S * 0.035, Y - S * 0.012], [X + S * 0.035, Y + S * 0.012]], '#f2c230');
        p.pellipse(X, Y, S * 0.024, S * 0.014, '#4a3cc8');
        p.pellipse(X - S * 0.004, Y - S * 0.002, S * 0.012, S * 0.006, '#2a1e80');
        p.pcircle(X - S * 0.016, Y - S * 0.003, S * 0.002, '#ffffff');
      },
    },
    {
      name: 'burbujas',
      blend: 'add',
      count: 320,
      motion: 'rise',
      speed: [0.2, 0.5],
      size: 0.06,
      weight: 'luma',
      draw: (p) => p.dots(130, [0.2, 0, 1, 1], [0.002, 0.004], ['#ffffff', '#d8fff8']),
    },
  ],
};

/** Coral esponjoso: muchos círculos que se abren hacia arriba, con puntas más claras. */
function coral(p: Painter, u: number, v: number, scale: number, c1: string, c2: string): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  const tips: [number, number, number][] = [];
  for (let i = 0; i < 46; i++) {
    const a = Math.PI + p.rand() * Math.PI;
    const d = p.range(0, 0.11);
    const cx = X + Math.cos(a) * S * d;
    const cy = Y + Math.sin(a) * S * d * 0.9;
    const r = S * p.range(0.012, 0.03);
    p.pcircle(cx, cy, r, c1);
    if (d > 0.07) tips.push([cx, cy, r]);
  }
  for (const [cx, cy, r] of tips) p.pcircle(cx, cy - r * 0.3, r * 0.6, c2);
}

/** Pez naranja con franjas blancas (especie real, sin rasgos de personaje). */
function stripedFish(p: Painter, u: number, v: number, scale: number): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  p.ppoly([[X - S * 0.013, Y], [X - S * 0.022, Y - S * 0.007], [X - S * 0.022, Y + S * 0.007]], '#ff7a1a');
  p.pellipse(X, Y, S * 0.016, S * 0.008, '#ff7a1a');
  p.pellipse(X + S * 0.006, Y, S * 0.0022, S * 0.0075, '#ffffff');
  p.pellipse(X - S * 0.005, Y, S * 0.0022, S * 0.0072, '#ffffff');
}
