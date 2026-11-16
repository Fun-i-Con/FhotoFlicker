export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabase()

  if (!supabase) {
    return
  }

  const { data } = await supabase.auth.getSession()

  if (!data.session && to.path !== '/login') {
    return navigateTo('/login')
  }

  if (data.session && to.path === '/login') {
    return navigateTo('/')
  }
})
