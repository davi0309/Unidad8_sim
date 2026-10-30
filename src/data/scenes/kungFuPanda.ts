import type { SceneDefinition } from '../types';
import type { Painter } from '../../utils/paint';

/**
 * Atardecer rojo sobre montañas de piedra que asoman entre la niebla,
 * un templo de techos curvos en lo alto de un pico y pétalos de durazno en el aire.
 */
export const kungFuPanda: SceneDefinition = {
  id: 'kung-fu-panda',
  reference: 'Kung Fu Panda',
  title: 'La cima entre la niebla',
  music: 'kung-fu-panda',
  base: '#c03a1c',
  affinity: { isla: 0.35, castillo: 0.3, bosque: 0.3, habitacion: 0.05 },
  palette: ['#e2341e', '#f8b034', '#ffc0cc'],
  light: '#f2741e',
  motif: 'pagoda',
  layers: [
    {
      name: 'cielo',
      count: 16000,
      size: 0.22,
      jitter: 0.07,
      draw: (p) => {
        p.vgrad([
          [0, '#6a0c10'],
          [0.25, '#b8161a'],
          [0.45, '#e2341e'],
          [0.62, '#f2741e'],
          [0.78, '#f8b034'],
          [1, '#f4c24a'],
        ]);
        p.glow(0.55, 0.78, 0.7, [
          [0, 'rgba(255,230,140,0.75)'],
          [1, 'rgba(255,230,140,0)'],
        ]);
        // Velos de nubes rojizas
        for (let i = 0; i < 9; i++) {
          p.ellipse(p.rand(), p.range(0.08, 0.4), p.range(0.2, 0.4), p.range(0.01, 0.025), 'rgba(140,16,20,0.35)');
        }
      },
    },
    {
      name: 'montes-lejanos',
      count: 14000,
      size: 0.19,
      jitter: 0.06,
      draw: (p) => {
        // Tres planos de picos: más claros (más niebla) cuanto más lejos
        peaks(p, 18, 0.66, [0.08, 0.16], [0.02, 0.035], '#e8803e');
        peaks(p, 12, 0.76, [0.12, 0.24], [0.03, 0.05], '#b84a24');
        peaks(p, 8, 0.88, [0.14, 0.28], [0.04, 0.06], '#7a2812');
      },
    },
    {
      name: 'niebla',
      count: 3000,
      motion: 'flow',
      speed: 0.07,
      size: 0.3,
      opacity: 0.28,
      draw: (p) => {
        for (let i = 0; i < 40; i++) {
          p.ellipse(p.rand(), p.pick([0.66, 0.72, 0.8, 0.88]) + p.range(-0.02, 0.02), p.range(0.12, 0.28), p.range(0.012, 0.025), 'rgba(255,214,140,0.7)');
        }
      },
    },
    {
      name: 'resplandor',
      blend: 'add',
      count: 1600,
      motion: 'pulse',
      speed: 0.5,
      size: 0.2,
      weight: 'luma',
      opacity: 0.6,
      draw: (p) => {
        p.glow(0.55, 0.8, 0.45, [
          [0, 'rgba(255,240,170,0.8)'],
          [1, 'rgba(255,220,120,0)'],
        ]);
      },
    },
    {
      name: 'pico-templo',
      count: 11000,
      size: 0.2,
      jitter: 0.08,
      draw: (p) => {
        p.poly([[0.08, 1.02], [0.12, 0.66], [0.16, 0.58], [0.28, 0.58], [0.32, 0.66], [0.36, 1.02]], '#4a1c0e');
        p.line([[0.12, 0.66], [0.16, 0.58], [0.28, 0.58]], 0.006, '#d0703a');
        // Pinos en las laderas
        for (const [u, v] of [[0.13, 0.7], [0.31, 0.69], [0.32, 0.76], [0.11, 0.78]] as const) {
          p.ellipse(u, v, 0.018, 0.012, '#2a0e08');
          p.ellipse(u + 0.008, v - 0.008, 0.012, 0.008, '#2a0e08');
        }
      },
    },
    {
      name: 'templo',
      count: 5000,
      size: 0.075,
      jitter: 0.05,
      draw: (p) => temple(p, 0.22, 0.58, 1.7),
    },
    {
      name: 'pico-frente',
      count: 9000,
      size: 0.2,
      jitter: 0.08,
      draw: (p) => {
        // Roca en primer plano, al centro, con borde encendido
        p.poly([[0.32, 1.02], [0.38, 0.9], [0.44, 0.86], [0.52, 0.845], [0.6, 0.86], [0.66, 0.92], [0.7, 1.02]], '#3a160c');
        p.line([[0.38, 0.9], [0.44, 0.86], [0.52, 0.845], [0.6, 0.86], [0.66, 0.92]], 0.006, '#e0803a');
        // Peñascos a los lados
        p.poly([[0.78, 1.02], [0.82, 0.78], [0.87, 0.7], [0.93, 0.72], [0.98, 0.8], [1.02, 0.82], [1.02, 1.02]], '#5a2210');
        p.line([[0.82, 0.78], [0.87, 0.7], [0.93, 0.72]], 0.004, '#d06a30');
        p.poly([[-0.02, 0.84], [0.04, 0.8], [0.08, 0.86], [0.1, 1.02], [-0.02, 1.02]], '#4a1c0e');
      },
    },
    {
      name: 'aves',
      count: 300,
      motion: 'drift',
      amp: [0.8, 0.2],
      speed: 0.25,
      size: 0.04,
      draw: (p) => {
        for (const [u, v, s] of [[0.6, 0.22, 1], [0.64, 0.25, 0.8], [0.57, 0.26, 0.7], [0.7, 0.2, 0.6]] as const) {
          const X = p.x(u);
          const Y = p.y(v);
          const S = p.s(0.02 * s);
          p.pline([[X - S, Y - S * 0.4], [X, Y], [X + S, Y - S * 0.4]], S * 0.25, '#3a0a0a');
        }
      },
    },
    {
      name: 'petalos',
      count: 700,
      motion: 'drift',
      amp: [1.2, 0.5],
      speed: 0.3,
      phase: 1.2,
      size: 0.07,
      draw: (p) => {
        for (let i = 0; i < 70; i++) {
          p.ellipse(p.rand(), p.range(0.1, 0.9), 0.006, 0.0035, p.pick(['#ffc0cc', '#ff9fb4', '#ffe0e6']), p.range(0, Math.PI));
        }
      },
    },
  ],
};

