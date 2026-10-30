import {
  Color3,
  DynamicTexture,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  TransformNode,
  Vector3,
  type GlowLayer,
  type Scene,
} from '@babylonjs/core';

/** Medidas de la cinta en unidades de mundo. */
export const FILM = {
  frameW: 16,
  frameH: 9,
  /** Distancia entre centros de fotogramas (16 de imagen + una franja negra delgada). */
  spacing: 16.7,
  /** Banda negra arriba y abajo de la imagen (donde van las perforaciones). */
  margin: 1.6,
  /** Perforaciones por fotograma. */
  holesPerFrame: 11,
  holeW: 0.78,
  holeH: 0.95,
  /** Ondulación de la cinta en profundidad. */
  wave: 3.5,
  waveFreq: 0.8,
};

/**
 * Cinta cinematográfica suspendida en el espacio.
 * Sigue una curva suave; cada fotograma tiene un nodo orientado según la curva.
 * u = posición en "fotogramas" (0 = primero, 1 = segundo...).
 */
export class FilmStrip {
  readonly frames: TransformNode[] = [];
  readonly origin: Vector3;

  private scene: Scene;
  private meshes: Mesh[] = [];
  private materials: StandardMaterial[] = [];
  private textures: DynamicTexture[] = [];

  constructor(scene: Scene, count: number, origin: Vector3) {
    this.scene = scene;
    this.origin = origin;

    for (let i = 0; i < count; i++) {
      const node = new TransformNode(`film-frame-${i}`, scene);
      node.position.copyFrom(this.pointAt(i));
      node.rotationQuaternion = this.orientationAt(i);
      this.frames.push(node);
    }
    this.buildBand(count);
    this.buildPerforations(count);
    this.excludeFromGlow();
  }

  pointAt(u: number): Vector3 {
    return new Vector3(
      this.origin.x + u * FILM.spacing,
      this.origin.y,
      this.origin.z + Math.sin(u * FILM.waveFreq) * FILM.wave,
    );
  }

  tangentAt(u: number): Vector3 {
    return new Vector3(FILM.spacing, 0, Math.cos(u * FILM.waveFreq) * FILM.waveFreq * FILM.wave).normalize();
  }

  /**
   * Orientación de un fotograma: X local a lo largo de la cinta, Y hacia arriba
   * y Z alejándose del espectador (la cara visible del plano mira a la cámara).
   */
  orientationAt(u: number): Quaternion {
    const x = this.tangentAt(u);
    const y = Vector3.Up();
    const z = Vector3.Cross(x, y).normalize();
    return Quaternion.RotationQuaternionFromAxis(x, y, z);
  }

  /** Normal que apunta hacia el lado del espectador. */
  normalAt(u: number): Vector3 {
    const t = this.tangentAt(u);
    return new Vector3(t.z, 0, -t.x);
  }

  private buildBand(count: number): void {
    const half = FILM.frameH / 2 + FILM.margin;
    const top: Vector3[] = [];
    const bottom: Vector3[] = [];
    for (let u = -1.6; u <= count - 1 + 1.6; u += 0.04) {
      const p = this.pointAt(u).add(this.normalAt(u).scale(-0.02));
      top.push(p.add(new Vector3(0, half, 0)));
      bottom.push(p.add(new Vector3(0, -half, 0)));
    }
    const band = MeshBuilder.CreateRibbon('film-band', { pathArray: [top, bottom], sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    // Negro puro, como el celuloide de la referencia
    band.material = this.material('film-band-mat', '#020202');
    band.isPickable = false;
    this.meshes.push(band);
  }

  /** Perforaciones blancas de esquinas redondeadas (instancias finas: un solo draw call). */
  private buildPerforations(count: number): void {
    const hole = MeshBuilder.CreatePlane('film-hole', { width: FILM.holeW, height: FILM.holeH }, this.scene);
    const mat = this.material('film-hole-mat', '#f2eee8');
    mat.opacityTexture = this.roundedRectTexture();
    hole.material = mat;
    hole.isPickable = false;
    this.textures.push(mat.opacityTexture as DynamicTexture);

    const y = FILM.frameH / 2 + FILM.margin / 2;
    // Alineadas con cada fotograma: el patrón se repite igual en todos
    const step = 1 / FILM.holesPerFrame;
    for (let u = -1.5 + step / 2; u <= count - 1 + 1.5; u += step) {
      // Un poco por delante de la banda negra (hacia el espectador) para que se vean
      const p = this.pointAt(u).add(this.normalAt(u).scale(0.03));
      const q = this.orientationAt(u);
      for (const sign of [1, -1]) {
        const m = Matrix.Compose(Vector3.One(), q, p.add(new Vector3(0, sign * y, 0)));
        hole.thinInstanceAdd(m, false);
      }
    }
    hole.thinInstanceRefreshBoundingInfo();
    this.meshes.push(hole);
  }

  /** Visibilidad de la banda y las perforaciones (0–1), para desvanecer la cinta. */
  setVisibility(v: number): void {
    for (const m of this.meshes) m.visibility = v;
  }

  /** La cinta no debe brillar con el GlowLayer (es negra y opaca). */
  excludeFromGlow(): void {
    const glow = this.scene.effectLayers.find((l) => l.name === 'glow') as GlowLayer | undefined;
    for (const m of this.meshes) glow?.addExcludedMesh(m);
  }

  /** Rectángulo de esquinas redondeadas con borde apenas suave. */
  private roundedRectTexture(): DynamicTexture {
    const W = 64;
    const H = Math.round((64 * FILM.holeH) / FILM.holeW);
    const tex = new DynamicTexture('film-hole-tex', { width: W, height: H }, this.scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    const r = W * 0.22;
    const pad = 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(pad + r, pad);
    ctx.arcTo(W - pad, pad, W - pad, H - pad, r);
    ctx.arcTo(W - pad, H - pad, pad, H - pad, r);
    ctx.arcTo(pad, H - pad, pad, pad, r);
    ctx.arcTo(pad, pad, W - pad, pad, r);
    ctx.closePath();
    ctx.fill();
    tex.hasAlpha = true;
    tex.update();
    return tex;
  }

  private material(name: string, hex: string): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.disableLighting = true;
    m.emissiveColor = Color3.FromHexString(hex);
    m.backFaceCulling = false;
    m.fogEnabled = false;
    this.materials.push(m);
    return m;
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const f of this.frames) f.dispose();
    this.meshes = [];
    this.materials = [];
  }
}
