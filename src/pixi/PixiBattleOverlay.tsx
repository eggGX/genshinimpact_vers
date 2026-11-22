import { useEffect, useRef } from 'react'
import { Application, Graphics, Text, type Ticker } from 'pixi.js'
import { drawReactionBurst, reactionFromFrameLabel, type ReactionFx } from './reactionFx'
import { spawnAttackTrail, type AttackCue } from './attackFx'

type ElementFx = 'pyro' | 'hydro' | 'cryo' | 'electro' | 'anemo' | 'geo' | 'dendro'
const ELEMENT_COLORS: Record<ElementFx, { main: number; light: number }> = {
  pyro: { main: 0xff703a, light: 0xffdc80 },
  hydro: { main: 0x3cbdff, light: 0xb2efff },
  cryo: { main: 0x8deafa, light: 0xf0ffff },
  electro: { main: 0xb46aff, light: 0xf0baff },
  anemo: { main: 0x54e2be, light: 0xc8ffec },
  geo: { main: 0xe5b34f, light: 0xffe6a0 },
  dendro: { main: 0x80dc54, light: 0xdbff9e },
}
const ELEMENTS = Object.keys(ELEMENT_COLORS) as ElementFx[]

function detectedElement(target: HTMLElement): ElementFx | null {
  const marker = target.querySelector<HTMLElement>('.elemental-hit')
  if (!marker) return null
  return ELEMENTS.find(element => marker.classList.contains(`elemental-hit--${element}`)) ?? null
}

function polygon(graphics: Graphics, x: number, y: number, radius: number, sides: number, rotation: number) {
  for (let corner = 0; corner < sides; corner += 1) {
    const angle = rotation + (Math.PI * 2 * corner) / sides
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (!corner) graphics.moveTo(px, py)
    else graphics.lineTo(px, py)
  }
  graphics.closePath()
}

/** Seven distinct shapes as well as elemental colours; all purely decorative. */
function drawParticle(g: Graphics, element: ElementFx, x: number, y: number, size: number, alpha: number, angle: number) {
  const { main, light } = ELEMENT_COLORS[element]
  switch (element) {
    case 'pyro':
      // Rising flame tongues.
      g.moveTo(x, y - size * 1.8).lineTo(x + size * 0.7, y + size * 0.6)
        .lineTo(x, y + size).lineTo(x - size * 0.8, y + size * 0.3)
        .closePath().fill({ color: main, alpha })
      g.circle(x, y + size * 0.2, size * 0.34).fill({ color: light, alpha })
      break
    case 'hydro':
      // Tear-shaped water splashes.
      g.moveTo(x, y - size * 1.45).bezierCurveTo(x + size * 1.6, y + size * 0.3, x + size, y + size, x, y + size)
        .bezierCurveTo(x - size, y + size, x - size * 1.6, y + size * 0.3, x, y - size * 1.45)
        .fill({ color: main, alpha })
      g.circle(x - size * 0.2, y + size * 0.15, size * 0.22).fill({ color: light, alpha })
      break
    case 'cryo':
      // Six-pointed snow crystals.
      for (let arm = 0; arm < 3; arm += 1) {
        const a = angle + arm * Math.PI / 3
        g.moveTo(x - Math.cos(a) * size, y - Math.sin(a) * size)
          .lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size)
          .stroke({ color: light, alpha, width: 1.8 })
      }
      g.circle(x, y, size * 0.22).fill({ color: main, alpha })
      break
    case 'electro':
      // Small jagged arcs rather than ordinary sparks.
      g.moveTo(x - size, y - size * 0.8)
        .lineTo(x + size * 0.1, y - size * 0.2)
        .lineTo(x - size * 0.4, y + size * 0.2)
        .lineTo(x + size, y + size)
        .stroke({ color: main, alpha, width: 3 })
      g.circle(x + size, y + size, size * 0.2).fill({ color: light, alpha })
      break
    case 'anemo':
      // Curved gusts spiralling outwards.
      g.arc(x, y, size * 1.2, angle, angle + Math.PI * 1.3)
        .stroke({ color: main, alpha, width: 2.7 })
      g.circle(x + Math.cos(angle) * size, y + Math.sin(angle) * size, 1.8)
        .fill({ color: light, alpha })
      break
    case 'geo':
      // Angular stone shards.
      polygon(g, x, y, size, 4, angle + Math.PI / 4)
      g.fill({ color: main, alpha })
      polygon(g, x, y, size * 0.45, 4, angle + Math.PI / 4)
      g.fill({ color: light, alpha: alpha * 0.8 })
      break
    case 'dendro':
      // Leaves with a bright central vein.
      g.moveTo(x, y - size * 1.4)
        .bezierCurveTo(x + size * 1.6, y - size * 0.7, x + size, y + size, x, y + size * 1.2)
        .bezierCurveTo(x - size * 1.3, y + size * 0.4, x - size * 1.3, y - size * 0.7, x, y - size * 1.4)
        .fill({ color: main, alpha })
      g.moveTo(x, y - size).lineTo(x, y + size * 0.7)
        .stroke({ color: light, alpha, width: 1.5 })
      break
  }
}

