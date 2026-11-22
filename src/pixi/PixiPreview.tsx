import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Text } from 'pixi.js'

/**
 * Standalone PixiJS rendering smoke test.
 * This is intentionally not wired into the live battle UI yet.
 */
export function PixiPreview() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const host = mountRef.current
    if (!host) return

    let disposed = false
    let initialized = false
    const app = new Application()

    const init = async () => {
      try {
        await app.init({
          background: '#101829',
          resizeTo: host,
          antialias: true,
          preference: 'webgl',
        })
        initialized = true
        if (disposed) {
          app.destroy({ removeView: true }, { children: true })
          return
        }

        host.appendChild(app.canvas)

        const stage = new Container()
        const background = new Graphics()
        const heading = new Text({
          text: 'PixiJS rendering test',
          style: { fontFamily: 'sans-serif', fontSize: 32, fill: '#ffffff', fontWeight: 'bold' },
        })
        const description = new Text({
          text: 'The original battle screen has not been changed.',
          style: { fontFamily: 'sans-serif', fontSize: 17, fill: '#c1d1e9' },
        })

        background.roundRect(0, 0, 900, 500, 24).fill('#1f3150')
        background.roundRect(70, 200, 140, 205, 12).fill('#3995ca')
        background.roundRect(245, 200, 140, 205, 12).fill('#a87ddb')
        background.roundRect(420, 200, 140, 205, 12).fill('#d9895e')
        heading.position.set(70, 65)
        description.position.set(70, 118)
        stage.addChild(background, heading, description)
        app.stage.addChild(stage)

        // Fit a fixed logical board into the available view, without scrolling.
        const fit = () => {
          const scale = Math.min(app.screen.width / 900, app.screen.height / 500)
          stage.scale.set(scale)
          stage.position.set(
            (app.screen.width - 900 * scale) / 2,
            (app.screen.height - 500 * scale) / 2,
          )
        }
        app.renderer.on('resize', fit)
        fit()
      } catch (cause) {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : 'PixiJS initialization failed')
        }
      }
    }

    void init()
    return () => {
      disposed = true
      if (initialized) app.destroy({ removeView: true }, { children: true })
    }
  }, [])

  return (
    <section style={{ width: '100%', height: '100dvh', overflow: 'hidden', background: '#101829' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {error && <p role="alert">PixiJS error: {error}</p>}
    </section>
  )
}
