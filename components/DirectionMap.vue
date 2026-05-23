<script setup lang="ts">
import { directionLabels, flickDirections, type Category } from '~/types/photo'

const directionArrows = {
  up: '↑',
  right: '→',
  down: '↓',
  left: '←'
} as const

const props = defineProps<{
  categories: Category[]
}>()

function categoryFor(direction: keyof typeof directionArrows) {
  return props.categories.find((category) => category.direction === direction)
}
</script>

<template>
  <section class="direction-map" aria-label="フリック方向と工程の対応">
    <div
      v-for="direction in flickDirections"
      :key="direction"
      class="direction-tile"
      :class="`direction-${direction}`"
      :style="{
        '--tile-color': categoryFor(direction)?.color || '#9ca3af'
      }"
    >
      <div class="direction-tile-header">
        <span class="direction-arrow">{{ directionArrows[direction] }}</span>
        <strong>{{ directionLabels[direction] }}</strong>
      </div>
      <div class="direction-target" :class="{ 'is-empty': !categoryFor(direction) }">
        <span>{{ categoryFor(direction)?.name || '未設定' }}</span>
      </div>
    </div>
    <div class="direction-center">
      <span class="direction-center-label">フリック方向</span>
      <strong>上下左右に操作</strong>
    </div>
  </section>
</template>
