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
