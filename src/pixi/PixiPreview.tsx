import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Text } from 'pixi.js'

/**
 * PixiJS battlefield layout prototype.
 *
 * All values below are sample display data: this screen does NOT read or change
 * the actual game state. The original battle UI is unaffected.
 */
const BOARD_WIDTH = 1440
const BOARD_HEIGHT = 810
const GOLD = 0xc8a96c
const MUTED = 0xaeb9ba
const FONT = '"Noto Sans JP", sans-serif'

function panel(parent: Container, x: number, y: number, width: number, height: number, fill: number, radius = 14, outline = GOLD, alpha = 1) {
  const g = new Graphics()
  g.roundRect(x, y, width, height, radius).fill({ color: fill, alpha })
  g.roundRect(x, y, width, height, radius).stroke({ color: outline, alpha: 0.65, width: 1.5 })
  parent.addChild(g)
  return g
}

function label(parent: Container, value: string, x: number, y: number, size = 17, color = 0xf0e6cc, anchorX = 0, weight: 'normal' | 'bold' = 'normal') {
  const text = new Text({ text: value, style: { fontFamily: FONT, fontSize: size, fill: color, fontWeight: weight } })
  text.anchor.set(anchorX, 0.5)
  text.position.set(x, y)
  parent.addChild(text)
  return text
}

function circle(parent: Container, x: number, y: number, radius: number, fill: number, outline = GOLD, outlineAlpha = 0.8) {
  const g = new Graphics()
  g.circle(x, y, radius).fill(fill)
  g.circle(x, y, radius).stroke({ color: outline, width: 2, alpha: outlineAlpha })
  parent.addChild(g)
}

function crestRow(parent: Container, y: number, title: string) {
  label(parent, title, 185, y + 1, 13, 0xcbb788)
  for (let i = 0; i < 5; i += 1) {
    circle(parent, 298 + i * 42, y, 15, 0x132a35, 0x907c52, 0.8)
  }
}

function resourceRow(parent: Container, x: number, y: number, title: string, active: number, total: number, color: number) {
  label(parent, title, x, y, 14, 0xcdb77d, 0, 'bold')
  for (let i = 0; i < total; i += 1) {
    circle(parent, x + 90 + i * 26, y, 8, i < active ? color : 0x1e3440, i < active ? 0xe3f1d6 : 0x536a72)
  }
  label(parent, `${active}/${total}`, x + 380, y, 16, 0xffffff, 1, 'bold')
}

function leader(parent: Container, x: number, y: number, name: string, health: number, friendly: boolean) {
  panel(parent, x, y, 124, 125, 0x1b3541, 16)
  circle(parent, x + 62, y + 46, 36, friendly ? 0x2f626a : 0x59454f)
  label(parent, friendly ? '蛍' : '空', x + 62, y + 46, 31, 0xf6e9c9, 0.5, 'bold')
  label(parent, name, x + 62, y + 91, 14, 0xd7c9a9, 0.5)
  panel(parent, x + 30, y + 103, 64, 29, 0x612a32, 14, 0xd98c88)
  label(parent, String(health), x + 62, y + 116, 19, 0xffe9e9, 0.5, 'bold')
}

function card(parent: Container, x: number, y: number, friendly: boolean, index: number, isHand = false) {
  const width = isHand ? 97 : 112
  const height = isHand ? 135 : 125
  const colors = [0x2f647c, 0x586b93, 0x765b84, 0x796a49, 0x4d7c67]
  panel(parent, x, y, width, height, 0x152a3d, 10, isHand ? 0xd6b57e : 0x9e8b61)
  panel(parent, x + 7, y + 7, width - 14, height - (isHand ? 38 : 32), colors[index % colors.length], 6, 0x607a82, 0.9)
  circle(parent, x + 13, y + 13, 12, 0x244c80, 0xf3ce80)
  label(parent, String(index + 2), x + 13, y + 13, 13, 0xffffff, 0.5, 'bold')
  if (!isHand) {
    label(parent, `${2 + index}/${3 + index}`, x + width / 2, y + height - 15, 18, 0xffffff, 0.5, 'bold')
  } else {
    label(parent, `カード${index + 1}`, x + width / 2, y + height - 18, 12, 0xe6dec8, 0.5)
  }
  if (friendly && !isHand) {
    const glow = new Graphics()
    glow.roundRect(x - 2, y - 2, width + 4, height + 4, 11).stroke({ color: 0x7bc4b4, alpha: 0.5, width: 2 })
    parent.addChild(glow)
  }
}

