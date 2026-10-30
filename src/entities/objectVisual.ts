import { Color3, ImportMeshAsync, TransformNode, type Scene } from '@babylonjs/core';
import type { ObjectDefinition } from '../data/types';
import { buildPlaceholder } from './placeholders';

/**
 * Crea la figura de un objeto de infancia: el .glb si existe, si no el modelo provisional.
 * La usan las etapas que muestran objetos fuera de la selección (diorama, cierre).
 */
export async function createObjectVisual(
  scene: Scene,
  definition: ObjectDefinition,
  color: string,
  name: string,
): Promise<TransformNode> {
  if (definition.model) {
    try {
      const result = await ImportMeshAsync(`${import.meta.env.BASE_URL}${definition.model}`, scene);
      const node = new TransformNode(name, scene);
      for (const m of result.meshes) if (!m.parent) m.parent = node;
      return node;
    } catch (err) {
      console.warn(`No se pudo cargar ${definition.model}, uso el modelo provisional.`, err);
    }
  }
  return buildPlaceholder(scene, definition.placeholder, name, Color3.FromHexString(color));
}
