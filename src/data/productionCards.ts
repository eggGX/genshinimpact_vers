import type { Card } from '../game/types'
import { neutralCards } from './cards/neutral'
import { pyroCards } from './cards/pyro'
import { hydroCards } from './cards/hydro'
import { cryoCards } from './cards/cryo'
import { electroCards } from './cards/electro'
import { anemoCards } from './cards/anemo'
import { geoCards } from './cards/geo'
import { dendroCards } from './cards/dendro'

/**
 * 正式カードの登録先。元素別ファイルに定義するだけでゲームに反映されます。
 * 確定115枚の正式カードのみを登録。テスト専用カードは持ちません。
 */
export const productionCards: Card[] = [
  ...neutralCards,
  ...pyroCards,
  ...hydroCards,
  ...cryoCards,
  ...electroCards,
  ...anemoCards,
  ...geoCards,
  ...dendroCards,
]
