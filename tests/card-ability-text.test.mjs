import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
after(async () => { await vite.close() })
const { getCardAbilityText, splitCardAbilityLines } = await vite.ssrLoadModule('/src/data/cardAbilityText.ts')
const { getCard } = await vite.ssrLoadModule('/src/data/cardRegistry.ts')

test('card detail splits only authored newlines, not inline keywords or quoted effects', () => {
  const c030 = getCard('C030')
  const c091 = getCard('C091')
  assert.deepEqual(splitCardAbilityLines(getCardAbilityText(c030).basic), [c030.description])
  assert.deepEqual(splitCardAbilityLines(getCardAbilityText(c091).basic), c091.description.split('\n'))
  assert.deepEqual(splitCardAbilityLines('【守護】\n【ラストワード】1ダメージ。'), ['【守護】', '【ラストワード】1ダメージ。'])
})

test('separate base, skill, and burst without losing inner keyword tags', () => {
  const card = {
    description: '【疾走】【ファンファーレ】1枚引く。【元素スキル：炎の技】PP1：自身に【元素攻撃：炎】を付与。【元素爆発：炎の奥義】エネルギー3：敵に3ダメージ。',
  }
  const result = getCardAbilityText(card)
  assert.equal(result.basic, '【疾走】【ファンファーレ】1枚引く。')
  assert.equal(result.skill, 'PP1：自身に【元素攻撃：炎】を付与。')
  assert.equal(result.burst, 'エネルギー3：敵に3ダメージ。')
})

test('real legendary abilities stay readable in dedicated sections', () => {
  for (const id of ['C023', 'C040', 'C055', 'C070']) {
    const card = getCard(id)
    assert.ok(card?.elementalSkill, id + ' must have skill')
    assert.ok(card?.elementalBurst, id + ' must have burst')
    const text = getCardAbilityText(card)
    assert.ok(!text.basic.includes('【元素スキル'), id + ' basic contains skill')
    assert.ok(!text.basic.includes('【元素爆発'), id + ' basic contains burst')
    assert.ok(text.skill.length > 0, id + ' missing skill detail')
    assert.ok(text.burst.length > 0, id + ' missing burst detail')
  }
})

test('basic-only cards preserve their original description unchanged', () => {
  for (const id of ['C001', 'C044']) {
    const card = getCard(id)
    const text = getCardAbilityText(card)
    assert.equal(text.basic, card.description?.trim() ?? '')
    assert.equal(text.skill, '')
    assert.equal(text.burst, '')
  }
})
