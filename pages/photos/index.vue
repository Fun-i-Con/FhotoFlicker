<script setup lang="ts">
import type { Category, PhotoItem, Place } from '~/types/photo'

interface PhotoView extends PhotoItem {
  url: string
}

const route = useRoute()
const db = usePhotoDb()
const categories = ref<Category[]>([])
const places = ref<Place[]>([])
const photos = ref<PhotoView[]>([])
const selectedPlaceId = ref(typeof route.query.place === 'string' ? route.query.place : '')
const selectedCategoryId = ref(typeof route.query.category === 'string' ? route.query.category : '')

function revokePhotos() {
  photos.value.forEach((photo) => URL.revokeObjectURL(photo.url))
}

async function load() {
  await db.init()
  categories.value = await db.getCategories()
  places.value = await db.getPlaces()
  revokePhotos()
  const items = await db.getPhotos({
    placeId: selectedPlaceId.value || undefined,
    categoryId: selectedCategoryId.value || undefined
  })
  photos.value = items.map((photo) => ({ ...photo, url: db.createObjectUrl(photo) }))
}

function categoryById(id: string) {
  return categories.value.find((category) => category.id === id)
}

function placeById(id: string) {
  return places.value.find((place) => place.id === id)
}

function placeLabel(placeId?: string) {
  if (!placeId) {
    return '場所未設定'
  }

  return placeById(placeId)?.name || '削除済み場所'
}

watch([selectedPlaceId, selectedCategoryId], async ([placeId, categoryId]) => {
  const query: Record<string, string> = {}

  if (placeId) {
    query.place = placeId
  }

  if (categoryId) {
    query.category = categoryId
  }

  await navigateTo({ path: '/photos', query }, { replace: true })
  await load()
})

onMounted(load)
onUnmounted(revokePhotos)
</script>

<template>
  <AppShell>
    <h1 class="page-title">写真一覧</h1>
    <p class="page-lead">保存済みの写真を場所と工程で絞り込みながら確認します。</p>

    <label class="field">
      <span>場所</span>
      <select v-model="selectedPlaceId">
        <option value="">すべて</option>
        <option v-for="place in places" :key="place.id" :value="place.id">
          {{ place.name }}
        </option>
      </select>
    </label>

    <label class="field">
      <span>工程</span>
      <select v-model="selectedCategoryId">
        <option value="">すべて</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>
    </label>

    <div v-if="photos.length > 0" class="photo-grid">
      <NuxtLink v-for="photo in photos" :key="photo.id" class="photo-card" :to="`/photos/${photo.id}`">
        <img class="photo-image" :src="photo.url" alt="分類済み写真" />
        <div class="photo-card-body">
          <div class="photo-card-meta">
            <span class="meta-label">場所</span>
            <strong>{{ placeLabel(photo.placeId) }}</strong>
          </div>
          <CategoryBadge :category="categoryById(photo.categoryId)" label="削除済み工程" />
          <span class="meta">{{ new Date(photo.createdAt).toLocaleString('ja-JP') }}</span>
        </div>
      </NuxtLink>
    </div>

    <p v-else class="empty-state">写真がありません。</p>

    <div class="button-row">
      <NuxtLink class="primary-button" to="/capture">撮影する</NuxtLink>
      <NuxtLink class="secondary-button" to="/categories">工程設定</NuxtLink>
    </div>
  </AppShell>
</template>
