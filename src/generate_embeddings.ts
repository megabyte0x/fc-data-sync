import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PAGE_SIZE = 25; // Very small page size for free tier
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds delay between requests
const MAX_RETRIES = 3; // Maximum number of retries per chunk


if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function get_users() {
    const { data, error } = await supabase.from('users').select('fid, user_name, pfp_url, follower_count, verified_addresses, following_count, channels_following');
    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return data;
}