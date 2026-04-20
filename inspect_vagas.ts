import { supabase } from './src/lib/supabase';

async function run() {
  try {
    const { data, error } = await supabase.from('vagas').select('*').limit(1);
    if (data && data.length > 0) {
      console.log('VAGAS_COLUMNS:', Object.keys(data[0]));
    } else {
      console.log('NO_VAGAS_FOUND');
    }
    if (error) console.error('QUERY_ERROR:', error);
  } catch (e) {
    console.error('SCRIPT_ERROR:', e);
  }
}

run();
