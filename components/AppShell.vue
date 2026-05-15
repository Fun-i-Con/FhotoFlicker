<template>
  <div class="app-shell">
    <header class="app-header">
      <NuxtLink class="brand" to="/">Photo Flick</NuxtLink>
      <nav class="header-nav" aria-label="主要ナビゲーション">
        <NuxtLink to="/capture">撮影</NuxtLink>
        <NuxtLink to="/categories">カテゴリ</NuxtLink>
        <NuxtLink to="/photos">一覧</NuxtLink>
      </nav>
    </header>
    <main class="app-main">
      <slot />
    </main>
  </div>
</template>
