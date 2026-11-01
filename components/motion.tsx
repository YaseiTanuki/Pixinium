'use client'

import Link from 'next/link'
import { MotionConfig, motion, type HTMLMotionProps, type Variants } from 'motion/react'
import type { ReactNode } from 'react'

export const MotionLink = motion.create(Link)
export const MotionDiv = motion.div
export const MotionArticle = motion.article
export const MotionSection = motion.section
export const MotionNav = motion.nav

const EASE = [0.22, 1, 0.36, 1] as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

export const popIn: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE } },
}

export const stagger = (step = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
})

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

// Reveals once when scrolled into view; children using fadeUp/popIn variants are staggered.
export function Reveal({ children, step, delay, ...props }: HTMLMotionProps<'div'> & { step?: number; delay?: number }) {
  return <motion.div variants={stagger(step, delay)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} {...props}>{children}</motion.div>
}

const PIXELS = [
  { left: '6%', top: '14%', size: 10, color: '#e94343', delay: 0 },
  { left: '92%', top: '10%', size: 14, color: '#f4b942', delay: 0.6 },
  { left: '48%', top: '4%', size: 8, color: '#6cc3a0', delay: 1.1 },
  { left: '84%', top: '58%', size: 10, color: '#e94343', delay: 1.7 },
  { left: '2%', top: '64%', size: 12, color: '#f4b942', delay: 0.9 },
]

// Decorative drifting pixels; CSS keyframes keep them on the compositor and off the main thread.
export function FloatingPixels() {
  return <div className="floating-pixels" aria-hidden="true">
    {PIXELS.map(({ left, top, size, color, delay }, index) => <span
      key={index}
      style={{ left, top, width: size, height: size, background: color, animationDelay: `${delay}s`, animationDuration: `${5 + index}s` }}
    />)}
  </div>
}