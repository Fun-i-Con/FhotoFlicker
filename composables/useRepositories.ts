import { indexedDbRepositories } from '~/repositories/indexedDb'
import { createSupabaseRepositories } from '~/repositories/supabase'
import type { Repositories } from '~/repositories/types'

export function useRepositories(): Repositories {
  const supabase = useSupabase()
  return supabase ? createSupabaseRepositories(supabase) : indexedDbRepositories
}
