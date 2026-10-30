import type { SceneDefinition } from '../types';
import type { Painter } from '../../utils/paint';

const LANTERNS: [number, number, string][] = [
  [0.05, 0.13, '#f7a738'],
  [0.18, 0.17, '#e8569b'],
  [0.31, 0.19, '#6fd36a'],
  [0.44, 0.2, '#a46ae0'],
  [0.57, 0.2, '#ffd84a'],
  [0.7, 0.19, '#5ac8e8'],
  [0.83, 0.16, '#f06a5a'],
  [0.95, 0.12, '#8fe07a'],
];

const CLOCK: [number, number] = [0.86, 0.36];

/** Merienda imposible en un jardín nocturno: faroles de papel, teteras de colores, un reloj que no se detiene. */
export const alicia: SceneDefinition = {
  id: 'alicia',
  reference: 'Alicia en el país de las maravillas',
  title: 'Una merienda imposible',
  music: 'alicia',
  base: '#0c1d24',
  affinity: { bosque: 0.45, castillo: 0.3, habitacion: 0.2, isla: 0.05 },
  palette: ['#e8569b', '#6fd36a', '#a46ae0'],
  light: '#e87ab8',
  motif: 'farol-papel',
  layers: [
    {
      name: 'jardin',
      count: 16000,
      size: 0.22,
      jitter: 0.1,
      draw: (p) => {
        p.fillAll('#0b1c25');
        // Cielo nocturno entre las hojas
        p.dots(60, [0, 0, 1, 0.45], [0.003, 0.006], ['#2b4a8a', '#3b5aa8']);
        // Follaje
        const greens = ['#17402f', '#1f5a3e', '#2a7350', '#1a4a5a', '#245f4a'];
        for (let i = 0; i < 260; i++) {
          p.ellipse(p.rand(), p.range(0, 0.66), p.range(0.012, 0.04), p.range(0.006, 0.016), p.pick(greens), p.range(0, Math.PI));
        }
        // Hojas grandes tipo helecho a los lados
        for (const [u, v, rot] of [[0.02, 0.5, -0.6], [0.98, 0.5, 0.6], [0.12, 0.62, -0.3]] as const) {
          for (let k = 0; k < 9; k++) {
            p.ellipse(u + (u < 0.5 ? 1 : -1) * k * 0.012, v - k * 0.03, 0.05, 0.012, '#2f8a5a', rot + k * 0.05);
          }
        }
        p.vgrad([[0, '#0d1d22'], [1, '#132a26']], 0.62, 1);
      },
    },
    {
      name: 'faroles',
      count: 2800,
      size: 0.11,
      jitter: 0.06,
      draw: (p) => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          pts.push([u, 0.06 + Math.sin(u * Math.PI) * 0.11]);
        }
        p.line(pts, 0.003, '#d8d0b0');
        for (const [u, v, color] of LANTERNS) lantern(p, u, v, color);
      },
    },
    {
      name: 'brillo-faroles',
      blend: 'add',
      count: 1700,
      motion: 'twinkle',
      speed: [0.6, 1.4],
      size: 0.2,
      weight: 'luma',
      opacity: 0.8,
      draw: (p) => {
        for (const [u, v, color] of LANTERNS) {
          p.glow(u, v + 0.06, 0.1, [
            [0, color],
            [1, 'rgba(0,0,0,0)'],
          ]);
        }
      },
    },
    {
      name: 'silla',
      count: 1600,
      size: 0.11,
      draw: (p) => {
        const X = p.x(0.5);
        const Y = p.y(0.44);
        const S = p.s(1);
        // Patas y brazos de la silla
        for (const dx of [-0.11, 0.11]) {
          p.ppoly([[X + S * dx - S * 0.012, Y], [X + S * dx + S * 0.012, Y], [X + S * dx + S * 0.01, Y + S * 0.24], [X + S * dx - S * 0.01, Y + S * 0.24]], '#7a1f5a');
          p.pellipse(X + S * dx * 1.25, Y + S * 0.12, S * 0.03, S * 0.018, '#c03c8c');
        }
        // Remate dorado
        p.pcircle(X, Y - S * 0.2, S * 0.018, '#f0c040');
        p.pellipse(X, Y - S * 0.004, S * 0.128, S * 0.168, '#6a1a50');
        p.pellipse(X, Y, S * 0.12, S * 0.16, '#a8327c');
        for (let k = 0; k < 7; k++) {
          const a = Math.PI + (k / 6) * Math.PI;
          p.pcircle(X + Math.cos(a) * S * 0.12, Y + Math.sin(a) * S * 0.15, S * 0.03, '#c03c8c');
        }
        p.pellipse(X, Y + S * 0.01, S * 0.075, S * 0.11, '#e05aaa');
        p.pellipse(X, Y + S * 0.01, S * 0.04, S * 0.07, '#f07ec0');
      },
    },
    {
      name: 'mesa',
      count: 4200,
      size: 0.15,
      jitter: 0.05,
      draw: (p) => {
        p.poly([[0.03, 0.66], [0.97, 0.66], [1.02, 0.96], [-0.02, 0.96]], '#f08cc0');
        p.poly([[0.03, 0.66], [0.97, 0.66], [0.99, 0.77], [0.01, 0.77]], '#f7aed2');
        for (let u = 0; u <= 1.02; u += 0.04) p.circle(u, 0.965, 0.024, '#f9c4dc');
        p.vgrad([[0, 'rgba(8,16,20,0)'], [1, 'rgba(8,16,20,1)']], 0.96, 1);
      },
    },
    {
      name: 'teteras',
      count: 3800,
      size: 0.09,
      jitter: 0.06,
      draw: (p) => {
        const pots: [number, number, number, string][] = [
          [0.1, 0.68, 1, '#7b4fd6'],
          [0.25, 0.665, 0.8, '#3fb6a8'],
          [0.39, 0.69, 0.92, '#f0c93a'],
          [0.61, 0.68, 1.1, '#e8569b'],
          [0.76, 0.665, 0.85, '#5fc964'],
          [0.9, 0.69, 1, '#4d7de0'],
          [0.19, 0.76, 0.75, '#e88a3a'],
          [0.52, 0.775, 0.8, '#9b6ae0'],
          [0.83, 0.77, 0.75, '#f05a6a'],
        ];
        for (const [u, v, s, c] of pots) teapot(p, u, v, s, c);
        const cups: [number, number, string][] = [
          [0.32, 0.75, '#5ac8e8'],
          [0.44, 0.78, '#ffd84a'],
          [0.68, 0.76, '#a46ae0'],
          [0.95, 0.76, '#6fd36a'],
          [0.05, 0.765, '#f7a738'],
          [0.57, 0.86, '#5ac8e8'],
          [0.28, 0.87, '#e8569b'],
        ];
        for (const [u, v, c] of cups) teacup(p, u, v, c);
      },
    },
    {
      name: 'reloj',
      count: 900,
      size: 0.08,
      draw: (p) => {
        const [u, v] = CLOCK;
        p.circle(u, v, 0.075, '#b8893a');
        p.circle(u, v, 0.065, '#f3e3bd');
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          p.pcircle(p.x(u) + Math.cos(a) * p.s(0.055), p.y(v) + Math.sin(a) * p.s(0.055), p.s(0.004), '#3a2a1a');
        }
      },
    },
    {
      name: 'agujas',
      count: 260,
      motion: 'orbit',
      orbitMode: 'rigid',
      center: CLOCK,
      speed: 0.35,
      size: 0.05,
      draw: (p) => {
        const [u, v] = CLOCK;
        const X = p.x(u);
        const Y = p.y(v);
        p.pline([[X, Y], [X, Y - p.s(0.05)]], p.s(0.007), '#2a1a10');
        p.pline([[X, Y], [X + p.s(0.035), Y + p.s(0.012)]], p.s(0.005), '#a02020');
      },
    },
    {
      name: 'cartas',
      count: 900,
      motion: 'drift',
      amp: [0.35, 0.22],
      speed: 0.45,
      size: 0.07,
      draw: (p) => {
        const cards: [number, number, number, string][] = [
          [0.07, 0.3, 0.3, '#d23a3a'],
          [0.17, 0.46, -0.2, '#1a1a1a'],
          [0.94, 0.48, 0.25, '#d23a3a'],
          [0.72, 0.34, -0.35, '#1a1a1a'],
          [0.3, 0.33, 0.15, '#d23a3a'],
        ];
        for (const [u, v, rot, suit] of cards) card(p, u, v, rot, suit);
      },
    },
    {
      name: 'hongo-flor',
      count: 2000,
      size: 0.13,
      draw: (p) => {
        // Hongo gigante a la izquierda
        const X = p.x(0.06);
        const Y = p.y(0.66);
        const S = p.s(1);
        p.ppoly([[X - S * 0.025, Y], [X + S * 0.025, Y], [X + S * 0.02, Y - S * 0.16], [X - S * 0.02, Y - S * 0.16]], '#efe0c0');
        p.ctx.fillStyle = '#d8404a';
        p.ctx.beginPath();
        p.ctx.ellipse(X, Y - S * 0.16, S * 0.12, S * 0.09, 0, Math.PI, 0);
        p.ctx.fill();
        for (const [dx, dy, r] of [[-0.06, -0.19, 0.015], [0.0, -0.22, 0.018], [0.06, -0.18, 0.014], [-0.03, -0.17, 0.01]]) {
          p.pcircle(X + S * dx, Y + S * dy, S * r, '#fff4ea');
        }
        // Flor enorme a la derecha
        const FX = p.x(0.96);
        const FY = p.y(0.58);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          p.pellipse(FX + Math.cos(a) * S * 0.05, FY + Math.sin(a) * S * 0.05, S * 0.05, S * 0.022, '#ff7ab8', a);
        }
        p.pcircle(FX, FY, S * 0.025, '#ffd84a');
      },
    },
    {
      name: 'chispas',
      blend: 'add',
      count: 320,
      motion: 'rise',
      speed: [0.15, 0.4],
      size: 0.07,
      weight: 'luma',
      draw: (p) => p.dots(140, [0, 0.2, 1, 0.95], [0.002, 0.004], ['#ffd6f0', '#fff3b0', '#c8f0ff']),
    },
  ],
};

