const SUPABASE_URL =
"https://yezmbhwfemardwgtnroz.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_Hb1ySpsX74hdVBOB0QPCIQ_W6SqFQuo";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
