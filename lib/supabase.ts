import { createClient } from '@supabase/supabase-js'

// IronPulse data lives in the `ironpulse` schema of a shared Supabase project
// (ML.Quest's tables stay in `public`). Only server routes touch the DB.
const SCHEMA = process.env.SUPABASE_SCHEMA || 'ironpulse'

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: SCHEMA }, auth: { persistSession: false } }
  )
}
