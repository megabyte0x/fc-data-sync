import { Cast, Verified_Addresses } from "./cast.types";

export interface User_DB {
    fid: string;
    user_name: string;
    description: string;
    following_count: number;
    follower_count: number;
    pfp_url: string;
    verified_addresses: Verified_Addresses;
    channels_following: User_Channel_DB[];
    channels_member: User_Channel_DB[];
    embeddings: number[];
    summary: string;
}

export interface Cast_DB {
    fid: string;
    casts: {
        data: Cast[];
    }
}

export interface User_Channel_DB {
    url: string;
    name: string;
    description: string;
    image_url: string;
}