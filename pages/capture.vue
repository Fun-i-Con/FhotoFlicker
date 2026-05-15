<script setup lang="ts">
const db = usePhotoDb()
const previewUrl = ref('')
const selectedFile = ref<File | null>(null)
const error = ref('')

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  revokePreview()
  selectedFile.value = file || null
  error.value = ''

  if (file) {
    previewUrl.value = URL.createObjectURL(file)
  }
}

async function saveAndClassify() {
  if (!selectedFile.value) {
    error.value = '写真を選択してください。'
    return
  }

  await db.init()
  await db.saveDraft(selectedFile.value)
  await navigateTo('/classify')
}

onUnmounted(revokePreview)
</script>

<template>
  <AppShell>
    <h1 class="page-title">撮影</h1>
    <p class="page-lead">スマホではカメラが起動します。撮影後にプレビューを確認して分類へ進みます。</p>

    <section class="capture-panel">
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
