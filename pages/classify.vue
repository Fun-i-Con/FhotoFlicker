<script setup lang="ts">
import {
  directionLabels,
  flickDirections,
  type Category,
  type DraftPhoto,
  type FlickDirection,
  type Place
} from '~/types/photo'

const db = usePhotoDb()
const categories = ref<Category[]>([])
const places = ref<Place[]>([])
const draft = ref<DraftPhoto | null>(null)
const imageUrl = ref('')
const error = ref('')
const activeDirection = ref<FlickDirection | null>(null)

const wrapperRef = ref<HTMLElement | null>(null)
const startPoint = ref<{ x: number; y: number } | null>(null)
const translateX = ref(0)
const translateY = ref(0)
const tiltX = ref(0)
const tiltY = ref(0)
const isDragging = ref(false)
const overlayOpacity = ref(0)
const overlayColor = ref('rgba(0,0,0,0)')

let rafId: number | null = null
const threshold = 80

const currentPlaceName = computed(() => {
  if (!draft.value?.placeId) {
    return '場所未設定'
  }
  return places.value.find((place) => place.id === draft.value?.placeId)?.name || '場所未設定'
})

function revokeImage() {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = ''
  }
}

async function load() {
  await db.init()
  categories.value = await db.getCategories()
  places.value = await db.getPlaces()
  draft.value = await db.getLatestDraft()
  revokeImage()

  if (draft.value) {
    imageUrl.value = db.createObjectUrl(draft.value)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getPrimaryDirection(deltaX: number, deltaY: number): FlickDirection {
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left'
  }
  return deltaY >= 0 ? 'down' : 'up'
}

function getOverlayColor(direction: FlickDirection) {
  switch (direction) {
    case 'right':
      return 'rgba(16,185,129,0.3)'
    case 'left':
      return 'rgba(239,68,68,0.3)'
    case 'up':
      return 'rgba(37,99,235,0.32)'
    case 'down':
      return 'rgba(251,191,36,0.32)'
  }
}

function resolveDirection(deltaX: number, deltaY: number): FlickDirection | null {
  const localThreshold = threshold
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < localThreshold) {
    return null
  }
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? 'right' : 'left'
  }
  return deltaY > 0 ? 'down' : 'up'
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

/* --- Drag / animation handlers --- */

const wrapperStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px)`,
  willChange: 'transform',
  touchAction: 'none',
}))

const tiltStyle = computed(() => ({
  transform: `perspective(900px) rotateX(${tiltX.value}deg) rotateY(${tiltY.value}deg)`,
  transition: isDragging.value ? 'transform 80ms ease-out' : 'transform 180ms ease-out',
}))

const overlayStyle = computed(() => ({
  background: overlayColor.value,
  opacity: overlayOpacity.value,
  pointerEvents: 'none',
  position: 'absolute',
  inset: '0',
  borderRadius: '8px',
}))

function onPointerDown(e: PointerEvent) {
  try { wrapperRef.value?.setPointerCapture(e.pointerId) } catch {}
  startPoint.value = { x: e.clientX, y: e.clientY }
  isDragging.value = true
  if (rafId) cancelAnimationFrame(rafId)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value || !startPoint.value) return
  const dx = e.clientX - startPoint.value.x
  const dy = e.clientY - startPoint.value.y
  updateDragPosition(dx, dy)
  activeDirection.value = resolveDirection(dx, dy)
}

function updateDragPosition(dx: number, dy: number) {
  const primary = getPrimaryDirection(dx, dy)
  const amount = primary === 'left' || primary === 'right' ? clamp(dx, -80, 80) : clamp(dy, -80, 80)

  translateX.value = primary === 'left' || primary === 'right' ? amount : 0
  translateY.value = primary === 'up' || primary === 'down' ? amount : 0
  const tilt = clamp((amount / 80) * 4, -4, 4)
  tiltX.value = primary === 'up' || primary === 'down' ? tilt : 0
  tiltY.value = primary === 'left' || primary === 'right' ? -tilt : 0

  const feedbackStrength = Math.min(Math.abs(amount) / threshold, 1)
  overlayOpacity.value = feedbackStrength
  overlayColor.value = getOverlayColor(primary)
}

async function onPointerUp(e: PointerEvent) {
  if (!isDragging.value || !startPoint.value) return
  const dx = e.clientX - startPoint.value.x
  const dy = e.clientY - startPoint.value.y
  const dir = resolveDirection(dx, dy)
  updateDragPosition(dx, dy)
  isDragging.value = false
  try { if (wrapperRef.value) wrapperRef.value.releasePointerCapture(e.pointerId) } catch {}
  activeDirection.value = null

  if (dir) {
    await animateOffscreen(dir)
    await classify(dir)
    translateX.value = 0
    translateY.value = 0
    tiltX.value = 0
    tiltY.value = 0
    overlayOpacity.value = 0
    startPoint.value = null
    await load()
  } else {
    await springBack()
    translateX.value = 0
    translateY.value = 0
    tiltX.value = 0
    tiltY.value = 0
    overlayOpacity.value = 0
    startPoint.value = null
  }
}

function onPointerCancel() {
  if (!isDragging.value) return
  isDragging.value = false
  tiltX.value = 0
  tiltY.value = 0
  springBack().catch(() => {})
  startPoint.value = null
  activeDirection.value = null
}

/* Move beyond the viewport edge and wait for the transform, not the opacity fade. */
async function animateOffscreen(direction: FlickDirection) {
  await nextTick()
  const el = wrapperRef.value
  if (!el) return

  const bounds = el.getBoundingClientRect()
  let targetX = translateX.value
  let targetY = translateY.value

  switch (direction) {
    case 'right':
      targetX += window.innerWidth - bounds.left + 48
      break
    case 'left':
      targetX -= bounds.right + 48
      break
    case 'up':
      targetY -= bounds.bottom + 48
      break
    case 'down':
      targetY += window.innerHeight - bounds.top + 48
      break
  }

  el.style.transition = 'transform 360ms cubic-bezier(.16,1,.3,1), opacity 360ms ease-out'
  void el.offsetWidth
  el.style.transform = `translate(${targetX}px, ${targetY}px)`
  el.style.opacity = '0'

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(fallback)
      el.removeEventListener('transitionend', onEnd)
      el.style.transition = ''
      el.style.opacity = ''
      resolve()
    }
    const onEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === 'transform') finish()
    }
    const fallback = window.setTimeout(finish, 500)
    el.addEventListener('transitionend', onEnd)
  })
}

/* spring back to origin */
function springBack() {
  return new Promise<void>((resolve) => {
    const el = wrapperRef.value
    if (!el) { resolve(); return }
    el.style.transition = 'transform 450ms cubic-bezier(.2,.8,.3,1)'
    el.style.transform = 'translate(0px,0px)'
    const onEnd = () => {
      el.removeEventListener('transitionend', onEnd)
      el.style.transition = ''
      resolve()
    }
    el.addEventListener('transitionend', onEnd)
  })
}

/* --- lifecycle --- */
onMounted(load)
onUnmounted(() => {
  revokeImage()
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
  <AppShell>
    <h1 class="page-title">フリック分類</h1>
    <p class="page-lead">写真を上下左右にフリックすると、対応する工程へ保存されます。</p>

    <DirectionMap :categories="categories" />

    <section v-if="draft && imageUrl" class="classify-stage">
      <div class="field">
        <span>現在の場所</span>
        <strong>{{ currentPlaceName }}</strong>
      </div>

      <div
        class="image-wrapper"
        ref="wrapperRef"
        :style="wrapperStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      >
        <div class="image-tilt" :style="tiltStyle">
          <img class="classify-image" :src="imageUrl" alt="分類待ち写真" draggable="false" />
          <div class="swipe-overlay" :style="overlayStyle" />
        </div>
      </div>

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
