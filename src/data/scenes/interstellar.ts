import type { SceneDefinition } from '../types';
import type { Painter } from '../../utils/paint';

const CENTER: [number, number] = [0.64, 0.44];
const SHADOW = 0.2;
const FLAT = 0.2;

/** Un agujero negro con su disco de luz girando, un planeta pequeño y el silencio del espacio. */
export const interstellar: SceneDefinition = {
  id: 'interstellar',
  reference: 'Interstellar',
  title: 'Más allá del tiempo',
  music: 'interstellar',
  base: '#020203',
  affinity: { habitacion: 0.45, isla: 0.35, castillo: 0.1, bosque: 0.1 },
  palette: ['#ffd59a', '#e8964a', '#2a2a3a'],
  light: '#ffd59a',
  motif: 'planeta',
  layers: [
    {
      name: 'estrellas',
      blend: 'add',
      count: 900,
      motion: 'twinkle',
      speed: [0.5, 1.8],
      size: 0.06,
      weight: 'luma',
      draw: (p) => p.dots(220, [0, 0, 1, 1], [0.0015, 0.0035], ['#ffffff', '#cfe0ff', '#ffe6c8']),
    },
    {
      name: 'disco-detras',
      blend: 'add',
      count: 9000,
      motion: 'orbit',
      orbitMode: 'kepler',
      center: CENTER,
      flatten: FLAT,
      speed: 0.7,
      size: 0.075,
      weight: 'luma',
      draw: (p) => disk(p, 1),
    },
    {
      name: 'anillo',
      blend: 'add',
      count: 3600,
      // El anillo no gira (su forma depende de hacia dónde mira el disco): solo pulsa
      motion: 'pulse',
      speed: 0.6,
      size: 0.06,
      weight: 'luma',
      draw: (p) => {
        const X = p.x(CENTER[0]);
        const Y = p.y(CENTER[1]);
        const c = p.ctx;
        const arc = (r: number, width: number, color: string, from = 0, to = Math.PI * 2) => {
          c.lineWidth = p.s(width);
          c.strokeStyle = color;
          c.beginPath();
          c.arc(X, Y, p.s(r), from, to);
          c.stroke();
        };
        // Anillo de fotones: fino y tenue en la parte baja
        arc(SHADOW + 0.022, 0.01, 'rgba(255,240,215,0.55)');
        // Arco superior: la luz del disco que pasa por detrás, curvada hacia arriba
        arc(SHADOW + 0.05, 0.05, 'rgba(255,238,210,0.8)', Math.PI * 1.02, Math.PI * 1.98);
        arc(SHADOW + 0.1, 0.05, 'rgba(255,190,120,0.28)', Math.PI * 1.08, Math.PI * 1.92);
        // Arco inferior, más débil
        arc(SHADOW + 0.035, 0.02, 'rgba(255,214,170,0.35)', Math.PI * 0.08, Math.PI * 0.92);
      },
    },
    {
      name: 'sombra',
      count: 3400,
      size: 0.11,
      jitter: 0,
      draw: (p) => p.circle(CENTER[0], CENTER[1], SHADOW + 0.012, '#000000'),
    },
    {
      name: 'disco-frente',
      blend: 'add',
      count: 5200,
      motion: 'orbit',
      orbitMode: 'front',
      center: CENTER,
      flatten: FLAT,
      speed: 0.7,
      size: 0.075,
      weight: 'luma',
      draw: (p) => {
        disk(p, 1.15);
        // Solo la mitad que pasa por delante del agujero
        p.ctx.clearRect(0, 0, p.W, p.y(CENTER[1]));
      },
    },
    {
      name: 'planeta',
      count: 500,
      size: 0.05,
      draw: (p) => {
        p.circle(0.36, 0.38, 0.02, '#0c0b0a');
        const c = p.ctx;
        c.strokeStyle = '#d9b88a';
        c.lineWidth = p.s(0.004);
        c.beginPath();
        c.arc(p.x(0.36), p.y(0.38), p.s(0.019), -0.9, 0.9);
        c.stroke();
      },
    },
    {
      name: 'polvo',
      blend: 'add',
      count: 1600,
      motion: 'drift',
      amp: [0.08, 0.03],
      speed: 0.4,
      size: 0.06,
      weight: 'luma',
      opacity: 0.6,
      draw: (p) => {
        const X = p.x(CENTER[0]);
        const Y = p.y(CENTER[1]);
        for (let i = 0; i < 380; i++) {
          const a = p.range(0.85, 1.25) * Math.PI;
          const r = p.s(p.range(0.35, 1.25));
          p.pcircle(X + Math.cos(a) * r, Y + Math.sin(a) * r * FLAT + p.s(p.range(0, 0.08)), p.s(p.range(0.002, 0.005)), p.pick(['#c88a5a', '#a86a40', '#e0b080']));
        }
      },
    },
  ],
};

/** Disco de acreción: anillo achatado, blanco en el borde interior y cobrizo hacia afuera. */
function disk(p: Painter, boost: number): void {
  const c = p.ctx;
  const R = p.s(1.2);
  c.save();
  c.translate(p.x(CENTER[0]), p.y(CENTER[1]));
  c.scale(1, FLAT);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
  const k = (r: number) => r / 1.2;
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(k(SHADOW + 0.005), 'rgba(0,0,0,0)');
  g.addColorStop(k(SHADOW + 0.03), `rgba(255,248,232,${Math.min(boost, 1)})`);
  g.addColorStop(k(0.36), 'rgba(255,214,150,0.95)');
  g.addColorStop(k(0.55), 'rgba(232,150,74,0.8)');
  g.addColorStop(k(0.85), 'rgba(150,80,40,0.45)');
  g.addColorStop(1, 'rgba(80,40,20,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, R, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
