<script setup lang="ts">
import type { Category, DraftPhoto, PhotoItem, Place } from '~/types/photo'

interface DraftPreview extends DraftPhoto {
  url: string
}

const db = usePhotoDb()
const categories = ref<Category[]>([])
const places = ref<Place[]>([])
const photos = ref<PhotoItem[]>([])
const draftPreviews = ref<DraftPreview[]>([])
const pendingCount = ref(0)
const loading = ref(true)
const error = ref('')

function revokePreviews() {
  draftPreviews.value.forEach((draft) => URL.revokeObjectURL(draft.url))
  draftPreviews.value = []
}

async function loadHome() {
  try {
    await db.init()
    const [loadedCategories, loadedPlaces, loadedPhotos, drafts] = await Promise.all([
      db.getCategories(),
      db.getPlaces(),
      db.getPhotos(),
      db.getDrafts()
    ])

    categories.value = loadedCategories
    places.value = loadedPlaces
    photos.value = loadedPhotos
    pendingCount.value = drafts.length
    draftPreviews.value = drafts.slice(0, 3).map((draft) => ({
      ...draft,
      url: db.createObjectUrl(draft)
    }))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'データの読み込みに失敗しました。'
  } finally {
    loading.value = false
  }
}

onMounted(loadHome)
onUnmounted(revokePreviews)
</script>

<template>
  <AppShell>
    <h1 class="page-title">場所ごとに撮って、工程で整理</h1>
    <p class="page-lead">場所を登録し、撮影した写真をフリック方向に対応する工程へ整理します。</p>

    <p v-if="error" class="message error" role="alert">{{ error }}</p>

    <div v-if="!loading" class="home-overview">
      <section v-if="pendingCount > 0" class="home-priority" aria-labelledby="home-priority-title">
        <div>
          <h2 id="home-priority-title" class="home-priority-title">分類待ち</h2>
          <p class="home-priority-count"><strong>{{ pendingCount }}</strong> 枚</p>
        </div>
        <div class="home-thumbnail-stack" aria-label="分類待ち写真のプレビュー">
          <img
            v-for="(draft, index) in draftPreviews"
            :key="draft.id"
            :src="draft.url"
            :alt="`分類待ち写真 ${index + 1}`"
          />
          <span v-if="pendingCount > draftPreviews.length" class="home-thumbnail-extra">
            +{{ pendingCount - draftPreviews.length }}
          </span>
        </div>
        <NuxtLink class="primary-button home-priority-button" to="/classify">分類する</NuxtLink>
      </section>

      <section v-else class="home-priority home-priority-capture" aria-labelledby="home-priority-title">
        <div>
          <h2 id="home-priority-title" class="home-priority-title">次の写真を撮影</h2>
          <p class="home-priority-description">撮影した写真は、あとからまとめて分類できます。</p>
        </div>
        <NuxtLink class="primary-button home-priority-button" to="/capture">撮影する</NuxtLink>
      </section>

      <nav class="home-link-list" aria-label="ホームメニュー">
        <NuxtLink class="home-link-row" to="/photos">
          <span class="home-link-copy">
            <strong>写真一覧</strong>
            <span class="home-link-status">分類済み {{ photos.length }} 枚</span>
          </span>
          <span class="home-link-arrow" aria-hidden="true">→</span>
        </NuxtLink>
        <NuxtLink class="home-link-row" to="/places">
          <span class="home-link-copy">
            <strong>場所</strong>
            <span class="home-link-status">登録済み {{ places.length }} 件</span>
          </span>
          <span class="home-link-arrow" aria-hidden="true">→</span>
        </NuxtLink>
        <NuxtLink class="home-link-row home-link-row-categories" to="/categories">
          <span class="home-link-copy">
            <strong>工程</strong>
            <span class="home-link-status">設定済み {{ categories.length }} 件</span>
          </span>
          <DirectionMap :categories="categories" compact />
          <span class="home-link-arrow" aria-hidden="true">→</span>
        </NuxtLink>
      </nav>
    </div>
  </AppShell>
</template>
