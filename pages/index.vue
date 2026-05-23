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
    <h1 class="page-title">場所ごとに撮って、工程で整理</h1>
    <p class="page-lead">場所を登録し、撮影した写真をフリック方向に対応する工程へ整理します。</p>

    <div class="action-grid">
      <NuxtLink class="action-card" to="/places">
        <strong>場所を作成</strong>
        <span>撮影前に現場や拠点を登録する</span>
      </NuxtLink>
      <NuxtLink class="action-card" to="/capture">
        <strong>撮影する</strong>
        <span>場所を確認して写真を追加し、そのまま分類へ進む</span>
      </NuxtLink>
      <NuxtLink class="action-card" to="/categories">
        <strong>工程設定</strong>
        <span>フリック方向と工程の割り当てを編集する</span>
      </NuxtLink>
      <NuxtLink class="action-card" to="/photos">
        <strong>写真一覧</strong>
        <span>場所と工程で絞り込みながら写真を確認する</span>
      </NuxtLink>
    </div>

    <template v-if="!loading">
      <h2 class="section-title">現在の工程設定</h2>
      <DirectionMap :categories="categories" />

      <h2 class="section-title">保存状況</h2>
      <div class="empty-state">
        分類済み {{ photos.length }} 件 / 工程 {{ categories.length }} 件
      </div>
    </template>
  </AppShell>
</template>
