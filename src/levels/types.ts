import type { LevelDefinition } from '../engine';

export interface WorldDefinition {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly levels: readonly LevelDefinition[];
}