function buildBoard(stage: Container) {
  const background = new Graphics()
  background.rect(0, 0, BOARD_WIDTH, BOARD_HEIGHT).fill(0x0b1824)
  background.ellipse(720, 406, 635, 310).fill({ color: 0x1d5558, alpha: 0.25 })
  background.roundRect(75, 18, 1290, 774, 22).fill({ color: 0x15313b, alpha: 0.75 })
  background.roundRect(75, 18, 1290, 774, 22).stroke({ color: GOLD, alpha: 0.7, width: 2 })
  stage.addChild(background)

  label(stage, 'GENSHIN CARD GAME', 108, 48, 21, 0xf0d6a4, 0, 'bold')
  label(stage, 'PixiJS 盤面レイアウト試作  ・  操作不可', 1332, 49, 14, MUTED, 1)
  panel(stage, 626, 28, 188, 42, 0x142a38, 12)
  label(stage, 'TURN 05', 720, 49, 22, 0xf4d6a1, 0.5, 'bold')

  // Opponent leader and status
  leader(stage, 125, 85, '相手リーダー', 20, false)
  crestRow(stage, 120, '相手クレスト')
  resourceRow(stage, 780, 124, '相手PP', 5, 7, 0x6cc4a6)
  resourceRow(stage, 780, 165, '元素エネルギー', 2, 5, 0xeebc5b)
  label(stage, '相手の手札 5枚', 1245, 205, 14, 0xc9bfa8, 1)

  // Central symmetrical play area
  panel(stage, 126, 230, 1188, 356, 0x102932, 22, 0xa79263, 0.96)
  label(stage, '相手の場', 171, 251, 15, 0xcbb788, 0)
  label(stage, '自分の場', 171, 565, 15, 0xcbb788, 0)
  const middle = new Graphics()
  middle.moveTo(157, 406).lineTo(1284, 406).stroke({ color: 0xc8a96c, alpha: 0.4, width: 2 })
  stage.addChild(middle)

  // Five board slots per player, with sample cards only in some.
  for (let i = 0; i < 5; i += 1) {
    const x = 380 + i * 147
    panel(stage, x, 259, 112, 125, 0x17353d, 10, 0x4c7476, 0.56)
    panel(stage, x, 427, 112, 125, 0x17353d, 10, 0x4c7476, 0.56)
  }
  card(stage, 380, 259, false, 0)
  card(stage, 527, 259, false, 1)
  card(stage, 527, 427, true, 1)
  card(stage, 674, 427, true, 2)
  card(stage, 821, 427, true, 3)

  // Player leader, resources and crest placeholders
  leader(stage, 125, 612, '自分のリーダー', 18, true)
  crestRow(stage, 639, '自分クレスト')
  resourceRow(stage, 780, 643, '自分PP', 4, 7, 0x6cc4a6)
  resourceRow(stage, 780, 683, '元素エネルギー', 3, 5, 0xeebc5b)
  panel(stage, 1182, 688, 146, 57, 0x386f71, 16, 0xc3ac71)
  label(stage, 'ターン終了', 1255, 716, 19, 0xffffff, 0.5, 'bold')

  // Hand is deliberately placed inside the fixed-height logical board.
  label(stage, '自分の手札', 536, 742, 13, 0xcdb77d, 1)
  for (let i = 0; i < 5; i += 1) {
    // Small overlapping miniature hand cards, all inside the board.
    const x = 550 + i * 105
    const y = 747
    const g = new Graphics()
    g.roundRect(x, y, 94, 45, 6).fill([0x325b76, 0x4c607b, 0x655373, 0x62725a, 0x725d45][i])
    g.roundRect(x, y, 94, 45, 6).stroke({ color: GOLD, width: 1.5 })
    stage.addChild(g)
    label(stage, String(i + 1), x + 16, y + 22, 16, 0xffffff, 0.5, 'bold')
  }
}

export function PixiPreview() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const host = mountRef.current
    if (!host) return

    let disposed = false
    let initialized = false
    let destroyed = false
    const app = new Application()

    const destroy = () => {
      if (destroyed || !initialized) return
      destroyed = true
      app.destroy({ removeView: true }, { children: true })
    }

    const init = async () => {
      try {
        await app.init({ background: '#0b1824', resizeTo: host, antialias: true, preference: 'webgl' })
        initialized = true
        if (disposed) {
          destroy()
          return
        }

        host.appendChild(app.canvas)
        const board = new Container()
        buildBoard(board)
        app.stage.addChild(board)

        const fit = () => {
          const scale = Math.min(app.screen.width / BOARD_WIDTH, app.screen.height / BOARD_HEIGHT)
          board.scale.set(scale)
          board.position.set(
            (app.screen.width - BOARD_WIDTH * scale) / 2,
            (app.screen.height - BOARD_HEIGHT * scale) / 2,
          )
        }
        app.renderer.on('resize', fit)
        fit()
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'PixiJS initialization failed')
      }
    }

    void init()
    return () => {
      disposed = true
      destroy()
    }
  }, [])

  return (
    <section style={{ width: '100%', height: '100dvh', overflow: 'hidden', background: '#0b1824' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {error && <p role="alert">PixiJS error: {error}</p>}
    </section>
  )
}
