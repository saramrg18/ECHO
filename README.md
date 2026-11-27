# HEXFORT

Estrategia por turnos en 3D low-poly (React Native + Expo + TypeScript + three.js / react-three-fiber).
Conquista casillas de un mapa hexagonal, construye torres con cartas y combínalas para ganar sinergias.
Ganas al capturar el castillo rival.

- **Turno**: recibes tropas (colócalas en tus casillas), mueves cada casilla una vez (siempre se queda 1 tropa) y juegas cartas con energía.
- **Combate**: si atacas con más tropas que la defensa (tropas + bonus de torre, castillo, bosque o colina), conquistas; si no, desgastas al defensor.
- **Cartas**: torres (guardia, arqueros, cuartel, mina, catapulta) y hechizos (refuerzos, bola de fuego, escudo, grito de guerra, terremoto).
- **Sinergias**: torres vecinas se potencian (Muralla, Fortín, Campamento, Armería, Filón, Artillería).
- **Campaña**: 5 mapas; cada victoria desbloquea cartas nuevas para tu mazo de 12.

Código: `src/hexfort/engine` (motor puro en TS, con tests e IA), `src/hexfort/three` (tablero 3D, modelos generados en código),
`src/hexfort/ui` y rutas en `src/app/index.tsx` y `src/app/hexfort/`. El juego anterior, ECHO, sigue disponible en `/echo`.

---

# ECHO

Juego de estrategia y lógica para iOS y Android (React Native + Expo + TypeScript).
Lleva tu pieza a la salida sabiendo que **cada movimiento se repite tres turnos después**.

## Ejecutar

```bash
npm install
npx expo start        # escanea el QR con Expo Go (iOS / Android)
npm test              # motor, niveles, progreso
npm run typecheck
npm run lint
```

## Reglas

- En el turno `t` primero se ejecuta tu movimiento y después el eco del movimiento del turno `t-3`.
- Un movimiento propio contra un obstáculo se rechaza y no gasta turno. Un eco que choca se pierde.
- Llegar a la salida (tú o tu eco) gana al instante.
- Si el nivel tiene límite de movimientos y se agota, se pierde (se puede deshacer).

## Ayudas al jugador

- **Estrellas**: 3 si igualas el óptimo (`par`, verificado por el solver), 2 si te pasas poco y 1 en otro caso.
- **Vista previa fantasma**: al mantener pulsada una flecha (o pasar el ratón por encima), o mientras deslizas, se ve dónde acabará la pieza (naranja) y dónde la deja el eco (cyan). Si deslizas de vuelta al punto de partida, el movimiento se cancela.
- **Pistas**: 3 por nivel. Calculan el siguiente movimiento óptimo desde la posición actual, o avisan si ya no se puede ganar.

## Arquitectura

```
src/
  engine/      Motor puro en TypeScript (sin React Native). Se prueba con Jest.
    types.ts         Estructuras de datos: tablero, casillas, ecos, estado
    level-parser.ts  Niveles en ASCII → Level (registro de glifos ampliable)
    tiles.ts         Registro de comportamientos de casilla (registerTile)
    movement.ts      Sistema de movimientos (un paso)
    echo-queue.ts    Sistema de repetición (cola de ecos)
    game.ts          Estado de la partida, turnos, deshacer, reiniciar
    solver.ts        BFS: garantiza que cada nivel tiene solución
    scoring.ts       Estrellas según movimientos y par
    assist.ts        Vista previa de movimientos y pistas
  levels/      30 niveles como datos, en 3 bloques
  progress/    Progreso del jugador (lógica pura)
  settings/    Ajustes del usuario
  storage/     Persistencia local (AsyncStorage)
  state/       Contexto global: progreso + ajustes guardados
  game/        Hook useGame: une motor, UI y feedback
  feedback/    Sonido (expo-audio) y vibración (expo-haptics)
  ui/          Tema, tablero animado, controles, componentes
  app/         Pantallas (Expo Router): inicio, niveles, juego, ajustes
scripts/       Herramientas de diseño de niveles y sonidos
```

### Leyenda de los mapas

| Glifo | Casilla |
|---|---|
| `#` | pared |
| `.` | suelo |
| `S` | inicio |
| `E` | salida |
| `a`–`d` | interruptor del grupo a–d |
| `A`–`D` | puerta cerrada del grupo |
| `1`–`4` | puerta abierta del grupo a–d |
| `%` | suelo que se derrumba al abandonarlo |
| `*` | silencio: borra los ecos pendientes |
| `^ > v <` | sentido único |

### Añadir mecánicas

Una casilla nueva se añade con `registerTile(kind, behavior)` y `registerGlyph(char, tile)`,
sin tocar el núcleo de turnos. El retraso del eco (`echoDelay`) es configurable por nivel.

### Diseñar niveles

```bash
npx tsx scripts/lab.ts niveles.json             # solución óptima y estadísticas
npx tsx scripts/generate.ts doors2 10 1234      # busca candidatos aleatorios
npx tsx scripts/make-sounds.ts                  # regenera los sonidos
```

Los tests (`src/levels/__tests__`) comprueban que los 30 niveles tienen solución dentro de su límite.
