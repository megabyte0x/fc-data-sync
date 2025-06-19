import { User, UserDehydrated, Range, ChannelDehydrated } from './cast.types';

export interface ChannelViewerContext {
    following: boolean;
    role: string;
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
    viewer_context: ChannelViewerContext;
    description_mentioned_profiles: UserDehydrated[];
    description_mentioned_profiles_ranges: Range[];
}

export interface ChannelsResponse {
    channels: ChannelFull[];
    next?: {
        cursor: string;
    };
}