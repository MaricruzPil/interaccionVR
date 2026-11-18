# Plan de trabajo y diagnóstico de 3.2

## ETAPA 1 · Diagnóstico de la práctica 3.1

### Qué se conserva

- La portada web y el crédito de autor como referencia de contenido.
- Three.js como renderizador y la sesión `immersive-vr`.
- `VRButton`, `OculusHandModel` y `OculusHandPointerModel`.
- Raycasting del puntero y lectura del gesto `isPinched()`.
- Escala de habitación, iluminación de alto contraste y la idea de conservar velocidad al soltar.

### Problemas encontrados

- La práctica anterior mantiene cuerpos en un arreglo propio y resuelve colisiones con esferas envolventes.
- No existe un motor de cuerpos rígidos con cuerpos estáticos, cinemáticos y dinámicos.
- Las piezas no tienen una categoría persistente ni una regla de clasificación.
- No hay recipientes abiertos ni colisionadores separados de base y paredes.
- La puntuación, el cronómetro y los estados de error no están modelados.
- Todo está concentrado en un único `index.html`, lo que hace riesgoso cambiar la física sin afectar la entrada de manos.

### Riesgo principal

Cambiar `mesh.position` durante el agarre puede desincronizar representación y colisión. En 3.2 el cuerpo de cannon-es es la fuente de posición; el mesh solo se sincroniza después del paso físico.

## ETAPA 2 · Arquitectura elegida

Se eligió una estructura pequeña, sin bundler ni servidor:

- `config.js`: una sola definición de geometría, colores, estados, posiciones y constantes.
- `physics.js`: construcción del mundo, materiales, cuerpos y paso fijo.
- `scene.js`: visuales y colisionadores de mesas, piso, paredes, piezas, recipientes y panel 3D.
- `input.js`: entrada de manos, raycasting, pinza, doble agarre y botones 3D.
- `game.js`: estados por pieza, sujeción/liberación, validación, errores, tiempos y puntuación.
- `audio.js`: señales cortas de agarre, acierto, error y finalización.
- `main.js`: composición, WebXR, render loop y enlace con la portada.

La interfaz inicial usa Bootstrap 5.3.3. El HUD dentro del visor es una textura de canvas sobre geometría de Three.js, no HTML ni Bootstrap.

## Decisiones de interacción

Las categorías son esferas, cubos, pirámides y prismas hexagonales. Cada categoría tiene cinco ejemplares y cada mesa recibe al menos una pieza de cada categoría. El reinicio conserva la categoría y cambia la posición, orientación y pequeña perturbación aleatoria; de esta forma no se altera el conteo ni se puede crear una forma física incompatible con su malla.

El agarre se simplifica técnicamente a un único objeto por puntero. Una pieza con `heldBy` no puede ser seleccionada por la otra mano. Si el seguimiento desaparece, se libera con la última velocidad limitada. Si sale de los límites, el objetivo de la mano se recorta al volumen de interacción. No se ofrece teclado o ratón como sustituto del hand tracking real.

## ETAPAS 3–7

1. **ETAPA 3:** integración de cannon-es, gravedad, mesas, paredes, veinte cuerpos y recipientes abiertos. Implementada en `physics.js` y `scene.js`; validación de visor pendiente.
2. **ETAPA 4:** conexión de pinza, cuerpo cinemático y liberación dinámica. Implementada en `input.js` y `game.js`; validación en Quest 3 pendiente.
3. **ETAPA 5:** estados observables, clasificación después de reposo, errores, recuperación, panel 3D y cronómetro. Implementada en `game.js` y `scene.js`; casos reales pendientes.
4. **ETAPA 6:** portada, favicon, créditos, README y mensajes de compatibilidad. Implementada; falta revisión visual con navegador y captura.
5. **ETAPA 7:** publicación pública y prueba HTTPS en Meta Quest 3. Pendiente de repositorio y dispositivo.

## Revisión de aceptación pendiente

No se marca como completada ninguna prueba que requiera navegador o Meta Quest 3 desde este entorno. La matriz actual en `README.md` usa `NO PROBADO` cuando falta la evidencia. Las siguientes evidencias se deben adjuntar al terminar: vista del laboratorio, pieza cayendo, depósito correcto, depósito equivocado, recuperación desde piso, panel 20/20 y URL pública HTTPS.
