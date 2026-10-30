import type { SceneDefinition } from '../types';
import { alicia } from './alicia';
import { interstellar } from './interstellar';
import { kungFuPanda } from './kungFuPanda';
import { laLaLand } from './laLaLand';
import { mario } from './mario';
import { nemo } from './nemo';
import { reyLeon } from './reyLeon';

/** Orden de los fotogramas en la cinta. Para reordenar, cambia este arreglo. */
export const CINEMA_SCENES: SceneDefinition[] = [laLaLand, reyLeon, alicia, mario, nemo, interstellar, kungFuPanda];
