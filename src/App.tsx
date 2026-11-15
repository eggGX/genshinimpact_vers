
import { useState } from 'react'
import {
  attackFollower,
  attackLeader,
  canFollowerAttack,
  createInitialGameState,
  endTurn,
  getCard,
  playCard,
} from './game/engine'
import type { Follower } from './game/types'
import './App.css'

function App() {
  const [game, setGame] = useState(createInitialGameState)
  const [selectedAttackerId, setSelectedAttackerId] =
    useState<string | null>(null)

  const currentPlayer = game.players.find(
    player => player.id === game.currentPlayerId
  )!

  const opponent = game.players.find(
    player => player.id !== game.currentPlayerId
  )!

  const winner = game.players.find(
    player => player.id === game.winnerId
  )

  const selectedAttacker = currentPlayer.field.find(
    follower => follower.instanceId === selectedAttackerId
  )

  const handleEndTurn = () => {
    setGame(previous => endTurn(previous))
    setSelectedAttackerId(null)
  }

  const handlePlayCard = (handIndex: number) => {
    setGame(previous =>
      playCard(previous, previous.currentPlayerId, handIndex)
    )
  }

  const handleSelectAttacker = (follower: Follower) => {
    if (game.winnerId !== null) return
    if (!canFollowerAttack(follower)) return

    setSelectedAttackerId(previous =>
      previous === follower.instanceId
        ? null
        : follower.instanceId
    )
  }

  const handleAttackFollower = (targetId: string) => {
    if (!selectedAttackerId) return

    setGame(previous =>
      attackFollower(previous, selectedAttackerId, targetId)
    )

    setSelectedAttackerId(null)
  }

  const handleAttackLeader = () => {
    if (!selectedAttackerId) return

    setGame(previous =>
      attackLeader(previous, selectedAttackerId)
    )

    setSelectedAttackerId(null)
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
      selectedAttacker !== undefined &&
      game.winnerId === null

    return (
      <button
        type="button"
        className={[
          'field-card',
          canAttack ? 'can-attack' : '',
          isSelected ? 'selected-card' : '',
          isTarget ? 'attack-target' : '',
        ].filter(Boolean).join(' ')}
        key={follower.instanceId}
        disabled={!canAttack && !isTarget}
        onClick={() => {
          if (isOpponent) {
            handleAttackFollower(follower.instanceId)
          } else {
            handleSelectAttacker(follower)
          }
        }}
      >
        <strong>{card?.name ?? '不明なカード'}</strong>

        <span>
          {follower.attack} / {follower.health}
        </span>

        <small>
          {isOpponent
            ? '敵フォロワー'
            : canFollowerAttack(follower)
              ? '攻撃可能'
              : '攻撃不可'}
        </small>
      </button>
    )
  }

  const renderField = (
    followers: Follower[],
    isOpponent: boolean
  ) => (
    <div className="card-slot">
      {followers.length === 0
        ? 'カード配置エリア'
        : followers.map(follower =>
            renderFollower(follower, isOpponent)
          )}
    </div>
  )

  return (
    <div className="game">
      <header className="game-header">
        <h1>原神カードゲーム</h1>
        <span>TURN {game.turn}</span>
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
          disabled={!selectedAttacker || game.winnerId !== null}
          onClick={handleAttackLeader}
        >
          <strong>{opponent.name}</strong>
          <span>
            HP {opponent.leaderHealth} / {opponent.leaderMaxHealth}
          </span>
        </button>

        <div className="pp">
          PP {opponent.pp} / {opponent.maxPp}
        </div>

        <div>墓場：{opponent.graveyard.length}枚</div>
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
            HP {currentPlayer.leaderHealth} / {currentPlayer.leaderMaxHealth}
          </span>
        </div>

        <div className="pp">
          PP {currentPlayer.pp} / {currentPlayer.maxPp}
        </div>

        <div>墓場：{currentPlayer.graveyard.length}枚</div>

        <button
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
          : selectedAttacker
            ? '攻撃対象を選択してください'
            : '攻撃可能なフォロワーを選択してください'}
      </div>

      <footer className="hand">
        {currentPlayer.hand.map((cardId, index) => {
          const card = getCard(cardId)
          if (!card) return null

          const playable =
            game.winnerId === null &&
            card.type === 'follower' &&
            card.cost <= currentPlayer.pp &&
            currentPlayer.field.length < 5

          return (
            <button
              className="hand-card"
              key={`${cardId}-${index}`}
              disabled={!playable}
              onClick={() => handlePlayCard(index)}
            >
              <span className="card-cost">
                {card.cost}
              </span>
              <strong>{card.name}</strong>
              <span>
                {card.attack} / {card.health}
              </span>
            </button>
          )
        })}
      </footer>
    </div>
  )
}

export default App
