# PROJECT_CONTEXT — Donde viven los recuerdos

## Estado actual
- **Fase 1 — Prototipo de interacción:** validada por el usuario.
- **Fase 2 — Big Bang:** validada por el usuario.
- **Fase 3 — Cinta cinematográfica:** validada por el usuario.
- **Fase 4 — Generación procedural del diorama (Etapa 3 "Nuestro rincón"):** validada por el usuario.
- **Fase 5 — Interacción del diorama + vida en los dioramas:** implementada y probada. Pendiente de validación.

## Stack
Babylon.js 9 · TypeScript 7 · Vite 8 · GSAP 3 · Web Audio API · HTML/CSS · WebGL.
Despliegue: GitHub Pages vía GitHub Actions (`.github/workflows/deploy.yml`), `base: './'`.

## Estructura
```
src/
  main.ts                    Punto de entrada (carga loader glTF y estilos)
  core/
    Experience.ts            Motor, escena, cámara, glow, audio, campo de partículas, etapas, paralaje
    StateManager.ts          5 etapas (origin, childhood, cinemaJourney, diorama, ending); solo avanza
  stages/
    StageBase.ts             Contrato común: enter / update / dispose; contexto { complete, setParallax }
    OriginStage.ts           Etapa 0: Big Bang
    ChildhoodStage.ts        Etapa 1: objetos de infancia y selección
    CinemaJourneyStage.ts    Etapa 2: cinta cinematográfica (vuelo, navegación, acercarse, música, registro)
    DioramaStage.ts          Etapa 3: plan procedural → plantilla, acentos, objetos; construcción por partículas
  entities/
    MemoryObject.ts          Objeto flotante de la infancia
    placeholders.ts          Modelos provisionales estilo "arcilla"
    FilmStrip.ts             Cinta curva: banda negra, perforaciones blancas redondeadas (thin instances), nodos de fotograma
    BokehBackdrop.ts         Fondo de círculos de luz (nítidos y desenfocados) que aparece poco a poco
    CinematicScene.ts        Un fotograma: plano base + capas de partículas generadas desde datos
    PointLayer.ts            Pinta una capa en canvas 2D y la convierte en puntos (muestreo por pintura)
    objectVisual.ts          Figura de un objeto de infancia (.glb o provisional) para usar fuera de la selección
    diorama/
      DioramaKit.ts          Herramientas de construcción (primitivas, materiales, sombras) + tipos Anchor/TemplateBuild
      templates.ts           4 plantillas (geometría) + ANCHORS (lugares para objetos con etiquetas y prioridad)
      motifs.ts              Elementos que deja cada universo (farola, acacia, farol de papel, hongo, coral, planeta, pagoda)
  shaders/
    memoryPoints.ts          Shader de puntos: 9 movimientos en GPU, formación, recorte al fotograma, cursor
  systems/
    AudioManager.ts          Web Audio: música con crossfade, efectos, nivel, mute
    ParticleSystem.ts        MemoryParticleField: campo persistente del Big Bang
    MemorySystem.ts          Selección de objetos + estadísticas de escenarios
    ExperienceTracker.ts     timeSpent, visitCount, interactionCount, lastVisit (invisible)
    InteractionSystem.ts     Picking hover/clic genérico
    WorldGenerator.ts        Generador procedural puro (sin Babylon): pesos, plantilla, acentos, ubicaciones
    DioramaEditor.ts         Edición del diorama: seleccionar, arrastrar sobre superficies, girar, escalar,
                             restablecer, efectos al tocar (+ sonidos), resaltado; delega la órbita a la etapa
  data/
    types.ts                 Tipos de objetos, memoria, SceneLayer, SceneDefinition
    audio.ts                 Registro de pistas (origen + 7 universos) y efectos de sonido (SFX)
    objects/childhood.ts     Catálogo de 11 objetos
    scenes/                  7 escenarios (uno por archivo) + index.ts con el orden de la cinta
                             (cada uno con affinity, palette, light, motif para el diorama)
    dioramas/index.ts        Datos de las 4 plantillas (cielo, luces, niebla) + GENERATOR_CONFIG + preferencias por categoría
  ui/UIManager.ts            Intro, destello, pista, puntos, continuar, flechas retro, intertítulo, debug,
                             herramientas del diorama (girar/escalar) y botón "restablecer"
  utils/paint.ts             Painter (formas en canvas 2D) + generador aleatorio con semilla
  utils/textures.ts          Textura de punto de luz
public/audio/LEEME.md        Nombres de archivo de cada canción
```

