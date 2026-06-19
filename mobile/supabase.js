import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://prroqqxhxrvtxfficnbp.supabase.co';
const supabaseAnonKey = 'sb_publishable_iZZ3l3O0X19wpTFs4Bd6Zw_mPJugrrR';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
