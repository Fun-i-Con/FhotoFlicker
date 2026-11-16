<script setup lang="ts">
import { directionLabels, type Category, type PhotoItem, type Place } from '~/types/photo'

const route = useRoute()
const { categoryRepository, placeRepository, photoRepository } = useRepositories()
const photo = ref<PhotoItem | null>(null)
const categories = ref<Category[]>([])
const places = ref<Place[]>([])
const imageUrl = ref('')

const category = computed(() => categories.value.find((item) => item.id === photo.value?.categoryId))
const placeName = computed(() => {
  if (!photo.value?.placeId) {
    return '場所未設定'
  }

  return places.value.find((item) => item.id === photo.value?.placeId)?.name || '場所未設定'
})

function revokeImage() {
  if (imageUrl.value) {
    photoRepository.releaseImageUrl(imageUrl.value)
    imageUrl.value = ''
  }
}

async function load() {
  categories.value = await categoryRepository.list()
  places.value = await placeRepository.list()
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  photo.value = await photoRepository.get(id) || null
  revokeImage()

  if (photo.value) {
    const urls = await photoRepository.getImageUrls([photo.value.id])
    imageUrl.value = urls.get(photo.value.id) || ''
  }
}

async function removePhoto() {
  if (!photo.value) {
    return
  }

  if (!confirm('この写真を削除しますか？')) {
    return
  }

  await photoRepository.delete(photo.value.id)
  await navigateTo('/photos')
}

onMounted(load)
onUnmounted(revokeImage)
</script>

<template>
  <AppShell>
    <h1 class="page-title">写真詳細</h1>

    <section v-if="photo && imageUrl" class="detail-panel">
      <img class="detail-image" :src="imageUrl" alt="写真詳細" />
      <h2 class="section-title">分類情報</h2>
      <p class="meta">場所: {{ placeName }}</p>
      <div class="field">
        <span>工程</span>
        <CategoryBadge :category="category" label="削除済み工程" />
      </div>
      <p class="meta">方向: {{ directionLabels[photo.direction] }}</p>
      <p class="meta">保存日時: {{ new Date(photo.createdAt).toLocaleString('ja-JP') }}</p>
      <div class="button-row">
        <NuxtLink v-if="photo.categoryId" class="secondary-button" :to="`/photos?category=${photo.categoryId}`">同じ工程を見る</NuxtLink>
        <button class="danger-button" type="button" @click="removePhoto">削除</button>
      </div>
    </section>

    <p v-else class="empty-state">写真が見つかりません。</p>
  </AppShell>
</template>
