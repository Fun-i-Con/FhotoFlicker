import {
  directionLabels,
  flickDirections,
  type Category,
  type DraftPhoto,
  type FlickDirection,
  type PhotoItem,
  type Place
} from '~/types/photo'

const DB_NAME = 'photo-flick-sorter'
const DB_VERSION = 3

type StoreName = 'categories' | 'drafts' | 'photos' | 'settings' | 'places'

const defaultColors: Record<FlickDirection, string> = {
  up: '#2563eb',
  right: '#16a34a',
  down: '#f59e0b',
  left: '#dc2626'
}

let dbPromise: Promise<IDBDatabase> | undefined

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

async function normalizeImageForStorage(image: Blob) {
  const buffer = await image.arrayBuffer()
  return new Blob([buffer], { type: image.type || 'image/jpeg' })
}

function openDb() {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    if (!import.meta.client || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains('categories')) {
        const categories = db.createObjectStore('categories', { keyPath: 'id' })
        categories.createIndex('direction', 'direction', { unique: true })
      }

      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' })
      }

      const photos = db.objectStoreNames.contains('photos')
        ? request.transaction!.objectStore('photos')
        : db.createObjectStore('photos', { keyPath: 'id' })

      if (!photos.indexNames.contains('categoryId')) {
        photos.createIndex('categoryId', 'categoryId')
      }
      if (!photos.indexNames.contains('createdAt')) {
        photos.createIndex('createdAt', 'createdAt')
      }
      if (!photos.indexNames.contains('placeId')) {
        photos.createIndex('placeId', 'placeId')
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('places')) {
        const places = db.createObjectStore('places', { keyPath: 'id' })
        places.createIndex('createdAt', 'createdAt')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

async function withStore<T>(storeName: StoreName, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const db = await openDb()

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const request = run(store)
    let value = undefined as T

    if (request) {
      request.onsuccess = () => {
        value = request.result
      }
      request.onerror = () => reject(request.error)
    }

    tx.oncomplete = () => resolve(value)
    tx.onerror = () => reject(tx.error)
  })
}

async function getAllFromStore<T>(storeName: StoreName) {
  return await withStore<T[]>(storeName, 'readonly', (store) => store.getAll())
}

async function seedCategories() {
  const existing = await getAllFromStore<Category>('categories')
  const seeded = await withStore<{ key: string; value: boolean } | undefined>(
    'settings',
    'readonly',
    (store) => store.get('category-seed')
  )

  if (seeded?.value) {
    return existing
  }

  if (existing.length > 0) {
    await withStore<IDBValidKey>('settings', 'readwrite', (store) => store.put({ key: 'category-seed', value: true }))
    return existing
  }

  const now = new Date().toISOString()
  const defaults: Category[] = flickDirections.map((direction) => ({
    id: createId('cat'),
    name: `${directionLabels[direction]}工程`,

    color: defaultColors[direction],
    direction,
    createdAt: now,
    updatedAt: now
  }))

  const db = await openDb()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['categories', 'settings'], 'readwrite')
    const store = tx.objectStore('categories')
    const settings = tx.objectStore('settings')

    defaults.forEach((category) => store.put(category))
    settings.put({ key: 'category-seed', value: true })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  return defaults
}

