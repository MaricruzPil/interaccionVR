# 3.2 Interacción virtual

Laboratorio web estático para clasificar veinte piezas geométricas mediante seguimiento de manos en WebXR. Es la ampliación de la práctica 3.1 que se encuentra en `C:\Users\maric\Downloads\cubosVR`; esa carpeta es referencia y no forma parte de este proyecto.

## Estado honesto

La primera implementación integrada está en `3.2`. La vista previa de escritorio está preparada para observar la caída, el reposo, los rebotes y las colisiones. La sesión `immersive-vr`, el gesto de pinza y el hand tracking genuino quedan **NO PROBADOS** hasta ejecutar la aplicación en un Meta Quest 3 mediante HTTPS.

## Ejecutar sin Node.js

1. Abre esta carpeta en Visual Studio Code.
2. Instala la extensión Live Server.
3. Abre `index.html` con **Open with Live Server**.
4. Comprueba la vista previa en escritorio.
5. Para la prueba VR, abre la URL HTTPS en Meta Quest 3 y pulsa **Entrar en VR**.

Para GitHub Pages: publica el repositorio desde `main` y la carpeta `/(root)` en Settings → Pages → Deploy from a branch. Todas las rutas del proyecto son relativas; Three.js, cannon-es, Bootstrap y las fuentes se cargan desde CDN HTTPS.

## Dependencias fijadas

- Three.js `0.160.0`, importado desde un import map de unpkg.
- cannon-es `0.20.0`, importado desde jsDelivr como módulo ESM.
- Bootstrap `5.3.3`, usado únicamente en la portada web.
- WebXR y WebXR Hand Input son APIs del navegador; no se afirma compatibilidad de manos en escritorio.

## Arquitectura

```text
index.html + styles.css        portada responsiva y controles de inspección
js/config.js                   categorías, posiciones, estados y constantes
js/physics.js                  World de cannon-es y cuerpos estáticos/dinámicos
js/scene.js                    laboratorio 3D, mesas, recipientes, piezas y HUD
js/input.js                    raycasting, pinza, doble mano y botones 3D
js/game.js                     reglas, cronómetro, estados y puntuación
js/audio.js                    confirmaciones sonoras locales sin assets externos
js/main.js                     arranque Three.js/WebXR y bucle de actualización
```

Cada pieza es un registro único que relaciona `id`, `categoryId`, `mesh`, `body`, `state`, `tableId`, `assignedBinId` y su intento actual. La malla nunca se mueve por separado: en cada paso se sincroniza desde el cuerpo de cannon-es. Mientras se sujeta, el cuerpo pasa a cinemático y sigue la posición de la mano; al soltar vuelve a dinámico con una velocidad limitada.

La validación no cuenta un contacto aislado. La pieza debe entrar por la boca, quedar dentro del volumen interior útil, corresponder al recipiente y permanecer por `0.55 s` con velocidad lineal y angular bajas. Al validar se cambia a estática para que permanezca visible dentro del bote. `piece.errorReported` y `assignedBinId` impiden dobles registros; un nuevo agarre abre un nuevo intento explícito.

## Escena y física

- Cuatro mesas físicas, cinco piezas por mesa y veinte piezas totales.
- Cuatro categorías: esferas, cubos, pirámides y prismas hexagonales; cinco ejemplares de cada una.
- Cuatro recipientes abiertos con base y cuatro paredes físicas separadas.
- Gravedad `-9.81 m/s²`, paso fijo cercano a `1/60 s`, acumulador limitado a seis subpasos.
- Fricción, restitución, sueño de cuerpos y solver de `12` iteraciones.
- La pirámide usa `ConvexPolyhedron`; el prisma usa el `Cylinder` de cannon-es orientado sobre el eje Y.
- El tiempo de cada bote empieza al comenzar la partida y se registra cuando su quinta pieza correcta se estabiliza. Una salida de VR pausa el cronómetro; volver a entrar lo reanuda.

