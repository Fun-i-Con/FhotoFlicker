export default defineNuxtConfig({
  compatibilityDate: '2026-05-14',
  ssr: false,
  devtools: { enabled: true },
  app: {
    head: {
      title: 'Photo Flick Sorter',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#111827' },
        { name: 'description', content: 'スマホ撮影した写真をフリックで分類するWebアプリ' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&display=swap'
        }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
})