import type { Player, Shield } from './types'

/** Leader shields share follower shield ordering: normal first, crystallize second. */
export function addLeaderShield(player: Player, amount: number, type: keyof Shield = 'normal'): Player {
  const current = player.leaderShield ?? { normal: 0, crystallize: 0 }
  return { ...player, leaderShield: {
    ...current, [type]: Math.min(10, current[type] + Math.max(0, amount)),
  }}
}

export function damageLeader(player: Player, amount: number): Player {
  let remaining = Math.max(0, amount)
  const current = player.leaderShield ?? { normal: 0, crystallize: 0 }
  const normal = Math.min(current.normal, remaining)
  remaining -= normal
  const crystallize = Math.min(current.crystallize, remaining)
  remaining -= crystallize
  return { ...player,
    leaderShield: { normal: current.normal - normal, crystallize: current.crystallize - crystallize },
    leaderHealth: Math.max(0, player.leaderHealth - remaining),
  }
}
