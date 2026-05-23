<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { usePhotoDb } from '~/composables/usePhotoDb'
import type { Place } from '~/types/photo'

const db = usePhotoDb()

const places = ref<Place[]>([])
const message = ref('')
const error = ref('')
const geoError = ref('')

const radiusOptions = [50, 100, 200]

const form = reactive({
  id: '',
  name: '',
  latitude: null as number | null,
  longitude: null as number | null,
  radiusMeters: 100
})

const isEditing = computed(() => Boolean(form.id))

async function loadPlaces() {
  try {
    await db.init()
    places.value = await db.getPlaces()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'データの読み込みに失敗しました。'
  }
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.latitude = null
  form.longitude = null
  form.radiusMeters = 100
  message.value = ''
  error.value = ''
  geoError.value = ''
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

function getCurrentLocation() {
  message.value = ''
  error.value = ''
  geoError.value = ''

  if (!navigator.geolocation) {
    geoError.value = 'このブラウザでは位置情報が利用できません。'
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      form.latitude = Number(position.coords.latitude.toFixed(6))
      form.longitude = Number(position.coords.longitude.toFixed(6))
      message.value = '現在地を取得しました。'
    },
    (positionError) => {
      geoError.value = getLocationErrorMessage(positionError.code)
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  )
}

async function submitPlace() {
  message.value = ''
  error.value = ''
  geoError.value = ''

  if (!form.name.trim()) {
    error.value = '場所名を入力してください。'
    return
  }

  if (form.latitude === null || form.longitude === null) {
    error.value = '緯度・経度が取得されていません。'
    return
  }

  try {
    await db.savePlace({
      id: form.id || undefined,
      name: form.name,
      latitude: form.latitude,
      longitude: form.longitude,
      radiusMeters: form.radiusMeters
    })
    await loadPlaces()
    message.value = isEditing.value ? '場所を更新しました。' : '場所を登録しました。'
    resetForm()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存に失敗しました。'
  }
}

function editPlace(place: Place) {
  form.id = place.id
  form.name = place.name
  form.latitude = place.latitude
  form.longitude = place.longitude
  form.radiusMeters = place.radiusMeters
  message.value = ''
  error.value = ''
  geoError.value = ''
}

async function removePlace(place: Place) {
  if (!confirm('この場所を削除しますか？')) {
    return
  }

  try {
    await db.deletePlace(place.id)
    await loadPlaces()
    if (form.id === place.id) {
      resetForm()
    }
    message.value = '場所を削除しました。'
  } catch (err) {
    error.value = err instanceof Error ? err.message : '削除に失敗しました。'
  }
}

onMounted(loadPlaces)
</script>

<template>
  <AppShell>
    <h1 class="page-title">場所管理</h1>
    <p class="page-lead">撮影場所を事前に登録して、写真に場所情報を紐づけます。</p>

    <section class="form-panel">
      <h2 class="section-title">{{ isEditing ? '場所編集' : '場所登録' }}</h2>
      <form @submit.prevent="submitPlace">
        <label class="field">
          <span>場所名</span>
          <input v-model="form.name" type="text" autocomplete="off" placeholder="例: 現場A" />
        </label>

        <div class="button-row">
          <button class="primary-button" type="button" @click="getCurrentLocation">
            現在地を取得
          </button>
        </div>

        <label class="field">
          <span>緯度</span>
          <input v-model.number="form.latitude" type="number" step="0.00000000000000001" placeholder="緯度" />

          <input v-model.number="form.longitude" type="number" step="0.00000000000000001" placeholder="経度" />
        </label>

        <label class="field">
          <span>判定半径</span>
          <select v-model.number="form.radiusMeters">
            <option v-for="value in radiusOptions" :key="value" :value="value">
              {{ value }}m
            </option>
          </select>
        </label>

        <p v-if="message" class="message">{{ message }}</p>
        <p v-if="error" class="message error">{{ error }}</p>
        <p v-if="geoError" class="message error">{{ geoError }}</p>

        <div class="button-row">
          <button class="primary-button" type="submit">
            {{ isEditing ? '更新' : '登録' }}
          </button>
          <button v-if="isEditing" class="secondary-button" type="button" @click="resetForm">
            キャンセル
          </button>
        </div>
      </form>
    </section>

    <h2 class="section-title">登録済み場所</h2>
    <div class="category-list">
      <div v-for="place in places" :key="place.id" class="category-row">
        <div>
          <strong>{{ place.name }}</strong>
          <div class="meta">
            緯度: {{ place.latitude.toFixed(6) }} / 経度: {{ place.longitude.toFixed(6) }} / 半径: {{ place.radiusMeters }}m
          </div>
        </div>
        <div class="button-row">
          <button class="secondary-button" type="button" @click="editPlace(place)">編集</button>
          <button class="danger-button" type="button" @click="removePlace(place)">削除</button>
        </div>
      </div>
      <p v-if="places.length === 0" class="empty-state">登録された場所がありません。</p>
    </div>
  </AppShell>
</template>
