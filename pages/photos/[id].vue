<script setup lang="ts">
import { directionLabels, type Category, type PhotoItem } from '~/types/photo'

const route = useRoute()
const db = usePhotoDb()
const photo = ref<PhotoItem | null>(null)
const categories = ref<Category[]>([])
const imageUrl = ref('')

const category = computed(() => categories.value.find((item) => item.id === photo.value?.categoryId))

function revokeImage() {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = ''
  }
}

async function load() {
  await db.init()
  categories.value = await db.getCategories()
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  photo.value = await db.getPhoto(id) || null
  revokeImage()

  if (photo.value) {
    imageUrl.value = db.createObjectUrl(photo.value)
  }
}

async function removePhoto() {
  if (!photo.value) {
    return
  }

  await db.deletePhoto(photo.value.id)
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
      <CategoryBadge :category="category" label="削除済みカテゴリ" />
      <p class="meta">方向: {{ directionLabels[photo.direction] }}</p>
      <p class="meta">保存日時: {{ new Date(photo.createdAt).toLocaleString('ja-JP') }}</p>
      <div class="button-row">
        <NuxtLink class="secondary-button" :to="`/photos?category=${photo.categoryId}`">同じカテゴリを見る</NuxtLink>
        <button class="danger-button" type="button" @click="removePhoto">削除</button>
      </div>
    </section>

    <p v-else class="empty-state">写真が見つかりません。</p>
  </AppShell>
</template>
