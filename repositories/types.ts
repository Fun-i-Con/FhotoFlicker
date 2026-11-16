import type { Category, DraftPhoto, FlickDirection, PhotoItem, Place } from '~/types/photo'

export type CategoryInput = Pick<Category, 'name' | 'color' | 'direction'> & { id?: string }
export type PlaceInput = Omit<Place, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

export interface PhotoFilters {
  placeId?: string
  categoryId?: string
}

export interface CategoryRepository {
  list(): Promise<Category[]>
  save(input: CategoryInput): Promise<Category>
  delete(id: string): Promise<void>
}

export interface PlaceRepository {
  list(): Promise<Place[]>
  save(input: PlaceInput): Promise<Place>
  delete(id: string): Promise<void>
}

export interface PhotoRepository {
  addDraft(file: File, placeId?: string): Promise<DraftPhoto>
  listDrafts(): Promise<DraftPhoto[]>
  classify(draftId: string, direction: FlickDirection): Promise<PhotoItem>
  list(filters?: PhotoFilters): Promise<PhotoItem[]>
  get(id: string): Promise<PhotoItem | undefined>
  delete(id: string): Promise<void>
  getImageUrls(ids: string[]): Promise<Map<string, string>>
  // 保存先によって URL の後始末が違う（IndexedDB 版は Blob URL の解放が必要）
  releaseImageUrl(url: string): void
}

export interface Repositories {
  categoryRepository: CategoryRepository
  placeRepository: PlaceRepository
  photoRepository: PhotoRepository
}
