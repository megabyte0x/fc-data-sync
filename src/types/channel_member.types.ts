import { User, UserDehydrated, Range, ChannelDehydrated } from './cast.types';

export interface ChannelMember {
    object: "member";
    role: "member";
    user: UserDehydrated;
    channel: ChannelFull;
}

export interface ChannelFull extends ChannelDehydrated {
    url: string;
    description: string;
    created_at: number;
    follower_count: number;
    external_link?: {
        title: string;
        url: string;
    };
    parent_url?: string;
    lead: User;
    moderator_fids: number[];
    member_count: number;
    moderator: User;
    pinned_cast_hash?: string;
    hosts: User[];
    description_mentioned_profiles: UserDehydrated[];
    description_mentioned_profiles_ranges: Range[];
}

export interface ChannelMembersResponse {
    members: ChannelMember[];
    next?: {
        cursor: string;
    };
}