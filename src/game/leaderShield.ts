import type { ElementType, Player, Shield } from './types'

/** Leader shields share follower shield ordering: normal first, crystallize second. */
export function addLeaderShield(player: Player, amount: number, type: keyof Shield = 'normal'): Player {
  const current = player.leaderShield ?? { normal: 0, crystallize: 0 }
  return { ...player, leaderShield: {
    ...current, [type]: Math.min(10, current[type] + Math.max(0, amount)),
  }}
}

export type LeaderReaction =
  | 'vaporize' | 'melt' | 'overloaded' | 'superconduct' | 'frozen'
  | 'electro_charged' | 'burning' | 'bloom' | 'swirl' | 'crystallize'

export interface LeaderDamageResult {
  player: Player
  reaction: LeaderReaction | null
  reactedElement?: ElementType
}

function leaderReaction(attached: ElementType, incoming: ElementType): LeaderReaction | null {
  const pair = [attached, incoming]
  if (pair.includes('pyro') && pair.includes('hydro')) return 'vaporize'
  if (pair.includes('pyro') && pair.includes('cryo')) return 'melt'
  if (pair.includes('pyro') && pair.includes('electro')) return 'overloaded'
  if (pair.includes('cryo') && pair.includes('electro')) return 'superconduct'
  if (pair.includes('hydro') && pair.includes('cryo')) return 'frozen'
  if (pair.includes('hydro') && pair.includes('electro')) return 'electro_charged'
  if (pair.includes('pyro') && pair.includes('dendro')) return 'burning'
  if (pair.includes('hydro') && pair.includes('dendro')) return 'bloom'
  // Quicken is deliberately excluded: it cannot occur on a leader.
  if (incoming === 'anemo' && ['pyro', 'hydro', 'cryo', 'electro'].includes(attached)) return 'swirl'
  if (incoming === 'geo' && ['pyro', 'hydro', 'cryo', 'electro'].includes(attached)) return 'crystallize'
  return null
}

/** Resolve the leader's damage, shields and persistent statuses. Side effects
 * involving other cards are resolved by the caller using the reaction result.
 */
export function damageLeaderWithReaction(player: Player, amount: number, element?: ElementType): LeaderDamageResult {
  const auras = player.leaderAura ?? []
  const incoming = element && !['none', 'anemo', 'geo'].includes(element) ? element : undefined
  const index = element ? auras.findIndex(aura => leaderReaction(aura.element, element) !== null) : -1
  const reactedElement = index >= 0 ? auras[index].element : undefined
  const reaction = reactedElement && element ? leaderReaction(reactedElement, element) : null
  const nextAuras = index >= 0
    ? auras.filter((_, i) => i !== index)
    : incoming && !auras.some(a => a.element === incoming)
      ? [...auras, { element: incoming }]
      : auras

  const physical = !element || element === 'none'
  const bonus = reaction === 'vaporize' || reaction === 'melt' || reaction === 'overloaded' ? 1 : 0
  const physicalBonus = physical && player.leaderSuperconduct && amount > 0 ? 1 : 0
  let remaining = Math.max(0, Math.trunc(amount) + bonus + physicalBonus)
  const current = player.leaderShield ?? { normal: 0, crystallize: 0 }
  const normal = Math.min(current.normal, remaining)
  remaining -= normal
  const crystallize = Math.min(current.crystallize, remaining)
  remaining -= crystallize
  return {
    player: {
      ...player,
      leaderAura: nextAuras,
      leaderShield: { normal: current.normal - normal, crystallize: current.crystallize - crystallize },
      leaderHealth: Math.max(0, player.leaderHealth - remaining),
      leaderSuperconduct: reaction === 'superconduct'
        ? true : physical && amount > 0 ? false : player.leaderSuperconduct,
      leaderFrozenNextTurn: reaction === 'frozen' ? true : player.leaderFrozenNextTurn,
      leaderBurningTurns: reaction === 'burning'
        ? (player.leaderBurningTurns ?? 0) + 1 : player.leaderBurningTurns,
    },
    reaction,
    reactedElement,
  }
}

/** Compatibility wrapper used by older non-battle elemental effects. */
export function damageLeader(player: Player, amount: number, element?: ElementType): Player {
  return damageLeaderWithReaction(player, amount, element).player
}

/** Bond of Life absorbs healing before it can restore the leader's HP. */
export function healLeader(player: Player, amount: number): Player {
  let heal = Math.max(0, Math.trunc(amount))
  const absorbed = Math.min(player.bondOfLife ?? 0, heal)
  heal -= absorbed
  return { ...player,
    bondOfLife: Math.max(0, (player.bondOfLife ?? 0) - absorbed),
    leaderHealth: Math.min(player.leaderMaxHealth, player.leaderHealth + heal),
  }
}
