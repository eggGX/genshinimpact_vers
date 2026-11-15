import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const engine = await vite.ssrLoadModule('/src/game/engine.ts')
after(async () => { await vite.close() })

function startedGame() {
  let state = engine.createInitialGameState()
  state = engine.confirmMulligan(state, [])
  state = engine.confirmMulligan(state, [])
  return state
}

function place(state, ownerIndex, cardId, attack = 2, health = 2) {
  const follower = {
    instanceId: 'test-' + ownerIndex + '-' + state.players[ownerIndex].field.length + '-' + cardId,
    cardId,
    attack,
    health,
    maxHealth: health,
    energy: 0,
    maxEnergy: 5,
    aura: [],
    shield: { normal: 0, crystallize: 0 },
    canAttack: true,
    hasAttacked: false,
    keywords: [],
  }
  state.players[ownerIndex].field.push(follower)
  return follower
}

test('開始時は40枚から4枚配り、マリガン後に先攻PP1で始まる', () => {
  const initial = engine.createInitialGameState()
  assert.equal(initial.phase, 'mulligan')
  for (const player of initial.players) {
    assert.equal(player.hand.length, 4)
    assert.equal(player.deck.length, 36)
  }
  const p2 = engine.confirmMulligan(initial, [0, 2])
  assert.equal(p2.currentPlayerId, 'player2')
  const active = engine.confirmMulligan(p2, [1])
  assert.equal(active.phase, 'main')
  assert.equal(active.currentPlayerId, 'player1')
  assert.equal(active.players[0].pp, 1)
  assert.equal(active.players[0].hand.length, 4)
  assert.equal(active.players[1].hand.length, 4)
})

test('ターン終了時に次プレイヤーがドローしてPPを回復', () => {
  const state = engine.endTurn(startedGame())
  assert.equal(state.currentPlayerId, 'player2')
  assert.equal(state.turn, 2)
  assert.equal(state.players[1].hand.length, 5)
  assert.equal(state.players[1].deck.length, 35)
  assert.equal(state.players[1].pp, 1)
})

test('デッキが空の状態でドローすると敗北', () => {
  const state = startedGame()
  state.players[1].deck = []
  const next = engine.endTurn(state)
  assert.equal(next.winnerId, 'player1')
})

test('アビスの魔術師のファンファーレは相手リーダーに2ダメージ', () => {
  const state = startedGame()
  state.players[0].pp = 3
  state.players[0].hand = ['test-mage']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[1].leaderHealth, 18)
  assert.equal(next.players[0].field.length, 1)
  assert.equal(next.players[0].pp, 0)
})

test('氷の射手は敵フォロワーに2ダメージを与え、破壊する', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const enemy = place(state, 1, 'test-slime', 1, 2)
  assert.equal(engine.canPlayCard(state, 0), true)
  const next = engine.playCard(state, 'player1', 0, enemy.instanceId)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[1].graveyard, ['test-slime'])
  assert.equal(next.players[0].field.length, 1)
})

test('ラストワードはフォロワーの持ち主を回復する', () => {
  const state = startedGame()
  state.players[1].leaderHealth = 15
  const attacker = place(state, 0, 'test-slime', 2, 3)
  const target = place(state, 1, 'test-hilichurl', 2, 2)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].leaderHealth, 17)
  assert.deepEqual(next.players[1].graveyard, ['test-hilichurl'])
})

test('戦闘のダメージは双方同時に適用される', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 2, 2)
  const target = place(state, 1, 'test-slime', 2, 2)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field.length, 0)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[0].graveyard.length, 1)
  assert.equal(next.players[1].graveyard.length, 1)
})

test('ターン終了時の祈祷師はリーダーを1回復する', () => {
  const state = startedGame()
  state.players[0].leaderHealth = 16
  place(state, 0, 'test-shaman', 1, 3)
  const next = engine.endTurn(state)
  assert.equal(next.players[0].leaderHealth, 17)
  assert.equal(next.currentPlayerId, 'player2')
})

test('攻撃したフォロワーは同じターンに再度攻撃できない', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 2)
  const next = engine.attackLeader(state, attacker.instanceId)
  assert.equal(next.players[1].leaderHealth, 19)
  assert.equal(next.players[0].field[0].hasAttacked, true)
  const again = engine.attackLeader(next, attacker.instanceId)
  assert.equal(again.players[1].leaderHealth, 19)
})

test('炎スライムの通常攻撃は生存した敵に炎元素を付着させる', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 2)
  const target = place(state, 1, 'test-mage', 1, 4)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].field[0].health, 3)
  assert.deepEqual(next.players[1].field[0].aura, [{ element: 'pyro' }])
})

