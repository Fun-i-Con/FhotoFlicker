<script setup lang="ts">
import { directionLabels, type Category } from '~/types/photo'

defineProps<{
  category?: Category
  label?: string
}>()
</script>

<template>
  <span class="category-badge" :style="{ '--badge-color': category?.color || '#6b7280' }">
    <span class="badge-dot" />
    <span>{{ category ? category.name : label || '未設定' }}</span>
    <small v-if="category">{{ directionLabels[category.direction] }}</small>
  </span>
</template>
