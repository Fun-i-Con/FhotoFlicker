import type { AppSupabaseClient } from '~/composables/useSupabase'
import type { Database } from '~/types/database.types'
import {
  directionLabels,
  flickDirections,
  type Category,
  type DraftPhoto,
  type FlickDirection,
  type PhotoItem,
  type Place
} from '~/types/photo'
import type {
  CategoryRepository,
  PhotoRepository,
  PlaceRepository,
  Repositories
} from '~/repositories/types'
import { resizeToJpeg } from '~/utils/image'

type Tables = Database['public']['Tables']
type CategoryRow = Tables['categories']['Row']
type PlaceRow = Tables['places']['Row']
type PhotoRow = Tables['photos']['Row']

const BUCKET = 'photos'
const SIGNED_URL_SECONDS = 60 * 60
const UNIQUE_VIOLATION = '23505'

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    direction: row.direction as FlickDirection,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radius_meters,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toDraft(row: PhotoRow): DraftPhoto {
  return {
    id: row.id,
    imageType: row.image_type,
    placeId: row.place_id ?? undefined,
    createdAt: row.created_at
  }
}

function toPhoto(row: PhotoRow): PhotoItem {
  return {
    id: row.id,
    imageType: row.image_type,
    categoryId: row.category_id ?? undefined,
    direction: row.direction as FlickDirection,
    placeId: row.place_id ?? undefined,
    createdAt: row.created_at
  }
}

// 画面は Error の message を表示するので、supabase-js のエラーオブジェクトを Error に揃える
function unwrap<T>(result: { data: T; error: { message: string } | null }) {
  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

function required<T>(result: { data: T | null; error: { message: string } | null }): T {
  const data = unwrap(result)

  if (data === null) {
    throw new Error('データを取得できませんでした。')
  }

  return data
}

export function createSupabaseRepositories(supabase: AppSupabaseClient): Repositories {
  async function currentUserId() {
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      throw new Error('ログインが必要です。')
    }

    return data.session.user.id
  }

  function storagePath(userId: string, photoId: string) {
    return `${userId}/${photoId}.jpg`
  }

  const categoryRepository: CategoryRepository = {
    async list() {
      const rows = required(await supabase.from('categories').select())
      return rows
        .map(toCategory)
        .sort((a, b) => flickDirections.indexOf(a.direction) - flickDirections.indexOf(b.direction))
    },

    async save(input) {
      const values = { name: input.name.trim(), color: input.color, direction: input.direction }
      const query = input.id
        ? supabase.from('categories').update(values).eq('id', input.id)
        : supabase.from('categories').insert(values)
      const { data, error } = await query.select().single()

      if (error?.code === UNIQUE_VIOLATION) {
        throw new Error(`${directionLabels[input.direction]}方向は別の工程に設定済みです。`)
      }

      return toCategory(required({ data, error }))
    },

    async delete(id) {
      unwrap(await supabase.from('categories').delete().eq('id', id))
    }
  }

  const placeRepository: PlaceRepository = {
    async list() {
      const rows = required(await supabase.from('places').select().order('created_at'))
      return rows.map(toPlace)
    },

    async save(input) {
      const values = {
        name: input.name.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        radius_meters: input.radiusMeters
      }
      const query = input.id
        ? supabase.from('places').update(values).eq('id', input.id)
        : supabase.from('places').insert(values)

      return toPlace(required(await query.select().single()))
    },

    async delete(id) {
      unwrap(await supabase.from('places').delete().eq('id', id))
    }
  }

  const photoRepository: PhotoRepository = {
    async addDraft(file, placeId) {
      const userId = await currentUserId()
      const image = await resizeToJpeg(file)
      const id = crypto.randomUUID()
      const path = storagePath(userId, id)

      // Storage は photos の行があるパスにしか置けないので、行を先に作る
      const row = required<PhotoRow>(
        await supabase
          .from('photos')
          .insert({ id, storage_path: path, image_type: image.type, place_id: placeId ?? null })
          .select()
          .single()
      )

      const { error } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: image.type })

      if (error) {
        await supabase.from('photos').delete().eq('id', id)
        throw new Error(error.message)
      }

      return toDraft(row)
    },

    async listDrafts() {
      const rows = required(
        await supabase.from('photos').select().is('classified_at', null).order('created_at')
      )
      return rows.map(toDraft)
    },

    async classify(draftId, direction) {
      const category = unwrap(
        await supabase.from('categories').select('id').eq('direction', direction).maybeSingle()
      )

      if (!category) {
        throw new Error(`${directionLabels[direction]}方向にカテゴリが設定されていません。`)
      }

      const row = required<PhotoRow>(
        await supabase
          .from('photos')
          .update({ category_id: category.id, direction, classified_at: new Date().toISOString() })
          .eq('id', draftId)
          .select()
          .single()
      )

      return toPhoto(row)
    },

    async list(filters = {}) {
      let query = supabase.from('photos').select().not('classified_at', 'is', null)

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }
      if (filters.placeId) {
        query = query.eq('place_id', filters.placeId)
      }

      const rows = required(await query.order('created_at', { ascending: false }))
      return rows.map(toPhoto)
    },

    async get(id) {
      const row = unwrap(
        await supabase.from('photos').select().eq('id', id).not('classified_at', 'is', null).maybeSingle()
      )
      return row ? toPhoto(row) : undefined
    },

    async delete(id) {
      const userId = await currentUserId()

      // ファイルを先に消す。途中で失敗しても行が残り、画面からもう一度削除できる
      const { error } = await supabase.storage.from(BUCKET).remove([storagePath(userId, id)])

      if (error) {
        throw new Error(error.message)
      }

      unwrap(await supabase.from('photos').delete().eq('id', id))
    },

    async getImageUrls(ids) {
      const urls = new Map<string, string>()

      if (ids.length === 0) {
        return urls
      }

      const userId = await currentUserId()
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(ids.map((id) => storagePath(userId, id)), SIGNED_URL_SECONDS)

      if (error) {
        throw new Error(error.message)
      }

      data.forEach((item, index) => {
        if (item.signedUrl) {
          urls.set(ids[index]!, item.signedUrl)
        }
      })

      return urls
    },

    releaseImageUrl() {}
  }

  return { categoryRepository, placeRepository, photoRepository }
}
