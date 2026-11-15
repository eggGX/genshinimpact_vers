
import { useState } from 'react'
import {
  attackFollower,
  attackLeader,
  canFollowerAttack,
  confirmMulligan,
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

  const [mulliganSelection, setMulliganSelection] =
    useState<number[]>([])

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

  /**
   * ゲームリセット
   */
  const handleReset = () => {
    setGame(createInitialGameState())
    setSelectedAttackerId(null)
    setMulliganSelection([])
  }

  /**
   * マリガンの選択切替
   */
  const handleToggleMulligan = (index: number) => {
    setMulliganSelection(previous =>
      previous.includes(index)
        ? previous.filter(value => value !== index)
        : [...previous, index]
    )
  }

  /**
   * マリガン確定
   */
  const handleConfirmMulligan = () => {
    const indices = [...mulliganSelection]

    setGame(previous =>
      confirmMulligan(previous, indices)
    )

    setMulliganSelection([])
  }

  /**
   * ターン終了
   */
  const handleEndTurn = () => {
    setGame(previous => endTurn(previous))
    setSelectedAttackerId(null)
  }

  /**
   * カードをプレイ
   */
  const handlePlayCard = (handIndex: number) => {
    setGame(previous =>
      playCard(
        previous,
        previous.currentPlayerId,
        handIndex
      )
    )
  }

  /**
   * 攻撃フォロワー選択
   */
  const handleSelectAttacker = (follower: Follower) => {
    if (game.winnerId !== null) return
    if (!canFollowerAttack(follower)) return

    setSelectedAttackerId(previous =>
      previous === follower.instanceId
        ? null
        : follower.instanceId
    )
  }

  /**
   * 敵フォロワー攻撃
   */
  const handleAttackFollower = (targetId: string) => {
    if (!selectedAttackerId) return

    const attackerId = selectedAttackerId

    setGame(previous =>
      attackFollower(previous, attackerId, targetId)
    )

    setSelectedAttackerId(null)
  }

  /**
   * 敵リーダー攻撃
   */
  const handleAttackLeader = () => {
    if (!selectedAttackerId) return

    const attackerId = selectedAttackerId

    setGame(previous =>
      attackLeader(previous, attackerId)
    )

    setSelectedAttackerId(null)
  }

  /**
   * フィールド上のフォロワー
   */
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
        <strong>
          {card?.name ?? '不明なカード'}
        </strong>

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

  /**
   * フィールド表示
   */
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

  /**
   * マリガン画面
   */
  if (game.phase === 'mulligan') {
    return (
      <div className="game">
        <header className="game-header">
          <h1>原神カードゲーム</h1>
          <span>ゲーム準備</span>

          <button type="button" onClick={handleReset}>
            ゲームリセット
          </button>
        </header>

        <main
          style={{
            maxWidth: 850,
            margin: '60px auto',
            textAlign: 'center',
          }}
        >
          <h2>
            {currentPlayer.name} のマリガン
          </h2>

          <p>
            交換したいカードを選択してください。
          </p>

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
            {currentPlayer.hand.map(
              (cardId, index) => {
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
                      boxShadow: selected
                        ? '0 0 18px #ffd24d88'
                        : 'none',
                    }}
                  >
                    <span>
                      コスト {card.cost}
                    </span>

                    <strong>{card.name}</strong>

                    <span>
                      {card.attack} / {card.health}
                    </span>

                    <span>
                      {selected
                        ? '交換する ✓'
                        : 'キープ'}
                    </span>
                  </button>
                )
              }
            )}
          </div>

          <button
            type="button"
            className="end-turn"
            style={{
              marginLeft: 0,
              fontSize: 18,
              padding: '14px 35px',
            }}
            onClick={handleConfirmMulligan}
          >
            {mulliganSelection.length === 0
              ? 'すべてキープして確定'
              : `${mulliganSelection.length}枚交換して確定`}
          </button>

          <p style={{ marginTop: 25 }}>
            デッキ残数：
            {currentPlayer.deck.length}枚
          </p>

          <p style={{ color: '#a5bbc1' }}>
            {currentPlayer.id === 'player1'
              ? '確定後、プレイヤー2のマリガンに進みます。'
              : '確定後、プレイヤー1のターンが始まります。'}
          </p>
        </main>
      </div>
    )
  }

  /**
   * 通常の対戦画面
   */
  return (
    <div className="game">
      <header className="game-header">
        <h1>原神カードゲーム</h1>

        <span>TURN {game.turn}</span>

        <button
          type="button"
          onClick={handleReset}
        >
          ゲームリセット
        </button>
      </header>

      {winner && (
        <div className="winner-banner">
          {winner.name} の勝利！
        </div>
      )}

      {/* 相手プレイヤー */}
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
            game.winnerId !== null
          }
          onClick={handleAttackLeader}
        >
          <strong>{opponent.name}</strong>

          <span>
            HP {opponent.leaderHealth}
            {' / '}
            {opponent.leaderMaxHealth}
          </span>
        </button>

        <div className="pp">
          PP {opponent.pp} / {opponent.maxPp}
        </div>

        <div>
          デッキ：{opponent.deck.length}枚
        </div>

        <div>
          手札：{opponent.hand.length}枚
        </div>

        <div>
          墓場：{opponent.graveyard.length}枚
        </div>
      </section>

      {/* フィールド */}
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

      {/* 自分プレイヤー */}
      <section className="player self">
        <div className="leader">
          <strong>{currentPlayer.name}</strong>

          <span>
            HP {currentPlayer.leaderHealth}
            {' / '}
            {currentPlayer.leaderMaxHealth}
          </span>
        </div>

        <div className="pp">
          PP {currentPlayer.pp} / {currentPlayer.maxPp}
        </div>

        <div>
          デッキ：{currentPlayer.deck.length}枚
        </div>

        <div>
          手札：{currentPlayer.hand.length}枚
        </div>

        <div>
          墓場：{currentPlayer.graveyard.length}枚
        </div>

        <button
          type="button"
          className="end-turn"
          disabled={game.winnerId !== null}
          onClick={handleEndTurn}
        >
          ターン終了
        </button>
      </section>

      {/* 操作案内 */}
      <div className="battle-message">
        {winner
          ? 'ゲーム終了'
          : selectedAttacker
            ? '攻撃対象を選択してください'
            : '攻撃可能なフォロワーを選択してください'}
      </div>

      {/* 手札 */}
      <footer className="hand">
        {currentPlayer.hand.map(
          (cardId, index) => {
            const card = getCard(cardId)

            if (!card) return null

            const playable =
              game.winnerId === null &&
              card.type === 'follower' &&
              card.cost <= currentPlayer.pp &&
              currentPlayer.field.length < 5

            return (
              <button
                type="button"
                className="hand-card"
                key={`${cardId}-${index}`}
                disabled={!playable}
                onClick={() =>
                  handlePlayCard(index)
                }
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
          }
        )}
      </footer>
    </div>
  )
}

export default App
