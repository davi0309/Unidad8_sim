# Audio

Coloca aquí los archivos de audio. Las rutas se configuran en `src/data/audio.ts`.

```
public/audio/
  musica/
    origen.mp3        ← Big Bang (también acompaña la etapa de infancia)
    la-la-land.mp3    ← fotograma I   · Una noche que suena
    rey-leon.mp3      ← fotograma II  · El amanecer de todo
    alicia.mp3        ← fotograma III · Una merienda imposible
    mario.mp3         ← fotograma IV  · Un mundo para jugar
    nemo.mp3          ← fotograma V   · Lo que vive bajo el agua
    interstellar.mp3  ← fotograma VI  · Más allá del tiempo
    kung-fu-panda.mp3 ← fotograma VII · La cima entre la niebla
  efectos/            ← efectos del diorama (todos opcionales)
    seleccion.mp3     ← al seleccionar un recuerdo
    soltar.mp3        ← al soltarlo después de arrastrarlo
    consola.mp3       ← al tocar cada objeto (nombre = id del objeto)
    peluche.mp3
    bicicleta.mp3
    balon.mp3
    audifonos.mp3
    caja-musical.mp3
    yoyo.mp3
    figura-accion.mp3
    muneca.mp3
    lego.mp3
    dinosaurio.mp3
```

- Formatos recomendados: `.mp3` u `.ogg`.
- Los efectos deben ser cortos (menos de 2 s). Si falta uno, ese toque simplemente no suena.
- Si un archivo de música no existe, ese escenario queda en silencio (la canción anterior se desvanece) sin errores.
- Para cambiar el nombre o el volumen de una pista, edita `src/data/audio.ts`.
