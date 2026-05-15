<script setup lang="ts">
import {
  directionLabels,
  flickDirections,
  type Category,
  type DraftPhoto,
  type FlickDirection
} from '~/types/photo'

const db = usePhotoDb()
const categories = ref<Category[]>([])
const draft = ref<DraftPhoto | null>(null)
const imageUrl = ref('')
const error = ref('')
const startPoint = ref<{ x: number; y: number } | null>(null)
const activeDirection = ref<FlickDirection | null>(null)

function revokeImage() {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = ''
  }
}

async function load() {
  await db.init()
  categories.value = await db.getCategories()
  draft.value = await db.getLatestDraft()
  revokeImage()

  if (draft.value) {
    imageUrl.value = db.createObjectUrl(draft.value)
  }
}

function resolveDirection(deltaX: number, deltaY: number): FlickDirection | null {
  const threshold = 52

  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) {
    return null
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? 'right' : 'left'
  }

  return deltaY > 0 ? 'down' : 'up'
}

function handlePointerStart(event: PointerEvent) {
  startPoint.value = { x: event.clientX, y: event.clientY }
  activeDirection.value = null
}

function handlePointerMove(event: PointerEvent) {
  if (!startPoint.value) {
    return
  }

  activeDirection.value = resolveDirection(event.clientX - startPoint.value.x, event.clientY - startPoint.value.y)
}

async function handlePointerEnd(event: PointerEvent) {
  if (!startPoint.value) {
    return
  }

  const direction = resolveDirection(event.clientX - startPoint.value.x, event.clientY - startPoint.value.y)
  startPoint.value = null
  activeDirection.value = null

  if (direction) {
    await classify(direction)
  }
}

async function classify(direction: FlickDirection) {
  error.value = ''

  if (!draft.value) {
    error.value = '分類待ちの写真がありません。'
    return
  }

  try {
    const photo = await db.classifyDraft(draft.value, direction)
    await navigateTo(`/photos/${photo.id}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '分類に失敗しました。'
  }
}

function categoryFor(direction: FlickDirection) {
  return categories.value.find((category) => category.direction === direction)
}

onMounted(load)
onUnmounted(revokeImage)
</script>

<template>
  <AppShell>
    <h1 class="page-title">フリック分類</h1>
    <p class="page-lead">写真を上下左右にフリックすると、対応するカテゴリへ保存されます。</p>

    <DirectionMap :categories="categories" />

    <section v-if="draft && imageUrl" class="classify-stage">
      <img
        class="classify-image"
        :src="imageUrl"
        alt="分類待ち写真"
        @pointerdown="handlePointerStart"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerEnd"
        @pointercancel="startPoint = null"
      />
      <div class="swipe-hint">
        <strong v-if="activeDirection">
          {{ directionLabels[activeDirection] }}: {{ categoryFor(activeDirection)?.name || '未設定' }}
        </strong>
        <span v-else>写真の上で上下左右にフリック</span>
      </div>
      <div class="button-row">
        <button
          v-for="direction in flickDirections"
          :key="direction"
          class="secondary-button"
          type="button"
          @click="classify(direction)"
        >
          {{ directionLabels[direction] }}
        </button>
      </div>
    </section>

    <p v-else class="empty-state">分類待ちの写真がありません。撮影画面から写真を追加してください。</p>
    <p v-if="error" class="message error">{{ error }}</p>

    <div class="button-row">
      <NuxtLink class="primary-button" to="/capture">撮影する</NuxtLink>
      <NuxtLink class="secondary-button" to="/photos">一覧を見る</NuxtLink>
    </div>
  </AppShell>
</template>
