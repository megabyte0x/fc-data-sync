import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Cast_DB, User_DB, User_Profile } from './types';
import { generateUserEmbeddings } from './generate_embeddings';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PAGE_SIZE = 25;
const DELAY_BETWEEN_REQUESTS = 2000;
const MAX_RETRIES = 3;
const PARALLEL_LIMIT = 3;
const CHECKPOINT_FILE = 'embedding_checkpoint.json';

interface ProcessingCheckpoint {
    lastProcessedOffset: number;
    totalProcessed: number;
    failedFids: string[];
    timestamp: string;
}

interface ProcessingStats {
    totalUsers: number;
    processed: number;
    skipped: number;
    failed: number;
    startTime: Date;
}


if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class CheckpointManager {
    private checkpointPath: string;

    constructor(filename: string = CHECKPOINT_FILE) {
        this.checkpointPath = path.join(process.cwd(), filename);
    }

    saveCheckpoint(checkpoint: ProcessingCheckpoint): void {
        try {
            fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
        } catch (error) {
            console.warn('Failed to save checkpoint:', error);
        }
    }

    loadCheckpoint(): ProcessingCheckpoint | null {
        try {
            if (fs.existsSync(this.checkpointPath)) {
                const data = fs.readFileSync(this.checkpointPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.warn('Failed to load checkpoint:', error);
        }
        return null;
    }

    clearCheckpoint(): void {
        try {
            if (fs.existsSync(this.checkpointPath)) {
                fs.unlinkSync(this.checkpointPath);
            }
        } catch (error) {
            console.warn('Failed to clear checkpoint:', error);
        }
    }
}

class ProgressTracker {
    private stats: ProcessingStats;
    private lastUpdate: Date;

    constructor(totalUsers: number) {
        this.stats = {
            totalUsers,
            processed: 0,
            skipped: 0,
            failed: 0,
            startTime: new Date()
        };
        this.lastUpdate = new Date();
    }

    update(processed: number, skipped: number, failed: number): void {
        this.stats.processed += processed;
        this.stats.skipped += skipped;
        this.stats.failed += failed;
        
        const now = new Date();
        if (now.getTime() - this.lastUpdate.getTime() > 5000) { // Update every 5 seconds
            this.logProgress();
            this.lastUpdate = now;
        }
    }

    logProgress(): void {
        const elapsed = (new Date().getTime() - this.stats.startTime.getTime()) / 1000;
        const rate = this.stats.processed / elapsed;
        const remaining = this.stats.totalUsers - (this.stats.processed + this.stats.skipped + this.stats.failed);
        const eta = remaining > 0 ? remaining / rate : 0;

        console.log(`Progress: ${this.stats.processed}/${this.stats.totalUsers} processed, ` +
                   `${this.stats.skipped} skipped, ${this.stats.failed} failed | ` +
                   `Rate: ${rate.toFixed(2)}/s | ETA: ${Math.round(eta)}s`);
    }

    getStats(): ProcessingStats {
        return { ...this.stats };
    }
}

async function fetch_users_data_with_retry(from: number, to: number, retryCount = 0): Promise<any> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('fid, user_name, pfp_url, follower_count, verified_addresses, following_count, channels_following, channels_member, embeddings, summary')
            .or('embeddings.is.null,summary.is.null')
            .range(from, to);

        if (error) {
            if (error.code === '57014' && retryCount < MAX_RETRIES) {
                console.log(`Timeout error, retrying after longer delay... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
                return fetch_users_data_with_retry(from, to, retryCount + 1);
            }
            throw error;
        }

        return data;
    } catch (e) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Unexpected error, retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
            return fetch_users_data_with_retry(from, to, retryCount + 1);
        }
        throw e;
    }
}

async function fetch_casts_for_fids(fids: string[], retryCount = 0): Promise<any> {
    try {
        const { data, error } = await supabase
            .from('casts')
            .select('fid, casts')
            .in('fid', fids);

        if (error) {
            if (error.code === '57014' && retryCount < MAX_RETRIES) {
                console.log(`Timeout error, retrying after longer delay... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
                return fetch_casts_for_fids(fids, retryCount + 1);
            }
            throw error;
        }

        return data;
    } catch (e) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Unexpected error, retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await delay(DELAY_BETWEEN_REQUESTS * (retryCount + 2));
            return fetch_casts_for_fids(fids, retryCount + 1);
        }
        throw e;
    }
}

function createUserProfile(user: User_DB, castRecord: Cast_DB | undefined): User_Profile | null {
    if (!castRecord || !castRecord.casts || !castRecord.casts.data) {
        return null;
    }

    let channels: { name: string, description: string }[] = [];
    if ((user.channels_following && user.channels_following.length > 0) || 
        (user.channels_member && user.channels_member.length > 0)) {
        const followingChannels = user.channels_following || [];
        const memberChannels = user.channels_member || [];
        channels = followingChannels.concat(memberChannels).map(channel => ({
            name: channel.name,
            description: channel.description
        }));
    }

    return {
        fid: user.fid,
        bio: user.description,
        follower_count: user.follower_count,
        following_count: user.following_count,
        channels: channels,
        user_name: user.user_name,
        name: user.user_name,
        casts: castRecord.casts.data
    };
}