function spawnImpact(
  app: Application, x: number, y: number, radius: number,
  element: ElementFx | null, onEnd: (stop: () => void) => void,
  reaction: ReactionFx | null = null,
): () => void {
  const graphics = new Graphics()
  app.stage.addChild(graphics)
  const reactionTitle = reaction ? new Text({ text: reaction, style: {
    fontFamily: 'Noto Sans JP, sans-serif', fontSize: 35,
    fill: 0xfff2ce, fontWeight: 'bold', stroke: { color: 0x172331, width: 5 },
  } }) : null
  if (reactionTitle) {
    reactionTitle.anchor.set(0.5)
    reactionTitle.position.set(x, y - 37)
    app.stage.addChild(reactionTitle)
  }
  const colors = element ? ELEMENT_COLORS[element] : { main: 0xffd68a, light: 0xffffff }
  let elapsed = 0
  let stopped = false
  const duration = 720

  const stop = () => {
    if (stopped) return
    stopped = true
    app.ticker.remove(tick)
    graphics.destroy()
    reactionTitle?.destroy()
    onEnd(stop)
  }
  const tick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS
    const progress = Math.min(1, elapsed / duration)
    const fade = (1 - progress) ** 1.35
    graphics.clear()
    if (reactionTitle) {
      reactionTitle.alpha = Math.min(1, progress * 8) * Math.min(1, (1 - progress) * 3)
      reactionTitle.position.y = y - 37 - 32 * progress
    }
    if (reaction) {
      drawReactionBurst(graphics, reaction, x, y, radius, progress)
      if (progress >= 1) stop()
      return
    }
    graphics.circle(x, y, 9 + progress * radius)
      .stroke({ color: colors.main, alpha: 0.87 * fade, width: 5 * fade + 0.5 })
    graphics.circle(x, y, 6 + progress * radius * 0.58)
      .stroke({ color: colors.light, alpha: 0.65 * fade, width: 2.5 * fade + 0.3 })

    if (element) {
      for (let i = 0; i < 13; i += 1) {
        const angle = i * Math.PI * 2 / 13 + (element === 'anemo' ? progress * 2.1 : 0)
        const distance = 11 + progress * radius * (0.72 + (i % 3) * 0.13)
        const size = 3.4 + (i % 4) * 1.1
        const upward = element === 'pyro' ? progress * radius * 0.38 : 0
        const downward = element === 'hydro' ? progress * radius * 0.2 : 0
        drawParticle(graphics, element, x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance - upward + downward, size, fade, angle)
      }
    }
    if (progress >= 1) stop()
  }
  app.ticker.add(tick)
  app.ticker.start()
  return stop
}

/**
 * Non-interactive overlay using the existing battle damage and elemental cues.
 * Game logic and the React/CSS animations are intentionally unchanged.
 */