## Flujo actual
1. **Pantalla inicial** → clic desbloquea audio.
2. **Etapa 0 – Origen** (~22 s): punto de luz, acumulación, explosión, enfriamiento lento del color.
3. **Etapa 1 – Infancia**: los objetos nacen de partículas; se eligen hasta 5; al cerrar todo se desvanece
   (objetos, bokeh y polvo, sin cortes).
4. **Etapa 2 – Cinta cinematográfica**:
   - Vuelo de 7 s: la cámara cruza el campo de partículas hasta una cinta de película suspendida (z ≈ 72).
     Fondo y niebla se funden a un azul casi negro. El primer fotograma se forma desde partículas durante el vuelo.
   - 7 fotogramas en orden: La La Land · Rey León · Alicia · Mario · Nemo · Interstellar · Kung Fu Panda.
     Cada uno es una imagen 2D hecha de partículas (≈27 000–40 000 por escenario) con movimiento propio
     (titileo, olas, órbitas, peces, estrellas fugaces, nubes que fluyen...).
   - Navegación: flechas retro a los lados, ← → del teclado, o clic en un fotograma vecino.
     Clic en la imagen actual / Enter / ↑ = acercarse (la imagen llena la pantalla). Esc / ↓ = volver a la cinta.
     Mover el cursor sobre la imagen aparta las partículas.
   - Estilo de la cinta (según referencia del usuario): banda negra pura, 11 perforaciones blancas de esquinas
     redondeadas por fotograma arriba y abajo, fotogramas separados por una franja negra delgada (spacing 16.7).
     La vista de cinta muestra el fotograma actual y parte de sus vecinos (stripViewFactor 2.3).
   - Fondo: al llegar, el espacio oscuro se transforma en ~22 s en un azul índigo (#252262) con círculos de luz
     de colores (rojo, azul claro, lima, violeta, amarillo) que derivan despacio; las estrellas se apagan.
   - Los fotogramas se forman al acercarse por primera vez; los lejanos se atenúan.
   - Intertítulo abajo: número romano + título propio de cada escenario.
   - Música: al detenerse 0.4 s en un fotograma suena su canción con crossfade de 2.5 s.
   - "continuar" aparece cuando el usuario se detuvo al menos una vez en los 7. Al pulsarlo,
     los escenarios se deshacen en partículas y comienza el diorama.

5. **Etapa 3 – Nuestro rincón (diorama)**:
   - Al pulsar "continuar" en la cinta: los escenarios se deshacen en partículas, la cinta, el fondo de luces
     y las estrellas se apagan (≈6 s). Luego la cámara vuela (6.5 s) a una vista elevada del diorama.
   - El cielo y la niebla pasan al color de la plantilla; las luces suben con un tinte de los universos visitados.
   - Construcción por partículas: el campo del Big Bang se agrupa donde va cada pieza y la pieza aparece:
     base (2.2 s) → estructuras (4.2 s) → detalles (6 s) → elementos de los universos (7.6 s, cada 0.35 s)
     → objetos de infancia en su orden de selección (9.4 s, cada 1.3 s).
   - Al terminar: intertítulo "nuestro rincón · <nombre de la plantilla>" y se activa la edición (Fase 5).
     La "vida" del diorama (partículas) arranca cuando aparecen los detalles.
6. **Edición del diorama (Fase 5)**:
   - Pasar el mouse resalta el elemento (crema); clic lo selecciona (dorado), muestra el panel con su nombre y
     reproduce su efecto + sonido. Clic en el vacío o Esc deselecciona.
   - Arrastrar un recuerdo: se levanta, sigue al cursor apoyándose en la superficie que haya debajo (suelo,
     mesa, cama, rocas flotantes…) y al soltar cae con rebote, polvito y sonido "soltar". No puede salir del
     diorama (radio por plantilla o caja en la habitación), no cae por los acantilados y no "trepa" más de
     1.6 de golpe salvo que el cursor apunte directo a una superficie.
   - Lo que se pone sobre algo que flota (roca, islote) se mece con eso.
   - Girar: Q / E o botones ⟲ ⟳ (π/8). Escalar: + / − o botones (×1.12, entre 0.6× y 1.6× del tamaño original).
   - "restablecer": todo vuelve a su lugar con un saltito y la cámara a la vista inicial.
   - Cámara: arrastrar el fondo gira (inclinación 0.18–1.25), rueda acerca/aleja (10–30). La habitación solo
     gira ±1.2 rad (se mira desde su lado abierto). El vaivén automático se detiene al interactuar y vuelve
     solo tras 8 s sin tocar nada.
   - Efectos por objeto (`interaction` en el catálogo): bounce (balón, lego), squish (peluche), spin (figura,
     muñeca), glow (consola: destello de luz), notes (audífonos, caja musical: notas que suben), shake
     (dinosaurio), roll (bicicleta avanza y vuelve), yoyo (sube y baja girando). Los elementos de los
     universos dan un saltito.

## Generador procedural (WorldGenerator)
1. **Peso por universo:** `P_i = T_i + λ·V_i`, con `T_i = tiempo / tiempo máximo` y
   `V_i = (visitas − 1) / máximo de regresos`. λ = 0.6 (`GENERATOR_CONFIG.lambda`). Datos normalizados:
   el tiempo no domina; volver a un universo pesa por separado.
2. **Plantilla:** `puntaje_t = Σ P_i · afinidad(i, t)`; gana la mayor (desempate fijo: bosque, castillo, isla, habitación).
   Afinidades en cada archivo de escenario (`affinity`).
3. **Acentos:** los 3 universos de mayor peso dejan su elemento (`motif`) 1–3 veces según su participación,
   en lugares libres de la plantilla (orden propio de cada usuario por semilla). La luz se tiñe un 30 %
   con el promedio ponderado del color de luz de los universos.
4. **Objetos de infancia:** el primero elegido ocupa el lugar de mayor prioridad de la plantilla; los demás
   eligen por coincidencia entre su categoría y las etiquetas del lugar (`CATEGORY_PREFERENCES`) + prioridad.
   Escala según el orden (el primero es el más grande). Se apoyan sobre la superficie y miran al espectador.
5. Todo es determinista: los mismos datos dan el mismo diorama (semilla = hash de pesos + objetos).

Prueba unitaria (5 perfiles): La La Land+Interstellar → Habitación · Nemo → Isla · regresos a Alicia y Rey León
→ Bosque · Mario → Castillo · tiempo en Nemo + regresos a La La Land → Isla con 2 farolas.

## Plantillas
- **Castillo entre las nubes:** isla de nubes, castillo con 4 torres de techos rosados, ventanas encendidas,
  banderines, rocas y nubecitas flotantes. Cielo cálido.
- **Habitación bajo la luna:** cuarto en corte (piso + 2 paredes), ventana con luna, luz azulada con sombras,
  cama, escritorio con lámpara, repisa con libros, alfombra, estrellas en la pared, móvil.
- **Bosque de los recuerdos:** claro circular, árboles alrededor (frente libre), sendero de piedras hacia el
  espectador, tocón, roca con musgo, hongos, raíces, niebla baja.
- **Isla suspendida (rediseñada):** colores vivos (pasto verde intenso, roca cálida, mar turquesa, cielo celeste).
  Tres montañas violetas con falda verde y nieve **al costado izquierdo** (dejan ver el centro), con un saliente
  y terrazas de té. Aldea de **3 casitas chinas** (techos de jade, rojo y azul con aleros levantados, columnas
  rojas, ventanas redondas encendidas y farolitos rojos que se mecen; una de dos pisos) unidas por un sendero
  de piedras. Lago con orilla de arena, nenúfares y peces koi que saltan; cascada; muelle; cerezos en flor,
  árboles redondos, bambú, flores de colores. Islotes: uno con pabellón chino, otro con un cerezo.
  Vida: pétalos de cerezo al viento, cometa roja con cola, gaviotas, nubes, velero en el mar.

### Vida en los dioramas (Fase 5)
- **Castillo:** banderines ondeando, ventanas que titilan, nubecitas que orbitan, 3 pájaros en círculo,
  globo aerostático que da vueltas, destellos dorados en el aire.
- **Habitación:** cortinas que se mecen, tren de juguete (4 vagones) que recorre la alfombra echando humo,
  reloj de pared con agujas que giran, estrellas que titilan, lámpara que parpadea, polvo de luna.
- **Bosque:** árboles que se mecen con el viento, 3 mariposas aleteando, luciérnagas, hojas que caen girando.
- **Isla:** cascada de partículas, ondas en el lago, 3 gaviotas, 4 nubes que orbitan, velero que rodea la isla.
- **Elementos de los universos:** farola con polilla que gira alrededor de la luz, acacia que se mece,
  farol de papel que se balancea y titila, hongo que "respira", coral que ondula, planeta que gira con su
  anillo y una lunita, pagoda con campanita de viento.
- Las rocas/islotes flotantes se mecen según su posición; todo lo que lleva encima se mueve con ellas.
- Las animaciones viven en nodos internos: el nodo raíz de cada elemento queda libre para que el usuario lo edite.

## Registro de comportamiento (ExperienceTracker)
- Cuenta visita al quedarse ≥ 1.2 s en un fotograma (pasar de largo no cuenta).
- `timeSpent` usa el reloj real (no el de animación) y se pausa si la pestaña no está visible.
- `interactionCount`: +1 al acercarse; +1 por cada tramo de "remover" partículas con el cursor (con espera de 1.5 s).
- Volver a un escenario suma visitas aparte del tiempo (independientes, como pide el diseño).
- Nada de esto se muestra al usuario. El panel de depuración (tecla D) solo existe en desarrollo o con `?debug`.

## Escenarios (src/data/scenes)
Cada escenario es datos: una lista de capas `SceneLayer` con `draw(painter)` + parámetros de partículas.
Para cambiar uno, se edita su archivo; el motor no se toca.
Son reinterpretaciones: iluminación, paleta y ambiente de las referencias del usuario, sin personajes
de las películas/juegos, actores ni copia de afiches:
- La La Land (v2): cielo azul profundo → violeta, estrellas, montañas, alfombra de luces de ciudad, farola antigua
  a la izquierda. Sin la pareja ni textos del póster.
- Rey León (v2): cielo rojo-naranja, sol enorme con anillo de luz, nubes encendidas, risco, manadas
  (antílopes, elefantes, jirafas, rinocerontes), acacias, brasas. Sin personajes.
- Kung Fu Panda (nuevo, VII): cielo rojo → dorado, montañas kársticas en tres planos con niebla, templo de tres techos
  en un pico, roca al frente, aves y pétalos de durazno. Sin el personaje.
- Mario: hongos y estrellas genéricos sin rostros.

## Decisiones tomadas
- Selección de infancia definitiva (no se deselecciona); "continuar" tras el primer objeto; automático en 5.
- Cámara sin control libre hasta el diorama; paralaje leve. En la cinta, la etapa maneja la cámara y apaga el
  paralaje global. En el diorama la cámara orbita con límites (Fase 5).
- El castillo se mira desde el lado de su patio y escalinata (antes la cámara lo veía por detrás y las torres
  tapaban los recuerdos del patio).
- Decoraciones vivas (pájaros, tren, nubes, cortinas…) no se pueden seleccionar ni sirven de apoyo.
- Las imágenes se dibujan en `renderingGroupId = 1`: la curva de la cinta nunca tapa los bordes del fotograma.
- Si falta la canción de un escenario, la anterior se desvanece (silencio) en vez de seguir sonando.
- Enums no permitidos (`erasableSyntaxOnly` de TS 7): objetos `as const`; sin propiedades en parámetros de constructor.
- Atajos de desarrollo: `?etapa=infancia`, `?etapa=cinta`, `?etapa=diorama`. Calidad baja: `?calidad=baja`.
  Con `?etapa=diorama` se simula el recorrido: `&sim=nemo:60:1,la-la-land:10:4` (escenario:segundos:visitas)
  y `&obj=peluche,audifonos` (objetos en orden). Sin parámetros, inventa uno al azar.
- El teclado de la cinta se activa al inicio de la etapa (antes esperaba a que se pintaran todos los escenarios
  y en equipos lentos las flechas no respondían los primeros segundos).

## Pruebas realizadas (navegador headless, ~4 FPS por render por software)
- Flujo completo: infancia (2 objetos) → continuar → vuelo → cinta → 6 escenarios → regresar al primero →
  continuar → disolución → etapa completada. Sin errores en consola.
- Estadísticas: visitas, tiempo, regreso (v=2) e interacciones (acercarse y remover) registradas correctamente.
- Capturas de los 6 escenarios en vista de cinta y acercados.
- `npm run build` sin errores.
- Fase 5, en las 4 plantillas: arrastre real con el mouse (el recuerdo se mueve y queda apoyado en el suelo),
  panel con el nombre, Q + botones de girar/escalar (escala topa en 1.6×), efectos de todos los elementos a la
  vez, órbita con arrastre + rueda (la habitación topa en ±1.2), "restablecer" devuelve recuerdos y cámara.
  Un objeto llevado a la roca flotante (castillo) y al islote (isla) mantiene la misma distancia mientras se
  mecen. Sin errores en consola.

## Recursos
- Modelos: ninguno aún → placeholders (`public/models/x.glb` + `model: 'models/x.glb'`).
- Audio: faltan los 8 archivos de música (origen + 7 universos) y los 13 efectos opcionales del diorama
  (nombres en `public/audio/LEEME.md`).

## Pendiente
- Fase 6: último recuerdo (Diorama → Ending): "No podemos conservarlo todo" / "Pero siempre podemos elegir
  qué llevar con nosotros".
- SceneManager: no hizo falta; cada etapa administra sus recursos.

## Problemas conocidos
- Bundle de ~6 MB (1.3 MB gzip) por importar Babylon completo. Se optimiza en la Fase 7.
- ~200 000 partículas en la cinta: fluido con GPU dedicada o integrada moderna; en equipos muy lentos usar `?calidad=baja`.
