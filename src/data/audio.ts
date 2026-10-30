/**
 * Registro de audio. Los archivos los aporta el autor del proyecto:
 * colócalos en public/audio/ con estos nombres (o cambia las rutas aquí).
 * Si un archivo no existe, la experiencia sigue en silencio sin romperse.
 */

export interface TrackDefinition {
  id: string;
  /** Ruta relativa a /public. */
  src: string;
  loop: boolean;
  /** Volumen propio de la pista (0–1). */
  volume: number;
}

export const MUSIC: Record<string, TrackDefinition> = {
  origin: { id: 'origin', src: 'audio/musica/origen.mp3', loop: true, volume: 0.9 },
  // Cinta cinematográfica: una pista por universo
  'la-la-land': { id: 'la-la-land', src: 'audio/musica/la-la-land.mp3', loop: true, volume: 0.85 },
  'rey-leon': { id: 'rey-leon', src: 'audio/musica/rey-leon.mp3', loop: true, volume: 0.85 },
  alicia: { id: 'alicia', src: 'audio/musica/alicia.mp3', loop: true, volume: 0.85 },
  mario: { id: 'mario', src: 'audio/musica/mario.mp3', loop: true, volume: 0.85 },
  nemo: { id: 'nemo', src: 'audio/musica/nemo.mp3', loop: true, volume: 0.85 },
  interstellar: { id: 'interstellar', src: 'audio/musica/interstellar.mp3', loop: true, volume: 0.85 },
  'kung-fu-panda': { id: 'kung-fu-panda', src: 'audio/musica/kung-fu-panda.mp3', loop: true, volume: 0.85 },
};

/**
 * Efectos de sonido del diorama (todos opcionales: si falta el archivo, no suena y no pasa nada).
 * 'seleccion' y 'soltar' son generales; el resto, uno por objeto (campo `sound` del catálogo).
 */
export const SFX: Record<string, TrackDefinition> = {
  'seleccion': { id: 'seleccion', src: 'audio/efectos/seleccion.mp3', loop: false, volume: 0.7 },
  'soltar': { id: 'soltar', src: 'audio/efectos/soltar.mp3', loop: false, volume: 0.7 },
  'consola': { id: 'consola', src: 'audio/efectos/consola.mp3', loop: false, volume: 0.7 },
  'peluche': { id: 'peluche', src: 'audio/efectos/peluche.mp3', loop: false, volume: 0.7 },
  'bicicleta': { id: 'bicicleta', src: 'audio/efectos/bicicleta.mp3', loop: false, volume: 0.7 },
  'balon': { id: 'balon', src: 'audio/efectos/balon.mp3', loop: false, volume: 0.7 },
  'audifonos': { id: 'audifonos', src: 'audio/efectos/audifonos.mp3', loop: false, volume: 0.7 },
  'caja-musical': { id: 'caja-musical', src: 'audio/efectos/caja-musical.mp3', loop: false, volume: 0.7 },
  'yoyo': { id: 'yoyo', src: 'audio/efectos/yoyo.mp3', loop: false, volume: 0.7 },
  'figura-accion': { id: 'figura-accion', src: 'audio/efectos/figura-accion.mp3', loop: false, volume: 0.7 },
  'muneca': { id: 'muneca', src: 'audio/efectos/muneca.mp3', loop: false, volume: 0.7 },
  'lego': { id: 'lego', src: 'audio/efectos/lego.mp3', loop: false, volume: 0.7 },
  'dinosaurio': { id: 'dinosaurio', src: 'audio/efectos/dinosaurio.mp3', loop: false, volume: 0.7 },
};