/** Fila de picos kársticos: altos, redondeados y estrechos. */
function peaks(p: Painter, n: number, base: number, h: [number, number], w: [number, number], color: string): void {
  for (let i = 0; i < n; i++) {
    const u = (i + p.rand()) / n;
    const height = p.range(h[0], h[1]);
    const width = p.range(w[0], w[1]);
    const X = p.x(u);
    const Y = p.y(base);
    const H = p.s(height);
    const W = p.s(width);
    const c = p.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(X - W * 1.4, Y + p.s(0.05));
    c.quadraticCurveTo(X - W * 1.1, Y - H * 0.6, X - W * 0.5, Y - H);
    c.quadraticCurveTo(X, Y - H * 1.12, X + W * 0.5, Y - H);
    c.quadraticCurveTo(X + W * 1.1, Y - H * 0.6, X + W * 1.4, Y + p.s(0.05));
    c.closePath();
    c.fill();
  }
}

/** Templo de tres techos con aleros curvos. */
function temple(p: Painter, u: number, v: number, scale: number): void {
  const X = p.x(u);
  const Y = p.y(v);
  const S = p.s(scale);
  const wall = '#3a120a';
  const roof = '#2a0a06';
  const glowWin = '#ffb050';
  const tiers = [
    { w: 0.06, h: 0.03, y: 0 },
    { w: 0.045, h: 0.026, y: 0.045 },
    { w: 0.032, h: 0.022, y: 0.084 },
  ];
  for (const t of tiers) {
    const base = Y - S * t.y;
    // muro
    p.ppoly([[X - S * t.w * 0.7, base], [X + S * t.w * 0.7, base], [X + S * t.w * 0.7, base - S * t.h], [X - S * t.w * 0.7, base - S * t.h]], wall);
    p.ppoly([[X - S * 0.006, base], [X + S * 0.006, base], [X + S * 0.006, base - S * t.h * 0.7], [X - S * 0.006, base - S * t.h * 0.7]], glowWin);
    // techo con puntas levantadas
    const ry = base - S * t.h;
    const c = p.ctx;
    c.fillStyle = roof;
    c.beginPath();
    c.moveTo(X - S * t.w * 1.25, ry - S * 0.012);
    c.quadraticCurveTo(X - S * t.w * 0.8, ry, X - S * t.w * 0.5, ry - S * 0.006);
    c.lineTo(X - S * t.w * 0.25, ry - S * 0.018);
    c.lineTo(X + S * t.w * 0.25, ry - S * 0.018);
    c.lineTo(X + S * t.w * 0.5, ry - S * 0.006);
    c.quadraticCurveTo(X + S * t.w * 0.8, ry, X + S * t.w * 1.25, ry - S * 0.012);
    c.lineTo(X + S * t.w * 0.9, ry + S * 0.004);
    c.lineTo(X - S * t.w * 0.9, ry + S * 0.004);
    c.closePath();
    c.fill();
  }
  p.pline([[X, Y - S * 0.106], [X, Y - S * 0.13]], S * 0.004, roof);
}
