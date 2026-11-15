
import { useState } from 'react'
import {
  attackFollower,
  attackLeader,
  canFollowerAttack,
  canPlayCard,
  canUseAbility,
  confirmMulligan,
  createInitialGameState,
  endTurn,
  getCard,
  needsPlayTarget,
  needsAbilityTarget,
  activateAbility,
  playCard,
} from './game/engine'
import type { Follower } from './game/types'
import type { AbilityKind } from './game/engine'
import './App.css'
import { CardLibrary } from './components/CardLibrary'
import { isGuarded } from './game/neutralRules'

function App() {
  const [showCardLibrary, setShowCardLibrary] = useState(false)
  const [game, setGame] = useState(createInitialGameState)
  const [selectedAttackerId, setSelectedAttackerId] =
    useState<string | null>(null)
  const [selectedHandIndex, setSelectedHandIndex] =
    useState<number | null>(null)
  const [selectedAbility, setSelectedAbility] = useState<{
    followerId: string
    kind: AbilityKind
  } | null>(null)
  const [mulliganSelection, setMulliganSelection] =
    useState<number[]>([])

  const currentPlayer = game.players.find(
    p => p.id === game.currentPlayerId
  )!
  const opponent = game.players.find(
    p => p.id !== game.currentPlayerId
  )!
  const winner = game.players.find(
    p => p.id === game.winnerId
  )

  const selectedAttacker = currentPlayer.field.find(
    f => f.instanceId === selectedAttackerId
  )

  const resetSelection = () => {
    setSelectedAttackerId(null)
    setSelectedHandIndex(null)
    setSelectedAbility(null)
  }

  const handleReset = () => {
    setGame(createInitialGameState())
    resetSelection()
    setMulliganSelection([])
  }

  const handleToggleMulligan = (index: number) => {
    setMulliganSelection(previous =>
      previous.includes(index)
        ? previous.filter(i => i !== index)
        : [...previous, index]
    )
  }

  const handleConfirmMulligan = () => {
    const indices = [...mulliganSelection]
    setGame(previous =>
      confirmMulligan(previous, indices)
    )
    setMulliganSelection([])
  }

  const handleEndTurn = () => {
    setGame(previous => endTurn(previous))
    resetSelection()
  }

  const handlePlayCard = (handIndex: number) => {
    if (!canPlayCard(game, handIndex)) return

    const card = getCard(currentPlayer.hand[handIndex])
    if (!card) return

    if (needsPlayTarget(card)) {
      setSelectedHandIndex(previous =>
        previous === handIndex ? null : handIndex
      )
      setSelectedAttackerId(null)
      return
    }

    setGame(previous =>
      playCard(
        previous,
        previous.currentPlayerId,
        handIndex
      )
    )
    resetSelection()
  }

  const handleUseAbility = (follower: Follower, kind: AbilityKind) => {
    if (!canUseAbility(game, follower.instanceId, kind)) return
    const card = getCard(follower.cardId)
    if (!card) return
    if (needsAbilityTarget(card, kind)) {
      setSelectedAbility({ followerId: follower.instanceId, kind })
      setSelectedAttackerId(null)
      setSelectedHandIndex(null)
      return
    }
    setGame(previous => activateAbility(previous, follower.instanceId, kind))
    resetSelection()
  }

  const handleSelectAttacker = (follower: Follower) => {
    if (game.winnerId !== null) return
    if (!canFollowerAttack(follower)) return

    setSelectedHandIndex(null)
    setSelectedAttackerId(previous =>
      previous === follower.instanceId
        ? null
        : follower.instanceId
    )
  }

  const handleEnemyFollowerClick = (targetId: string) => {
    if (selectedHandIndex !== null) {
      const index = selectedHandIndex

      setGame(previous =>
        playCard(
          previous,
          previous.currentPlayerId,
          index,
          targetId
        )
      )
      resetSelection()
      return
    }

    if (selectedAbility) {
      const { followerId, kind } = selectedAbility
      setGame(previous => activateAbility(previous, followerId, kind, targetId))
      resetSelection()
      return
    }

    if (!selectedAttackerId) return

    const attackerId = selectedAttackerId
    setGame(previous =>
      attackFollower(previous, attackerId, targetId)
    )
    resetSelection()
  }

  const handleAttackLeader = () => {
    if (!selectedAttackerId) return

    const attackerId = selectedAttackerId

    setGame(previous =>
      attackLeader(previous, attackerId)
    )
    resetSelection()
  }

  const renderFollower = (
    follower: Follower,
    isOpponent: boolean
  ) => {
    const card = getCard(follower.cardId)

    const canAttack =
      !isOpponent &&
      game.winnerId === null &&
      canFollowerAttack(follower)

    const isSelected =
      follower.instanceId === selectedAttackerId

    const isTarget =
      isOpponent &&
      game.winnerId === null &&
      (selectedAttacker === undefined || !isGuarded(opponent) ||
        follower.keywords.includes('guard')) &&
      (selectedAttacker !== undefined
        ? !follower.keywords.includes('intimidate')
        : selectedHandIndex !== null || selectedAbility !== null
          ? !follower.keywords.includes('aura')
          : false)

    return (
      <div key={follower.instanceId} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        className={[
          'field-card',
          canAttack ? 'can-attack' : '',
          isSelected ? 'selected-card' : '',
          isTarget ? 'attack-target' : '',
        ].filter(Boolean).join(' ')}
        disabled={!canAttack && !isTarget}
        onClick={() => {
          if (isOpponent) {
            handleEnemyFollowerClick(follower.instanceId)
          } else {
            handleSelectAttacker(follower)
          }
        }}
      >
        <strong>
          {card?.name ?? '不明なカード'}
        </strong>

        <span>
          {follower.attack} / {follower.health}
        </span>

        {follower.aura.length > 0 && (
          <small style={{ color: '#9fe7ff' }}>
            付着：{follower.aura.map(a => a.element).join('・')}
          </small>
        )}
        {follower.keywords.includes('guard') && (
          <small>【守護】他の味方とリーダーを守る</small>
        )}
        {follower.keywords.includes('rush') && (
          <small>【突進】登場ターンはフォロワーのみ攻撃可能</small>
        )}
        {follower.keywords.includes('storm') && (
          <small>【疾走】登場ターンから攻撃可能</small>
        )}
        {follower.keywords.includes('aura') && (
          <small>【オーラ】効果の対象に選べない</small>
        )}
        {follower.keywords.includes('intimidate') && (
          <small>【威圧】フォロワーから攻撃されない</small>
        )}
        {follower.keywords.includes('frozen') && (
          <small style={{ color: '#aee1ff', fontWeight: 'bold' }}>
            凍結中（攻撃不可）
          </small>
        )}
        {follower.keywords.includes('superconduct') && (
          <small>超電導：次の物理被ダメージ+2</small>
        )}
        {follower.keywords.filter(k => k.startsWith('burning:')).map(k => (
          <small key={k}>燃焼：残り{k.slice(8)}ターン</small>
        ))}
        {follower.keywords.filter(k => k.startsWith('quicken:')).map(k => (
          <small key={k}>原激化：残り{k.slice(8)}回</small>
        ))}
        {follower.cardId === 'dendro-core' && (
          <small style={{ color: '#b5ed91' }}>草原核（攻撃不可）</small>
        )}
        {follower.shield.normal > 0 && (
          <small>通常シールド：{follower.shield.normal}</small>
        )}
        {follower.shield.crystallize > 0 && (
          <small>結晶シールド：{follower.shield.crystallize}</small>
        )}

        <small>
          {isOpponent
            ? '敵フォロワー'
            : canAttack
              ? '攻撃可能'
              : '攻撃不可'}
        </small>
      </button>
      {!isOpponent && (card?.elementalSkill || card?.elementalBurst) && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {card.elementalSkill && (
            <button type="button"
              disabled={!canUseAbility(game, follower.instanceId, 'skill')}
              onClick={() => handleUseAbility(follower, 'skill')}
              title={card.elementalSkill.name}>
              スキル{follower.skillUsed ? '済' : ''}
            </button>
          )}
          {card.elementalBurst && (
            <button type="button"
              disabled={!canUseAbility(game, follower.instanceId, 'burst')}
              onClick={() => handleUseAbility(follower, 'burst')}
              title={card.elementalBurst.name}>
              爆発 EN{card.elementalBurst.energyCost ?? 0}
            </button>
          )}
        </div>
      )}
      </div>
    )
  }

  const renderField = (
    followers: Follower[],
    isOpponent: boolean
  ) => (
    <div className="card-slot">
      {followers.length === 0
        ? 'カード配置エリア'
        : followers.map(f =>
            renderFollower(f, isOpponent)
          )}
    </div>
  )

  if (showCardLibrary) {
    return <CardLibrary onBack={() => setShowCardLibrary(false)} />
  }

  if (game.phase === 'mulligan') {
    return (
      <div className="game">
        <header className="game-header">
          <h1>原神カードゲーム</h1>
          <span>ゲーム準備</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setShowCardLibrary(true)}>
              カード一覧
            </button>
            <button type="button" onClick={handleReset}>
              ゲームリセット
            </button>
          </div>
        </header>

        <main
          style={{
            maxWidth: 850,
            margin: '60px auto',
            textAlign: 'center',
          }}
        >
          <h2>{currentPlayer.name} のマリガン</h2>

          <p>交換したいカードを選択してください。</p>
          <p>
            選択枚数：{mulliganSelection.length} / 4
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 16,
              margin: '35px 0',
            }}
          >
            {currentPlayer.hand.map((cardId, index) => {
              const card = getCard(cardId)
              if (!card) return null

              const selected =
                mulliganSelection.includes(index)

              return (
                <button
                  type="button"
                  key={index}
                  onClick={() =>
                    handleToggleMulligan(index)
                  }
                  style={{
                    width: 155,
                    height: 215,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: selected
                      ? '#72592b'
                      : '#38546a',
                    color: 'white',
                    border: selected
                      ? '3px solid #ffd24d'
                      : '3px solid #c9a75c',
                    borderRadius: 12,
                    cursor: 'pointer',
                  }}
                >
                  <span>コスト {card.cost}</span>
                  <strong>{card.name}</strong>
                  <span>
                    {card.type === 'follower'
                      ? `${card.attack} / ${card.health}`
                      : card.type === 'spell' ? 'スペル' : 'アミュレット'}
                  </span>
                  <span>
                    {selected ? '交換する ✓' : 'キープ'}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="end-turn"
            style={{
              marginLeft: 0,
              padding: '14px 35px',
            }}
            onClick={handleConfirmMulligan}
          >
            {mulliganSelection.length === 0
              ? 'すべてキープして確定'
              : `${mulliganSelection.length}枚交換して確定`}
          </button>

          <p style={{ marginTop: 25 }}>
            デッキ残数：{currentPlayer.deck.length}枚
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="game">
      <header className="game-header">
        <h1>原神カードゲーム</h1>
        <span>TURN {game.turn}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setShowCardLibrary(true)}>
            カード一覧
          </button>
          <button type="button" onClick={handleReset}>
            ゲームリセット
          </button>
        </div>
      </header>

      {winner && (
        <div className="winner-banner">
          {winner.name} の勝利！
        </div>
      )}

      <section className="player opponent">
        <button
          type="button"
          className={[
            'leader',
            'leader-button',
            selectedAttacker ? 'attack-target' : '',
          ].filter(Boolean).join(' ')}
          disabled={
            !selectedAttacker ||
            game.winnerId !== null ||
            isGuarded(opponent) ||
            selectedAttacker.keywords.includes('rush_only')
          }
          onClick={handleAttackLeader}
        >
          <strong>{opponent.name}</strong>
          <span>
            HP {opponent.leaderHealth} /
            {' '}{opponent.leaderMaxHealth}
          </span>
        </button>

        <div className="pp">
          PP {opponent.pp} / {opponent.maxPp} EN {opponent.energy} / 5
        </div>
        <div>デッキ：{opponent.deck.length}枚</div>
        <div>手札：{opponent.hand.length}枚</div>
        <div>墓場：{opponent.graveyard.length}枚</div>
        {(opponent.leaderBurningTurns ?? 0) > 0 && (
          <div>リーダー燃焼：残り{opponent.leaderBurningTurns}ターン</div>
        )}
      </section>

      <section className="field">
        <div className="field-row">
          <p>{opponent.name} のフィールド</p>
          {renderField(opponent.field, true)}
        </div>

        <div className="field-divider">VS</div>

        <div className="field-row">
          <p>{currentPlayer.name} のフィールド</p>
          {renderField(currentPlayer.field, false)}
        </div>
      </section>

      <section className="player self">
        <div className="leader">
          <strong>{currentPlayer.name}</strong>
          <span>
            HP {currentPlayer.leaderHealth} /
            {' '}{currentPlayer.leaderMaxHealth}
          </span>
        </div>

        <div className="pp">
          PP {currentPlayer.pp} / {currentPlayer.maxPp} EN {currentPlayer.energy} / 5
        </div>
        <div>デッキ：{currentPlayer.deck.length}枚</div>
        <div>手札：{currentPlayer.hand.length}枚</div>
        <div>墓場：{currentPlayer.graveyard.length}枚</div>
        {(currentPlayer.crests ?? []).map((crest, index) => (
          <div key={index}>
            クレスト【第四降臨者の力】残り{crest.turnsRemaining}ターン
            （発動済み：{crest.usedElements.join('・') || 'なし'}）
          </div>
        ))}
        {(currentPlayer.leaderBurningTurns ?? 0) > 0 && (
          <div>リーダー燃焼：残り{currentPlayer.leaderBurningTurns}ターン</div>
        )}

        <button
          type="button"
          className="end-turn"
          disabled={game.winnerId !== null}
          onClick={handleEndTurn}
        >
          ターン終了
        </button>
      </section>

      <div className="battle-message">
        {winner
          ? 'ゲーム終了'
          : selectedAbility !== null
            ? '元素スキル・元素爆発の対象となる敵フォロワーを選択してください'
          : selectedHandIndex !== null
            ? 'ファンファーレの対象となる敵フォロワーを選択してください'
            : selectedAttacker
              ? '攻撃対象を選択してください'
              : 'カードをプレイするか、攻撃可能なフォロワーを選択してください'}
      </div>

      <footer className="hand">
        {currentPlayer.hand.map((cardId, index) => {
          const card = getCard(cardId)
          if (!card) return null

          const playable = canPlayCard(game, index)
          const selected = selectedHandIndex === index

          return (
            <button
              type="button"
              className={[
                'hand-card',
                selected ? 'selected-card' : '',
              ].filter(Boolean).join(' ')}
              key={`${cardId}-${index}`}
              disabled={!playable}
              onClick={() => handlePlayCard(index)}
              style={{
                borderColor: selected
                  ? '#ffd24d'
                  : undefined,
                boxShadow: selected
                  ? '0 0 16px #ffd24d'
                  : undefined,
              }}
              title={card.description}
            >
              <span className="card-cost">
                {card.cost}
              </span>
              <strong>{card.name}</strong>
              <span>
                {card.type === 'follower'
                  ? `${card.attack} / ${card.health}`
                  : card.type === 'spell' ? 'スペル' : 'アミュレット'}
              </span>
            </button>
          )
        })}
      </footer>
    </div>
  )
}

export default App
