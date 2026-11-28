/** The guided first match: short steps in plain Spanish. */
import type { CardId, MatchState } from '../engine';

export interface TutorialStep {
  text: string;
  /** Freeze the match while this step is shown. */
  pause: boolean;
  button?: string;
  /** The step ends when the player plays this card. */
  waitCard?: CardId;
  /** Or when this returns true (gets the seconds since the step started). */
  until?: (s: MatchState, elapsed: number) => boolean;
  focus?: 'clock';
}

export const TUTORIAL: TutorialStep[] = [
  {
    text: '¡Bienvenida a MAREAS! 🗼 Arriba está el faro rival (morado) y abajo el tuyo (naranja). Gana quien apague antes el faro del otro.',
    pause: true,
    button: 'Siguiente',
  },
  {
    text: 'En medio hay islas pequeñas. Si conquistas una 💎 Perla, ganas energía más rápido. Si conquistas una 🏰 Roca, su cañón te defiende.',
    pause: true,
    button: 'Siguiente',
  },
  {
    text: 'La marea cambia cada 20 segundos (mira el reloj). Con la marea BAJA 🏖️ aparecen caminos de arena entre las islas, y cada vez son distintos.',
    pause: true,
    button: 'Siguiente',
    focus: 'clock',
  },
  {
    text: 'Toca la carta Cangrejos y luego la 💎 isla del centro. Irán por la arena, la conquistarán y se quedarán a defenderla.',
    pause: true,
    waitCard: 'cangrejos',
  },
  {
    text: '¡Bien! Ojo: si sube la marea y siguen en un camino de arena, se ahogan. En las islas siempre están a salvo.',
    pause: false,
    until: (s) => s.tide === 'high' && s.water > 0.5,
  },
  {
    text: '¡Subió la marea 🌊! Ahora los barcos navegan por donde quieran. Toca la carta Bote y luego la isla rival 🎯 para atacar su faro.',
    pause: true,
    waitCard: 'bote',
  },
  {
    text: 'Fíjate: bajo el agua se ven los caminos que se abrirán en la próxima marea baja. Así puedes planear tu jugada.',
    pause: false,
    until: (_s, t) => t > 7,
  },
  {
    text: 'Truco: si juegas una carta con la marea "equivocada", espera en tu isla hasta que pueda salir. ¡Ahora el rival también juega. Apaga su faro!',
    pause: true,
    button: '¡A jugar!',
  },
];
