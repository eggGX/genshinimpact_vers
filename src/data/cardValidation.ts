import type { Card, ElementType, Rarity } from '../game/types'

export const ELEMENT_ORDER: ElementType[] = [
  'none', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro',
]
export const RARITY_ORDER: Rarity[] = ['bronze', 'silver', 'gold', 'legendary']

export const PLANNED_CARD_COUNTS: Record<ElementType, Record<Rarity, number>> = {
  none:    { bronze: 4, silver: 5, gold: 2, legendary: 0 },
  pyro:    { bronze: 4, silver: 5, gold: 4, legendary: 3 },
  hydro:   { bronze: 4, silver: 5, gold: 4, legendary: 3 },
  cryo:    { bronze: 4, silver: 4, gold: 4, legendary: 3 },
  electro: { bronze: 4, silver: 4, gold: 4, legendary: 3 },
  anemo:   { bronze: 4, silver: 4, gold: 4, legendary: 3 },
  geo:     { bronze: 4, silver: 4, gold: 4, legendary: 3 },
  dendro:  { bronze: 4, silver: 4, gold: 4, legendary: 3 },
}
export const PLANNED_TOTAL = 118

export interface CardSlotStatus {
  element: ElementType
  rarity: Rarity
  planned: number
  registered: number
  remaining: number
}

export interface CardValidationReport {
  errors: string[]
  slots: CardSlotStatus[]
  total: number
  plannedTotal: number
  ready: boolean
}

/**
 * Formal-card audit. Empty or partially completed sets are valid during development;
 * they become ready only after all planned rarity/element slots are filled.
 */
export function validateProductionCards(cards: readonly Card[]): CardValidationReport {
  const errors: string[] = []
  const ids = new Set<string>()
  const counts = new Map<string, number>()

  for (const card of cards) {
    const id = typeof card.id === 'string' ? card.id.trim() : ''
    if (!id) errors.push('カードIDは必須です')
    else if (ids.has(id)) errors.push(`カードIDが重複しています: ${id}`)
    ids.add(id)

    const name = typeof card.name === 'string' ? card.name.trim() : ''
    if (!name) errors.push(`${id || '(IDなし)'}: 名前は必須です`)
    if (card.token) errors.push(`${id}: トークンは正式115枚の登録対象外です`)
    if (!ELEMENT_ORDER.includes(card.element)) errors.push(`${id}: 不明な元素 ${card.element}`)
    if (!RARITY_ORDER.includes(card.rarity)) errors.push(`${id}: 不明なレアリティ ${card.rarity}`)
    if (!Number.isInteger(card.cost) || card.cost < 0) errors.push(`${id}: コストが不正です`)
    if (!['follower', 'spell', 'amulet'].includes(card.type)) errors.push(`${id}: 不明なカードタイプ`)

    if (card.type === 'follower') {
      if (!Number.isInteger(card.attack) || (card.attack ?? -1) < 0) {
        errors.push(`${id}: 攻撃力が不正です`)
      }
      if (!Number.isInteger(card.health) || (card.health ?? 0) <= 0) {
        errors.push(`${id}: 体力が不正です`)
      }
    }
    if (card.elementalSkill && (!card.elementalSkill.name.trim() ||
        (card.elementalSkill.ppCost !== undefined &&
          (!Number.isInteger(card.elementalSkill.ppCost) || card.elementalSkill.ppCost < 0)) ||
        card.elementalSkill.effects.some(e => e.trigger !== 'skill'))) {
      errors.push(`${id}: 元素スキル定義が不正です`)
    }
    if (card.elementalBurst) {
      const burst = card.elementalBurst
      if (!burst.name.trim() || !Number.isInteger(burst.energyCost) ||
          (burst.energyCost ?? -1) < 0 || (burst.energyCost ?? 6) > 5 ||
          burst.effects.some(e => e.trigger !== 'burst')) {
        errors.push(`${id}: 元素爆発定義が不正です`)
      }
    }

    const key = `${card.element}:${card.rarity}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const slots: CardSlotStatus[] = ELEMENT_ORDER.flatMap(element =>
    RARITY_ORDER.map(rarity => {
      const planned = PLANNED_CARD_COUNTS[element][rarity]
      const registered = counts.get(`${element}:${rarity}`) ?? 0
      if (registered > planned) {
        errors.push(`${element}/${rarity}: 上限${planned}枚に対して${registered}枚あります`)
      }
      return {
        element,
        rarity,
        planned,
        registered,
        remaining: Math.max(0, planned - registered),
      }
    })
  )

  return {
    errors,
    slots,
    total: cards.length,
    plannedTotal: PLANNED_TOTAL,
    ready: errors.length === 0 && slots.every(slot => slot.remaining === 0),
  }
}
