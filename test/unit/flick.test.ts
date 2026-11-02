import { describe, expect, it } from 'vitest'
import { FLICK_THRESHOLD_PX, resolveDirection } from '../../utils/flick'

describe('resolveDirection', () => {
  it('移動量がしきい値未満なら null を返す', () => {
    expect(resolveDirection(0, 0)).toBeNull()
    expect(resolveDirection(FLICK_THRESHOLD_PX - 1, 0)).toBeNull()
    expect(resolveDirection(0, -(FLICK_THRESHOLD_PX - 1))).toBeNull()
  })

  it('しきい値ちょうどで方向を返す', () => {
    expect(resolveDirection(FLICK_THRESHOLD_PX, 0)).toBe('right')
  })

  it('横の移動量が大きければ左右を返す', () => {
    expect(resolveDirection(100, 30)).toBe('right')
    expect(resolveDirection(-100, -30)).toBe('left')
  })

  it('縦の移動量が大きければ上下を返す', () => {
    expect(resolveDirection(30, 100)).toBe('down')
    expect(resolveDirection(-30, -100)).toBe('up')
  })

  it('縦横の移動量が同じなら上下を返す', () => {
    expect(resolveDirection(80, 80)).toBe('down')
    expect(resolveDirection(80, -80)).toBe('up')
  })
})
