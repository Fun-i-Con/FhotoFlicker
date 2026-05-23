<script setup lang="ts">
import { directionLabels, flickDirections, type Category } from '~/types/photo'

defineProps<{
  categories: Category[]
}>()
</script>

<template>
  <section class="direction-map" aria-label="フリック方向と工程の対応">
    <div
      v-for="direction in flickDirections"
      :key="direction"
      class="direction-tile"
      :class="`direction-${direction}`"
    >
      <strong>{{ directionLabels[direction] }}</strong>
      <CategoryBadge :category="categories.find((category) => category.direction === direction)" />
    </div>
  </section>
</template>
