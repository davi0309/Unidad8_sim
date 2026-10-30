import { Vector3, type TransformNode } from '@babylonjs/core';
import type { TemplateId } from '../../data/types';
import type { Anchor, DioramaKit, TemplateBuild, V3 } from './DioramaKit';

/**
 * Lugares para los objetos de infancia en cada plantilla.
 * La prioridad indica cuán visible es el sitio: el primer recuerdo elegido va al de mayor prioridad.
 */
export const ANCHORS: Record<TemplateId, Anchor[]> = {
  castillo: [
    { id: 'patio', position: [0, 0.55, 3.1], tags: ['centro', 'abierto', 'suelo'], priority: 10 },
    { id: 'nube-izq', position: [-3.6, 0.7, 1.4], tags: ['suave', 'descanso', 'suelo'], priority: 7 },
    { id: 'nube-der', position: [3.6, 0.7, 1.2], tags: ['abierto', 'suelo', 'movimiento'], priority: 7 },
    { id: 'almena', position: [1.55, 4.05, 1.55], tags: ['alto', 'musica', 'luz'], priority: 6 },
    { id: 'escalinata', position: [-1.4, 0.55, 4.4], tags: ['suelo', 'juego', 'mesa'], priority: 5 },
    { id: 'roca-flotante', position: [6, 3.55, -3.6], tags: ['suspendido', 'alto', 'estante'], priority: 5, float: true },
  ],
  habitacion: [
    { id: 'alfombra', position: [0.6, 0.06, 0.4], tags: ['centro', 'suelo', 'juego', 'abierto'], priority: 10 },
    { id: 'cama', position: [-2.9, 1.0, 2.2], tags: ['suave', 'descanso'], priority: 9 },
    { id: 'escritorio', position: [2.7, 1.32, 3.4], tags: ['mesa', 'musica', 'juego'], priority: 8 },
    { id: 'repisa', position: [-4.4, 3.08, -1.2], tags: ['estante', 'alto'], priority: 7 },
    { id: 'ventana', position: [0.6, 2.78, 4.35], tags: ['alto', 'luz', 'musica'], priority: 6 },
    { id: 'rincon', position: [3.5, 0.06, -2.6], tags: ['suelo', 'abierto', 'movimiento'], priority: 5 },
  ],
  bosque: [
    { id: 'claro', position: [0, 0.32, 0.4], tags: ['centro', 'abierto', 'suelo'], priority: 10 },
    { id: 'tocon', position: [1.9, 0.86, -1.3], tags: ['mesa', 'estante', 'juego'], priority: 8 },
    { id: 'roca-musgo', position: [-2.2, 1.02, 1.5], tags: ['suave', 'alto', 'descanso'], priority: 7 },
    { id: 'sendero', position: [0.7, 0.32, -3.4], tags: ['suelo', 'abierto', 'movimiento'], priority: 6 },
    { id: 'raices', position: [-3.0, 0.32, 2.4], tags: ['suave', 'descanso'], priority: 6 },
    { id: 'rama', position: [3.1, 3.3, 2.3], tags: ['alto', 'musica', 'suspendido'], priority: 5, float: true },
  ],
  isla: [
    { id: 'pradera', position: [0.4, 0.32, -0.2], tags: ['centro', 'abierto', 'suelo'], priority: 10 },
    { id: 'orilla', position: [3.1, 0.32, 2.4], tags: ['suelo', 'agua', 'movimiento'], priority: 8 },
    { id: 'muelle', position: [1.2, 0.5, 3.0], tags: ['mesa', 'agua', 'juego'], priority: 7 },
    { id: 'saliente', position: [-1.5, 2.25, -0.6], tags: ['alto', 'estante', 'musica'], priority: 6 },
    { id: 'borde', position: [-3.9, 0.32, 2.0], tags: ['suave', 'descanso'], priority: 6 },
    { id: 'islote', position: [6.6, 2.6, -2.0], tags: ['suspendido', 'alto'], priority: 5, float: true },
  ],
};

type Builder = (kit: DioramaKit) => TemplateBuild;