export function PixiBattleOverlay({ cue, attack }: { cue: { label: string; effectTarget?: string } | null; attack: AttackCue | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const activeEffects = useRef<Array<() => void>>([])
  const previousImpact = useRef<{ x: number; y: number; radius: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const app = new Application()
    let cancelled = false
    let ready = false

    void (async () => {
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resizeTo: container,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: 'webgl',
        })
        ready = true
        if (cancelled) {
          app.destroy({ removeView: true }, { children: true })
          return
        }
        app.canvas.style.display = 'block'
        app.canvas.style.pointerEvents = 'none'
        container.appendChild(app.canvas)
        appRef.current = app
        app.ticker.stop()
      } catch (error) {
        if (!cancelled) console.warn('PixiJS overlay could not initialize:', error)
      }
    })()

    return () => {
      cancelled = true
      for (const stop of [...activeEffects.current]) stop()
      activeEffects.current = []
      appRef.current = null
      if (ready) app.destroy({ removeView: true }, { children: true })
    }
  }, [])

  useEffect(() => {
    if (!attack) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const request = window.requestAnimationFrame(() => {
      const app = appRef.current
      const host = containerRef.current
      const battle = host?.parentElement
      if (!app || !host || !battle) return
      const elements = Array.from(battle.querySelectorAll<HTMLElement>('[data-pixi-id]'))
      const source = elements.find(node => node.dataset.pixiId === attack.attackerId)
      const target = elements.find(node => node.dataset.pixiId === attack.targetId)
      if (!source || !target) return
      const canvasBounds = host.getBoundingClientRect()
      const from = source.getBoundingClientRect()
      const to = target.getBoundingClientRect()
      if (!from.width || !from.height || !to.width || !to.height) return
      const stop = spawnAttackTrail(app, {
        x: from.left + from.width / 2 - canvasBounds.left,
        y: from.top + from.height / 2 - canvasBounds.top,
      }, {
        x: to.left + to.width / 2 - canvasBounds.left,
        y: to.top + to.height / 2 - canvasBounds.top,
      }, attack.duration, finished => {
        activeEffects.current = activeEffects.current.filter(item => item !== finished)
        if (!activeEffects.current.length) app.ticker.stop()
      })
      activeEffects.current.push(stop)
    })
    return () => window.cancelAnimationFrame(request)
    // The frame object remains stable during the attack; ordinary rerenders
    // must not launch duplicate trails.
  }, [attack?.key])

  useEffect(() => {
    if (!cue) {
      previousImpact.current = null
      return
    }
    const reaction = reactionFromFrameLabel(cue.label)
    const request = window.requestAnimationFrame(() => {
      const app = appRef.current
      const host = containerRef.current
      if (!app || !host) return
      const battle = host.parentElement
      if (!battle) return
      const targets = battle.querySelectorAll<HTMLElement>(
        '.follower-wrapper.battle-damaged, .follower-wrapper.battle-hit, ' +
        '.follower-wrapper.battle-destroying, .leader.leader-damaged, .leader.leader-hit',
      )
      const bounds = host.getBoundingClientRect()
      const getPosition = (target: HTMLElement) => {
        const rect = target.getBoundingClientRect()
        if (!rect.width || !rect.height) return null
        return {
          x: rect.left + rect.width / 2 - bounds.left,
          y: rect.top + rect.height / 2 - bounds.top,
          radius: Math.max(42, Math.min(115, rect.width * 0.75)),
        }
      }
      const play = (position: { x: number; y: number; radius: number },
        element: ElementFx | null, kind: ReactionFx | null) => {
        previousImpact.current = position
        const stop = spawnImpact(app, position.x, position.y, position.radius, element, finished => {
          activeEffects.current = activeEffects.current.filter(item => item !== finished)
          if (!activeEffects.current.length) app.ticker.stop()
        }, kind)
        activeEffects.current.push(stop)
      }

      if (reaction) {
        // The game engine supplies the exact public instance ID for this reaction.
        // Do not rely on damage highlight classes: freezing, crystallize, etc.
        // may not change HP and therefore have no damage highlight.
        const exactTarget = cue.effectTarget
          ? Array.from(battle.querySelectorAll<HTMLElement>('[data-pixi-id]'))
            .find(node => node.dataset.pixiId === cue.effectTarget)
          : undefined
        const highlighted = Array.from(targets).find(node =>
          node.querySelector('.elemental-hit') || node.classList.contains('battle-damaged'))
        const position = (exactTarget && getPosition(exactTarget)) ||
          (highlighted && getPosition(highlighted)) ||
          previousImpact.current ||
          (() => {
            // Last resort for older online frames without effectTarget metadata.
            const field = battle.querySelector<HTMLElement>('.field')
            return field ? getPosition(field) : null
          })()
        if (position) play(position, null, reaction)
        return
      }

      let count = 0
      targets.forEach(target => {
        if (count >= 12) return
        const elementalMarker = target.querySelector<HTMLElement>('.elemental-hit')
        const hasDamage = target.classList.contains('battle-damaged') ||
          target.classList.contains('battle-destroying') ||
          target.querySelector('.battle-float-number--damage, .battle-float-number--shield')
        if (!hasDamage && !elementalMarker) return
        const position = getPosition(target)
        if (!position) return
        count += 1
        play(position, detectedElement(target), null)
      })
    })
    return () => window.cancelAnimationFrame(request)
  }, [cue])

  return (
    <div
      aria-hidden="true"
      className="pixi-battle-overlay"
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 20,
      }}
    />
  )
}
