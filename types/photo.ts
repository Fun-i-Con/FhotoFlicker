export type FlickDirection = 'up' | 'right' | 'down' | 'left'

export interface Category {
  id: string
  name: string
  color: string
  direction: FlickDirection
  createdAt: string
  updatedAt: string
}

export interface PhotoItem {
  id: string
  image: Blob
  imageType: string
  categoryId: string
  direction: FlickDirection
  createdAt: string
}

export interface DraftPhoto {
  id: string
  image: Blob
  imageType: string
  createdAt: string
}

export const flickDirections: FlickDirection[] = ['up', 'right', 'down', 'left']

export const directionLabels: Record<FlickDirection, string> = {
  up: '上',
  right: '右',
  down: '下',
  left: '左'
}