// ---------------------------------------------------------------------------
// Castillo entre las nubes
// ---------------------------------------------------------------------------
const castillo: Builder = (k) => {
  const base = k.group('castillo-nubes');
  const castle = k.group('castillo-torres');
  const details = k.group('castillo-detalles');
  const floaters = [];

  // Isla de nubes
  const cloud = ['#fff6ee', '#ffe6da', '#ffd8cc'];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = k.range(1.5, 5.6);
    const s = k.range(1.6, 2.8);
    k.sphere(base, [s * 1.3, s * 0.7, s * 1.3], k.mat(k.pick(cloud)), [Math.cos(a) * r, k.range(-0.2, 0.25), Math.sin(a) * r], { seg: 7, flat: true });
  }
  for (let i = 0; i < 12; i++) {
    const a = k.range(0, Math.PI * 2);
    const r = k.range(0, 3.5);
    k.sphere(base, [2.4, 1.4, 2.4], k.mat('#f4d4d0'), [Math.cos(a) * r, -0.9 - k.range(0, 0.8), Math.sin(a) * r], { seg: 7, flat: true });
  }

  // Castillo: torre del homenaje, cuatro torres y murallas
  const stone = k.mat('#f3e2c8');
  const stoneShade = k.mat('#e2ccae');
  const roof = k.mat('#d0607a');
  k.box(castle, [2.4, 2.8, 2.4], stone, [0, 1.6, 0]);
  k.cyl(castle, { top: 0, bottom: 2.6, h: 1.6, tess: 4 }, roof, [0, 3.8, 0], [0, Math.PI / 4, 0]);
  for (const [x, z] of [[-1.55, -1.55], [1.55, -1.55], [-1.55, 1.55], [1.55, 1.55]] as const) {
    k.cyl(castle, { top: 1.0, bottom: 1.1, h: 3.6, tess: 12 }, stone, [x, 2.0, z]);
    k.cyl(castle, { top: 0, bottom: 1.35, h: 1.4, tess: 12 }, roof, [x, 4.5, z]);
  }
  for (const [x, z, ry] of [[0, -1.55, 0], [0, 1.55, 0], [-1.55, 0, Math.PI / 2], [1.55, 0, Math.PI / 2]] as const) {
    k.box(castle, [2.1, 1.7, 0.4], stoneShade, [x, 1.05, z], [0, ry, 0]);
  }
  // Puerta y escalinata
  k.box(castle, [0.8, 1.1, 0.1], k.mat('#6a3a3a'), [0, 0.75, 1.78]);
  for (let i = 0; i < 4; i++) k.box(castle, [1.6 - i * 0.1, 0.12, 0.45], stoneShade, [0, 0.12 + i * 0.12, 2.6 - i * 0.35]);

  // Ventanas encendidas y banderines
  const win = k.mat('#ffd890', { emissive: 0.9 });
  const flags: TransformNode[] = [];
  for (const [x, z] of [[-1.55, -1.55], [1.55, -1.55], [-1.55, 1.55], [1.55, 1.55]] as const) {
    k.box(details, [0.22, 0.35, 0.05], win, [x, 2.7, z + (z > 0 ? 0.5 : -0.5)]);
    k.cyl(details, { top: 0.04, bottom: 0.04, h: 0.8 }, stoneShade, [x, 5.5, z]);
    const flag = k.group('banderin', details, [x, 5.75, z]);
    k.box(flag, [0.45, 0.25, 0.03], k.mat(flags.length % 2 ? '#ffcf6a' : '#8ac8ff'), [0.24, 0, 0], undefined, { shadow: false });
    flags.push(k.decor(flag));
  }
  k.box(details, [0.3, 0.45, 0.05], win, [0, 2.4, 1.22]);

  // Rocas flotantes con nubecitas
  for (const [x, y, z] of [[6, 2.6, -3.6], [-6.2, 2.0, 2.6]] as const) {
    const g = k.group('roca-flotante', details, [x, y, z]);
    k.cyl(g, { top: 1.6, bottom: 0.2, h: 1.4, tess: 7 }, k.mat('#b89080'), [0, 0, 0], undefined, { flat: true });
    k.cyl(g, { top: 1.65, bottom: 1.6, h: 0.18, tess: 7 }, k.mat('#ffe6da'), [0, 0.78, 0], undefined, { flat: true });
    floaters.push(g);
  }
  const puffs: TransformNode[] = [];
  for (let i = 0; i < 6; i++) {
    const a = k.range(0, Math.PI * 2);
    const g = k.group('nubecita', details, [Math.cos(a) * k.range(7, 9), k.range(1, 5), Math.sin(a) * k.range(7, 9)]);
    k.cluster(g, [0, 0, 0], 0.9, 5, cloud, { flat: true, squash: 0.6 });
    floaters.push(k.decor(g));
    puffs.push(g);
  }

  // ---- Vida ----
  // Banderines que ondean, ventanas que titilan, nubecitas que giran alrededor
  const winBase = win.emissiveColor.clone();
  k.onFrame((t, dt) => {
    flags.forEach((f, i) => {
      f.rotation.y = Math.sin(t * 2.4 + i) * 0.35;
      f.rotation.x = Math.sin(t * 3.1 + i * 2) * 0.08;
    });
    win.emissiveColor = winBase.scale(0.8 + 0.2 * Math.sin(t * 1.7) * Math.sin(t * 0.63));
    const c = Math.cos(dt * 0.05);
    const sn = Math.sin(dt * 0.05);
    for (const g of puffs) {
      const x = g.position.x;
      g.position.x = x * c - g.position.z * sn;
      g.position.z = x * sn + g.position.z * c;
    }
  });
  // Pájaros que vuelan en círculo sobre las torres
  const flock = k.group('bandada', k.root);
  const birds = [0, 1, 2].map(() => k.bird(flock, '#6a4458', 1.5));
  k.onFrame((t) => {
    birds.forEach((b, i) => {
      const a = t * 0.28 + i * 0.45;
      const r = 7.2 + i * 0.7;
      b.node.position.set(Math.cos(a) * r, 6.4 + Math.sin(t * 0.8 + i) * 0.4 + i * 0.3, Math.sin(a) * r);
      b.node.rotation.y = -a;
      b.flap(t + i * 0.7);
    });
  });
  // Globo aerostático que da vueltas lentamente
  const balloon = k.group('globo', k.root);
  k.sphere(balloon, [1.6, 1.9, 1.6], k.mat('#e8566a'), [0, 1.3, 0], { seg: 14 });
  k.sphere(balloon, [0.5, 1.92, 1.62], k.mat('#ffd36a'), [0, 1.3, 0], { seg: 14 });
  k.sphere(balloon, [1.62, 1.92, 0.5], k.mat('#ffd36a'), [0, 1.3, 0], { seg: 14 });
  k.box(balloon, [0.5, 0.38, 0.5], k.mat('#8a5a3a'), [0, -0.25, 0]);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) {
    k.cyl(balloon, { top: 0.02, bottom: 0.02, h: 0.7 }, k.mat('#5a3a2a'), [x * 1.5, 0.2, z * 1.5]);
  }
  k.decor(balloon);
  k.onFrame((t) => {
    const a = t * 0.05 + 2.4;
    balloon.position.set(Math.cos(a) * 8.8, 4.4 + Math.sin(t * 0.5) * 0.6, Math.sin(a) * 8.8);
    balloon.rotation.y = t * 0.1;
  });
  // Destellos dorados en el aire
  k.particles({
    name: 'destellos',
    capacity: 140,
    min: [-5.5, 0.6, -5.5],
    max: [5.5, 5.5, 5.5],
    colors: ['#fff2c0', '#ffd0e0'],
    size: [0.05, 0.14],
    life: [2, 4],
    rate: 26,
    power: [0.05, 0.2],
    dir1: [-0.1, 0.2, -0.1],
    dir2: [0.1, 0.5, 0.1],
  });

  return {
    root: k.root,
    stages: [base, castle, details],
    accentSlots: [[-4.4, 0.55, -2.2], [4.4, 0.55, -2.4], [-2.6, 0.55, 3.8], [2.9, 0.55, 3.8], [-5, 0.55, 0.6], [5, 0.55, 0.4], [0, 0.55, -4.6], [-3, 0.55, -4]],
    floaters,
  };
};

