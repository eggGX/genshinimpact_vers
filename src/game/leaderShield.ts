import type { ElementType, Player, Shield } from './types'

/** Leader shields share follower shield ordering: normal first, crystallize second. */
export function addLeaderShield(player: Player, amount: number, type: keyof Shield = 'normal'): Player {
  const current = player.leaderShield ?? { normal: 0, crystallize: 0 }
  return { ...player, leaderShield: {
    ...current, [type]: Math.min(10, current[type] + Math.max(0, amount)),
  }}
}

/**
 * Elemental damage to a leader attaches its element just as it does to a follower.
 * An existing reactive attachment is consumed; Vaporize and Melt add damage.
 * Physical, Anemo and Geo hits do not create an aura.
 */
export function damageLeader(player: Player, amount: number, element?: ElementType): Player {
  const auras = player.leaderAura ?? []
  const incoming = element && !['none', 'anemo', 'geo'].includes(element) ? element : undefined
  const reacts = (existing: ElementType): boolean => {
    const pair = [existing, element]
    return (pair.includes('pyro') && ['hydro','cryo','electro','dendro'].some(e => pair.includes(e))) ||
      (pair.includes('hydro') && ['electro','cryo','dendro'].some(e => pair.includes(e))) ||
      (pair.includes('cryo') && pair.includes('electro')) ||
      (pair.includes('dendro') && pair.includes('electro')) ||
      ((element === 'anemo' || element === 'geo') &&
        ['pyro','hydro','cryo','electro'].includes(existing))
  }
  const index = element ? auras.findIndex(a => reacts(a.element)) : -1
  const reacted = index >= 0 ? auras[index].element : null
  const bonus = reacted && element &&
    ((reacted === 'pyro' && element === 'cryo') ||
     (reacted === 'cryo' && element === 'pyro')) ? 3 :
    reacted && element &&
    ((reacted === 'pyro' && element === 'hydro') ||
     (reacted === 'hydro' && element === 'pyro')) ? 2 : 0
  const nextAuras = index >= 0
    ? auras.filter((_, i) => i !== index)
    : incoming && !auras.some(a => a.element === incoming)
      ? [...auras, { element: incoming }]
      : auras

  let remaining = Math.max(0, Math.trunc(amount) + bonus)
  const current = player.leaderShield ?? { normal: 0, crystallize: 0 }
  const normal = Math.min(current.normal, remaining)
  remaining -= normal
  const crystallize = Math.min(current.crystallize, remaining)
  remaining -= crystallize
  return { ...player,
    leaderAura: nextAuras,
    leaderShield: { normal: current.normal - normal, crystallize: current.crystallize - crystallize },
    leaderHealth: Math.max(0, player.leaderHealth - remaining),
  }
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
