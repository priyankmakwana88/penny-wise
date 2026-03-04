import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("Supabase Key:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "Loaded!" : "Missing!");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    [
      'Supabase env vars missing.',
      'Create a `.env.local` in the Vite project root with:',
      '- VITE_SUPABASE_URL=...',
      '- VITE_SUPABASE_ANON_KEY=...',
      'Then fully restart `npm run dev`.',
    ].join('\n')
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)