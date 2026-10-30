import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import type { PlaceholderShape } from '../data/types';

/**
 * Modelos provisionales hechos con primitivas, estilo "arcilla" suave.
 * Se reemplazan por .glb poniendo la ruta en `model` del catálogo.
 * Todos miden aprox. 1.6 unidades de alto/ancho. El frente mira hacia -Z.
 */

type V3 = [number, number, number];

interface Kit {
  scene: Scene;
  root: TransformNode;
  name: string;
  /** Color variante del catálogo (parte principal del objeto). */
  base: StandardMaterial;
  dark: StandardMaterial;
  light: StandardMaterial;
  accent: StandardMaterial;
  /** Material de color fijo (cacheado por objeto). */
  mat: (hex: string, options?: { emissive?: number; gloss?: boolean }) => StandardMaterial;
}

function material(scene: Scene, name: string, color: Color3, gloss = false): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  // Acabado mate tipo arcilla; brillo suave solo en metales
  m.specularColor = gloss ? new Color3(0.55, 0.48, 0.3) : new Color3(0.06, 0.06, 0.07);
  m.specularPower = gloss ? 48 : 16;
  return m;
}

function place(mesh: Mesh, kit: Kit, mat: StandardMaterial, pos: V3, rot?: V3): Mesh {
  mesh.parent = kit.root;
  mesh.material = mat;
  mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  return mesh;
}

/** Elipsoide (esfera escalada). */
function blob(k: Kit, name: string, size: V3, mat: StandardMaterial, pos: V3, rot?: V3): Mesh {
  const m = MeshBuilder.CreateSphere(name, { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments: 20 }, k.scene);
  return place(m, k, mat, pos, rot);
}

/** Losa de esquinas redondeadas (ancho × alto en XY, grosor en Z). */
function slab(k: Kit, name: string, w: number, h: number, d: number, r: number, mat: StandardMaterial, pos: V3, rot?: V3): Mesh {
  const shape: Vector3[] = [];
  const seg = 6;
  const corners: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = start + (i / seg) * (Math.PI / 2);
      shape.push(new Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
  }
  shape.push(shape[0].clone());
  const m = MeshBuilder.ExtrudeShape(
    name,
    { shape, path: [new Vector3(0, 0, -d / 2), new Vector3(0, 0, d / 2)], cap: Mesh.CAP_ALL, sideOrientation: Mesh.DOUBLESIDE },
    k.scene,
  );
  return place(m, k, mat, pos, rot);
}

/** Tubo suave entre puntos. */
function tube(k: Kit, name: string, points: Vector3[], radius: number, mat: StandardMaterial): Mesh {
  const m = MeshBuilder.CreateTube(name, { path: points, radius, tessellation: 14, cap: Mesh.CAP_ALL }, k.scene);
  m.parent = k.root;
  m.material = mat;
  return m;
}

