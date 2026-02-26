import { supabase } from './src/lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function listTables() {
  console.log('--- Checking available RPCs or information_schema if possible ---');
  // Since we don't have direct access to list tables via supabase-js without an RPC,
  // we'll try to guess or probe common names if 'books' is empty.
  
  const tablesToProbe = ['books', 'book', 'Books', 'library_books', 'all_books'];
  for (const table of tablesToProbe) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`Table '${table}':`, count, error ? error.message : 'OK');
  }
}

listTables();
