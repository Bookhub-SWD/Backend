import { supabase } from './src/lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function insertDummy() {
  console.log('--- Inserting Dummy Book ---');
  // First, check if a library exists
  const { data: lib } = await supabase.from('library').select('id').limit(1).single();
  
  const dummyBook = {
    title: 'Test Book ' + Date.now(),
    author: 'AI Assistant',
    publisher: 'Test Pub',
    library_id: lib ? lib.id : null, 
    isbn: 1234567890
  };

  const { data, error } = await supabase.from('books').insert(dummyBook).select();
  if (error) console.error('Insert Error:', error);
  else console.log('Insert Success:', data);
}

insertDummy();
