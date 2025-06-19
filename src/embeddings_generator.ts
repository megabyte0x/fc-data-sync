import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { CastRecord } from './types';

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

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(from: number, to: number, retryCount = 0): Promise<any> {
    try {
        const { data, error } = await supabase
            .from('casts')
            .select('fid, casts')
            .order('fid')
            .range(from, to);

        if (error) {
            if (error.code === '57014' && retryCount < MAX_RETRIES) {
                // If it's a timeout error and we haven't exceeded max retries
                console.log(`Timeout error, retrying after longer delay... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2)); // Exponential backoff
                return fetchWithRetry(from, to, retryCount + 1);
            }
            throw error;
        }

        return data;
    } catch (e) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Unexpected error, retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
            return fetchWithRetry(from, to, retryCount + 1);
        }
        throw e;
    }
}

async function fetch_casts_for_all() {
    let allCasts: any[] = [];
    let hasMore = true;
    let currentPage = 0;
    let consecutiveErrors = 0;

    while (hasMore && consecutiveErrors < 3) {
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        console.log(`Fetching casts from ${from} to ${to}...`);

        try {
            const data = await fetchWithRetry(from, to);

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allCasts = allCasts.concat(data);
                currentPage++;
                consecutiveErrors = 0; // Reset error counter on success

                // If we got less records than PAGE_SIZE, we've reached the end
                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                }
            }

            console.log(`Fetched ${data?.length || 0} records. Total records so far: ${allCasts.length}`);

            // Add delay before next request
            if (hasMore) {
                await delay(DELAY_BETWEEN_REQUESTS);
            }
        } catch (e) {
            console.error(`Failed to fetch range ${from}-${to} after all retries:`, e);
            consecutiveErrors++;
            await delay(DELAY_BETWEEN_REQUESTS * 2);
        }
    }

    if (consecutiveErrors >= 3) {
        console.warn('Stopped fetching due to too many consecutive errors');
    }

    return allCasts;
}

function filter_data(castsData: CastRecord[]) {
    const userMap = new Map();

    castsData.forEach(record => {
        const { fid, casts } = record;

        if (casts && casts.data && casts.data.length > 0) {
            const authorData = casts.data[0].author;

            if (!userMap.has(fid)) {
                userMap.set(fid, {
                    fid: fid,
                    user_name: authorData.username,
                    following_count: 0,
                    followers_count: 0,
                    pfp_url: authorData.pfp_url
                });
            }
        }
    });

    return Array.from(userMap.values());
}

async function upload_users_to_supabase(userData: any[]) {
    const { data, error } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'fid' });

    if (error) {
        console.error('Error uploading users:', error);
        return false;
    }

    console.log(`Successfully uploaded ${userData.length} users to the database`);
    return true;
}

async function main() {
    try {
        console.log('Fetching casts from database...');
        const castsData = await fetch_casts_for_all();

        console.log('Filtering data to extract user information...');
        const userData = filter_data(castsData);

        console.log('Uploading user data to users table...');
        await upload_users_to_supabase(userData);

        console.log('Process completed successfully!');
    } catch (error) {
        console.error('Error in main process:', error);
    }
}

export { fetch_casts_for_all, filter_data, upload_users_to_supabase, main };

if (require.main === module) {
    main();
}