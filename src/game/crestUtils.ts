import type { CrestState, Player } from './types'

/**
 * A player may have at most one crest per card ID.
 * Reapplying a crest does not reset its countdown or activation history.
 */
export function grantUniqueCrest(player: Player, crest: CrestState): CrestState[] {
  const existing = player.crests ?? []
  if (existing.some(item => item.id === crest.id)) return existing
  return [...existing, crest]
}
