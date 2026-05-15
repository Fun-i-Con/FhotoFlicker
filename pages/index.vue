<script setup lang="ts">
import type { Category, PhotoItem } from '~/types/photo'

const db = usePhotoDb()
const categories = ref<Category[]>([])
const photos = ref<PhotoItem[]>([])
const loading = ref(true)

onMounted(async () => {
  await db.init()
  categories.value = await db.getCategories()
  photos.value = await db.getPhotos()
  loading.value = false
})
</script>

<template>
  <AppShell>
    <h1 class="page-title">撮って、フリックで分類</h1>
    <p class="page-lead">スマホで撮影した写真を上下左右の操作で保存先カテゴリに振り分けます。</p>

    <div class="action-grid">
      <NuxtLink class="action-card" to="/capture">
        <strong>撮影する</strong>
        <span>カメラを起動して分類待ちの写真を作成</span>
      </NuxtLink>
      <NuxtLink class="action-card" to="/classify">
        <strong>分類する</strong>
        <span>撮影済みの写真を上下左右フリックで保存</span>
      </NuxtLink>
      <NuxtLink class="action-card" to="/categories">
        <strong>カテゴリ設定</strong>
        <span>保存先カテゴリと方向の割り当てを編集</span>
      </NuxtLink>
      <NuxtLink class="action-card" to="/photos">
        <strong>写真一覧</strong>
        <span>分類済み写真をカテゴリ別に確認</span>
      </NuxtLink>
    </div>

    <template v-if="!loading">
      <h2 class="section-title">現在の方向設定</h2>
      <DirectionMap :categories="categories" />

      <h2 class="section-title">保存状況</h2>
      <div class="empty-state">
        分類済み {{ photos.length }} 件 / カテゴリ {{ categories.length }} 件
      </div>
    </template>
  </AppShell>
</template>
