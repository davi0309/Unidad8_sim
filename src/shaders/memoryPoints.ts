import { Effect } from '@babylonjs/core';

/**
 * Shader de puntos de los escenarios.
 * Cada punto es una partícula con su propio movimiento, calculado en la GPU
 * (así se pueden animar decenas de miles sin costo en JavaScript).
 *
 * Atributos:
 *  - motion: (tipo, semilla, velocidad, tamaño en unidades de mundo)
 *  - param:  parámetros del movimiento (centro, amplitud, etc.)
 *
 * Tipos de movimiento (ver MOTION en PointLayer.ts):
 *  0 quieto · 1 titileo · 2 subir · 3 balanceo · 4 deriva en grupo · 5 órbita
 *  6 caída diagonal · 7 flujo horizontal · 8 pulso de luz
 */
const vertex = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec4 color;
attribute vec4 motion;
attribute vec4 param;

uniform mat4 world;
uniform mat4 viewProjection;
uniform float uTime;
uniform float uScale;
uniform float uSize;
uniform float uAssemble;
uniform float uIntensity;
uniform vec2 uFrame;
uniform vec3 uPointer;

varying vec4 vColor;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

vec2 wrapFrame(vec2 p, vec2 hf) {
  return mod(p + hf, hf * 2.0) - hf;
}

void main(void) {
  vec3 p = position;
  float t = uTime;
  float type = motion.x;
  float seed = motion.y;
  float spd = motion.z;
  float alpha = color.a;
  vec2 hf = uFrame * 0.5;

  // Temblor mínimo: la imagen "respira" como algo recordado
  p.xy += vec2(sin(t * 0.7 + seed * 40.0), cos(t * 0.6 + seed * 31.0)) * 0.012;

  if (type < 0.5) {
    // quieto
  } else if (type < 1.5) {
    // titileo
    alpha *= 0.45 + 0.55 * (0.5 + 0.5 * sin(t * spd + seed * 60.0));
  } else if (type < 2.5) {
    // subir y reaparecer abajo
    float h = uFrame.y;
    float y = mod(p.y + hf.y + t * spd, h);
    p.y = y - hf.y;
    p.x += sin(t * 0.8 + seed * 20.0) * 0.12;
    alpha *= smoothstep(0.0, 0.18 * h, y) * smoothstep(h, 0.7 * h, y);
  } else if (type < 3.5) {
    // balanceo: más amplio cuanto más lejos de la base
    float k = max(p.y - param.y, 0.0);
    p.x += sin(t * spd + p.y * 0.5 + param.x + seed * 0.6) * k * 0.05;
  } else if (type < 4.5) {
    // deriva en grupo (bancos de peces, cartas, estrellas)
    p.x += sin(t * spd * 0.5 + param.x) * param.z;
    p.y += sin(t * spd * 0.8 + param.x * 1.7) * param.w;
    p.y += sin(t * 3.0 + seed * 30.0 + p.x * 2.0) * 0.02;
  } else if (type < 5.5) {
    // órbita alrededor de un centro, con achatamiento (discos)
    vec2 c = param.xy;
    vec2 d = p.xy - c;
    d.y /= param.z;
    float r = length(d);
    float w = param.w < 0.5 ? spd : spd / pow(max(r, 0.6), 1.5);
    float a = atan(d.y, d.x) + t * w;
    d = vec2(cos(a), sin(a)) * r;
    d.y *= param.z;
    p.xy = c + d;
    // modo "frente": solo se ve la mitad que pasa por delante del centro
    if (param.w > 1.5) alpha *= smoothstep(0.08, -0.22, d.y);
  } else if (type < 6.5) {
    // caída diagonal (estrellas fugaces), la capa entera se desplaza y reaparece
    vec2 dir = normalize(vec2(-0.75, -0.55));
    p.xy = wrapFrame(p.xy + dir * t * spd, hf);
    alpha *= smoothstep(0.0, 0.8, hf.x - abs(p.x)) * smoothstep(0.0, 0.8, hf.y - abs(p.y));
  } else if (type < 7.5) {
    // flujo horizontal lento (nubes, niebla)
    p.x = mod(p.x + hf.x + t * spd, uFrame.x) - hf.x;
    alpha *= smoothstep(0.0, 1.2, hf.x - abs(p.x));
  } else {
    // pulso de luz
    alpha *= 0.6 + 0.4 * (0.5 + 0.5 * sin(t * spd + param.x + seed * 2.0));
  }

  // El cursor aparta las partículas suavemente
  if (uPointer.z > 0.001) {
    vec2 d = p.xy - uPointer.xy;
    float dd = dot(d, d);
    p.xy += normalize(d + 1e-4) * uPointer.z * 0.55 * exp(-dd * 1.3);
  }

  // Formación: desde una nube dispersa hasta la imagen
  float a = clamp(uAssemble * 1.7 - seed * 0.7, 0.0, 1.0);
  a = a * a * (3.0 - 2.0 * a);
  vec3 dir3 = normalize(vec3(hash(seed * 91.7) - 0.5, hash(seed * 37.3) - 0.5, hash(seed * 13.1) - 0.5) + 1e-4);
  vec3 scattered = p + dir3 * (4.0 + hash(seed * 7.9) * 10.0);
  p = mix(scattered, p, a);
  alpha *= mix(0.2, 1.0, a);

  // Ya formada, la imagen no se sale del fotograma
  float inside = step(abs(p.x), hf.x) * step(abs(p.y), hf.y);
  alpha *= mix(1.0, inside, a);

  gl_Position = viewProjection * world * vec4(p, 1.0);
  gl_PointSize = clamp(motion.w * uSize * uScale / gl_Position.w, 1.0, 64.0);
  vColor = vec4(color.rgb * uIntensity, alpha);
}
`;

const fragment = /* glsl */ `
precision highp float;
varying vec4 vColor;

void main(void) {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float m = smoothstep(1.0, 0.2, d);
  float a = vColor.a * m;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}
`;

Effect.ShadersStore['memoryPointsVertexShader'] = vertex;
Effect.ShadersStore['memoryPointsFragmentShader'] = fragment;

export const MEMORY_POINTS_SHADER = 'memoryPoints';