## Pruebas de aceptación

| Requisito | Procedimiento | Resultado observado | Evidencia |
| --- | --- | --- | --- |
| 1. Portada, favicon y créditos | Abrir `index.html` en Live Server | Implementado en código; pendiente de revisión visual completa | `index.html`, `styles.css`, `favicon.svg` |
| 2. WebXR immersive-vr en Quest 3 | Entrar desde GitHub Pages HTTPS | **NO PROBADO** | Requiere Meta Quest 3 |
| 3. Ambas manos y pinza | Pellizcar con mano izquierda y derecha | **NO PROBADO** | Grabación pendiente |
| 4. Cuatro mesas y cinco piezas por mesa | Contar objetos antes de comenzar | Implementado en código; no ejecutado | Captura pendiente |
| 5. Veinte piezas, cinco por categoría | Contar categorías en el panel y escena | Implementado en código; no ejecutado | Captura pendiente |
| 6. Reinicio con configuración distinta | Pulsar Reiniciar dos veces | Implementado; no ejecutado | Dos capturas pendientes |
| 7. Botes abiertos y rotulados | Inspeccionar boca, base y paredes | Implementado en código; no ejecutado | Captura pendiente |
| 8. Caída, reposo, rebote y fricción | Observar piezas tras iniciar | **NO PROBADO** en navegador | Captura o grabación pendiente |
| 9. Colisiones entre piezas y botes | Lanzar una pieza hacia una pared y otra pieza | **NO PROBADO** en navegador | Grabación pendiente |
| 10. Recuperación de dinámica al soltar | Agarrar, mover y soltar | **NO PROBADO** en visor | Grabación pendiente |
| 11. Solo un objeto estable suma | Dejar una pieza correcta dentro del bote | **NO PROBADO** en visor | Panel antes/después pendiente |
| 12. Tres depósitos erróneos | Usar tres recipientes equivocados | **NO PROBADO** en visor | Avisos y panel pendientes |
| 13. Recuperar pieza del piso | Soltar fuera de un bote y volver a agarrar | **NO PROBADO** en visor | Grabación pendiente |
| 14. Progreso 0/20 y 0/5 a 20/20 y 5/5 | Completar la partida | **NO PROBADO** | Panel final pendiente |
| 15. Tiempos, intentos, precisión y errores | Comparar fórmula con el panel | Implementado en código; no ejecutado | Registro pendiente |
| 16. Cronómetro detenido al completar | Terminar la pieza 20 y esperar | **NO PROBADO** | Captura de tiempo final pendiente |
| 17. Reinicio de métricas | Reiniciar después de una partida | Implementado; no ejecutado | Captura pendiente |
| 18. Sin errores críticos de carga | Revisar consola y vista previa | **NO PROBADO** en navegador | Export de consola pendiente |
| 19. URLs públicas | Publicar rama `main` en Pages | Pendiente de repositorio | URL GitHub y Pages pendientes |
| 20. Problemas y conclusiones del alumno | Documentar dos problemas reales y conclusiones | Pendiente de prueba de campo | Entrega académica pendiente |

## Referencias técnicas

- [Ejemplo Three.js: WebXR hand input pointer drag](https://threejs.org/examples/webxr_vr_handinput_pointerdrag.html)
- [Meta Horizon OS: WebXR Hands](https://developers.meta.com/vr/documentation/web/webxr-hands/)
- [cannon-es: documentación y ejemplos](https://pmndrs.github.io/cannon-es/)

## Créditos y limitaciones pendientes

Autor: Maricruz Pineda Lara. La práctica conserva el enfoque de portada, VRButton, modelos de manos y puntero de `cubosVR`, pero cambia la simulación artesanal por cannon-es. Sigue pendiente una prueba con dispositivo real, capturas de los veinte casos de aceptación, revisión de rendimiento en Quest 3 y publicación final en GitHub Pages.
