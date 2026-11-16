<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePhotoDb } from '~/composables/usePhotoDb'
import type { DraftPhoto, Place } from '~/types/photo'

const db = usePhotoDb()
const places = ref<Place[]>([])
const selectedPlaceId = ref('')
const photoInput = ref<HTMLInputElement | null>(null)
const pendingCount = ref(0)
const latestDraft = ref<DraftPhoto | null>(null)
const latestDraftImageUrl = ref('')
const isLocating = ref(false)
const isSaving = ref(false)
const isChangingPlace = ref(false)
const locationError = ref('')
const locationMessage = ref('')
const error = ref('')
const saveMessage = ref('')

const selectedPlace = computed(() => places.value.find((place) => place.id === selectedPlaceId.value) || null)
const selectedPlaceName = computed(() => selectedPlace.value?.name || (hasPlaces.value ? '場所未選択' : '場所未登録'))
const hasPlaces = computed(() => places.value.length > 0)

function getLocationErrorMessage(code: number) {
  switch (code) {
    case 1:
      return '位置情報取得が拒否されました。'
    case 2:
    case 3:
    default:
      return '位置情報の取得に失敗しました。'
  }
}

async function loadPlaces() {
  places.value = await db.getPlaces()
}

async function loadDrafts() {
  const drafts = await db.getDrafts()
  pendingCount.value = drafts.length
  latestDraft.value = drafts[drafts.length - 1] || null

  if (latestDraftImageUrl.value) {
    URL.revokeObjectURL(latestDraftImageUrl.value)
    latestDraftImageUrl.value = ''
  }

  if (latestDraft.value) {
    latestDraftImageUrl.value = db.createObjectUrl(latestDraft.value)
  }
}

function requestCurrentLocation() {
  locationError.value = ''
  locationMessage.value = ''

  if (!hasPlaces.value) {
    selectedPlaceId.value = ''
    return
  }

  if (!navigator.geolocation) {
    locationError.value = 'このブラウザでは位置情報が利用できません。'
    return
  }

  isLocating.value = true

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const nearestPlace = await db.findNearestPlace(position.coords.latitude, position.coords.longitude)
        selectedPlaceId.value = nearestPlace?.id || ''
        locationMessage.value = nearestPlace
          ? `現在地に最も近い場所として「${nearestPlace.name}」を選択しました。`
          : '現在地に一致する登録場所が見つからなかったため、場所未選択のままです。'
      } catch (err) {
        locationError.value = err instanceof Error ? err.message : '位置情報を使った場所判定に失敗しました。'
      } finally {
        isLocating.value = false
      }
    },
    (positionError) => {
      selectedPlaceId.value = ''
      locationError.value = getLocationErrorMessage(positionError.code)
      isLocating.value = false
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  )
}

async function initializeCapture() {
  error.value = ''
  locationError.value = ''
  locationMessage.value = ''

  try {
    await db.init()
    await loadPlaces()
    await loadDrafts()
    requestCurrentLocation()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'データの読み込みに失敗しました。'
  }
}

function resetPhotoInput() {
  if (photoInput.value) {
    photoInput.value.value = ''
  }
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  error.value = ''
  saveMessage.value = ''

  if (!file) {
    return
  }

  await savePhotoForLater(file)
}

async function savePhotoForLater(file: File) {
  if (isSaving.value) {
    return
  }

  isSaving.value = true
  try {
    await db.init()
    await db.saveDraft(file, selectedPlaceId.value || undefined)
    await loadDrafts()
    saveMessage.value = `保存しました（分類待ち ${pendingCount.value}枚）`
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存に失敗しました。'
  } finally {
    isSaving.value = false
    resetPhotoInput()
  }
}

onMounted(initializeCapture)

onUnmounted(() => {
  if (latestDraftImageUrl.value) {
    URL.revokeObjectURL(latestDraftImageUrl.value)
  }
})
</script>

<template>
  <AppShell>
    <h1 class="page-title">撮影</h1>
    <section class="capture-panel">
      <div class="capture-location">
        <div>
          <span>撮影場所</span>
          <strong>{{ selectedPlaceName }}</strong>
        </div>
        <button
          v-if="hasPlaces"
          class="secondary-button place-change-button"
          type="button"
          :aria-expanded="isChangingPlace"
          @click="isChangingPlace = !isChangingPlace"
        >
          変更
        </button>
        <NuxtLink v-else class="place-register-link" to="/places">場所を登録</NuxtLink>
      </div>

      <p v-if="isLocating" class="message">位置情報を取得しています...</p>
      <p v-if="locationMessage" class="message">{{ locationMessage }}</p>
      <p v-if="locationError" class="message error">{{ locationError }}</p>

      <div v-if="isChangingPlace && hasPlaces" class="capture-place-picker">
        <label class="field">
          <span>撮影場所を選択</span>
          <select v-model="selectedPlaceId" :disabled="isLocating" @change="isChangingPlace = false">
            <option value="">場所未選択</option>
            <option v-for="place in places" :key="place.id" :value="place.id">
              {{ place.name }}
            </option>
          </select>
        </label>
        <button class="secondary-button" type="button" :disabled="isLocating" @click="requestCurrentLocation">
          現在地から選択
        </button>
      </div>

      <p v-if="saveMessage" class="message save-message" role="status" aria-live="polite">{{ saveMessage }}</p>
      <div class="capture-controls" :class="{ 'has-pending': pendingCount > 0 }">
        <input
          id="photo-input"
          ref="photoInput"
          class="hidden-input"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="写真を撮影または選択"
          :disabled="isSaving"
          @change="handleFile"
        />
        <label
          class="file-button capture-button"
          :class="{ 'is-saving': isSaving }"
          :aria-disabled="isSaving"
          for="photo-input"
        >
          <strong>{{ isSaving ? '保存中...' : '撮影する' }}</strong>
          <span>カメラを起動／写真を選択</span>
        </label>
        <NuxtLink v-if="pendingCount > 0" class="pending-card" to="/classify">
          <img v-if="latestDraftImageUrl" class="pending-thumbnail" :src="latestDraftImageUrl" alt="" />
          <span class="pending-card-count">分類待ち {{ pendingCount }}枚</span>
          <strong>分類する</strong>
        </NuxtLink>
      </div>
      <p v-if="error" class="message error">{{ error }}</p>
    </section>
  </AppShell>
</template>
