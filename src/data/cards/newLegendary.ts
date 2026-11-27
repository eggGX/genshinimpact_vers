import type { Card } from '../../game/types'

/** Special fourth Hydro legendary (C124), beyond the original per-element 3. */
export const newLegendaryCards: Card[] = [{
  id: 'C124',
  implementationStatus: 'playable',
  name: 'ズバイルシアターの踊り子・ニィロウ',
  type: 'follower',
  rarity: 'legendary',
  element: 'hydro',
  cost: 4,
  attack: 1,
  health: 6,
  region: ['スメール'],
  traits: ['ズバイルシアター'],
  description: '【ファンファーレ】自分のデッキに無元素・水元素・草元素以外のカードがないなら、自分のリーダーは『クレスト：ズバイルシアターの踊り子・ニィロウ』をもつ。\n【元素スキル：七域のダンス】\nコスト：PP2\nランダムな相手フォロワー1体に水元素1ダメージ。これを3回行う。\nこのフォロワーは「【交戦時】相手フォロワーに水元素を付着する。」をもつ。\n【元素爆発：浮蓮のダンス・遠夢聆泉】\nコスト：元素エネルギー_3\n相手の場のフォロワーすべてに水元素2ダメージ。\n【クレスト】相手の場で開花反応が発生するとき、「草原核」の代わりに「豊穣の核」を相手の場に出す。',
  elementalSkill: { name: '七域のダンス', ppCost: 2, effects: [] },
  elementalBurst: { name: '浮蓮のダンス・遠夢聆泉', energyCost: 3, effects: [] },
}]