function lantern(p: Painter, u: number, v: number, color: string): void {
  const X = p.x(u);
  const Y = p.y(v) + p.s(0.06);
  const S = p.s(1);
  p.pline([[X, p.y(v)], [X, Y - S * 0.05]], S * 0.003, '#d8d0b0');
  p.pellipse(X, Y, S * 0.042, S * 0.052, color);
  const c = p.ctx;
  c.strokeStyle = 'rgba(0,0,0,0.25)';
  c.lineWidth = Math.max(S * 0.003, 1);
  for (const k of [0.15, 0.55]) {
    c.beginPath();
    c.ellipse(X, Y, S * 0.042 * k, S * 0.052, 0, 0, Math.PI * 2);
    c.stroke();
  }
  p.ppoly([[X - S * 0.02, Y - S * 0.055], [X + S * 0.02, Y - S * 0.055], [X + S * 0.02, Y - S * 0.045], [X - S * 0.02, Y - S * 0.045]], '#2a2a2a');
  p.ppoly([[X - S * 0.02, Y + S * 0.045], [X + S * 0.02, Y + S * 0.045], [X + S * 0.02, Y + S * 0.055], [X - S * 0.02, Y + S * 0.055]], '#2a2a2a');
}

function teapot(p: Painter, u: number, v: number, scale: number, c: string): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  p.ppoly([[X + S * 0.035, Y - S * 0.035], [X + S * 0.085, Y - S * 0.075], [X + S * 0.092, Y - S * 0.068], [X + S * 0.048, Y - S * 0.015]], c);
  const ctx = p.ctx;
  ctx.strokeStyle = c;
  ctx.lineWidth = Math.max(S * 0.01, 1);
  ctx.beginPath();
  ctx.ellipse(X - S * 0.05, Y - S * 0.04, S * 0.018, S * 0.024, 0, 0, Math.PI * 2);
  ctx.stroke();
  p.pellipse(X, Y - S * 0.038, S * 0.05, S * 0.04, c);
  p.pellipse(X, Y - S * 0.078, S * 0.026, S * 0.01, c);
  p.pcircle(X, Y - S * 0.092, S * 0.008, c);
  p.pellipse(X - S * 0.018, Y - S * 0.05, S * 0.012, S * 0.006, 'rgba(255,255,255,0.5)', -0.4);
  for (const [dx, dy] of [[-0.015, -0.03], [0.015, -0.035], [0, -0.02]]) {
    p.pcircle(X + S * dx, Y + S * dy, S * 0.005, 'rgba(255,255,255,0.55)');
  }
}

function teacup(p: Painter, u: number, v: number, c: string): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(1);
  p.pellipse(X, Y, S * 0.028, S * 0.007, '#f4ecdf');
  p.ppoly([[X - S * 0.018, Y - S * 0.026], [X + S * 0.018, Y - S * 0.026], [X + S * 0.012, Y - S * 0.004], [X - S * 0.012, Y - S * 0.004]], c);
  p.pellipse(X, Y - S * 0.026, S * 0.018, S * 0.004, '#7a4a2a');
}

function card(p: Painter, u: number, v: number, rot: number, suit: string): void {
  const c = p.ctx;
  const S = p.s(1);
  c.save();
  c.translate(p.x(u), p.y(v));
  c.rotate(rot);
  c.fillStyle = '#f7f3ea';
  c.fillRect(-S * 0.022, -S * 0.032, S * 0.044, S * 0.064);
  c.restore();
  p.pcircle(p.x(u), p.y(v), S * 0.009, suit);
}
