import { describe, expect, it } from 'vitest'
import type { Place } from '../../types/photo'
import { distanceMeters, selectNearestPlace } from '../../utils/geo'

function place(id: string, latitude: number, longitude: number, radiusMeters: number): Place {
  return {
    id,
    name: id,
    latitude,
    longitude,
    radiusMeters,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('distanceMeters', () => {
  it('同じ地点なら 0 を返す', () => {
    expect(distanceMeters(41.8418, 140.7669, 41.8418, 140.7669)).toBe(0)
  })

  it('緯度 1 度の差はおよそ 111km になる', () => {
    expect(distanceMeters(41, 140, 42, 140)).toBeCloseTo(111195, -2)
  })

  it('東京駅から函館駅までの距離がおよそ 680km になる', () => {
    const distance = distanceMeters(35.6812, 139.7671, 41.7737, 140.7263)
    expect(distance).toBeGreaterThan(670000)
    expect(distance).toBeLessThan(690000)
  })
})

describe('selectNearestPlace', () => {
  it('場所が登録されていなければ null を返す', () => {
    expect(selectNearestPlace([], 41.8418, 140.7669)).toBeNull()
  })

  it('判定半径の外にある場所は選ばない', () => {
    const far = place('far', 41.85, 140.7669, 100)
    expect(selectNearestPlace([far], 41.8418, 140.7669)).toBeNull()
  })

  it('判定半径内の場所が複数あれば最も近い場所を選ぶ', () => {
    const near = place('near', 41.8419, 140.7669, 500)
    const nearer = place('nearer', 41.84181, 140.7669, 500)
    expect(selectNearestPlace([near, nearer], 41.8418, 140.7669)?.id).toBe('nearer')
  })

  it('より近くても判定半径の外なら、遠いが半径内の場所を選ぶ', () => {
    const closeButSmall = place('closeButSmall', 41.8420, 140.7669, 10)
    const fartherButLarge = place('fartherButLarge', 41.8430, 140.7669, 500)
    expect(selectNearestPlace([closeButSmall, fartherButLarge], 41.8418, 140.7669)?.id).toBe('fartherButLarge')
  })
})
