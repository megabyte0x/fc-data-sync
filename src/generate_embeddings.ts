import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
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

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchCastsWithRetry(from: number, to: number, retryCount = 0): Promise<any> {
    try {
        const { data, error } = await supabase
            .from('casts')
            .select('fid, casts')
            .order('fid')
            .range(from, to);

        if (error) {
            if (error.code === '57014' && retryCount < MAX_RETRIES) {
                console.log(`Timeout error, retrying after longer delay... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
                return fetchCastsWithRetry(from, to, retryCount + 1);
            }
            throw error;
        }

        return data;
    } catch (e) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Unexpected error, retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
            return fetchCastsWithRetry(from, to, retryCount + 1);
        }
        throw e;
    }
}

async function process_and_update_chunk(castsData: any[]) {
    try {
        for (const castEntry of castsData) {
            const { fid, casts } = castEntry;

            if (casts && casts.data && casts.data.length > 0) {
                const authorData = casts.data[0].author;

                const { data, error } = await supabase
                    .from('users')
                    .upsert({
                        fid: fid,
                        user_name: authorData.username,
                        following_count: authorData.following_count,
                        followers_count: authorData.follower_count,
                        pfp_url: authorData.pfp_url,
                        verified_addresses: authorData.verified_addresses
                    });

                if (error) {
                    console.error(`Error updating user for fid ${fid}:`, error);
                } else {
                    console.log(`Successfully updated user for fid ${fid}`);
                }
            }

            // Add delay between individual fid processing to avoid rate limits
            await delay(DELAY_BETWEEN_REQUESTS / 2);
        }
    } catch (error) {
        console.error('Error in processing and updating chunk:', error);
    }
}

async function update_users_from_casts() {
    let totalProcessed = 0;
    let hasMore = true;
    let currentPage = 0;
    let consecutiveErrors = 0;

    while (hasMore && consecutiveErrors < 3) {
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        console.log(`Fetching casts from ${from} to ${to}...`);

        try {
            const data = await fetchCastsWithRetry(from, to);

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                // Process and update this chunk immediately
                await process_and_update_chunk(data);

                totalProcessed += data.length;
                currentPage++;
                consecutiveErrors = 0;

                console.log(`Processed ${data.length} casts. Total processed so far: ${totalProcessed}`);

                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                }

                if (hasMore) {
                    await delay(DELAY_BETWEEN_REQUESTS);
                }
            }
        } catch (e) {
            console.error(`Failed to fetch casts range ${from}-${to} after all retries:`, e);
            consecutiveErrors++;
            await delay(DELAY_BETWEEN_REQUESTS * 2);
        }
    }

    if (consecutiveErrors >= 3) {
        console.warn('Stopped updating due to too many consecutive errors');
    }

    console.log(`Completed updating users with ${totalProcessed} total casts processed`);
    return totalProcessed;
};
// https://8001/api/user-analysis
async function main() {
    await update_users_from_casts();
}

export { main };
