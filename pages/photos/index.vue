<script setup lang="ts">
import type { Category, PhotoItem } from '~/types/photo'

interface PhotoView extends PhotoItem {
  url: string
}

const route = useRoute()
const db = usePhotoDb()
const categories = ref<Category[]>([])
const photos = ref<PhotoView[]>([])
const selectedCategoryId = ref(typeof route.query.category === 'string' ? route.query.category : '')

function revokePhotos() {
  photos.value.forEach((photo) => URL.revokeObjectURL(photo.url))
}

async function load() {
  await db.init()
  categories.value = await db.getCategories()
  revokePhotos()
  const items = await db.getPhotos(selectedCategoryId.value || undefined)
  photos.value = items.map((photo) => ({ ...photo, url: db.createObjectUrl(photo) }))
}

function categoryById(id: string) {
  return categories.value.find((category) => category.id === id)
}

watch(selectedCategoryId, async (categoryId) => {
  await navigateTo({ path: '/photos', query: categoryId ? { category: categoryId } : {} }, { replace: true })
  await load()
})

onMounted(load)
onUnmounted(revokePhotos)
</script>

<template>
  <AppShell>
    <h1 class="page-title">写真一覧</h1>
    <p class="page-lead">分類済みの写真をカテゴリ別に確認します。</p>

    <label class="field">
      <span>カテゴリ</span>
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
          <CategoryBadge :category="categoryById(photo.categoryId)" label="削除済みカテゴリ" />
          <span class="meta">{{ new Date(photo.createdAt).toLocaleString('ja-JP') }}</span>
        </div>
      </NuxtLink>
    </div>

    <p v-else class="empty-state">写真がありません。</p>

    <div class="button-row">
      <NuxtLink class="primary-button" to="/capture">撮影する</NuxtLink>
      <NuxtLink class="secondary-button" to="/categories">カテゴリ設定</NuxtLink>
    </div>
  </AppShell>
</template>