test('氷の射手のダメージは生存した敵に氷元素を付着させる', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const target = place(state, 1, 'test-mage', 1, 4)
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  assert.equal(next.players[1].field[0].health, 2)
  assert.deepEqual(next.players[1].field[0].aura, [{ element: 'cryo' }])
})

test('物理通常攻撃は元素付着を生じない', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-hilichurl', 1, 4)
  const target = place(state, 1, 'test-mage', 1, 4)
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.deepEqual(next.players[1].field[0].aura, [])
})

test('風・岩・無元素の攻撃は付着せず、同元素は重複登録しない', async () => {
  const { applyElementalAura } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 4)
  assert.deepEqual(applyElementalAura(target, 'anemo').aura, [])
  assert.deepEqual(applyElementalAura(target, 'geo').aura, [])
  assert.deepEqual(applyElementalAura(target, 'none').aura, [])
  const once = applyElementalAura(target, 'hydro')
  const twice = applyElementalAura(once, 'hydro')
  assert.deepEqual(twice.aura, [{ element: 'hydro' }])
})

test('異なる元素の重なりは保持するが反応を起こさない（STEP14）', async () => {
  const { applyElementalAura } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 4)
  const hydro = applyElementalAura(target, 'hydro')
  const cryo = applyElementalAura(hydro, 'cryo')
  assert.deepEqual(cryo.aura.map(a => a.element), ['hydro', 'cryo'])
  assert.equal(cryo.health, 4)
})

test('訓練兵は登場時に自身を2/2から3/4に強化する', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-trainee']
  const next = engine.playCard(state, 'player1', 0)
  assert.equal(next.players[0].field[0].attack, 3)
  assert.equal(next.players[0].field[0].health, 4)
  assert.equal(next.players[0].field[0].maxHealth, 4)
})

test('雷の術師は選択した敵の攻撃力を1下げ、体力は変えない', () => {
  const state = startedGame()
  state.players[0].pp = 3
  state.players[0].hand = ['test-electro-mage']
  const target = place(state, 1, 'test-hilichurl', 2, 2)
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  assert.equal(next.players[1].field[0].attack, 1)
  assert.equal(next.players[1].field[0].health, 2)
})

test('蒸発は水→炎、炎→水の両方向で+2し付着を消費する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  for (const [attached, incoming] of [['hydro', 'pyro'], ['pyro', 'hydro']]) {
    const state = startedGame()
    const target = place(state, 1, 'test-mage', 1, 10)
    target.aura = [{ element: attached }]
    const outcome = resolveElementalDamage(target, 2, incoming)
    assert.equal(outcome.reaction, 'vaporize')
    assert.equal(outcome.damage, 4)
    assert.equal(outcome.follower.health, 6)
    assert.deepEqual(outcome.follower.aura, [])
  }
})

test('溶解は炎→氷、氷→炎の両方向で+3し付着を消費する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  for (const [attached, incoming] of [['pyro', 'cryo'], ['cryo', 'pyro']]) {
    const state = startedGame()
    const target = place(state, 1, 'test-mage', 1, 10)
    target.aura = [{ element: attached }]
    const outcome = resolveElementalDamage(target, 1, incoming)
    assert.equal(outcome.reaction, 'melt')
    assert.equal(outcome.damage, 4)
    assert.equal(outcome.follower.health, 6)
    assert.deepEqual(outcome.follower.aura, [])
  }
})

test('元素のない攻撃では反応を起こさず、元の付着を維持する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 8)
  target.aura = [{ element: 'pyro' }]
  const result = resolveElementalDamage(target, 2)
  assert.equal(result.reaction, null)
  assert.equal(result.follower.health, 6)
  assert.deepEqual(result.follower.aura, [{ element: 'pyro' }])
})

test('氷の射手の登場時効果で溶解+3、致死ダメージなら墓場へ送る', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const target = place(state, 1, 'test-mage', 1, 4)
  target.aura = [{ element: 'pyro' }]
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[1].graveyard, ['test-mage'])
})

