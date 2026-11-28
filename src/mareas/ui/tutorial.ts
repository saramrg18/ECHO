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
  focus?: 'clock' | 'top';
}

export const TUTORIAL: TutorialStep[] = [
  {
    text: '¡Bienvenida a MAREAS! 🗼 Arriba está el faro rival (morado) y abajo el tuyo (naranja). Gana quien apague antes el faro del otro.',
    pause: true,
    button: 'Siguiente',
  },
  {
    text: 'Entre las dos islas hay tres caminos de arena. La marea cambia cada 20 segundos, y este reloj te avisa de cuándo.',
    pause: true,
    button: 'Siguiente',
    focus: 'clock',
  },
  {
    text: 'Ahora la marea está BAJA 🏖️: la arena se ve y las criaturas pueden cruzar. Toca la carta Cangrejos y luego uno de los tres caminos.',
    pause: true,
    waitCard: 'cangrejos',
  },
  {
    text: '¡Bien! Tus cangrejos corren hacia el faro rival. Ojo: si sube la marea y siguen en la arena, se ahogan.',
    pause: false,
    until: (s) => s.tide === 'high' && s.water > 0.5,
  },
  {
    text: '¡Subió la marea 🌊! La arena está bajo el agua y es el turno de los barcos. Toca la carta Bote y luego un camino.',
    pause: true,
    waitCard: 'bote',
  },
  {
    text: 'Los barcos también tienen prisa: si baja la marea y siguen en mitad del camino, se quedan varados.',
    pause: false,
    until: (_s, t) => t > 6,
  },
  {
    text: 'Truco: si juegas una carta con la marea "equivocada", espera en tu playa hasta su marea. ¡Ahora el rival también juega. Apaga su faro!',
    pause: true,
    button: '¡A jugar!',
  },
];
