/**
 * Herramientas para "pintar" escenarios en un canvas 2D.
 * La pintura no se muestra: sirve de mapa para colocar y colorear partículas.
 *
 * Coordenadas normalizadas: u (0–1, izquierda→derecha), v (0–1, arriba→abajo).
 * Los tamaños (radios, grosores) van en unidades de alto (s(1) = alto del canvas),
 * así los círculos no se deforman.
 */

export type Fill = string | CanvasGradient;
export type Stops = [number, string][];
export type Pt = [number, number];

/** Generador pseudoaleatorio con semilla: el mismo escenario se ve igual cada vez. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Painter {
  readonly ctx: CanvasRenderingContext2D;
  readonly W: number;
  readonly H: number;
  readonly rand: () => number;

  constructor(ctx: CanvasRenderingContext2D, W: number, H: number, rand: () => number) {
    this.ctx = ctx;
    this.W = W;
    this.H = H;
    this.rand = rand;
  }

  // ---------- Conversión ----------
  x(u: number): number {
    return u * this.W;
  }
  y(v: number): number {
    return v * this.H;
  }
  s(n: number): number {
    return n * this.H;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.rand();
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.rand() * items.length)];
  }

  // ---------- Fondos y gradientes ----------
  fillAll(fill: Fill): void {
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  /** Gradiente vertical entre v0 y v1 (pinta solo esa franja). */
  vgrad(stops: Stops, v0 = 0, v1 = 1): void {
    const g = this.ctx.createLinearGradient(0, this.y(v0), 0, this.y(v1));
    for (const [o, c] of stops) g.addColorStop(o, c);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, this.y(v0), this.W, this.y(v1) - this.y(v0));
  }

  /** Gradiente lineal entre dos puntos, sobre todo el canvas. */
  lgrad(u0: number, v0: number, u1: number, v1: number, stops: Stops): void {
    this.fillAll(this.linear(u0, v0, u1, v1, stops));
  }

  linear(u0: number, v0: number, u1: number, v1: number, stops: Stops): CanvasGradient {
    const g = this.ctx.createLinearGradient(this.x(u0), this.y(v0), this.x(u1), this.y(v1));
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }

  /** Resplandor radial (pinta un círculo con degradado). */
  glow(u: number, v: number, r: number, stops: Stops): void {
    const X = this.x(u);
    const Y = this.y(v);
    const R = this.s(r);
    const g = this.ctx.createRadialGradient(X, Y, 0, X, Y, R);
    for (const [o, c] of stops) g.addColorStop(o, c);
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(X, Y, R, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // ---------- Formas en coordenadas normalizadas ----------
  circle(u: number, v: number, r: number, fill: Fill): void {
    this.pcircle(this.x(u), this.y(v), this.s(r), fill);
  }

  ellipse(u: number, v: number, rx: number, ry: number, fill: Fill, rot = 0): void {
    this.pellipse(this.x(u), this.y(v), this.s(rx), this.s(ry), fill, rot);
  }

  /** Rectángulo: u, v esquina superior izquierda; w en ancho normalizado, h en alto normalizado. */
  rect(u: number, v: number, w: number, h: number, fill: Fill): void {
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(this.x(u), this.y(v), this.x(w), this.y(h));
  }

  poly(points: Pt[], fill: Fill): void {
    this.ppoly(points.map(([u, v]) => [this.x(u), this.y(v)]), fill);
  }

  line(points: Pt[], width: number, stroke: Fill): void {
    this.pline(points.map(([u, v]) => [this.x(u), this.y(v)]), this.s(width), stroke);
  }

  /** Estrella de n puntas (sin rostro ni detalles: forma genérica). */
  star(u: number, v: number, r: number, fill: Fill, rot = 0, points = 5, inner = 0.48): void {
    const X = this.x(u);
    const Y = this.y(v);
    const R = this.s(r);
    const pts: Pt[] = [];
    for (let i = 0; i < points * 2; i++) {
      const a = rot - Math.PI / 2 + (i * Math.PI) / points;
      const rr = i % 2 === 0 ? R : R * inner;
      pts.push([X + Math.cos(a) * rr, Y + Math.sin(a) * rr]);
    }
    this.ppoly(pts, fill);
  }

  /** Puntos al azar dentro de una región. */
  dots(n: number, region: [number, number, number, number], r: [number, number], colors: readonly string[]): void {
    const [u0, v0, u1, v1] = region;
    for (let i = 0; i < n; i++) {
      this.circle(this.range(u0, u1), this.range(v0, v1), this.range(r[0], r[1]), this.pick(colors));
    }
  }

  // ---------- Formas en píxeles (para siluetas compuestas) ----------
  pcircle(X: number, Y: number, R: number, fill: Fill): void {
    this.ctx.fillStyle = fill;
    this.ctx.beginPath();
    this.ctx.arc(X, Y, Math.max(R, 0.1), 0, Math.PI * 2);
    this.ctx.fill();
  }

  pellipse(X: number, Y: number, RX: number, RY: number, fill: Fill, rot = 0): void {
    this.ctx.fillStyle = fill;
    this.ctx.beginPath();
    this.ctx.ellipse(X, Y, Math.max(RX, 0.1), Math.max(RY, 0.1), rot, 0, Math.PI * 2);
    this.ctx.fill();
  }

  ppoly(points: Pt[], fill: Fill): void {
    if (points.length < 3) return;
    this.ctx.fillStyle = fill;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) this.ctx.lineTo(points[i][0], points[i][1]);
    this.ctx.closePath();
    this.ctx.fill();
  }

  pline(points: Pt[], width: number, stroke: Fill): void {
    if (points.length < 2) return;
    const c = this.ctx;
    c.strokeStyle = stroke;
    c.lineWidth = Math.max(width, 0.5);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.stroke();
  }

  /** Nube de círculos superpuestos: sombra abajo, luz arriba. */
  cloud(u: number, v: number, scale: number, shade: string, light: string, puffs = 14): void {
    const X = this.x(u);
    const Y = this.y(v);
    const S = this.s(scale);
    const spots: [number, number, number][] = [];
    for (let i = 0; i < puffs; i++) {
      const cx = X + this.range(-0.13, 0.13) * S;
      const cy = Y + this.range(-0.025, 0.02) * S;
      const r = this.range(0.03, 0.06) * S;
      spots.push([cx, cy, r]);
      this.pcircle(cx, cy, r, shade);
    }
    for (const [cx, cy, r] of spots.slice(0, Math.ceil(puffs * 0.6))) {
      this.pcircle(cx - r * 0.12, cy - r * 0.28, r * 0.72, light);
    }
  }
}