// ---------------------------------------------------------------------------
// Habitación bajo la luna
// ---------------------------------------------------------------------------
const habitacion: Builder = (k) => {
  const shell = k.group('hab-cuarto');
  const furniture = k.group('hab-muebles');
  const details = k.group('hab-detalles');

  // Piso y dos paredes (corte de maqueta abierto hacia el espectador)
  k.box(shell, [10, 0.4, 10], k.mat('#7a5a48'), [0, -0.2, 0], undefined, { shadow: false });
  for (let i = -4; i <= 4; i += 1) k.box(shell, [0.03, 0.02, 10], k.mat('#6a4a3a'), [i + 0.5, 0.005, 0], undefined, { shadow: false });
  k.box(shell, [10, 6.5, 0.4], k.mat('#3a4778'), [0, 3.25, 5.0]);
  k.box(shell, [0.4, 6.5, 10], k.mat('#323f6c'), [-5.0, 3.25, 0]);
  k.box(shell, [10, 0.3, 0.1], k.mat('#d8d0c0'), [0, 0.15, 4.78]);
  k.box(shell, [0.1, 0.3, 10], k.mat('#d8d0c0'), [-4.78, 0.15, 0]);

  // Ventana con luna
  const frame = k.mat('#e8e0d0');
  k.box(shell, [2.8, 2.6, 0.12], k.mat('#9fc4ff', { emissive: 0.55 }), [0.6, 3.9, 4.82], undefined, { shadow: false });
  k.box(shell, [3.0, 0.16, 0.3], frame, [0.6, 5.2, 4.75]);
  k.box(shell, [3.2, 0.18, 0.55], frame, [0.6, 2.6, 4.6]);
  k.box(shell, [0.14, 2.6, 0.3], frame, [-0.8, 3.9, 4.75]);
  k.box(shell, [0.14, 2.6, 0.3], frame, [2.0, 3.9, 4.75]);
  k.box(shell, [0.08, 2.6, 0.2], frame, [0.6, 3.9, 4.75]);
  k.box(shell, [2.8, 0.08, 0.2], frame, [0.6, 3.9, 4.75]);
  k.sphere(shell, [1.1, 1.1, 0.2], k.mat('#fff8e0', { emissive: 1 }), [1.2, 4.5, 4.9], { shadow: false });
  // Cortinas (cuelgan de arriba para poder mecerse)
  const curtains: TransformNode[] = [];
  for (const x of [-1.3, 2.5]) {
    const pivot = k.group('cortina', shell, [x, 5.4, 4.55]);
    k.box(pivot, [0.7, 3.2, 0.12], k.mat('#5a6ab8'), [0, -1.6, 0], undefined, { shadow: false });
    curtains.push(k.decor(pivot));
  }
  // Mancha de luz de luna en el piso
  k.box(shell, [2.6, 0.01, 2.2], k.mat('#bcd0ff', { emissive: 0.35, alpha: 0.35 }), [0.9, 0.02, 2.6], [0, 0.2, 0], { shadow: false });

  // Cama
  const wood = k.mat('#5a3a2a');
  k.box(furniture, [2.4, 0.5, 4.0], wood, [-3.6, 0.35, 2.3]);
  k.box(furniture, [2.2, 0.35, 3.8], k.mat('#ece6f2'), [-3.6, 0.75, 2.3]);
  k.box(furniture, [2.3, 0.2, 2.6], k.mat('#6a7ac8'), [-3.6, 0.98, 1.7]);
  k.box(furniture, [1.4, 0.3, 0.7], k.mat('#f4f0f8'), [-3.6, 1.05, 3.8]);
  k.box(furniture, [2.4, 1.4, 0.2], wood, [-3.6, 0.9, 4.35]);
  // Escritorio y lámpara
  k.box(furniture, [2.4, 0.15, 1.2], k.mat('#8a5a3a'), [2.7, 1.2, 3.9]);
  for (const [x, z] of [[1.6, 3.4], [3.8, 3.4], [1.6, 4.4], [3.8, 4.4]] as const) k.box(furniture, [0.12, 1.2, 0.12], k.mat('#6a4028'), [x, 0.6, z]);
  k.cyl(furniture, { top: 0.06, bottom: 0.06, h: 0.7 }, k.mat('#c8b8a0'), [3.6, 1.6, 4.2]);
  k.cyl(furniture, { top: 0.25, bottom: 0.55, h: 0.4 }, k.mat('#ffcf8a', { emissive: 0.7 }), [3.6, 2.0, 4.2]);
  // Repisa con libros
  k.box(furniture, [0.6, 0.12, 2.4], wood, [-4.5, 3.0, -1.2]);
  const books = ['#c84a4a', '#4a7ac8', '#e8c040', '#6ab06a', '#a46ae0'];
  for (let i = 0; i < 5; i++) k.box(furniture, [0.4, k.range(0.4, 0.6), 0.16], k.mat(books[i]), [-4.5, 3.3, -2.1 + i * 0.2]);
  // Alfombra redonda
  k.cyl(furniture, { top: 3.6, bottom: 3.6, h: 0.04, tess: 32 }, k.mat('#c8a0b8'), [0.6, 0.02, 0.4], undefined, { shadow: false });
  k.cyl(furniture, { top: 2.6, bottom: 2.6, h: 0.045, tess: 32 }, k.mat('#e0bccb'), [0.6, 0.025, 0.4], undefined, { shadow: false });

  // Estrellas pegadas en la pared y un móvil
  const glowStar = k.mat('#fff2b0', { emissive: 0.9 });
  for (let i = 0; i < 9; i++) k.sphere(details, [0.12, 0.12, 0.04], glowStar, [k.range(-4.5, 4.5), k.range(4.5, 6.2), 4.78], { shadow: false });
  for (let i = 0; i < 6; i++) k.sphere(details, [0.04, 0.12, 0.12], glowStar, [-4.78, k.range(4.2, 6.2), k.range(-4, 3)], { shadow: false });
  const mobile = k.group('movil', details, [-1.2, 5.6, 1.2]);
  k.cyl(mobile, { top: 0.02, bottom: 0.02, h: 1.6 }, k.mat('#c8c0b0'), [0, 0, 0], [0, 0, Math.PI / 2]);
  for (const x of [-0.7, 0, 0.7]) {
    k.cyl(mobile, { top: 0.01, bottom: 0.01, h: 0.6 }, k.mat('#c8c0b0'), [x, -0.3, 0]);
    k.sphere(mobile, [0.22, 0.22, 0.08], glowStar, [x, -0.65, 0]);
  }

  // ---- Vida ----
  // Tren de juguete que da vueltas alrededor de la alfombra
  const train = k.group('tren', furniture, [0.6, 0.05, 0.4]);
  const cars: TransformNode[] = [];
  const carColors = ['#c84a4a', '#4a7ac8', '#e8c040', '#6ab06a'];
  for (let i = 0; i < 4; i++) {
    const car = k.group('vagon', train);
    if (i === 0) {
      k.box(car, [0.5, 0.3, 0.28], k.mat(carColors[0]), [0, 0.24, 0]);
      k.cyl(car, { top: 0.1, bottom: 0.13, h: 0.24 }, k.mat('#2a2a2a'), [0.15, 0.5, 0]);
      k.box(car, [0.2, 0.22, 0.3], k.mat('#3a3a5a'), [-0.15, 0.46, 0]);
    } else {
      k.box(car, [0.42, 0.24, 0.26], k.mat(carColors[i]), [0, 0.21, 0]);
    }
    for (const x of [-0.13, 0.13]) {
      for (const z of [-0.15, 0.15]) {
        k.cyl(car, { top: 0.13, bottom: 0.13, h: 0.04, tess: 10 }, k.mat('#1a1a1a'), [x, 0.08, z], [Math.PI / 2, 0, 0]);
      }
    }
    cars.push(car);
  }
  k.decor(train);
  const chimney = new Vector3();
  const smoke = k.particles({
    name: 'humo-tren',
    capacity: 40,
    min: [-0.03, 0, -0.03],
    max: [0.03, 0, 0.03],
    colors: ['#f0f0ff', '#c8c8e0'],
    alpha: 0.5,
    size: [0.08, 0.16],
    life: [0.8, 1.4],
    rate: 9,
    power: [0.2, 0.35],
    dir1: [-0.1, 1, -0.1],
    dir2: [0.1, 1, 0.1],
    additive: false,
  });
  smoke.emitter = chimney;
  k.onFrame((t) => {
    cars.forEach((car, i) => {
      const a = t * 0.38 - i * 0.3;
      car.position.set(Math.cos(a) * 1.82, 0, Math.sin(a) * 1.82);
      car.rotation.y = -a - Math.PI / 2;
    });
    chimney.copyFrom(cars[0].getAbsolutePosition()).addInPlace(new Vector3(0, 0.65, 0));
  });
  // Reloj de pared sobre la cama
  const clock = k.group('reloj', details, [-4.76, 4.6, 2.4]);
  clock.rotation.y = -Math.PI / 2;
  k.cyl(clock, { top: 1.0, bottom: 1.0, h: 0.08, tess: 24 }, k.mat('#eadfc4'), [0, 0, 0], [Math.PI / 2, 0, 0], { shadow: false });
  k.torus(clock, { d: 1.02, t: 0.08 }, k.mat('#8a5a3a'), [0, 0, 0], [Math.PI / 2, 0, 0]);
  const hourHand = k.group('hora', clock, [0, 0, -0.06]);
  k.box(hourHand, [0.05, 0.26, 0.02], k.mat('#2a1a10'), [0, 0.12, 0], undefined, { shadow: false });
  const minuteHand = k.group('minuto', clock, [0, 0, -0.07]);
  k.box(minuteHand, [0.035, 0.38, 0.02], k.mat('#2a1a10'), [0, 0.18, 0], undefined, { shadow: false });
  k.decor(clock);
  // Cortinas que respiran, estrellas que titilan, lámpara que parpadea apenas
  const starBase = glowStar.emissiveColor.clone();
  const lampMat = k.mat('#ffcf8a', { emissive: 0.7 });
  const lampBase = lampMat.emissiveColor.clone();
  k.onFrame((t) => {
    minuteHand.rotation.z = -t * 0.5;
    hourHand.rotation.z = -t * 0.042;
    curtains.forEach((c, i) => {
      c.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.045;
      c.rotation.x = Math.sin(t * 0.5 + i) * 0.03;
    });
    glowStar.emissiveColor = starBase.scale(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6)));
    lampMat.emissiveColor = lampBase.scale(0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 2.3));
  });
  // Polvo flotando en el rayo de luna
  k.particles({
    name: 'polvo-luna',
    capacity: 160,
    min: [-0.6, 0.4, 1.4],
    max: [2.2, 4.6, 4.4],
    colors: ['#cfe0ff', '#ffffff'],
    alpha: 0.65,
    size: [0.03, 0.07],
    life: [4, 8],
    rate: 20,
    power: [0.02, 0.08],
    dir1: [-0.1, -0.05, -0.1],
    dir2: [0.1, 0.1, 0.1],
  });

  return {
    root: k.root,
    stages: [shell, furniture, details],
    accentSlots: [[3.9, 0, -3.9], [-3.6, 0, -3.8], [4.2, 0, 1.0], [1.6, 0, -4.0], [-1.0, 0, -4.2], [4.2, 0, -1.4], [-1.6, 0, -2.4], [2.2, 0, 1.8]],
    floaters: [mobile],
  };
};