async function processUserEmbedding(userProfile: User_Profile, failedFids: Set<string>): Promise<{ success: boolean, error?: any }> {
    try {
        if (failedFids.has(userProfile.fid)) {
            console.log(`Skipping previously failed fid: ${userProfile.fid}`);
            return { success: false };
        }

        console.log("Generating embeddings for fid", userProfile.fid);
        const { summary, embedding } = await generateUserEmbeddings(userProfile);

        const { error } = await supabase
            .from('users')
            .update({
                embeddings: embedding,
                summary: summary,
            })
            .eq('fid', userProfile.fid);

        if (error) {
            throw error;
        }

        console.log("Successfully updated embeddings for fid", userProfile.fid);
        return { success: true };
    } catch (error) {
        console.error(`Failed to process fid ${userProfile.fid}:`, error);
        failedFids.add(userProfile.fid);
        return { success: false, error };
    }
}

async function processUsersParallel(userProfiles: User_Profile[], failedFids: Set<string>): Promise<{ processed: number, failed: number }> {
    const results = { processed: 0, failed: 0 };
    
    for (let i = 0; i < userProfiles.length; i += PARALLEL_LIMIT) {
        const batch = userProfiles.slice(i, i + PARALLEL_LIMIT);
        
        const promises = batch.map(profile => processUserEmbedding(profile, failedFids));
        const batchResults = await Promise.all(promises);
        
        batchResults.forEach(result => {
            if (result.success) {
                results.processed++;
            } else {
                results.failed++;
            }
        });
        
        if (i + PARALLEL_LIMIT < userProfiles.length) {
            await delay(DELAY_BETWEEN_REQUESTS);
        }
    }
    
    return results;
}

async function process_and_update_chunk(usersData: User_DB[], castsData: Cast_DB[], failedFids: Set<string>): Promise<{ processed: number, skipped: number, failed: number }> {
    const castsMap = new Map<string, Cast_DB>();
    castsData.forEach(castRecord => {
        castsMap.set(castRecord.fid, castRecord);
    });

    const user_profiles: User_Profile[] = [];
    let skipped = 0;

    usersData.forEach(user => {
        const castRecord = castsMap.get(user.fid);
        const userProfile = createUserProfile(user, castRecord);
        
        if (userProfile) {
            user_profiles.push(userProfile);
        } else {
            skipped++;
        }
    });

    if (user_profiles.length === 0) {
        return { processed: 0, skipped, failed: 0 };
    }

    const results = await processUsersParallel(user_profiles, failedFids);
    return { processed: results.processed, skipped, failed: results.failed };
}

async function getTotalUserCount(): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .or('embeddings.is.null,summary.is.null');
        
        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.warn('Could not get total user count:', error);
        return 0;
    }
}

async function update_users_embeddings() {
    const checkpointManager = new CheckpointManager();
    const checkpoint = checkpointManager.loadCheckpoint();
    
    let currentOffset = checkpoint?.lastProcessedOffset || 0;
    let totalProcessed = checkpoint?.totalProcessed || 0;
    const failedFids = new Set(checkpoint?.failedFids || []);
    
    console.log(`Starting from offset: ${currentOffset}, previously processed: ${totalProcessed}`);
    if (failedFids.size > 0) {
        console.log(`Found ${failedFids.size} previously failed FIDs that will be skipped`);
    }

    const totalUsers = await getTotalUserCount();
    const progressTracker = new ProgressTracker(totalUsers);
    
    let hasMore = true;
    let consecutiveErrors = 0;

    while (hasMore && consecutiveErrors < 3) {
        const from = currentOffset;
        const to = from + PAGE_SIZE - 1;

        console.log(`Fetching users from ${from} to ${to}...`);

        try {
            const user_data: User_DB[] = await fetch_users_data_with_retry(from, to);

            if (!user_data || user_data.length === 0) {
                hasMore = false;
                break;
            }

            const fids = user_data.map(user => user.fid);
            console.log(`Fetching casts for ${fids.length} users...`);
            
            const cast_data: Cast_DB[] = await fetch_casts_for_fids(fids);
            const results = await process_and_update_chunk(user_data, cast_data, failedFids);

            totalProcessed += results.processed;
            currentOffset += user_data.length;
            consecutiveErrors = 0;

            progressTracker.update(results.processed, results.skipped, results.failed);

            const newCheckpoint: ProcessingCheckpoint = {
                lastProcessedOffset: currentOffset,
                totalProcessed,
                failedFids: Array.from(failedFids),
                timestamp: new Date().toISOString()
            };
            checkpointManager.saveCheckpoint(newCheckpoint);

            if (user_data.length < PAGE_SIZE) {
                hasMore = false;
            }

            if (hasMore) {
                await delay(DELAY_BETWEEN_REQUESTS);
            }
        } catch (e) {
            console.error(`Failed to process range ${from}-${to}:`, e);
            consecutiveErrors++;
            await delay(DELAY_BETWEEN_REQUESTS * 2);
        }
    }

    progressTracker.logProgress();
    const finalStats = progressTracker.getStats();
    
    if (consecutiveErrors >= 3) {
        console.warn('Stopped due to consecutive errors. Progress saved to checkpoint.');
    } else {
        console.log('✅ Processing completed successfully!');
        checkpointManager.clearCheckpoint();
    }

    console.log(`Final Stats: ${finalStats.processed} processed, ${finalStats.skipped} skipped, ${finalStats.failed} failed`);
    return totalProcessed;
};

export { update_users_embeddings, CheckpointManager, ProgressTracker };
