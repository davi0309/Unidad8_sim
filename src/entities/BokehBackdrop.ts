import {
  Color3,
  Constants,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type GlowLayer,
  type Scene,
} from '@babylonjs/core';
import gsap from 'gsap';

/** Colores de los círculos (rojo, azul claro, verde lima, violeta, amarillo). */
const PALETTE = ['#d0283a', '#5aa8e8', '#a6d838', '#9a52d8', '#f2d43a', '#c43a6a', '#7cc0f0'];

interface Orb {
  mesh: Mesh;
  material: StandardMaterial;
  targetAlpha: number;
}

/**
 * Fondo de luces fuera de foco detrás de la cinta: círculos de colores,
 * algunos nítidos y otros muy desenfocados, que derivan despacio.
 * Aparece poco a poco (reveal 0 → 1).
 */
export class BokehBackdrop {
  /** 0 = invisible, 1 = fondo completo. Se anima desde fuera. */
  reveal = 0;

  private scene: Scene;
  private orbs: Orb[] = [];
  private textures: DynamicTexture[] = [];
  private tweens: gsap.core.Tween[] = [];

  constructor(scene: Scene, center: Vector3, span: number, count = 90) {
    this.scene = scene;
    const sharp = this.discTexture('bokeh-sharp', 0.9);
    const soft = this.discTexture('bokeh-soft', 0.25);
    this.textures.push(sharp, soft);
    const glow = scene.effectLayers.find((l) => l.name === 'glow') as GlowLayer | undefined;

    for (let i = 0; i < count; i++) {
      const isSharp = Math.random() < 0.45;
      const size = isSharp ? 7 + Math.random() * 18 : 12 + Math.random() * 24;
      const mesh = MeshBuilder.CreatePlane(`bokeh-bg-${i}`, { size }, scene);
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.isPickable = false;
      mesh.position.set(
        center.x + (Math.random() - 0.5) * (span + 120),
        center.y + (Math.random() - 0.5) * 95,
        center.z + 45 + Math.random() * 80,
      );

      const mat = new StandardMaterial(`bokeh-bg-mat-${i}`, scene);
      mat.disableLighting = true;
      mat.fogEnabled = false;
      mat.emissiveColor = Color3.FromHexString(PALETTE[i % PALETTE.length]);
      mat.opacityTexture = isSharp ? sharp : soft;
      mat.alphaMode = Constants.ALPHA_COMBINE;
      mat.alpha = 0;
      mesh.material = mat;
      mesh.alphaIndex = -30;
      glow?.addExcludedMesh(mesh);

      this.orbs.push({ mesh, material: mat, targetAlpha: isSharp ? 0.45 + Math.random() * 0.3 : 0.3 + Math.random() * 0.3 });

      // Deriva lenta, cada círculo a su ritmo
      this.tweens.push(
        gsap.to(mesh.position, {
          x: mesh.position.x + (Math.random() - 0.5) * 14,
          y: mesh.position.y + (Math.random() - 0.5) * 8,
          duration: 14 + Math.random() * 16,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        }),
      );
    }
  }

  /** Disco con borde: hardness 1 = borde nítido, 0 = muy difuso. */
  private discTexture(name: string, hardness: number): DynamicTexture {
    const size = 256;
    const tex = new DynamicTexture(name, { width: size, height: size }, this.scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    const edge = 0.55 + hardness * 0.4;
    g.addColorStop(0, 'rgba(255,255,255,0.78)');
    g.addColorStop(edge * 0.7, 'rgba(255,255,255,0.88)');
    g.addColorStop(edge, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    tex.hasAlpha = true;
    tex.update();
    return tex;
  }

  update(): void {
    // Cada círculo aparece con un pequeño desfase, para que el fondo "se encienda" por partes
    this.orbs.forEach((o, i) => {
      const local = Math.min(Math.max(this.reveal * 1.4 - (i / this.orbs.length) * 0.4, 0), 1);
      o.material.alpha = o.targetAlpha * local;
    });
  }

  dispose(): void {
    for (const t of this.tweens) t.kill();
    for (const o of this.orbs) {
      o.material.dispose();
      o.mesh.dispose();
    }
    for (const t of this.textures) t.dispose();
    this.orbs = [];
  }
}