test('炎スライムの通常攻撃で蒸発が発生する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 6)
  const target = place(state, 1, 'test-mage', 1, 7)
  target.aura = [{ element: 'hydro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[1].field[0].health, 4)
  assert.deepEqual(next.players[1].field[0].aura, [])
})

test('同時戦闘で片方に反応が発生しても双方の攻撃を処理する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 2, 2)
  const target = place(state, 1, 'test-slime', 2, 4)
  target.aura = [{ element: 'hydro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field.length, 0)
  assert.equal(next.players[1].field.length, 0)
  assert.deepEqual(next.players[0].graveyard, ['test-slime'])
  assert.deepEqual(next.players[1].graveyard, ['test-slime'])
})

test('感電は水＋雷で反応し、攻撃対象の付着を解除する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  for (const [aura, incoming] of [['hydro', 'electro'], ['electro', 'hydro']]) {
    const state = startedGame()
    const target = place(state, 1, 'test-mage', 1, 8)
    target.aura = [{ element: aura }]
    const result = resolveElementalDamage(target, 2, incoming)
    assert.equal(result.reaction, 'electro_charged')
    assert.equal(result.follower.health, 6)
    assert.deepEqual(result.follower.aura, [])
  }
})

test('感電の追加1ダメージは別の敵フォロワーへ与える', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 8)
  place(state, 1, 'test-hilichurl', 1, 3)
  const next = resolveReactionConsequence(state, 1, target.instanceId, 'electro_charged')
  assert.equal(next.players[1].field[0].health, 8)
  assert.equal(next.players[1].field[1].health, 2)
  assert.equal(next.players[1].leaderHealth, 20)
})

test('感電で別の敵がいないときはリーダーに1ダメージ', async () => {
  const { resolveReactionConsequence } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 8)
  const next = resolveReactionConsequence(state, 1, target.instanceId, 'electro_charged')
  assert.equal(next.players[1].leaderHealth, 19)
})

test('過負荷は炎＋雷で反応しコスト5以下の敵を手札に戻す', async () => {
  const { resolveReactionConsequence, resolveElementalDamage } =
    await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-hilichurl', 1, 8)
  target.aura = [{ element: 'pyro' }]
  const outcome = resolveElementalDamage(target, 1, 'electro')
  assert.equal(outcome.reaction, 'overloaded')
  state.players[1].field[0] = outcome.follower
  const before = state.players[1].hand.length
  const next = resolveReactionConsequence(state, 1, target.instanceId, outcome.reaction)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[1].hand.length, before + 1)
  assert.equal(next.players[1].hand.at(-1), 'test-hilichurl')
  assert.equal(next.players[1].graveyard.length, 0)
})

test('凍結は水＋氷で発生し、反応後は付着を解除する', async () => {
  const { resolveElementalDamage } = await vite.ssrLoadModule('/src/game/elemental.ts')
  const state = startedGame()
  const target = place(state, 1, 'test-mage', 1, 8)
  target.aura = [{ element: 'hydro' }]
  const outcome = resolveElementalDamage(target, 1, 'cryo')
  assert.equal(outcome.reaction, 'frozen')
  assert.deepEqual(outcome.follower.aura, [])
  assert.equal(outcome.follower.health, 7)
  assert.equal(outcome.follower.keywords.includes('frozen'), true)
  assert.equal(engine.canFollowerAttack(outcome.follower), false)
})

test('凍結したフォロワーは持ち主のターン終了まで攻撃不可', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-hilichurl', 2, 5)
  attacker.keywords = ['frozen']
  const blocked = engine.attackLeader(state, attacker.instanceId)
  assert.equal(blocked.players[1].leaderHealth, 20)
  const switched = engine.endTurn(state)
  assert.equal(switched.players[0].field[0].keywords.includes('frozen'), false)
  assert.equal(switched.currentPlayerId, 'player2')
})

test('氷の射手の効果で凍結し、解除前は攻撃できない', () => {
  const state = startedGame()
  state.players[0].pp = 2
  state.players[0].hand = ['test-archer']
  const target = place(state, 1, 'test-mage', 1, 8)
  target.aura = [{ element: 'hydro' }]
  const next = engine.playCard(state, 'player1', 0, target.instanceId)
  const enemy = next.players[1].field[0]
  assert.equal(enemy.health, 6)
  assert.equal(enemy.keywords.includes('frozen'), true)
  assert.equal(engine.canFollowerAttack(enemy), false)
})

test('通常攻撃中の反応はダメージの同時処理を維持する', () => {
  const state = startedGame()
  const attacker = place(state, 0, 'test-slime', 1, 5)
  const target = place(state, 1, 'test-hilichurl', 1, 5)
  target.aura = [{ element: 'electro' }]
  const next = engine.attackFollower(state, attacker.instanceId, target.instanceId)
  assert.equal(next.players[0].field[0].health, 4)
  assert.equal(next.players[1].field.length, 0)
  assert.equal(next.players[1].hand.at(-1), 'test-hilichurl')
})
