
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRegs() {
    const { data, error } = await supabase
        .from('event_registrations')
        .select('id, registration_code, status')
        .limit(10);
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Recent registrations:', JSON.stringify(data, null, 2));
    }
}

checkRegs();
