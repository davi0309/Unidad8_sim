import {
  PointerEventTypes,
  type AbstractMesh,
  type Nullable,
  type Observer,
  type PointerInfo,
  type Scene,
} from '@babylonjs/core';

export interface InteractionHandlers<T> {
  /** Traduce una malla clicada a la entidad que representa (o null). */
  resolve: (mesh: AbstractMesh) => T | null;
  /** ¿Esta entidad acepta interacción ahora mismo? */
  canInteract: (target: T) => boolean;
  onHover: (target: T | null) => void;
  onSelect: (target: T) => void;
}

/**
 * Picking genérico con hover y clic.
 * Evita dobles clics: ignora selecciones mientras la anterior se procesa.
 */
export class InteractionSystem<T> {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private handlers: InteractionHandlers<T>;
  private observer: Nullable<Observer<PointerInfo>> = null;
  private hovered: T | null = null;
  private busy = false;
  private down: { x: number; y: number; time: number } | null = null;
  private enabled = true;

  constructor(scene: Scene, canvas: HTMLCanvasElement, handlers: InteractionHandlers<T>) {
    this.scene = scene;
    this.canvas = canvas;
    this.handlers = handlers;
    this.observer = scene.onPointerObservable.add((info) => this.handlePointer(info));
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) this.setHovered(null);
  }

  /** Bloquea nuevos clics hasta llamar a release(). */
  lock(): void {
    this.busy = true;
  }

  release(): void {
    this.busy = false;
  }

  private handlePointer(info: PointerInfo): void {
    if (!this.enabled) return;

    if (info.type === PointerEventTypes.POINTERMOVE) {
      this.setHovered(this.pickTarget());
      return;
    }

    // Clic propio (down + up cerca y rápido): no depende de la detección de doble clic
    // de Babylon, que falla cuando bajan los FPS.
    const e = info.event as PointerEvent;
    if (info.type === PointerEventTypes.POINTERDOWN && e.button === 0) {
      this.down = { x: e.clientX, y: e.clientY, time: performance.now() };
      return;
    }
    if (info.type === PointerEventTypes.POINTERUP && this.down) {
      const { x, y, time } = this.down;
      this.down = null;
      const isClick = Math.hypot(e.clientX - x, e.clientY - y) < 8 && performance.now() - time < 700;
      if (!isClick || this.busy) return;
      const target = this.pickTarget();
      if (target) this.handlers.onSelect(target);
    }
  }

  private pickTarget(): T | null {
    // Atraviesa lo que no se puede elegir (objetos ya conservados, en transición, etc.)
    const picks = this.scene.multiPick(this.scene.pointerX, this.scene.pointerY, (m) => m.isPickable && m.isEnabled()) ?? [];
    picks.sort((a, b) => a.distance - b.distance);
    for (const pick of picks) {
      if (!pick.pickedMesh) continue;
      const target = this.handlers.resolve(pick.pickedMesh);
      if (target && this.handlers.canInteract(target)) return target;
    }
    return null;
  }

  private setHovered(target: T | null): void {
    if (target === this.hovered) return;
    this.hovered = target;
    this.canvas.style.cursor = target ? 'pointer' : 'default';
    this.handlers.onHover(target);
  }

  dispose(): void {
    this.scene.onPointerObservable.remove(this.observer);
    this.observer = null;
    this.canvas.style.cursor = 'default';
  }
}
