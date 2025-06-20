import { Cast } from "./cast.types";

export interface User_Profile {
    fid: string;
    bio: string;
    follower_count: number;
    following_count: number;
    channels: {
        name: string;
        description: string;
    }[];
    user_name: string;
    name: string;
    casts: Cast[];
}