// ---------------------------------------------------------------------------
// Bosque de los recuerdos
// ---------------------------------------------------------------------------
const bosque: Builder = (k) => {
  const ground = k.group('bosque-suelo');
  const trees = k.group('bosque-arboles');
  const details = k.group('bosque-detalles');
  const floaters = [];

  k.cyl(ground, { top: 13, bottom: 12, h: 1.2, tess: 14 }, k.mat('#5a3a28'), [0, -0.45, 0], undefined, { flat: true, shadow: false });
  k.cyl(ground, { top: 13.2, bottom: 13.2, h: 0.3, tess: 14 }, k.mat('#4a8a4a'), [0, 0.15, 0], undefined, { flat: true, shadow: false });
  // Sendero de piedras
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    k.cyl(ground, { top: 0.7, bottom: 0.75, h: 0.08, tess: 7 }, k.mat('#d8c8a0'), [Math.sin(t * 3) * 1.2 + 0.4, 0.32, -5.6 + t * 5], undefined, { flat: true, shadow: false });
  }

  // Árboles alrededor del claro
  const greens = ['#2f6a4a', '#3f8a5a', '#5aa06a', '#2a5a48'];
  const swaying: { node: TransformNode; phase: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3;
    const r = k.range(4.3, 5.8);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // El frente queda libre: el claro y el sendero se ven desde la cámara
    if (z < -1.2 && Math.abs(x) < 4.8) continue;
    const h = k.range(2.2, 3.4);
    // Cada árbol es un grupo con base en el suelo: así puede mecerse con el viento
    const tree = k.group('arbol', trees, [x, 0.3, z]);
    k.cyl(tree, { top: 0.32, bottom: 0.5, h, tess: 7 }, k.mat('#6a4a32'), [0, h / 2, 0], undefined, { flat: true });
    if (i % 3 === 0) {
      k.cyl(tree, { top: 0, bottom: 2.4, h: 3, tess: 7 }, k.mat('#2a5a40'), [0, h + 1.2, 0], undefined, { flat: true });
    } else {
      k.cluster(tree, [0, h + 0.9, 0], 1.5, 4, greens, { flat: true });
    }
    swaying.push({ node: tree, phase: i * 0.9 });
  }
  // Rama que se extiende sobre el claro
  k.cyl(trees, { top: 0.12, bottom: 0.25, h: 3, tess: 6 }, k.mat('#6a4a32'), [3.9, 3.0, 2.9], [0, -0.6, Math.PI / 2.6], { flat: true });

  // Tocón, roca con musgo, hongos, linternas de luz
  k.cyl(details, { top: 1.2, bottom: 1.4, h: 0.85, tess: 9 }, k.mat('#8a6040'), [1.9, 0.72, -1.3], undefined, { flat: true });
  k.cyl(details, { top: 1.0, bottom: 1.0, h: 0.02, tess: 9 }, k.mat('#c8a070'), [1.9, 1.15, -1.3], undefined, { flat: true });
  k.sphere(details, [1.6, 1.2, 1.4], k.mat('#8a8a80'), [-2.2, 0.75, 1.5], { seg: 5, flat: true });
  k.sphere(details, [1.4, 0.4, 1.2], k.mat('#5a9a4a'), [-2.2, 1.18, 1.5], { seg: 5, flat: true });
  for (let i = 0; i < 7; i++) {
    const x = k.range(-3.6, 3.6);
    const z = k.range(-3.6, 3.2);
    if (Math.hypot(x, z) < 1.4) continue;
    k.cyl(details, { top: 0.1, bottom: 0.12, h: 0.3 }, k.mat('#f0e4cc'), [x, 0.45, z]);
    k.sphere(details, [0.42, 0.24, 0.42], k.mat(k.pick(['#e05a4a', '#f0a040', '#c84aa0'])), [x, 0.62, z], { seg: 8 });
  }
  // Raíces
  for (let i = 0; i < 4; i++) {
    k.cyl(details, { top: 0.08, bottom: 0.22, h: 1.4, tess: 5 }, k.mat('#5a3a28'), [-3.4 + i * 0.3, 0.38, 2.9 - i * 0.15], [Math.PI / 2.3, i * 0.6, 0], { flat: true });
  }
  // Niebla baja
  for (let i = 0; i < 5; i++) {
    const g = k.group('niebla', details, [k.range(-4, 4), 0.55, k.range(-4, 4)]);
    k.sphere(g, [4, 0.3, 2.4], k.mat('#e8f4ec', { alpha: 0.08, emissive: 0.2 }), [0, 0, 0], { seg: 8, shadow: false });
    floaters.push(g);
  }

  // ---- Vida ----
  // Los árboles se mecen con un viento suave
  k.onFrame((t) => {
    for (const { node, phase } of swaying) {
      node.rotation.z = Math.sin(t * 0.6 + phase) * 0.03;
      node.rotation.x = Math.cos(t * 0.47 + phase) * 0.022;
    }
  });
  // Mariposas que revolotean por el claro
  const butterflies = [
    ['#ff9ac8', '#ffd36a'],
    ['#9ad0ff', '#ffffff'],
    ['#ffd36a', '#ff8a4a'],
  ].map(([c1, c2], i) => {
    const body = k.group('mariposa', details);
    const wings: TransformNode[] = [];
    for (const side of [-1, 1]) {
      const pivot = k.group('ala', body);
      k.box(pivot, [0.3, 0.012, 0.22], k.mat(c1), [side * 0.16, 0, 0.03], undefined, { shadow: false });
      k.box(pivot, [0.18, 0.014, 0.14], k.mat(c2), [side * 0.12, 0.004, -0.11], undefined, { shadow: false });
      wings.push(pivot);
    }
    k.sphere(body, [0.05, 0.05, 0.22], k.mat('#2a2a2a'), [0, 0, 0], { seg: 6, shadow: false });
    k.decor(body);
    return { body, wings, i, prev: new Vector3() };
  });
  k.onFrame((t) => {
    for (const b of butterflies) {
      const s2 = t * 0.35 + b.i * 2.1;
      const x = Math.sin(s2) * 3.0 * Math.cos(s2 * 0.5 + b.i);
      const z = Math.cos(s2 * 1.3) * 2.6;
      const y = 1.3 + Math.sin(t * 1.7 + b.i) * 0.5 + b.i * 0.35;
      b.body.rotation.y = Math.atan2(x - b.prev.x, z - b.prev.z);
      b.prev.set(x, y, z);
      b.body.position.set(x, y, z);
      const a = Math.sin(t * 15 + b.i) * 1.0;
      b.wings[0].rotation.z = a;
      b.wings[1].rotation.z = -a;
    }
  });
  // Luciérnagas y hojas que caen
  k.particles({
    name: 'luciernagas',
    capacity: 100,
    min: [-5, 0.6, -5],
    max: [5, 3.4, 5],
    colors: ['#e8ff8a', '#fff2a0'],
    size: [0.08, 0.16],
    life: [3, 6],
    rate: 18,
    power: [0.05, 0.2],
    dir1: [-0.3, -0.1, -0.3],
    dir2: [0.3, 0.25, 0.3],
  });
  const leaves = k.particles({
    name: 'hojas',
    capacity: 60,
    min: [-5, 3.2, -5],
    max: [5, 5, 5],
    colors: ['#e0a040', '#7ab04a'],
    alpha: 1,
    size: [0.1, 0.18],
    life: [5, 8],
    rate: 6,
    power: [0.05, 0.15],
    gravity: [0, -0.25, 0],
    additive: false,
  });
  leaves.minAngularSpeed = -2;
  leaves.maxAngularSpeed = 2;

  return {
    root: k.root,
    stages: [ground, trees, details],
    accentSlots: [[-3.8, 0.3, 0.2], [3.6, 0.3, 1.4], [-2.6, 0.3, -3.2], [2.6, 0.3, -3.0], [-1.0, 0.3, 3.6], [1.2, 0.3, 3.4], [3.6, 0.3, -1.0], [-3.6, 0.3, -1.4]],
    floaters,
  };
};

