import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type GlowLayer,
  type Mesh,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';
import type { SceneDefinition } from '../data/types';
import { hashString, mulberry32 } from '../utils/paint';
import { buildLayerData, createPointMesh, type PointMesh } from './PointLayer';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Un fotograma de la cinta: un escenario dibujado con partículas en un plano 2D.
 * Se construye por capas (fondo, siluetas, luces) a partir de la definición de datos.
 */
export class CinematicScene {
  readonly definition: SceneDefinition;
  readonly index: number;
  readonly frame: { w: number; h: number };
  /** Plano detrás de la imagen: da el color base y sirve para detectar clics. */
  readonly backing: Mesh;

  /** 0 = partículas dispersas, 1 = imagen formada. */
  assemble = 0;
  /** Brillo general (los fotogramas lejanos al actual se atenúan). */
  intensity = 1;
  built = false;

  private scene: Scene;
  private root: TransformNode;
  private layers: PointMesh[] = [];
  private backingMaterial: StandardMaterial;
  private pointer = new Vector3(0, 0, 0);

  constructor(scene: Scene, definition: SceneDefinition, index: number, root: TransformNode, frame: { w: number; h: number }) {
    this.scene = scene;
    this.definition = definition;
    this.index = index;
    this.root = root;
    this.frame = frame;

    const mat = new StandardMaterial(`frame-${definition.id}-backing`, scene);
    mat.disableLighting = true;
    mat.emissiveColor = Color3.FromHexString(definition.base).scale(0.85);
    mat.alpha = 0;
    mat.fogEnabled = false;
    this.backingMaterial = mat;

    const plane = MeshBuilder.CreatePlane(`frame-${definition.id}-backing`, { width: frame.w, height: frame.h }, scene);
    plane.parent = root;
    plane.position.z = 0.04;
    plane.material = mat;
    plane.alphaIndex = -10;
    // Las imágenes se dibujan en un grupo posterior a la cinta: la curva de la banda
    // nunca tapa los bordes del fotograma.
    plane.renderingGroupId = 1;
    plane.metadata = { sceneIndex: index };
    this.backing = plane;
    const glow = scene.effectLayers.find((l) => l.name === 'glow') as GlowLayer | undefined;
    glow?.addExcludedMesh(plane);
  }

  /** Pinta y genera las capas. Cede un frame entre capas para no congelar la animación. */
  async build(): Promise<void> {
    if (this.built) return;
    this.built = true;
    const rand = mulberry32(hashString(this.definition.id));
    for (const [i, layer] of this.definition.layers.entries()) {
      const data = buildLayerData(layer, this.frame, rand, -0.002 * (i + 1));
      if (data.count === 0) continue;
      const pm = createPointMesh(this.scene, `frame-${this.definition.id}-${layer.name}`, data, layer.blend ?? 'alpha', this.frame);
      pm.mesh.parent = this.root;
      pm.mesh.alphaIndex = i;
      pm.mesh.renderingGroupId = 1;
      this.layers.push(pm);
      await nextFrame();
    }
  }

  setPointer(x: number, y: number, strength: number): void {
    this.pointer.set(x, y, strength);
  }

  /** Convierte un punto del mundo a coordenadas locales del fotograma. */
  toLocal(world: Vector3): Vector3 {
    const inv = this.root.getWorldMatrix().clone().invert();
    return Vector3.TransformCoordinates(world, inv);
  }

  update(time: number, scale: number): void {
    this.backingMaterial.alpha = this.assemble * 0.97;
    this.backingMaterial.emissiveColor = Color3.FromHexString(this.definition.base).scale(0.85 * (0.5 + this.intensity * 0.5));
    for (const { material } of this.layers) {
      material.setFloat('uTime', time);
      material.setFloat('uScale', scale);
      material.setFloat('uAssemble', this.assemble);
      material.setFloat('uIntensity', this.intensity);
      material.setVector3('uPointer', this.pointer);
    }
  }

  dispose(): void {
    for (const { mesh, material } of this.layers) {
      material.dispose();
      mesh.dispose();
    }
    this.layers = [];
    this.backing.dispose();
    this.backingMaterial.dispose();
  }
}
