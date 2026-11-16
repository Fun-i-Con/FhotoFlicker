<script setup lang="ts">
const supabase = useSupabase()
const error = ref('')

async function signIn() {
  error.value = ''

  if (!supabase) {
    return
  }

  // GitHub Pages では深いパスが 404.html 経由になるので、戻り先はルートにする
  const redirectTo = new URL(useRuntimeConfig().app.baseURL, window.location.origin).href
  const { error: signInError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  })

  if (signInError) {
    error.value = signInError.message
  }
}
</script>

<template>
  <main class="app-main">
    <h1 class="page-title">ログイン</h1>
    <p class="page-lead">写真を保存するには Google アカウントでログインしてください。</p>

    <div class="button-row">
      <button class="primary-button" type="button" @click="signIn">Google でログイン</button>
    </div>

    <p v-if="error" class="message error">{{ error }}</p>
  </main>
</template>
