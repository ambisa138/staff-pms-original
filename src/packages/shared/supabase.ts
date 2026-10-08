import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function testSupabaseConnection() {
  if (!supabase) {
    return { success: false, message: "Supabase URL or Anon Key missing" };
  }
  try {
    // Testing storage as requested in Phase 0
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    return { success: true, message: "Supabase connected successfully" };
  } catch (error: any) {
    return { success: false, message: error?.message || "Unknown Supabase error" };
  }
}
