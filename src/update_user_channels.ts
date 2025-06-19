import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { ChannelsResponse } from './channels.types';
import axios from 'axios';
import { User } from './cast.types';

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

async function fetchFidsWithRetry(from: number, to: number, retryCount = 0): Promise<any> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('fid')
            .order('fid')
            .range(from, to);

        if (error) {
            if (error.code === '57014' && retryCount < MAX_RETRIES) {
                console.log(`Timeout error, retrying after longer delay... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
                return fetchFidsWithRetry(from, to, retryCount + 1);
            }
            throw error;
        }

        return data;
    } catch (e) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Unexpected error, retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
            return fetchFidsWithRetry(from, to, retryCount + 1);
        }
        throw e;
    }
}

async function fetch_user_channels_with_retry(fid: string, retryCount = 0): Promise<ChannelsResponse | null> {
    try {
        const options = { method: 'GET', headers: { 'x-api-key': process.env.NEYNAR_API_KEY ?? "", "Content-Type": "application/json", } };

        const response = await axios.get(`https://api.neynar.com/v2/farcaster/user/channels/?limit=100&fid=${fid}`, options);
        const data: ChannelsResponse = response.data;
        return data;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Error fetching channels for fid ${fid}, retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
            return fetch_user_channels_with_retry(fid, retryCount + 1);
        }
        console.error(`Failed to fetch channels for fid ${fid} after all retries:`, error);
        return null;
    }
}

async function process_and_update_chunk(fids: string[]) {
    try {
        for (const fid of fids) {
            const channels = await fetch_user_channels_with_retry(fid);
            if (channels && channels.channels) {


                const { data, error } = await supabase
                    .from('users')
                    .update({
                        channels_following: channels.channels.map((channel) => {
                            // update_lead(channel.lead);
                            return {
                                url: channel.url,
                                name: channel.name,
                                description: channel.description,
                                image_url: channel.image_url,
                            }
                        })
                    })
                    .eq('fid', fid);


                if (error) {
                    console.error(`Error updating user channels for fid ${fid}:`, error);
                } else {
                    console.log(`Successfully updated channels for fid ${fid}`);
                }
            }

            // Add delay between individual fid processing to avoid rate limits
            await delay(DELAY_BETWEEN_REQUESTS / 2);
        }
    } catch (error) {
        console.error('Error in processing and updating chunk:', error);
    }
}


// async function update_lead(lead: User) {
//     const { data, error } = await supabase.from('users').update({
//         user_name: lead.username,
//         pfp_url: lead.pfp_url,
//         follower_count: lead.follower_count,
//         verified_addresses: lead.verified_addresses,
//         following_count: lead.following_count,
//     }).eq('fid', lead.fid)

//     if (error) {
//         console.error(`Error updating lead for fid ${lead.fid}:`, error);
//     } else {
//         console.log(`Successfully updated lead for fid ${lead.fid}`);
//     }
// }

async function update_user_channels() {
    let totalProcessed = 0;
    let hasMore = true;
    let currentPage = 0;
    let consecutiveErrors = 0;

    while (hasMore && consecutiveErrors < 3) {
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        console.log(`Fetching fids from ${from} to ${to}...`);

        try {
            const data = await fetchFidsWithRetry(from, to);

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                const fids = data.map((user: any) => user.fid);

                // Process and update this chunk immediately
                await process_and_update_chunk(fids);

                totalProcessed += data.length;
                currentPage++;
                consecutiveErrors = 0;

                console.log(`Processed ${data.length} fids. Total processed so far: ${totalProcessed}`);

                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                }

                if (hasMore) {
                    await delay(DELAY_BETWEEN_REQUESTS);
                }
            }
        } catch (e) {
            console.error(`Failed to fetch fids range ${from}-${to} after all retries:`, e);
            consecutiveErrors++;
            await delay(DELAY_BETWEEN_REQUESTS * 2);
        }
    }

    if (consecutiveErrors >= 3) {
        console.warn('Stopped updating due to too many consecutive errors');
    }

    console.log(`Completed updating channels with ${totalProcessed} total fids processed`);
    return totalProcessed;
}

async function main() {
    await update_user_channels();
}

export { main };