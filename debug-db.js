import { supabase } from './src/lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function debugData() {
  console.log('--- Checking Books ---');
  const { data: books, error: bookError } = await supabase.from('books').select('id, title').limit(5);
  if (bookError) console.error('Book Error:', bookError);
  else console.log('Books found:', books);

  console.log('\n--- Checking Subjects ---');
  const { data: subjects, error: subjError } = await supabase.from('subjects').select('code, name').limit(5);
  if (subjError) console.error('Subject Error:', subjError);
  else console.log('Subjects found:', subjects);

  console.log('\n--- Checking Book Subjects ---');
  const { data: bs, error: bsError } = await supabase.from('book_subjects').select('*').limit(5);
  if (bsError) console.error('Book Subjects Error:', bsError);
  else console.log('Book Subjects found:', bs);
}

debugData();
