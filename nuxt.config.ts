export default defineNuxtConfig({
  compatibilityDate: '2026-05-14',
  ssr: false,
  devtools: { enabled: true },
  app: {
    baseURL: '/2026hackthon_team_B/',
    head: {
      title: 'Photo Flick Sorter',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#111827' },
        { name: 'description', content: 'スマホ撮影した写真をフリックで分類するWebアプリ' }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'github_pages',
    output: {
      publicDir: 'docs'
    }
  }
})