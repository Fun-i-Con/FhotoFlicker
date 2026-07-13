<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import { usePhotoDb } from '~/composables/usePhotoDb'
import type { Place } from '~/types/photo'

const db = usePhotoDb()
const places = ref<Place[]>([])
const selectedPlaceId = ref('')
const isLocating = ref(false)
const locationError = ref('')
const locationMessage = ref('')
const error = ref('')
const pendingDraftId = ref('')
const photoInput = ref<HTMLInputElement | null>(null)
const continuousMode = ref(true)

const selectedPlace = computed(() => places.value.find((place) => place.id === selectedPlaceId.value) || null)
const selectedPlaceName = computed(() => selectedPlace.value?.name || '場所未選択')
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

async function openPhotoPicker() {
  resetPhotoInput()
  await nextTick()
  requestAnimationFrame(() => {
    photoInput.value?.click()
  })
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  error.value = ''

  if (!file) {
    error.value = '写真を選択してください。'
    return
  }

  await saveAndClassify(file)
}

async function saveAndClassify(file: File) {
  try {
    await db.init()
    const draft = await db.saveDraft(file, selectedPlaceId.value || undefined)
    pendingDraftId.value = draft.id

    if (!continuousMode.value) {
      await continueToClassify()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存に失敗しました。'
  }
}

async function retakePhoto() {
  try {
    await db.init()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '撮影の準備に失敗しました。'
    return
  }

  openPhotoPicker()
}

async function continueToClassify() {
  if (!pendingDraftId.value) {
    return
  }

  await navigateTo('/classify')
}

onMounted(initializeCapture)
</script>

<template>
  <AppShell>
    <h1 class="page-title">撮影</h1>
    <p class="page-lead">撮影前に場所を確認し、写真を保存したあとに分類画面から手動で分類できます。</p>

    <section class="capture-panel">
      <section class="form-panel">
        <h2 class="section-title">撮影場所</h2>
        <p class="message" v-if="isLocating">位置情報を取得しています...</p>
        <p class="message" v-if="locationMessage">{{ locationMessage }}</p>
        <p class="message error" v-if="locationError">{{ locationError }}</p>

        <div class="field">
          <span>現在の選択場所</span>
          <strong>{{ selectedPlaceName }}</strong>
        </div>

        <template v-if="hasPlaces">
          <label class="field">
            <span>場所を手動で選択</span>
            <select v-model="selectedPlaceId" :disabled="isLocating">
              <option value="">場所未選択</option>
              <option v-for="place in places" :key="place.id" :value="place.id">
                {{ place.name }}
              </option>
            </select>
          </label>

          <div class="button-row">
            <button class="secondary-button" type="button" :disabled="isLocating" @click="requestCurrentLocation">
              現在地から再選択
            </button>
          </div>
        </template>

        <div v-else class="empty-state">
          <p>登録済みの場所がありません。</p>
          <NuxtLink class="primary-button" to="/places">場所を登録する</NuxtLink>
        </div>
      </section>

      <div class="button-row">
        <button class="file-button" type="button" @click="openPhotoPicker">{{ continuousMode ? '連続撮影' : '写真を追加' }}</button>
        <button class="secondary-button" type="button" @click="continuousMode = !continuousMode">
          {{ continuousMode ? '単発撮影モード' : '連続撮影モード' }}
        </button>
      </div>
      <input
        ref="photoInput"
        id="photo-input"
        class="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        @change="handleFile"
      />

      <div v-if="pendingDraftId && continuousMode" class="form-panel choice-panel">
        <p class="message">写真を保存しました。続けて撮影するか、分類画面へ進めます。</p>
        <div class="button-row">
          <button class="primary-button" type="button" @click="continueToClassify">分類する</button>
        </div>
      </div>

      <p v-if="error" class="message error">{{ error }}</p>
    </section>
  </AppShell>
</template>
