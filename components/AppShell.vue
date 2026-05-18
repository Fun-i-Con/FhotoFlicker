<template>
  <div class="app-shell">
    <main class="app-main">
      <slot />
    </main>

    <footer class="bottom-nav" aria-label="下部ナビゲーション">
      <NuxtLink to="/capture">撮影</NuxtLink>
      <NuxtLink to="/categories">カテゴリ</NuxtLink>
      <NuxtLink to="/photos">一覧</NuxtLink>
    </footer>
  </div>
</template>
