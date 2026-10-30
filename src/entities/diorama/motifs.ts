import type { TransformNode } from '@babylonjs/core';
import type { MotifId } from '../../data/types';
import type { DioramaKit, V3 } from './DioramaKit';

/**
 * Elementos que cada universo visitado deja en el diorama.
 * Son piezas pequeñas, en miniatura, con la paleta de su universo, y cada una tiene su propio movimiento.
 * El nodo raíz es el que el usuario puede mover/rotar/escalar; las animaciones viven en nodos internos.
 */
type MotifBuilder = (k: DioramaKit, parent: TransformNode, pos: V3, palette: string[]) => { node: TransformNode; float?: boolean };

const farola: MotifBuilder = (k, parent, pos, palette) => {
  const g = k.group('motivo-farola', parent, pos);
  const steel = k.mat('#8a96c8');
  k.cyl(g, { top: 0.22, bottom: 0.3, h: 0.16 }, steel, [0, 0.08, 0]);
  k.cyl(g, { top: 0.07, bottom: 0.09, h: 1.6 }, steel, [0, 0.9, 0]);
  const lampMat = k.mat('#fff6e0', { emissive: 1 });
  k.sphere(g, [0.3, 0.42, 0.3], lampMat, [0, 1.85, 0], { shadow: false });
  k.cyl(g, { top: 0.05, bottom: 0.2, h: 0.12 }, steel, [0, 2.1, 0]);
  k.sphere(g, [0.12, 0.12, 0.12], k.mat(palette[1] ?? '#ffd47a', { emissive: 0.8 }), [0, 2.2, 0], { shadow: false });
  // Una polilla que da vueltas alrededor de la luz
  const moth = k.group('polilla', g, [0, 1.85, 0]);
  k.sphere(moth, [0.06, 0.04, 0.08], k.mat('#e8dcc0'), [0.35, 0, 0], { seg: 5, shadow: false });
  k.decor(moth);
  const base = lampMat.emissiveColor.clone();
  const phase = pos[0] + pos[2];
  k.onFrame((t) => {
    lampMat.emissiveColor = base.scale(0.85 + 0.15 * Math.sin(t * 2.1));
    moth.rotation.y = t * 2.6 + phase;
    moth.position.y = 1.85 + Math.sin(t * 3.3 + phase) * 0.12;
  });
  return { node: g };
};

const acacia: MotifBuilder = (k, parent, pos) => {
  const g = k.group('motivo-acacia', parent, pos);
  const bark = k.mat('#5a3a24');
  k.cyl(g, { top: 0.1, bottom: 0.16, h: 1.2, tess: 6 }, bark, [0, 0.6, 0], undefined, { flat: true });
  const crown = k.group('copa', g, [0, 1.2, 0]);
  k.cyl(crown, { top: 0.05, bottom: 0.08, h: 0.7, tess: 5 }, bark, [-0.25, 0.15, 0], [0, 0, 0.6]);
  k.cyl(crown, { top: 0.05, bottom: 0.08, h: 0.7, tess: 5 }, bark, [0.25, 0.15, 0], [0, 0, -0.6]);
  k.sphere(crown, [1.9, 0.38, 1.3], k.mat('#5a7a2a'), [0, 0.55, 0], { seg: 6, flat: true });
  k.sphere(crown, [1.3, 0.26, 1.0], k.mat('#7a9a3a'), [0.1, 0.7, 0], { seg: 6, flat: true });
  const phase = pos[0] * 0.7;
  k.onFrame((t) => {
    crown.rotation.z = Math.sin(t * 0.8 + phase) * 0.05;
    crown.rotation.x = Math.cos(t * 0.6 + phase) * 0.03;
  });
  return { node: g };
};

const farolPapel: MotifBuilder = (k, parent, pos, palette) => {
  const g = k.group('motivo-farol', parent, pos);
  const wood = k.mat('#4a3a2a');
  k.cyl(g, { top: 0.05, bottom: 0.06, h: 1.7 }, wood, [0, 0.85, 0]);
  k.cyl(g, { top: 0.04, bottom: 0.04, h: 0.6 }, wood, [0.28, 1.68, 0], [0, 0, Math.PI / 2]);
  // El farol cuelga de un gancho y se balancea
  const hook = k.group('gancho', g, [0.52, 1.66, 0]);
  const color = palette.length ? k.pick(palette) : '#e8569b';
  const paper = k.mat(color, { emissive: 0.85 });
  k.cyl(hook, { top: 0.01, bottom: 0.01, h: 0.12 }, wood, [0, -0.04, 0]);
  k.sphere(hook, [0.42, 0.52, 0.42], paper, [0, -0.36, 0], { seg: 10, shadow: false });
  k.cyl(hook, { top: 0.18, bottom: 0.18, h: 0.06 }, k.mat('#2a2a2a'), [0, -0.08, 0]);
  k.cyl(hook, { top: 0.18, bottom: 0.18, h: 0.06 }, k.mat('#2a2a2a'), [0, -0.64, 0]);
  const base = paper.emissiveColor.clone();
  const phase = pos[2] * 1.3;
  k.onFrame((t) => {
    hook.rotation.z = Math.sin(t * 1.4 + phase) * 0.18;
    hook.rotation.x = Math.sin(t * 1.1 + phase * 0.5) * 0.08;
    paper.emissiveColor = base.scale(0.8 + 0.2 * Math.sin(t * 4 + phase) * Math.sin(t * 1.3));
  });
  return { node: g };
};