export function usePhotoDb() {
  const isReady = useState('photo-db-ready', () => false)
  const errorMessage = useState<string | null>('photo-db-error', () => null)

  async function init() {
    try {
      await openDb()
      await seedCategories()
      isReady.value = true
      errorMessage.value = null
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'IndexedDBの初期化に失敗しました。'
      throw error
    }
  }

  async function getCategories() {
    const categories = await seedCategories()
    return categories.sort((a, b) => flickDirections.indexOf(a.direction) - flickDirections.indexOf(b.direction))
  }

  async function getCategoryByDirection(direction: FlickDirection) {
    const categories = await getCategories()
    return categories.find((category) => category.direction === direction)
  }

  async function saveCategory(input: Pick<Category, 'name' | 'color' | 'direction'> & { id?: string }) {
    const categories = await getCategories()
    const duplicated = categories.find((category) => category.direction === input.direction && category.id !== input.id)

    if (duplicated) {
      throw new Error(`${directionLabels[input.direction]}方向は「${duplicated.name}」に設定済みです。`)
    }

    const now = new Date().toISOString()
    const existing = input.id ? categories.find((category) => category.id === input.id) : undefined
    const category: Category = {
      id: input.id || createId('cat'),
      name: input.name.trim(),
      color: input.color,
      direction: input.direction,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }

    await withStore<IDBValidKey>('categories', 'readwrite', (store) => store.put(category))
    return category
  }

  async function deleteCategory(id: string) {
    await withStore<undefined>('categories', 'readwrite', (store) => store.delete(id))
  }

  async function saveDraft(file: File, placeId?: string) {
    const normalizedImage = await normalizeImageForStorage(file)
    const draft: DraftPhoto = {
      id: createId('draft'),
      image: normalizedImage,
      imageType: normalizedImage.type || 'image/jpeg',
      placeId,
      createdAt: new Date().toISOString()
    }

    await withStore<IDBValidKey>('drafts', 'readwrite', (store) => store.put(draft))
    return draft
  }

  async function getLatestDraft() {
    const drafts = await getAllFromStore<DraftPhoto>('drafts')
    return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
  }

  async function clearDraft(id: string) {
    await withStore<undefined>('drafts', 'readwrite', (store) => store.delete(id))
  }

  async function classifyDraft(draft: DraftPhoto, direction: FlickDirection) {
    const category = await getCategoryByDirection(direction)

    if (!category) {
      throw new Error(`${directionLabels[direction]}方向にカテゴリが設定されていません。`)
    }

    const normalizedImage = await normalizeImageForStorage(draft.image)
    const photo: PhotoItem = {
      id: createId('photo'),
      image: normalizedImage,
      imageType: normalizedImage.type || draft.imageType,
      categoryId: category.id,
      direction,
      placeId: draft.placeId,
      createdAt: new Date().toISOString()
    }

    await withStore<IDBValidKey>('photos', 'readwrite', (store) => store.put(photo))
    await clearDraft(draft.id)
    return photo
  }

  async function getPhotos(categoryIdOrFilters?: string | { placeId?: string; categoryId?: string }) {
    const photos = await getAllFromStore<PhotoItem>('photos')
    
    // categoryId 単体を渡された場合の互換性保持
    if (typeof categoryIdOrFilters === 'string') {
      return photos
        .filter((photo) => !categoryIdOrFilters || photo.categoryId === categoryIdOrFilters)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }

    // フィルターオブジェクトの場合
    const { categoryId, placeId } = categoryIdOrFilters || {}
    return photos
      .filter((photo) => 
        (!categoryId || photo.categoryId === categoryId) &&
        (!placeId || photo.placeId === placeId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async function getPhoto(id: string) {
    return await withStore<PhotoItem | undefined>('photos', 'readonly', (store) => store.get(id))
  }

  async function deletePhoto(id: string) {
    await withStore<undefined>('photos', 'readwrite', (store) => store.delete(id))
  }

  function createObjectUrl(item: Pick<PhotoItem | DraftPhoto, 'image'>) {
    return URL.createObjectURL(item.image)
  }

  // 場所一覧を取得
async function getPlaces() {
  return await getAllFromStore<Place>('places')
}

// 場所を保存
async function savePlace(input: Omit<Place, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const places = await getPlaces()
  const existing = input.id ? places.find((place) => place.id === input.id) : undefined

  const now = new Date().toISOString()
  const place: Place = {
    id: input.id || createId('place'),
    name: input.name.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters: input.radiusMeters,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }

  await withStore<IDBValidKey>('places', 'readwrite', (store) => store.put(place))
  return place
}

// 場所を削除
async function deletePlace(id: string) {
  await withStore<undefined>('places', 'readwrite', (store) => store.delete(id))
}

// 現在地から最寄り場所を見つける（Haversine公式を使用）
async function findNearestPlace(latitude: number, longitude: number): Promise<Place | null> {
  const places = await getPlaces()
  
  if (places.length === 0) return null

  // Haversine公式で距離を計算
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // 地球の半径（km）
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c * 1000 // メートル単位
  }

  let nearest: Place | null = null
  let minDistance = Infinity

  places.forEach((place) => {
    const distance = calculateDistance(latitude, longitude, place.latitude, place.longitude)
    if (distance <= place.radiusMeters && distance < minDistance) {
      nearest = place
      minDistance = distance
    }
  })

  return nearest
}

  return {
    isReady,
    errorMessage,
    init,
    getCategories,
    saveCategory,
    deleteCategory,
    saveDraft,
    getLatestDraft,
    classifyDraft,
    getPhotos,
    getPhoto,
    deletePhoto,
    createObjectUrl,
    getPlaces,
    savePlace,
    deletePlace,
    findNearestPlace
  }
}
