import type { Card } from '../game/types'

export interface CardAbilityText {
  basic: string
  skill: string
  burst: string
}

/**
 * The card catalogue keeps the original full description for backward
 * compatibility. Split it for presentation only; do not change the rules.
 * An ability body can itself contain keyword tags such as 【元素攻撃：炎】,
 * so only split at the two top-level elemental ability headings.
 */
export function getCardAbilityText(card: Card): CardAbilityText {
  const description = card.description?.trim() ?? ''
  const sections: CardAbilityText = { basic: '', skill: '', burst: '' }
  const marker = /【元素(スキル|爆発)(?:：[^】]*)?】/g
  const found = [...description.matchAll(marker)]
  if (!found.length) return { ...sections, basic: description }

  sections.basic = description.slice(0, found[0].index).trim()
  for (let i = 0; i < found.length; i++) {
    const match = found[i]
    const from = (match.index ?? 0) + match[0].length
    const to = i + 1 < found.length ? (found[i + 1].index ?? description.length) : description.length
    const body = description.slice(from, to).trim()
    const category = match[1] === 'スキル' ? 'skill' : 'burst'
    // Preserve full text if more than one ability heading is present.
    sections[category] = [sections[category], body].filter(Boolean).join(' ')
  }
  return sections
}
