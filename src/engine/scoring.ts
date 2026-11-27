/** Star rating: compares the moves used with the optimal solution (par). */
export type Stars = 1 | 2 | 3;
export const MAX_STARS = 3;

/** Extra moves over par still worth two stars. */
export function twoStarMargin(par: number): number {
  return Math.max(2, Math.round(par * 0.3));
}

export function starsFor(moves: number, par: number | undefined): Stars {
  if (par === undefined || moves <= par) return 3;
  return moves <= par + twoStarMargin(par) ? 2 : 1;
}