// ---------------------------------------------------------------------------
// Isla suspendida
// ---------------------------------------------------------------------------
const isla: Builder = (k) => {
  const island = k.group('isla-base');
  const relief = k.group('isla-relieve');
  const details = k.group('isla-detalles');
  const floaters = [];

  k.cyl(island, { top: 11.4, bottom: 1.2, h: 6.5, tess: 9 }, k.mat('#7a6a5a'), [0, -3.1, 0], undefined, { flat: true });
  k.cyl(island, { top: 11.6, bottom: 11.4, h: 0.5, tess: 9 }, k.mat('#6ab06a'), [0, 0.05, 0], undefined, { flat: true, shadow: false });
  for (let i = 0; i < 6; i++) {
    const a = k.range(0, Math.PI * 2);
    k.cyl(island, { top: k.range(1.4, 2.2), bottom: 0.2, h: k.range(1.5, 3), tess: 6 }, k.mat('#6a5a4c'), [Math.cos(a) * 4.5, -1.8, Math.sin(a) * 4.5], undefined, { flat: true });
  }
  // Mar lejano: da el horizonte
  const sea = k.cyl(island, { top: 160, bottom: 160, h: 0.1, tess: 48 }, k.mat('#6ab4d0', { gloss: 0.6 }), [0, -14, 0], undefined, { shadow: false });
  sea.receiveShadows = false;
  sea.isPickable = false;

  // Montañas con nieve
  k.cyl(relief, { top: 0, bottom: 4.6, h: 4.6, tess: 7 }, k.mat('#8a8aa0'), [-2.0, 2.5, -1.6], undefined, { flat: true });
  k.cyl(relief, { top: 0, bottom: 1.6, h: 1.4, tess: 7 }, k.mat('#f4f6ff'), [-2.0, 4.15, -1.6], undefined, { flat: true });
  k.cyl(relief, { top: 0, bottom: 3.2, h: 3.0, tess: 7 }, k.mat('#9a9ab2'), [-0.3, 1.7, -3.0], undefined, { flat: true });
  k.cyl(relief, { top: 0, bottom: 1.0, h: 0.8, tess: 7 }, k.mat('#f4f6ff'), [-0.3, 2.85, -3.0], undefined, { flat: true });
  k.box(relief, [1.2, 0.18, 0.9], k.mat('#7a7a92'), [-1.5, 2.1, -0.6], [0, 0.3, 0]);
  // Lago y cascada
  k.cyl(relief, { top: 3.8, bottom: 3.8, h: 0.08, tess: 24 }, k.mat('#4aa8d8', { gloss: 0.9, alpha: 0.92 }), [2.2, 0.33, 1.0], undefined, { shadow: false });
  k.box(relief, [0.7, 4.5, 0.12], k.mat('#bfe8ff', { alpha: 0.55, emissive: 0.3 }), [4.4, -1.9, 2.6], [0, -0.5, 0], { shadow: false });

  // Muelle, árboles, flores
  const wood = k.mat('#9a6a44');
  k.box(details, [0.8, 0.1, 2.0], wood, [1.2, 0.42, 2.6], [0, 0.3, 0]);
  for (const [x, z] of [[0.9, 2.0], [1.5, 2.0], [0.9, 3.4], [1.5, 3.4]] as const) k.cyl(details, { top: 0.08, bottom: 0.08, h: 0.5 }, wood, [x, 0.25, z]);
  for (const [x, z, s] of [[-4.0, -0.6, 1], [3.6, -2.8, 0.9], [-3.2, 3.2, 0.8], [0.6, -4.2, 0.7]] as const) {
    k.cyl(details, { top: 0.18, bottom: 0.28, h: 1.4 * s, tess: 6 }, k.mat('#7a5a3a'), [x, 0.3 + 0.7 * s, z], undefined, { flat: true });
    k.cluster(details, [x, 0.3 + 1.6 * s, z], 0.9 * s, 3, ['#4a9a5a', '#6ab86a'], { flat: true });
  }
  for (let i = 0; i < 14; i++) {
    const a = k.range(0, Math.PI * 2);
    const r = k.range(1.5, 5.2);
    k.sphere(details, [0.14, 0.14, 0.14], k.mat(k.pick(['#ffe0f0', '#fff4a0', '#ffffff'])), [Math.cos(a) * r, 0.36, Math.sin(a) * r], { seg: 6, shadow: false });
  }
  // Islotes flotantes
  for (const [x, y, z, s] of [[6.6, 1.6, -2.0, 1], [-6.8, 2.6, 2.4, 0.7], [-2.8, 4.8, -6.4, 0.6]] as const) {
    const g = k.group('islote', details, [x, y, z]);
    k.cyl(g, { top: 2.2 * s, bottom: 0.2, h: 1.8 * s, tess: 7 }, k.mat('#7a6a5a'), [0, 0, 0], undefined, { flat: true });
    k.cyl(g, { top: 2.3 * s, bottom: 2.2 * s, h: 0.22, tess: 7 }, k.mat('#6ab06a'), [0, 0.95 * s, 0], undefined, { flat: true });
    floaters.push(g);
  }

  // ---- Vida ----
  // Cascada que cae por el borde de la isla
  k.particles({
    name: 'cascada',
    capacity: 420,
    min: [4.2, 0.25, 2.4],
    max: [4.6, 0.35, 2.9],
    colors: ['#f0faff', '#a8dcff'],
    alpha: 0.85,
    size: [0.15, 0.35],
    life: [1.2, 1.8],
    rate: 190,
    power: [0.4, 0.8],
    dir1: [0.4, -0.2, 0.2],
    dir2: [0.6, -0.1, 0.4],
    gravity: [0, -6, 0],
    additive: false,
  });
  // Ondas en el lago
  const ripples = [0, 1].map((i) => {
    const mat = k.mat(i ? '#e8f8ff' : '#e8f8fe', { alpha: 0.99, emissive: 0.4 });
    const ring = k.torus(relief, { d: 1, t: 0.04 }, mat, [2.2, 0.39, 1.0]);
    ring.isPickable = false;
    return { ring, mat, offset: i * 0.5 };
  });
  // Gaviotas, nubes que rodean la isla y un velero en el mar
  const gulls = [0, 1, 2].map(() => k.bird(details, '#f4f4f0', 1.3));
  const clouds = [0, 1, 2, 3].map((i) => {
    const g = k.group('nube', details);
    k.cluster(g, [0, 0, 0], 1.3, 6, ['#ffffff', '#eef2ff'], { flat: true, squash: 0.55 });
    k.decor(g);
    return { g, a: (i / 4) * Math.PI * 2, y: 6 + (i % 2) * 1.5 };
  });
  const boat = k.group('velero', island);
  k.box(boat, [2.4, 0.6, 0.9], k.mat('#8a5a3a'), [0, 0, 0]);
  k.cyl(boat, { top: 0.08, bottom: 0.08, h: 2.6 }, k.mat('#5a3a2a'), [0, 1.5, 0]);
  k.box(boat, [0.05, 2.0, 1.3], k.mat('#fff8f0'), [0.5, 1.6, 0]);
  k.decor(boat);
  k.onFrame((t) => {
    for (const r of ripples) {
      const p = ((t * 0.35 + r.offset) % 1 + 1) % 1;
      r.ring.scaling.setAll(0.4 + p * 3.2);
      r.mat.alpha = 0.6 * (1 - p);
    }
    gulls.forEach((b, i) => {
      const a = -t * 0.3 + i * 2.1;
      const rad = 8 + i * 0.8;
      b.node.position.set(Math.cos(a) * rad, 3.5 + Math.sin(t * 0.9 + i) * 0.7 + i * 0.4, Math.sin(a) * rad);
      b.node.rotation.y = -a + Math.PI;
      b.flap(t * 0.8 + i);
    });
    for (const c of clouds) {
      const a = c.a + t * 0.025;
      c.g.position.set(Math.cos(a) * 11, c.y + Math.sin(t * 0.3 + c.a) * 0.3, Math.sin(a) * 11);
    }
    const ba = t * 0.04;
    boat.position.set(Math.cos(ba) * 22, -13.6 + Math.sin(t * 1.3) * 0.08, Math.sin(ba) * 22);
    boat.rotation.y = -ba - Math.PI / 2;
    boat.rotation.x = Math.sin(t * 1.1) * 0.05;
  });

  return {
    root: k.root,
    stages: [island, relief, details],
    accentSlots: [[3.6, 0.3, -1.0], [-3.8, 0.3, 0.8], [0.4, 0.3, -2.6], [-1.6, 0.3, 3.6], [4.4, 0.3, 0.4], [2.6, 0.3, -3.4], [-4.2, 0.3, -2.4], [0.0, 0.3, 4.2]],
    floaters,
  };
};

export const TEMPLATE_BUILDERS: Record<TemplateId, Builder> = { castillo, habitacion, bosque, isla };

export function anchorById(template: TemplateId, id: string): Anchor | undefined {
  return ANCHORS[template].find((a) => a.id === id);
}

export type { V3 };
