import type { FlickDirection } from '~/types/photo'

export const FLICK_THRESHOLD_PX = 52

export function resolveDirection(deltaX: number, deltaY: number): FlickDirection | null {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < FLICK_THRESHOLD_PX) {
    return null
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? 'right' : 'left'
  }

  return deltaY > 0 ? 'down' : 'up'
}
