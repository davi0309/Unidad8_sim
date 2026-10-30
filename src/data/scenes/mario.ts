import type { SceneDefinition } from '../types';
import type { Painter } from '../../utils/paint';

const STARS: [number, number, number, number][] = [
  [0.22, 0.28, 0.034, 0.2],
  [0.36, 0.18, 0.028, -0.15],
  [0.47, 0.38, 0.022, 0.3],
  [0.6, 0.1, 0.026, 0.05],
  [0.88, 0.4, 0.03, -0.25],
  [0.93, 0.2, 0.02, 0.1],
  [0.13, 0.45, 0.018, -0.1],
  [0.66, 0.5, 0.018, 0.2],
];

/** Un mundo luminoso para jugar: cielo de día, hongos gigantes, estrellas flotando y lluvia de estrellas fugaces. */
export const mario: SceneDefinition = {
  id: 'mario',
  reference: 'Mario',
  title: 'Un mundo para jugar',
  music: 'mario',
  base: '#5a8fd8',
  affinity: { castillo: 0.5, bosque: 0.25, isla: 0.2, habitacion: 0.05 },
  palette: ['#e33a35', '#7ac860', '#ffd93a'],
  light: '#bfe6f5',
  motif: 'hongo',
  layers: [
    {
      name: 'paisaje',
      count: 16000,
      size: 0.22,
      jitter: 0.07,
      draw: (p) => {
        p.vgrad([[0, '#2c55c4'], [0.35, '#4f86e8'], [0.65, '#9fd2f2'], [1, '#c4ebf6']], 0, 0.72);
        // Haces de luz diagonales
        for (let i = 0; i < 5; i++) {
          const u = 0.15 + i * 0.14;
          p.poly([[u, -0.02], [u + 0.05, -0.02], [u + 0.32, 0.75], [u + 0.22, 0.75]], 'rgba(255,255,255,0.1)');
        }
        // Nubes grandes
        p.cloud(0.56, 0.3, 1.6, '#d8e8f6', '#ffffff', 18);
        p.cloud(0.86, 0.14, 1.1, '#d8e8f6', '#ffffff');
        p.cloud(0.25, 0.14, 0.9, '#d8e8f6', '#ffffff');
        // Colinas
        for (let u = -0.05; u < 1.1; u += 0.12) p.circle(u, 0.82, p.range(0.2, 0.28), '#7ac860');
        for (let u = 0; u < 1.1; u += 0.16) p.circle(u, 0.9, p.range(0.2, 0.26), '#5aa84f');
        // Árboles redondos
        for (const [u, v, s] of [[0.2, 0.62, 1], [0.34, 0.6, 0.8], [0.5, 0.64, 0.7], [0.82, 0.6, 0.9], [0.92, 0.63, 0.7]] as const) {
          p.rect(u - 0.004, v, 0.008, 0.08 * s, '#7a4a2a');
          p.circle(u, v, 0.05 * s, '#3f9a4c');
          p.circle(u - 0.012, v - 0.015, 0.035 * s, '#56b860');
        }
        // Prado y camino
        p.vgrad([[0, '#8fd45a'], [1, '#5aa83e']], 0.74, 1);
        p.poly([[0.3, 1], [0.44, 0.8], [0.52, 0.76], [0.6, 0.77], [0.57, 0.86], [0.7, 1]], '#efce86');
        // Tronco a la izquierda y ladera al frente
        p.poly([[0, 0], [0.1, 0], [0.12, 0.25], [0.11, 0.5], [0.08, 0.72], [0, 0.78]], '#8a4a2a');
        for (let i = 0; i < 6; i++) p.line([[0.02 + i * 0.016, 0.05], [0.03 + i * 0.014, 0.65]], 0.003, '#6a3820');
        p.poly([[0.62, 1.02], [1.02, 0.78], [1.02, 1.02]], '#c06a2e');
        p.line([[0.62, 1.0], [1.02, 0.78]], 0.006, '#e08a48');
      },
    },
    {
      name: 'nubes',
      count: 2400,
      motion: 'flow',
      speed: 0.1,
      size: 0.22,
      opacity: 0.9,
      draw: (p) => {
        p.cloud(0.1, 0.32, 0.7, '#e2eef8', '#ffffff', 10);
        p.cloud(0.42, 0.08, 0.6, '#e2eef8', '#ffffff', 10);
        p.cloud(0.72, 0.42, 0.55, '#e2eef8', '#ffffff', 9);
      },
    },
    {
      name: 'hongos',
      count: 3000,
      motion: 'sway',
      speed: 1.1,
      baseY: 0.8,
      size: 0.12,
      jitter: 0.05,
      draw: (p) => {
        mushroom(p, 0.74, 0.66, 2.3, '#e33a35');
        mushroom(p, 0.3, 0.78, 0.8, '#e8463c');
        mushroom(p, 0.42, 0.8, 0.6, '#e33a35');
        mushroom(p, 0.52, 0.74, 0.5, '#f05045');
      },
    },
    {
      name: 'follaje',
      count: 2600,
      motion: 'sway',
      speed: 1.4,
      baseY: 1,
      phase: 1.3,
      size: 0.14,
      jitter: 0.08,
      draw: (p) => {
        const greens = ['#2f8a5a', '#3fa36a', '#56b86a', '#2a6e7a', '#6cc070'];
        for (let i = 0; i < 70; i++) p.circle(p.range(0, 0.35), p.range(0.88, 1.02), p.range(0.02, 0.05), p.pick(greens));
        for (let i = 0; i < 30; i++) p.circle(p.range(0.1, 0.22), p.range(0.58, 0.72), p.range(0.02, 0.04), p.pick(greens));
        for (let i = 0; i < 30; i++) p.circle(p.range(0.86, 1), p.range(0.66, 0.8), p.range(0.02, 0.04), p.pick(greens));
      },
    },
    {
      name: 'estrellas',
      count: 1400,
      motion: 'drift',
      amp: [0.12, 0.18],
      speed: 0.9,
      size: 0.08,
      draw: (p) => {
        for (const [u, v, r, rot] of STARS) {
          p.star(u, v, r * 1.12, '#f0a020', rot);
          p.star(u, v, r, '#ffd93a', rot);
          p.star(u, v - r * 0.1, r * 0.5, '#ffeea0', rot);
        }
      },
    },
    {
      name: 'brillo-estrellas',
      blend: 'add',
      count: 700,
      motion: 'twinkle',
      speed: [1, 2.2],
      size: 0.16,
      weight: 'luma',
      opacity: 0.7,
      draw: (p) => {
        for (const [u, v, r] of STARS) {
          p.glow(u, v, r * 2.4, [
            [0, 'rgba(255,240,150,0.9)'],
            [1, 'rgba(255,220,100,0)'],
          ]);
        }
      },
    },
    {
      name: 'estrellas-fugaces',
      blend: 'add',
      count: 800,
      motion: 'fall',
      speed: 1.1,
      size: 0.07,
      weight: 'luma',
      draw: (p) => {
        for (let i = 0; i < 7; i++) {
          const u = p.range(0.3, 1);
          const v = p.range(0, 0.45);
          const g = p.linear(u, v, u + 0.08, v - 0.06, [
            [0, 'rgba(255,255,255,1)'],
            [1, 'rgba(180,230,255,0)'],
          ]);
          p.line([[u, v], [u + 0.08, v - 0.06]], 0.006, g);
        }
      },
    },
    {
      name: 'destellos',
      blend: 'add',
      count: 260,
      motion: 'twinkle',
      speed: [1.5, 3],
      size: 0.08,
      weight: 'luma',
      draw: (p) => p.dots(110, [0, 0, 1, 0.7], [0.002, 0.004], ['#ffffff', '#fff6b0']),
    },
  ],
};

/** Hongo genérico de sombrero rojo con lunares (sin rostro). */
function mushroom(p: Painter, u: number, v: number, scale: number, cap: string): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  p.ppoly([[X - S * 0.035, Y], [X + S * 0.035, Y], [X + S * 0.03, Y - S * 0.11], [X - S * 0.03, Y - S * 0.11]], '#f4e4c4');
  p.pellipse(X, Y - S * 0.11, S * 0.08, S * 0.018, '#d6c095');
  const c = p.ctx;
  c.fillStyle = cap;
  c.beginPath();
  c.ellipse(X, Y - S * 0.11, S * 0.12, S * 0.1, 0, Math.PI, 0);
  c.fill();
  for (const [dx, dy, r] of [[0, -0.19, 0.03], [-0.07, -0.14, 0.022], [0.07, -0.15, 0.024], [-0.035, -0.175, 0.012], [0.04, -0.12, 0.012]]) {
    p.pcircle(X + S * dx, Y + S * dy, S * r, '#fff8f0');
  }
  p.pellipse(X - S * 0.05, Y - S * 0.17, S * 0.02, S * 0.008, 'rgba(255,255,255,0.35)', -0.5);
}