const hongo: MotifBuilder = (k, parent, pos, palette) => {
  const g = k.group('motivo-hongo', parent, pos);
  const body = k.group('cuerpo', g);
  k.cyl(body, { top: 0.28, bottom: 0.36, h: 0.55 }, k.mat('#f4e4c4'), [0, 0.28, 0]);
  k.sphere(body, [1.1, 0.75, 1.1], k.mat(palette[0] ?? '#e33a35'), [0, 0.62, 0], { seg: 16 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.sphere(body, [0.18, 0.08, 0.18], k.mat('#fff8f0'), [Math.cos(a) * 0.38, 0.86, Math.sin(a) * 0.38], { seg: 6, shadow: false });
  }
  k.sphere(body, [0.2, 0.08, 0.2], k.mat('#fff8f0'), [0, 1.0, 0], { seg: 6, shadow: false });
  // Respira: se aplasta y se estira un poco, como si estuviera vivo
  const phase = pos[0] + pos[2] * 0.5;
  k.onFrame((t) => {
    const s = Math.sin(t * 2.2 + phase);
    body.scaling.set(1 - s * 0.04, 1 + s * 0.07, 1 - s * 0.04);
  });
  return { node: g };
};

const coral: MotifBuilder = (k, parent, pos, palette) => {
  const g = k.group('motivo-coral', parent, pos);
  const body = k.group('cuerpo', g);
  k.cluster(body, [0, 0.45, 0], 0.6, 9, palette.slice(0, 3), { flat: true });
  const branches: TransformNode[] = [];
  for (let i = 0; i < 4; i++) {
    const b = k.group('rama', body, [k.range(-0.4, 0.4), 0.1, k.range(-0.4, 0.4)]);
    k.cyl(b, { top: 0.04, bottom: 0.1, h: k.range(0.5, 0.9), tess: 5 }, k.mat(palette[1] ?? '#3cbcc8'), [0, 0.35, 0]);
    branches.push(b);
  }
  const phase = pos[0] * 1.1;
  k.onFrame((t) => {
    branches.forEach((b, i) => {
      b.rotation.z = Math.sin(t * 1.3 + i + phase) * 0.18;
      b.rotation.x = Math.cos(t * 1.1 + i * 2 + phase) * 0.12;
    });
    body.rotation.y = Math.sin(t * 0.4 + phase) * 0.1;
  });
  return { node: g };
};

const planeta: MotifBuilder = (k, parent, pos, palette) => {
  const g = k.group('motivo-planeta', parent, [pos[0], pos[1] + 1.6, pos[2]]);
  const spin = k.group('giro', g);
  k.sphere(spin, [0.8, 0.8, 0.8], k.mat(palette[1] ?? '#e8964a'), [0, 0, 0], { seg: 16 });
  k.sphere(spin, [0.82, 0.12, 0.82], k.mat(palette[0] ?? '#ffd59a'), [0, 0.12, 0], { seg: 16 });
  const ring = k.torus(g, { d: 1.4, t: 0.06 }, k.mat(palette[0] ?? '#ffd59a', { emissive: 0.6 }), [0, 0, 0], [0.4, 0, 0.3]);
  // Una lunita que lo orbita
  const orbit = k.group('orbita', g);
  k.sphere(orbit, [0.16, 0.16, 0.16], k.mat('#e8e8f0'), [1.0, 0, 0], { seg: 8, shadow: false });
  k.decor(orbit);
  k.onFrame((t) => {
    spin.rotation.y = t * 0.6;
    ring.rotation.y = t * 0.15;
    orbit.rotation.y = t * 1.2;
    orbit.rotation.z = 0.35;
  });
  return { node: g, float: true };
};

const pagoda: MotifBuilder = (k, parent, pos, palette) => {
  const g = k.group('motivo-pagoda', parent, pos);
  const wall = k.mat('#7a2a1a');
  const roof = k.mat('#2a1a14');
  for (let i = 0; i < 3; i++) {
    const w = 0.9 - i * 0.2;
    k.box(g, [w * 0.7, 0.35, w * 0.7], wall, [0, 0.2 + i * 0.5, 0]);
    k.cyl(g, { top: w * 0.35, bottom: w * 1.4, h: 0.18, tess: 4 }, roof, [0, 0.45 + i * 0.5, 0], [0, Math.PI / 4, 0]);
  }
  const light = k.mat(palette[1] ?? '#f8b034', { emissive: 0.9 });
  k.box(g, [0.14, 0.2, 0.05], light, [0, 0.18, 0.32]);
  k.cyl(g, { top: 0, bottom: 0.06, h: 0.35 }, roof, [0, 1.75, 0]);
  // Campanita de viento que se mece bajo el alero
  const bell = k.group('campana', g, [0.5, 0.42, 0]);
  k.cyl(bell, { top: 0.005, bottom: 0.005, h: 0.18 }, roof, [0, -0.09, 0]);
  k.cyl(bell, { top: 0.03, bottom: 0.09, h: 0.1 }, k.mat('#d8b040'), [0, -0.2, 0]);
  k.decor(bell);
  const base = light.emissiveColor.clone();
  const phase = pos[0] - pos[2];
  k.onFrame((t) => {
    bell.rotation.z = Math.sin(t * 2.3 + phase) * 0.35;
    light.emissiveColor = base.scale(0.75 + 0.25 * Math.sin(t * 1.5 + phase));
  });
  return { node: g };
};

export const MOTIFS: Record<MotifId, MotifBuilder> = {
  farola,
  acacia,
  'farol-papel': farolPapel,
  hongo,
  coral,
  planeta,
  pagoda,
};
