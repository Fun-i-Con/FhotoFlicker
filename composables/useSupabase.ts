import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'

function create(url: string, key: string) {
  return createClient<Database>(url, key, { auth: { flowType: 'pkce' } })
}

export type AppSupabaseClient = ReturnType<typeof create>

let client: AppSupabaseClient | null | undefined

// 接続先が未設定なら null を返す。その場合は IndexedDB 版で動き、ログインも求めない
export function useSupabase() {
  if (client === undefined) {
    const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
    client = supabaseUrl && supabaseKey ? create(supabaseUrl, supabaseKey) : null
  }

  return client
}
