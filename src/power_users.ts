import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Cast, FeedResponse, PowerUserFIDsResponse, CastRecord } from './types';

dotenv.config();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!NEYNAR_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// List of FIDs to fetch casts for
// 37
const FIDS = [] // Replace with your actual FIDs

async function fetchPowerUsers() {
  try {
    const response = await axios.get<PowerUserFIDsResponse>(
      `https://api.neynar.com/v2/farcaster/user/power_lite`,
      {
        headers: {
          'api_key': NEYNAR_API_KEY,
        },
      }
    );

    return response.data.result.fids;
  } catch (error) {
    console.error('Error fetching power users:', error);
    return [];
  }
}
async function fetchCastsForFid(fid: number): Promise<Cast[]> {
  try {
    const response = await axios.get<FeedResponse>(
      `https://api.neynar.com/v2/farcaster/feed/user/casts`,
      {
        headers: {
          'api_key': NEYNAR_API_KEY,
        },
        params: {
          fid: fid,
          limit: 100, // Adjust as needed
        },
      }
    );

    return response.data.casts || [];
  } catch (error) {
    console.error(`Error fetching casts for FID ${fid}:`, error);
    return [];
  }
}

function filterCasts(casts: Cast[]): Cast[] {
  return casts.filter(cast =>
    cast.parent_hash !== "" &&
    cast.text !== ""
  );
}


async function saveCastsToSupabase(castRecord: CastRecord) {
  try {
    const { data, error } = await supabase
      .from('casts')
      .upsert(castRecord, { onConflict: 'fid' })
      .eq('fid', castRecord.fid);

    if (error) {
      console.error('Error saving to Supabase:', error);
      throw error;
    }

    console.log(`Successfully saved cast records to Supabase for fid ${castRecord.fid}`);
    return data;
  } catch (error) {
    console.error('Failed to save casts to Supabase:', error);
    throw error;
  }
}

async function main() {
  try {

    const power_users = await fetchPowerUsers();
    console.log("number of power users", power_users.length);

    for (const fid of power_users) {
      console.log(`Fetching casts for FID: ${fid}`);

      const casts = await fetchCastsForFid(fid);
      const filteredCasts = filterCasts(casts);

      console.log(`FID ${fid}: ${casts.length} total casts, ${filteredCasts.length} filtered casts`);

      // Add casts in a JSON file locally. casts.json: {fid: {casts: [cast1, cast2, ...]}}

      if (filteredCasts.length > 0) {
        // Update supabase with the casts
        saveCastsToSupabase({
          fid: fid.toString(),
          casts: { data: filteredCasts }
        });

      }
    }



  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}