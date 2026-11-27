import { useEffect, useRef, useState } from 'react'

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Short vibration on Android; silently ignored elsewhere. */
export function haptic(ms = 12): void {
  try { navigator.vibrate?.(ms) } catch { /* ignore */ }
}

const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Animates a number from its previous value to `target`. */
export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(target)
  const from = useRef(0)
  useEffect(() => {
    if (reduceMotion()) { setValue(target); from.current = target; return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(a + (target - a) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = target }
  }, [target, ms])
  return value
}

/**
 * Horizontal swipe on an element: the content follows the finger, and a swipe
 * past the threshold calls onSwipe(-1 | 1). Ignored inside [data-noswipe] or when disabled.
 */
export function useSwipe(onSwipe: (dir: -1 | 1) => void, disabled: boolean) {
  // callback ref: the element may mount after the first render (loading state)
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const cb = useRef(onSwipe)
  cb.current = onSwipe
  useEffect(() => {
    if (!el || disabled) return
    let x0 = 0, y0 = 0, dx = 0, mode: 'none' | 'h' | 'v' = 'none', active = false
    const reset = () => { el.style.transition = 'transform .25s ease, opacity .25s ease'; el.style.transform = ''; el.style.opacity = '' }
    const start = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('[data-noswipe], input, select, textarea')) { active = false; return }
      active = true; mode = 'none'; dx = 0
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY
      el.style.transition = 'none'
    }
    const move = (e: TouchEvent) => {
      if (!active) return
      dx = e.touches[0].clientX - x0
      const dy = e.touches[0].clientY - y0
      if (mode === 'none' && Math.abs(dx) + Math.abs(dy) > 10) mode = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v'
      if (mode === 'h') {
        el.style.transform = `translateX(${dx * 0.55}px)`
        el.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / 900))
      }
    }
    const end = () => {
      if (!active) return
      active = false
      if (mode === 'h' && Math.abs(dx) > 70) {
        el.style.transition = 'none'; el.style.transform = ''; el.style.opacity = ''
        cb.current(dx < 0 ? 1 : -1)
      } else reset()
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: true })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [el, disabled])
  return setEl
}
