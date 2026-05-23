<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import { usePhotoDb } from '~/composables/usePhotoDb'
import type { Place } from '~/types/photo'

const db = usePhotoDb()
const previewUrl = ref('')
const selectedFile = ref<File | null>(null)
const places = ref<Place[]>([])
const selectedPlaceId = ref('')
const isLocating = ref(false)
const locationError = ref('')
const locationMessage = ref('')
const error = ref('')

const selectedPlace = computed(() => places.value.find((place) => place.id === selectedPlaceId.value) || null)
const hasPlaces = computed(() => places.value.length > 0)

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

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

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  revokePreview()
  selectedFile.value = file || null
  error.value = ''

  if (file) {
    previewUrl.value = URL.createObjectURL(file)
    await saveAndClassify()
  }
}

async function saveAndClassify() {
  if (!selectedFile.value) {
    error.value = '写真を選択してください。'
    return
  }

  try {
    await db.init()
    await db.saveDraft(selectedFile.value, selectedPlaceId.value || undefined)
    await navigateTo('/classify')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存に失敗しました。'
  }
}

onMounted(initializeCapture)
onUnmounted(revokePreview)
</script>

<template>
  <AppShell>
    <h1 class="page-title">撮影</h1>
    <p class="page-lead">スマホではカメラが起動します。撮影後にプレビューを確認して分類へ進みます。</p>

    <section class="capture-panel">
      <section class="form-panel">
        <h2 class="section-title">撮影場所</h2>
        <p class="message" v-if="isLocating">位置情報を取得しています...</p>
        <p class="message" v-if="locationMessage">{{ locationMessage }}</p>
        <p class="message error" v-if="locationError">{{ locationError }}</p>

        <div class="field">
          <span>現在の選択場所</span>
          <strong>{{ selectedPlace ? selectedPlace.name : '場所未選択' }}</strong>
        </div>

        <template v-if="hasPlaces">
          <label class="field">
            <span>場所を手動で選択</span>
            <select v-model="selectedPlaceId">
              <option value="">場所未選択</option>
              <option v-for="place in places" :key="place.id" :value="place.id">
                {{ place.name }}
              </option>
            </select>
          </label>

          <div class="button-row">
            <button class="secondary-button" type="button" @click="requestCurrentLocation">
              現在地から再選択
            </button>
          </div>
        </template>

        <div v-else class="empty-state">
          <p>登録済みの場所がありません。</p>
          <NuxtLink class="primary-button" to="/places">場所を登録する</NuxtLink>
        </div>
      </section>

      <label class="file-button" for="photo-input">写真を撮影</label>
      <input
        id="photo-input"
        class="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        @change="handleFile"
      />

      <img v-if="previewUrl" class="preview-image" :src="previewUrl" alt="撮影画像プレビュー" />
      <p v-else class="empty-state">まだ写真が選択されていません。</p>

      <p v-if="error" class="message error">{{ error }}</p>
      <div class="button-row">
        <button class="primary-button" type="button" :disabled="!selectedFile" @click="saveAndClassify">
          分類へ進む
        </button>
        <NuxtLink class="secondary-button" to="/">戻る</NuxtLink>
      </div>
    </section>
  </AppShell>
</template>
