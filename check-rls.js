import { supabase } from './src/lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function debugRLS() {
  console.log('--- Checking Library ---');
  const { data: libs, error: libErr, count } = await supabase.from('library').select('*', { count: 'exact' });
  console.log('Library found:', libs?.length, 'Count:', count, libErr);

  console.log('\n--- Checking Subjects again ---');
  const { data: subjs } = await supabase.from('subjects').select('*').limit(1);
  console.log('Is subjects readable?', subjs?.length > 0 ? 'YES' : 'NO');
}

debugRLS();
