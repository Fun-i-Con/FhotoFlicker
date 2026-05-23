<script setup lang="ts">
import { directionLabels, flickDirections, type Category, type FlickDirection } from '~/types/photo'

const db = usePhotoDb()
const categories = ref<Category[]>([])
const message = ref('')
const error = ref('')
const form = reactive({
  id: '',
  name: '',
  color: '#2563eb',
  direction: 'up' as FlickDirection
})

const isEditing = computed(() => Boolean(form.id))

async function load() {
  await db.init()
  categories.value = await db.getCategories()
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.color = '#2563eb'
  form.direction = 'up'
  error.value = ''
}

function editCategory(category: Category) {
  form.id = category.id
  form.name = category.name
  form.color = category.color
  form.direction = category.direction
  message.value = ''
  error.value = ''
}

async function submitCategory() {
  error.value = ''
  message.value = ''

  if (!form.name.trim()) {
    error.value = '工程名を入力してください。'
    return
  }

  try {
    await db.saveCategory({
      id: form.id || undefined,
      name: form.name,
      color: form.color,
      direction: form.direction
    })
    await load()
    message.value = isEditing.value ? '工程を更新しました。' : '工程を追加しました。'
    resetForm()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存に失敗しました。'
  }
}

async function removeCategory(category: Category) {
  if (!confirm('この工程を削除しますか？')) {
    return
  }

  await db.deleteCategory(category.id)
  await load()
  if (form.id === category.id) {
    resetForm()
  }
  message.value = '工程を削除しました。'
}

onMounted(load)
</script>

<template>
  <AppShell>
    <h1 class="page-title">工程設定</h1>
    <p class="page-lead">場所ごとに写真を整理できるよう、フリック方向と工程の対応を設定します。同じ方向には1つの工程だけ設定できます。</p>

    <DirectionMap :categories="categories" />

    <section class="form-panel">
      <h2 class="section-title">{{ isEditing ? '工程編集' : '工程追加' }}</h2>
      <form @submit.prevent="submitCategory">
        <label class="field">
          <span>工程名</span>
          <input v-model="form.name" type="text" autocomplete="off" placeholder="例: 施工前" />
        </label>
        <label class="field">
          <span>方向</span>
          <select v-model="form.direction">
            <option v-for="direction in flickDirections" :key="direction" :value="direction">
              {{ directionLabels[direction] }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>色</span>
          <input v-model="form.color" type="color" />
        </label>
        <p v-if="message" class="message">{{ message }}</p>
        <p v-if="error" class="message error">{{ error }}</p>
        <div class="button-row">
          <button class="primary-button" type="submit">{{ isEditing ? '更新' : '追加' }}</button>
          <button v-if="isEditing" class="secondary-button" type="button" @click="resetForm">キャンセル</button>
        </div>
      </form>
    </section>

    <h2 class="section-title">登録済み工程</h2>
    <div class="category-list">
      <div v-for="category in categories" :key="category.id" class="category-row">
        <CategoryBadge :category="category" />
        <div class="button-row">
          <button class="secondary-button" type="button" @click="editCategory(category)">編集</button>
          <button class="danger-button" type="button" @click="removeCategory(category)">削除</button>
        </div>
      </div>
      <p v-if="categories.length === 0" class="empty-state">工程がありません。</p>
    </div>
  </AppShell>
</template>
