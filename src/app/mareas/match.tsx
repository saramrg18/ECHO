import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { SEAS, seaReached, type SeaId } from '../../mareas/engine';
import { useMareas } from '../../mareas/state/MareasState';
import { MatchScreen } from '../../mareas/ui/MatchScreen';

export default function MatchRoute() {
  const { sea, tutorial } = useLocalSearchParams<{ sea?: string; tutorial?: string }>();
  const { save } = useMareas();
  const id = (SEAS.some((s) => s.id === sea) && seaReached(save.shells, sea as SeaId) ? sea : 'laguna') as SeaId;
  return <MatchScreen key={id} sea={id} tutorial={tutorial === '1'} />;
}
