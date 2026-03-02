import {
  motion, useMotionValue, useSpring, useTransform, AnimatePresence,
} from 'framer-motion'
import { Children, cloneElement, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { MotionValue } from 'framer-motion'
import './Dock.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type SpringConfig = { mass: number; stiffness: number; damping: number }

// ─── DockItem ─────────────────────────────────────────────────────────────────

interface DockItemInternalProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  mouseX: MotionValue<number>
  spring: SpringConfig
  distance: number
  magnification: number
  baseItemSize: number
}

function DockItem({
  children, className = '', onClick,
  mouseX, spring, distance, magnification, baseItemSize,
}: DockItemInternalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isHovered = useMotionValue(0)

  // Stable center X — only refreshed when the dock is idle (items at rest).
  // Reading getBoundingClientRect() during animation causes a feedback loop:
  // item grows → flex shifts neighbours → rect.x changes → distance changes → repeat.
  const stableCenterX = useRef(0)

  useEffect(() => {
    const snapCenter = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) stableCenterX.current = rect.left + rect.width / 2
    }
    // Initial snap after first layout
    const frame = requestAnimationFrame(snapCenter)
    window.addEventListener('resize', snapCenter)
    // Re-snap only after spring has settled (~350 ms) so we capture true rest position
    let settleTimer: ReturnType<typeof setTimeout>
    const unsub = mouseX.on('change', val => {
      if (val === Infinity) {
        clearTimeout(settleTimer)
        settleTimer = setTimeout(() => requestAnimationFrame(snapCenter), 400)
      }
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settleTimer)
      window.removeEventListener('resize', snapCenter)
      unsub()
    }
  }, [mouseX])

  const mouseDistance = useTransform(mouseX, (val: number) => {
    if (val === Infinity) return Infinity
    return val - stableCenterX.current
  })

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize],
  )
  const size = useSpring(targetSize, spring)

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={`dock-item ${className}`}
      tabIndex={0}
      role="button"
    >
      {Children.map(children, child =>
        cloneElement(
          child as ReactElement<{ isHovered?: MotionValue<number> }>,
          { isHovered },
        ),
      )}
    </motion.div>
  )
}

// ─── DockLabel ────────────────────────────────────────────────────────────────

function DockLabel({
  children, className = '', isHovered,
}: {
  children: ReactNode
  className?: string
  isHovered?: MotionValue<number>
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isHovered) return
    return isHovered.on('change', v => setVisible(v === 1))
  }, [isHovered])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -6 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.15 }}
          className={`dock-label ${className}`}
          role="tooltip"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── DockIcon ─────────────────────────────────────────────────────────────────

function DockIcon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`dock-icon ${className}`}>{children}</div>
}

// ─── Dock (public) ────────────────────────────────────────────────────────────

export interface DockItemConfig {
  icon: ReactNode
  label: string
  onClick?: () => void
  className?: string
}

export interface DockProps {
  items: DockItemConfig[]
  className?: string
  spring?: SpringConfig
  magnification?: number
  distance?: number
  panelHeight?: number
  dockHeight?: number
  baseItemSize?: number
}

export default function Dock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 64,
  distance = 120,
  panelHeight = 58,
  dockHeight = 200,
  baseItemSize = 40,
}: DockProps) {
  const mouseX = useMotionValue(Infinity)
  const isHovered = useMotionValue(0)

  const maxHeight = useMemo(
    () => Math.max(dockHeight, magnification + magnification / 2 + 4),
    [dockHeight, magnification],
  )
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight])
  const height = useSpring(heightRow, spring)

  return (
    <motion.div style={{ height }} className={`dock-outer ${className}`}>
      <motion.div
        onMouseMove={({ pageX }) => { isHovered.set(1); mouseX.set(pageX) }}
        onMouseLeave={() => { isHovered.set(0); mouseX.set(Infinity) }}
        className="dock-panel"
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Navigation dock"
      >
        {items.map((item, i) => (
          <DockItem
            key={i}
            onClick={item.onClick}
            className={item.className ?? ''}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
          >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  )
}
