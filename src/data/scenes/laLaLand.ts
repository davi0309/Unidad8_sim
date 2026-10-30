import type { SceneDefinition } from '../types';
import type { Painter } from '../../utils/paint';

const LAMP: [number, number] = [0.2, 0.42];

/**
 * Mirador nocturno: cielo azul profundo que se vuelve violeta en el horizonte,
 * montañas, una alfombra de luces de ciudad y una farola antigua encendida.
 */
export const laLaLand: SceneDefinition = {
  id: 'la-la-land',
  reference: 'La La Land',
  title: 'Una noche que suena',
  music: 'la-la-land',
  base: '#1a1a5a',
  affinity: { habitacion: 0.55, castillo: 0.15, isla: 0.2, bosque: 0.1 },
  palette: ['#5a34bc', '#ffd47a', '#1a1a5a'],
  light: '#8a7cff',
  motif: 'farola',
  layers: [
    {
      name: 'cielo',
      count: 16000,
      size: 0.22,
      jitter: 0.06,
      draw: (p) => {
        p.vgrad([
          [0, '#0a103c'],
          [0.3, '#16196a'],
          [0.5, '#2c2490'],
          [0.62, '#5a34bc'],
          [0.7, '#8644d2'],
          [0.735, '#9a52d8'],
        ], 0, 0.74);
        // Resplandor violeta de la ciudad sobre el horizonte
        p.glow(0.55, 0.74, 0.7, [
          [0, 'rgba(190,110,255,0.55)'],
          [1, 'rgba(190,110,255,0)'],
        ]);
        // Montañas: dos cordilleras
        ridge(p, 0.715, 0.035, '#3a2c7a', 7);
        ridge(p, 0.738, 0.025, '#1a1448', 13);
        // Valle con la ciudad (base oscura; las luces van en otra capa)
        p.vgrad([[0, '#151a48'], [1, '#1c2458']], 0.745, 0.88);
        // Mirador en primer plano, iluminado por la farola
        p.vgrad([[0, '#2a3672'], [1, '#1a2250']], 0.88, 1);
        p.glow(LAMP[0], 0.94, 0.3, [
          [0, 'rgba(150,170,255,0.4)'],
          [1, 'rgba(150,170,255,0)'],
        ]);
        p.line([[0, 0.88], [1, 0.88]], 0.004, '#3e4c90');
      },
    },
    {
      name: 'estrellas',
      blend: 'add',
      count: 1100,
      motion: 'twinkle',
      speed: [0.6, 2.2],
      size: 0.07,
      weight: 'luma',
      draw: (p) => {
        p.dots(260, [0, 0, 1, 0.66], [0.0015, 0.0035], ['#ffffff', '#e8ecff', '#fff2fa']);
      },
    },
    {
      name: 'luces-ciudad',
      blend: 'add',
      count: 5200,
      motion: 'twinkle',
      speed: [0.8, 3],
      size: 0.06,
      weight: 'luma',
      draw: (p) => {
        const colors = ['#fff1c8', '#ffd47a', '#ffffff', '#cfe0ff', '#ffb36a'];
        // Más densas y pequeñas hacia el horizonte (perspectiva)
        for (let i = 0; i < 2600; i++) {
          const t = Math.pow(p.rand(), 1.6);
          const v = 0.748 + t * 0.13;
          const r = 0.0012 + t * 0.0022;
          p.circle(p.rand(), v, r, p.pick(colors));
        }
        // Avenidas: hileras de luces que cruzan el valle
        for (let k = 0; k < 6; k++) {
          const v0 = p.range(0.76, 0.86);
          const slope = p.range(-0.03, 0.03);
          for (let u = 0; u < 1; u += 0.006) p.circle(u, v0 + slope * u, 0.0016, '#ffe2a0');
        }
      },
    },
    {
      name: 'luz-farola',
      blend: 'add',
      count: 1500,
      motion: 'pulse',
      speed: 0.7,
      size: 0.14,
      weight: 'luma',
      opacity: 0.7,
      draw: (p) => {
        const [u, v] = LAMP;
        p.glow(u, v - 0.035, 0.1, [
          [0, 'rgba(255,255,255,0.9)'],
          [0.35, 'rgba(225,235,255,0.35)'],
          [1, 'rgba(160,180,255,0)'],
        ]);
        p.glow(u, 0.95, 0.1, [
          [0, 'rgba(210,220,255,0.25)'],
          [1, 'rgba(210,220,255,0)'],
        ]);
      },
    },
    {
      name: 'farola',
      count: 4200,
      size: 0.08,
      jitter: 0.05,
      draw: (p) => lamp(p),
    },
    {
      name: 'chispas',
      blend: 'add',
      count: 260,
      motion: 'rise',
      speed: [0.15, 0.35],
      size: 0.08,
      weight: 'luma',
      draw: (p) => p.dots(110, [0.3, 0.4, 0.95, 0.95], [0.002, 0.004], ['#fff2c8', '#e0d0ff', '#ffd6f0']),
    },
  ],
};

/** Línea de montañas suave hecha de lomas superpuestas. */
function ridge(p: Painter, base: number, height: number, color: string, bumps: number): void {
  const pts: [number, number][] = [[0, 1]];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    let h = 0;
    for (let k = 1; k <= 3; k++) h += Math.sin(u * Math.PI * bumps * k * 0.5 + k * 1.7 + bumps) / k;
    pts.push([u, base - height * (0.6 + 0.4 * h)]);
  }
  pts.push([1, 1]);
  p.poly(pts, color);
}

/** Farola antigua: base escalonada, poste fino y farol en forma de gota. */
function lamp(p: Painter): void {
  const [u, v] = LAMP;
  const X = p.x(u);
  const S = p.s(1);
  const top = p.y(v);
  const ground = p.y(0.955);
  const steel = '#9aa6dc';
  const shade = '#56609a';
  // Base escalonada
  p.ppoly([[X - S * 0.03, ground], [X + S * 0.03, ground], [X + S * 0.022, ground - S * 0.02], [X - S * 0.022, ground - S * 0.02]], shade);
  p.ppoly([[X - S * 0.016, ground - S * 0.02], [X + S * 0.016, ground - S * 0.02], [X + S * 0.011, ground - S * 0.07], [X - S * 0.011, ground - S * 0.07]], steel);
  // Poste
  p.ppoly([[X - S * 0.008, ground - S * 0.07], [X + S * 0.008, ground - S * 0.07], [X + S * 0.006, top + S * 0.02], [X - S * 0.006, top + S * 0.02]], steel);
  p.ppoly([[X + S * 0.002, ground - S * 0.07], [X + S * 0.008, ground - S * 0.07], [X + S * 0.006, top + S * 0.02], [X + S * 0.002, top + S * 0.02]], shade);
  // Anillos decorativos
  for (const k of [0.25, 0.5, 0.75]) {
    const y = ground - S * 0.07 + (top + S * 0.02 - (ground - S * 0.07)) * k;
    p.pellipse(X, y, S * 0.011, S * 0.004, steel);
  }
  // Capitel y farol
  p.pellipse(X, top + S * 0.02, S * 0.016, S * 0.007, steel);
  p.pellipse(X, top - S * 0.035, S * 0.022, S * 0.045, '#f4f6ff');
  p.pellipse(X, top - S * 0.085, S * 0.008, S * 0.01, steel);
}
