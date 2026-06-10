import type { Variants } from 'framer-motion'

export const pageEnter: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

export const cardStagger: Variants = {
  animate: { transition: { staggerChildren: 0.05 } },
}

export const cardItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}

export const slideOverEnter: Variants = {
  initial:  { x: '100%', opacity: 0 },
  animate:  { x: 0, opacity: 1, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
  exit:     { x: '100%', opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } },
}

export const modalEnter: Variants = {
  initial:  { scale: 0.96, opacity: 0 },
  animate:  { scale: 1, opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:     { scale: 0.96, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
}

export const listItem: Variants = {
  initial:  { opacity: 0, x: -6 },
  animate:  { opacity: 1, x: 0, transition: { duration: 0.15, ease: 'easeOut' } },
}

export const backdropEnter: Variants = {
  initial:  { opacity: 0 },
  animate:  { opacity: 1, transition: { duration: 0.2 } },
  exit:     { opacity: 0, transition: { duration: 0.15 } },
}
