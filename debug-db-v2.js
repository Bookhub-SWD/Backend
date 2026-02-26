import { supabase } from './src/lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function debugDetails() {
  console.log('--- Checking Book with ID 2 ---');
  const { data: book2, error: book2Error } = await supabase.from('books').select('*').eq('id', 2);
  console.log('Book ID 2:', book2, book2Error);

  console.log('\n--- Checking count of all books ---');
  const { count, error: countError } = await supabase.from('books').select('*', { count: 'exact', head: true });
  console.log('Total books count:', count, countError);

  console.log('\n--- Checking Subjects again (full) ---');
  const { data: allSubjects } = await supabase.from('subjects').select('*');
  console.log('All subjects counts:', allSubjects?.length);
}

debugDetails();