const builders: Record<PlaceholderShape, (k: Kit) => void> = {
  // ---------- Consola portátil ----------
  handheldConsole(k) {
    const s = k.scene;
    const grey = k.mat('#4c4d52');
    slab(k, 'body', 1.15, 1.65, 0.3, 0.14, k.base, [0, 0, 0]);
    slab(k, 'back', 1.1, 1.6, 0.06, 0.12, k.light, [0, 0, 0.17]);
    slab(k, 'bezel', 0.9, 0.72, 0.04, 0.09, grey, [0, 0.33, -0.165]);
    slab(k, 'screen', 0.62, 0.5, 0.03, 0.03, k.mat('#a3b38a', { emissive: 0.18 }), [0, 0.33, -0.19]);
    slab(k, 'dpadH', 0.34, 0.11, 0.07, 0.03, grey, [-0.27, -0.27, -0.17]);
    slab(k, 'dpadV', 0.11, 0.34, 0.07, 0.03, grey, [-0.27, -0.27, -0.17]);
    const red = k.mat('#d4646e');
    for (const [x, y] of [[0.17, -0.27], [0.38, -0.21]] as const) {
      const b = MeshBuilder.CreateCylinder('btn', { diameter: 0.16, height: 0.08, tessellation: 24 }, s);
      place(b, k, red, [x, y, -0.17], [Math.PI / 2, 0, 0]);
    }
    for (const x of [-0.1, 0.07]) {
      slab(k, 'select', 0.13, 0.045, 0.04, 0.02, grey, [x, -0.55, -0.16], [0, 0, 0.45]);
    }
    for (let i = 0; i < 4; i++) {
      slab(k, 'grille', 0.18, 0.025, 0.03, 0.012, grey, [0.36 + i * 0.012, -0.53 - i * 0.055, -0.155], [0, 0, 0]);
    }
  },

  // ---------- Peluche (oso sentado con moño) ----------
  plush(k) {
    const muzzle = k.mat('#e3c39a');
    const brown = k.dark;
    const bow = k.mat('#efe1c1');
    blob(k, 'body', [0.92, 0.95, 0.8], k.base, [0, -0.28, 0]);
    blob(k, 'belly', [0.55, 0.6, 0.3], k.light, [0, -0.3, -0.28]);
    blob(k, 'head', [0.88, 0.82, 0.8], k.base, [0, 0.4, 0]);
    for (const x of [-0.33, 0.33]) {
      blob(k, 'ear', [0.3, 0.3, 0.2], k.base, [x, 0.76, 0.02]);
      blob(k, 'earIn', [0.17, 0.17, 0.08], muzzle, [x, 0.76, -0.07]);
      blob(k, 'arm', [0.26, 0.48, 0.26], k.base, [x * 1.38, -0.2, -0.1], [0, 0, x > 0 ? 0.35 : -0.35]);
      blob(k, 'leg', [0.32, 0.3, 0.48], k.base, [x * 0.82, -0.65, -0.24]);
      const pad = MeshBuilder.CreateCylinder('pad', { diameter: 0.24, height: 0.04, tessellation: 24 }, k.scene);
      place(pad, k, muzzle, [x * 0.82, -0.65, -0.48], [Math.PI / 2, 0, 0]);
      blob(k, 'eye', [0.09, 0.1, 0.06], brown, [x * 0.42, 0.5, -0.37]);
      blob(k, 'bowWing', [0.22, 0.15, 0.09], bow, [x * 0.38, 0.02, -0.38], [0, 0, x > 0 ? 0.2 : -0.2]);
    }
    blob(k, 'muzzle', [0.36, 0.27, 0.2], muzzle, [0, 0.31, -0.36]);
    blob(k, 'nose', [0.13, 0.09, 0.07], brown, [0, 0.37, -0.46]);
    blob(k, 'bowKnot', [0.09, 0.09, 0.08], bow, [0, 0.02, -0.41]);
  },

  // ---------- Caja musical con bailarina ----------
  musicBox(k) {
    const s = k.scene;
    const wood = k.base;
    const woodDark = k.mat('#3a2216');
    const gold = k.mat('#c9a24a', { gloss: true });
    const velvet = k.mat('#7a1f2c');
    const lace = k.mat('#efe4cf');
    const skin = k.mat('#ecc9a6');

    // Base y patas
    slab(k, 'plinth', 1.55, 0.12, 1.1, 0.03, wood, [0, -0.66, 0], [Math.PI / 2, 0, 0]);
    for (const x of [-0.65, 0.65]) for (const z of [-0.42, 0.42]) {
      blob(k, 'foot', [0.13, 0.1, 0.13], gold, [x, -0.75, z]);
    }
    // Caja
    place(MeshBuilder.CreateBox('box', { width: 1.38, height: 0.5, depth: 0.92 }, s), k, wood, [0, -0.36, 0]);
    place(MeshBuilder.CreateBox('inside', { width: 1.24, height: 0.02, depth: 0.78 }, s), k, woodDark, [0, -0.1, 0]);
    place(MeshBuilder.CreateBox('trimTop', { width: 1.4, height: 0.03, depth: 0.94 }, s), k, gold, [0, -0.15, 0]);
    place(MeshBuilder.CreateBox('trimLow', { width: 1.4, height: 0.025, depth: 0.94 }, s), k, gold, [0, -0.54, 0]);
    slab(k, 'lock', 0.16, 0.18, 0.02, 0.05, gold, [0, -0.33, -0.47]);
    // Mecanismo y terciopelo
    const disc = MeshBuilder.CreateCylinder('velvet', { diameter: 0.55, height: 0.06, tessellation: 32 }, s);
    place(disc, k, velvet, [-0.1, -0.06, 0.02]);
    const torusRim = MeshBuilder.CreateTorus('rim', { diameter: 0.56, thickness: 0.025, tessellation: 32 }, s);
    place(torusRim, k, gold, [-0.1, -0.04, 0.02]);
    const drum = MeshBuilder.CreateCylinder('drum', { diameter: 0.14, height: 0.32, tessellation: 20 }, s);
    place(drum, k, gold, [0.42, -0.02, 0.1], [0, 0, Math.PI / 2]);
    const crank = MeshBuilder.CreateCylinder('crank', { diameter: 0.05, height: 0.28 }, s);
    place(crank, k, gold, [0.82, -0.36, 0], [0, 0, Math.PI / 2]);
    blob(k, 'crankKnob', [0.08, 0.08, 0.08], gold, [0.97, -0.36, 0]);
    // Tapa abierta (bisagra atrás)
    const hinge = new TransformNode('hinge', s);
    hinge.parent = k.root;
    hinge.position.set(0, -0.1, 0.46);
    hinge.rotation.x = 1.78;
    const lid = MeshBuilder.CreateBox('lid', { width: 1.38, height: 0.09, depth: 0.92 }, s);
    lid.parent = hinge;
    lid.material = wood;
    lid.position.set(0, 0.045, -0.46);
    const lidIn = MeshBuilder.CreateBox('lidIn', { width: 1.22, height: 0.02, depth: 0.76 }, s);
    lidIn.parent = hinge;
    lidIn.material = woodDark;
    lidIn.position.set(0, -0.005, -0.46);
    const lidTrim = MeshBuilder.CreateBox('lidTrim', { width: 1.4, height: 0.025, depth: 0.94 }, s);
    lidTrim.parent = hinge;
    lidTrim.material = gold;
    lidTrim.position.set(0, 0.06, -0.46);
    // Bailarina
    const bx = -0.1;
    const leg = MeshBuilder.CreateCylinder('leg', { diameterTop: 0.06, diameterBottom: 0.035, height: 0.32 }, s);
    place(leg, k, lace, [bx, 0.13, 0.02]);
    const tutu = MeshBuilder.CreateCylinder('tutu', { diameterTop: 0.1, diameterBottom: 0.44, height: 0.08, tessellation: 24 }, s);
    place(tutu, k, lace, [bx, 0.31, 0.02]);
    blob(k, 'torso', [0.12, 0.2, 0.09], lace, [bx, 0.43, 0.02]);
    blob(k, 'head', [0.1, 0.11, 0.1], skin, [bx, 0.6, 0.02]);
    blob(k, 'bun', [0.06, 0.06, 0.06], k.mat('#6b4a33'), [bx, 0.65, 0.05]);
    tube(k, 'armUp', [new Vector3(bx + 0.05, 0.5, 0.02), new Vector3(bx + 0.13, 0.62, 0.02), new Vector3(bx + 0.1, 0.75, 0.02)], 0.018, skin);
    tube(k, 'armOut', [new Vector3(bx - 0.05, 0.5, 0.02), new Vector3(bx - 0.2, 0.52, 0.0), new Vector3(bx - 0.3, 0.48, -0.02)], 0.018, skin);
  },

  // ---------- Audífonos ----------
  headphones(k) {
    const s = k.scene;
    const dark = k.mat('#3e4249');
    const arc: Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const a = (Math.PI * i) / 28;
      arc.push(new Vector3(Math.cos(a) * 0.6, Math.sin(a) * 0.62 - 0.05, 0));
    }
    tube(k, 'band', arc, 0.11, dark);
    for (const side of [-1, 1]) {
      tube(k, 'yoke', [new Vector3(side * 0.6, -0.05, 0), new Vector3(side * 0.64, -0.3, 0)], 0.075, k.base);
      const cup = MeshBuilder.CreateCylinder('cup', { diameter: 0.64, height: 0.2, tessellation: 32 }, s);
      place(cup, k, k.base, [side * 0.7, -0.5, 0], [0, 0, Math.PI / 2]);
      blob(k, 'cap', [0.12, 0.6, 0.6], k.base, [side * 0.8, -0.5, 0]);
      const cushion = MeshBuilder.CreateTorus('cushion', { diameter: 0.46, thickness: 0.2, tessellation: 32 }, s);
      place(cushion, k, dark, [side * 0.55, -0.5, 0], [0, 0, Math.PI / 2]);
    }
  },

  // ---------- Yoyó de madera ----------
  yoyo(k) {
    const s = k.scene;
    const lightWood = k.mat('#dcb88a');
    const face = k.mat('#e2c194');
    face.diffuseTexture = ringTexture(k);
    for (const side of [-1, 1]) {
      // Mitad: cilindro que se abre hacia afuera + borde redondeado
      const half = MeshBuilder.CreateCylinder('half', { diameterTop: 1.2, diameterBottom: 1.0, height: 0.3, tessellation: 40 }, s);
      place(half, k, k.base, [0, 0, side * 0.2], [side * (Math.PI / 2), 0, 0]);
      const rim = MeshBuilder.CreateTorus('rim', { diameter: 1.12, thickness: 0.12, tessellation: 40 }, s);
      place(rim, k, k.base, [0, 0, side * 0.32], [Math.PI / 2, 0, 0]);
      const disc = MeshBuilder.CreateCylinder('face', { diameter: 1.08, height: 0.02, tessellation: 48 }, s);
      place(disc, k, face, [0, 0, side * 0.37], [side * (Math.PI / 2), 0, 0]);
    }
    const band = MeshBuilder.CreateCylinder('band', { diameter: 1.02, height: 0.1, tessellation: 40 }, s);
    place(band, k, lightWood, [0, 0, 0], [Math.PI / 2, 0, 0]);
    // Cuerda que cae en un bucle
    const rope: Vector3[] = [new Vector3(0, -0.4, 0)];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const a = t * Math.PI * 3;
      rope.push(new Vector3(-0.15 - t * 0.45 + Math.cos(a) * 0.32 * t, -0.62 - t * 0.12, -Math.sin(a) * 0.32 * t));
    }
    tube(k, 'rope', rope, 0.03, k.mat('#ece0c4'));
  },

  // ---------- Muñeca sentada ----------
  doll(k) {
    const skin = k.mat('#f1cfae');
    const hair = k.mat('#8b5a3c');
    const cream = k.mat('#f4e8d2');
    const black = k.mat('#2a2220');
    const dress = k.base;
    // Cabeza y pelo
    blob(k, 'head', [0.6, 0.6, 0.56], skin, [0, 0.42, 0]);
    blob(k, 'hairBack', [0.68, 0.7, 0.6], hair, [0, 0.45, 0.06]);
    blob(k, 'bangs', [0.62, 0.24, 0.26], hair, [0, 0.62, -0.18]);
    for (const x of [-1, 1]) {
      blob(k, 'hairSide', [0.2, 0.6, 0.32], hair, [x * 0.3, 0.2, 0.06]);
      blob(k, 'eye', [0.07, 0.09, 0.05], black, [x * 0.12, 0.38, -0.27]);
      blob(k, 'bow', [0.24, 0.17, 0.12], dress, [x * 0.15, 0.78, -0.02], [0, 0, x * 0.25]);
      // Brazos con manga
      blob(k, 'sleeve', [0.18, 0.16, 0.16], dress, [x * 0.24, 0.05, -0.02]);
      blob(k, 'cuff', [0.13, 0.06, 0.13], cream, [x * 0.29, -0.06, -0.04]);
      blob(k, 'arm', [0.12, 0.28, 0.12], skin, [x * 0.31, -0.18, -0.06], [0, 0, x * 0.15]);
      // Piernas hacia el frente
      blob(k, 'leg', [0.16, 0.16, 0.4], skin, [x * 0.13, -0.48, -0.32]);
      blob(k, 'shoe', [0.2, 0.18, 0.24], dress, [x * 0.13, -0.48, -0.56]);
    }
    blob(k, 'bowKnot', [0.09, 0.09, 0.09], dress, [0, 0.78, -0.03]);
    // Vestido
    const body = MeshBuilder.CreateCylinder('dress', { diameterTop: 0.34, diameterBottom: 0.82, height: 0.55, tessellation: 32 }, k.scene);
    place(body, k, dress, [0, -0.2, 0]);
    blob(k, 'skirtFront', [0.7, 0.2, 0.42], dress, [0, -0.42, -0.2]);
    const hem = MeshBuilder.CreateTorus('hem', { diameter: 0.8, thickness: 0.05, tessellation: 32 }, k.scene);
    place(hem, k, cream, [0, -0.47, 0]);
    blob(k, 'collar', [0.36, 0.08, 0.3], cream, [0, 0.08, -0.04]);
  },

  bicycle(k) {
    const s = k.scene;
    for (const x of [-0.62, 0.62]) {
      const w = MeshBuilder.CreateTorus('wheel', { diameter: 0.85, thickness: 0.07, tessellation: 32 }, s);
      w.rotation.x = Math.PI / 2;
      place(w, k, k.dark, [x, -0.35, 0]);
    }
    const tube = (from: Vector3, to: Vector3) => {
      const t = MeshBuilder.CreateTube('frame', { path: [from, to], radius: 0.045 }, s);
      t.parent = k.root;
      t.material = k.base;
    };
    const seat = new Vector3(-0.15, 0.25, 0);
    const head = new Vector3(0.45, 0.3, 0);
    const crank = new Vector3(0, -0.35, 0);
    tube(new Vector3(-0.62, -0.35, 0), seat);
    tube(seat, crank);
    tube(crank, head);
    tube(seat, head);
    tube(head, new Vector3(0.62, -0.35, 0));
    tube(new Vector3(-0.62, -0.35, 0), crank);
    tube(head, new Vector3(0.4, 0.55, 0));
    place(MeshBuilder.CreateBox('saddle', { width: 0.3, height: 0.06, depth: 0.14 }, s), k, k.dark, [-0.17, 0.3, 0]);
    place(MeshBuilder.CreateBox('bars', { width: 0.06, height: 0.06, depth: 0.5 }, s), k, k.dark, [0.4, 0.55, 0]);
  },

  ball(k) {
    const s = k.scene;
    place(MeshBuilder.CreateSphere('ball', { diameter: 1.4, segments: 24 }, s), k, k.base, [0, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const band = MeshBuilder.CreateTorus('seam', { diameter: 1.41, thickness: 0.035, tessellation: 48 }, s);
      band.rotation.set(i === 0 ? Math.PI / 2 : 0, 0, i === 2 ? Math.PI / 2 : 0);
      place(band, k, k.dark, [0, 0, 0]);
    }
  },

  actionFigure(k) {
    const s = k.scene;
    place(MeshBuilder.CreateBox('torso', { width: 0.55, height: 0.6, depth: 0.3 }, s), k, k.base, [0, 0.15, 0]);
    place(MeshBuilder.CreateSphere('head', { diameter: 0.34 }, s), k, k.light, [0, 0.64, 0]);
    for (const x of [-0.38, 0.38]) {
      const arm = MeshBuilder.CreateCapsule('arm', { radius: 0.08, height: 0.6 }, s);
      arm.rotation.z = x < 0 ? 0.35 : -0.35;
      place(arm, k, k.base, [x, 0.12, 0]);
    }
    for (const x of [-0.14, 0.14]) {
      place(MeshBuilder.CreateCapsule('leg', { radius: 0.1, height: 0.7 }, s), k, k.dark, [x, -0.5, 0]);
    }
    place(MeshBuilder.CreateBox('belt', { width: 0.57, height: 0.08, depth: 0.32 }, s), k, k.accent, [0, -0.13, 0]);
  },

  brick(k) {
    const s = k.scene;
    place(MeshBuilder.CreateBox('brick', { width: 1.5, height: 0.55, depth: 0.75 }, s), k, k.base, [0, 0, 0]);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        place(
          MeshBuilder.CreateCylinder('stud', { diameter: 0.22, height: 0.12 }, s),
          k, k.base, [-0.56 + i * 0.375, 0.33, -0.18 + j * 0.36],
        );
      }
    }
  },

  // ---------- Dinosaurio de juguete (triceratops low-poly) ----------
  dinosaur(k) {
    const s = k.scene;
    // Todo cuelga de un nodo escalado para que mida lo mismo que los demás objetos
    const body = new TransformNode('dino', s);
    body.parent = k.root;
    body.scaling.setAll(0.7);
    const d: Kit = { ...k, root: body };
    const cream = k.mat('#efe8d2');
    const eye = k.mat('#2e2a26');
    const frill = k.light;

    // Esfera de pocas caras: da el aspecto facetado del low-poly
    const facet = (name: string, size: V3, mat: StandardMaterial, pos: V3, rot?: V3): Mesh => {
      const m = MeshBuilder.CreateSphere(name, { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments: 4 }, s);
      return place(m, d, mat, pos, rot);
    };
    const cone = (name: string, base: number, h: number, mat: StandardMaterial, pos: V3, rot: V3): Mesh => {
      const m = MeshBuilder.CreateCylinder(name, { diameterTop: 0, diameterBottom: base, height: h, tessellation: 5 }, s);
      return place(m, d, mat, pos, rot);
    };

    // Cuerpo, panza y cola (el dinosaurio mira hacia +X)
    facet('torso', [1.15, 0.8, 0.86], k.base, [0, 0, 0]);
    facet('belly', [0.9, 0.42, 0.72], cream, [0.05, -0.22, 0]);
    const tail = MeshBuilder.CreateCylinder('tail', { diameterTop: 0.03, diameterBottom: 0.38, height: 0.8, tessellation: 6 }, s);
    place(tail, d, k.base, [-0.78, -0.02, 0], [0, 0, Math.PI / 2 - 0.35]);

    // Patas con pezuñas crema
    for (const x of [-0.34, 0.34]) {
      for (const z of [-0.26, 0.26]) {
        const leg = MeshBuilder.CreateCylinder('leg', { diameterTop: 0.36, diameterBottom: 0.32, height: 0.4, tessellation: 6 }, s);
        place(leg, d, k.base, [x, -0.44, z]);
        const hoof = MeshBuilder.CreateCylinder('hoof', { diameter: 0.34, height: 0.07, tessellation: 6 }, s);
        place(hoof, d, cream, [x + 0.02, -0.65, z]);
      }
    }

    // Gola con picos
    const frillDisc = MeshBuilder.CreateCylinder('frill', { diameter: 1.28, height: 0.1, tessellation: 9 }, s);
    place(frillDisc, d, k.base, [0.55, 0.52, 0], [0, 0, Math.PI / 2 + 0.25]);
    const frillCenter = new Vector3(0.55, 0.52, 0);
    for (let i = 0; i < 7; i++) {
      const a = -1.35 + (i / 6) * 2.7; // ángulo desde arriba hacia los lados
      const dir = new Vector3(0, Math.cos(a), Math.sin(a));
      const spike = MeshBuilder.CreateCylinder('spike', { diameterTop: 0, diameterBottom: 0.22, height: 0.2, tessellation: 4 }, s);
      spike.parent = body;
      spike.material = frill;
      spike.position = frillCenter.add(dir.scale(0.66)).add(new Vector3(-0.08, 0, 0));
      // Orienta el eje Y del cono hacia afuera
      spike.rotationQuaternion = null;
      spike.rotation.set(Math.atan2(dir.z, dir.y), 0, 0);
      spike.rotation.x = -spike.rotation.x;
    }

    // Cabeza, hocico, ojos y cuernos
    facet('head', [0.86, 0.8, 0.82], k.base, [0.8, 0.3, 0]);
    facet('snout', [0.42, 0.36, 0.44], k.base, [1.14, 0.14, 0]);
    facet('jaw', [0.36, 0.14, 0.36], cream, [1.1, -0.02, 0]);
    cone('noseHorn', 0.15, 0.22, cream, [1.3, 0.26, 0], [0, 0, -1.1]);
    for (const z of [-0.2, 0.2]) {
      cone('browHorn', 0.14, 0.38, cream, [0.96, 0.74, z], [0, 0, -0.45]);
      facet('eye', [0.08, 0.13, 0.08], eye, [1.15, 0.38, z * 1.2]);
    }

    // Caras planas: acabado facetado como la referencia
    for (const m of body.getChildMeshes()) (m as Mesh).convertToFlatShadedMesh();
  },
};

