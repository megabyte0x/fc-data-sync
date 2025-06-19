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

async function process_and_upload_chunk(castsData: CastRecord[]) {
    try {
        // Process the chunk
        const processedUsers = filter_data(castsData);

        if (processedUsers.length > 0) {
            // Upload the processed users
            const success = await upload_users_to_supabase(processedUsers);
            if (success) {
                console.log(`Successfully processed and uploaded ${processedUsers.length} users`);
            } else {
                console.error(`Failed to upload ${processedUsers.length} processed users`);
            }
        }
    } catch (error) {
        console.error('Error in processing and uploading chunk:', error);
    }
}

async function fetch_casts_for_all() {
    let totalProcessed = 0;
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
                // Process and upload this chunk immediately
                await process_and_upload_chunk(data);

                totalProcessed += data.length;
                currentPage++;
                consecutiveErrors = 0; // Reset error counter on success

                console.log(`Processed ${data.length} records. Total processed so far: ${totalProcessed}`);

                // If we got less records than PAGE_SIZE, we've reached the end
                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                }

                // Add delay before next request
                if (hasMore) {
                    await delay(DELAY_BETWEEN_REQUESTS);
                }
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

    console.log(`Completed processing with ${totalProcessed} total records processed`);
    return totalProcessed;
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
                    following_count: authorData.following_count,
                    follower_count: authorData.follower_count,
                    pfp_url: authorData.pfp_url,
                    verified_addresses: authorData.verified_addresses,
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

    return true;
}

async function main() {
    try {
        console.log('Starting to fetch and process casts...');
        const totalProcessed = await fetch_casts_for_all();
        console.log(`Process completed successfully! Total records processed: ${totalProcessed}`);
    } catch (error) {
        console.error('Error in main process:', error);
    }
}

export { fetch_casts_for_all, filter_data, upload_users_to_supabase, main };

if (require.main === module) {
    main();
}