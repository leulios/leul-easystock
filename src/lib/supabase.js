import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yarbynjjvtcpzhxhdzwj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcmJ5bmpqdnRjcHpoeGhkendqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDY4NTksImV4cCI6MjA4NzYyMjg1OX0.MQ9hjfEwA4rjNSSLuy3TYodHiPY7jFcsHszTwPLGMXo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