/** Anillos concéntricos para la cara del yoyó. */
function ringTexture(k: Kit): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture(`${k.name}-rings`, { width: size, height: size }, k.scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const c = size / 2;
  ctx.fillStyle = '#dcb88a';
  ctx.fillRect(0, 0, size, size);
  const rings: [number, string, number][] = [
    [0.92, '#2b1d16', 3], [0.82, '#8e3b2a', 14], [0.72, '#2b1d16', 3],
    [0.6, '#8e3b2a', 12], [0.5, '#2b1d16', 2], [0.4, '#8e3b2a', 10],
  ];
  for (const [r, color, w] of rings) {
    ctx.beginPath();
    ctx.arc(c, c, r * c, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  tex.update();
  return tex;
}

/** Construye el placeholder bajo un nodo raíz. */
export function buildPlaceholder(
  scene: Scene,
  shape: PlaceholderShape,
  name: string,
  color: Color3,
): TransformNode {
  const root = new TransformNode(name, scene);
  const cache = new Map<string, StandardMaterial>();
  const kit: Kit = {
    scene,
    root,
    name,
    base: material(scene, `${name}-base`, color),
    dark: material(scene, `${name}-dark`, color.scale(0.3)),
    light: material(scene, `${name}-light`, Color3.Lerp(color, new Color3(0.95, 0.92, 0.88), 0.55)),
    accent: material(scene, `${name}-accent`, Color3.Lerp(color, new Color3(0.9, 0.3, 0.35), 0.6)),
    mat: (hex, options) => {
      const key = `${hex}-${options?.gloss ? 'g' : ''}${options?.emissive ?? ''}`;
      let m = cache.get(key);
      if (!m) {
        m = material(scene, `${name}-${key}`, Color3.FromHexString(hex), options?.gloss);
        if (options?.emissive) m.emissiveColor = Color3.FromHexString(hex).scale(options.emissive);
        cache.set(key, m);
      }
      return m;
    },
  };
  builders[shape](kit);
  return root;
}
