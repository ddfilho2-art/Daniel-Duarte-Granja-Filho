import { supabase } from './src/lib/supabase';

async function run() {
  try {
    const { data, error } = await supabase.from('transferencias').select('*').limit(5);
    console.log('JSON_RESPONSE:', JSON.stringify(data, null, 2));
    if (error) console.error('QUERY_ERROR:', error);
  } catch (e) {
    console.error('SCRIPT_ERROR:', e);
  }
  process.exit(0);
}

run();
