export interface Cast {
  object: string;
  hash: string;
  parent_hash?: string;
  parent_url?: string;
  root_parent_url?: string;
  parent_author?: {
    fid: number;
  };
  author: {
    object: string;
    fid: number;
    username: string;
    display_name: string;
    custody_address: string;
    pro?: {
      status: string;
      subscribed_at: string;
      expires_at: string;
    };
    pfp_url: string;
    profile: {
      bio: {
        text: string;
        mentioned_profiles: UserDehydrated[];
        mentioned_profiles_ranges: Range[];
        mentioned_channels: ChannelDehydrated[];
        mentioned_channels_ranges: Range[];
      };
      location?: {
        latitude: number;
        longitude: number;
        address: {
          city: string;
          state: string;
          state_code: string;
          country: string;
          country_code: string;
        };
        radius: number;
      };
      banner_url?: string;
    };
    follower_count: number;
    following_count: number;
    verifications: string[];
    verified_addresses: {
      eth_addresses: string[];
      sol_addresses: string[];
      primary: {
        eth_address: string;
        sol_address: string;
      };
    };
    verified_accounts: {
      platform: string;
      username: string;
    }[];
    power_badge: boolean;
    experimental: {
      deprecation_notice: string;
      neynar_user_score: number;
    };
    viewer_context: {
      following: boolean;
      followed_by: boolean;
      blocking: boolean;
      blocked_by: boolean;
    };
    score: number;
  };
  app: UserDehydrated;
  text: string;
  timestamp: string;
  embeds: Embed[];
  type: string;
  frames: Frame[];
  reactions: {
    likes: Reaction[];
    recasts: Reaction[];
    likes_count: number;
    recasts_count: number;
  };
  replies: {
    count: number;
  };
  thread_hash: string;
  mentioned_profiles: User[];
  mentioned_profiles_ranges: Range[];
  mentioned_channels: ChannelDehydrated[];
  mentioned_channels_ranges: Range[];
  channel?: Channel;
  viewer_context: {
    liked: boolean;
    recasted: boolean;
  };
  author_channel_context: {
    following: boolean;
    role: string;
  };
}

export interface UserDehydrated {
  object: string;
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
}

export interface User extends UserDehydrated {
  pro?: {
    status: string;
    subscribed_at: string;
    expires_at: string;
  };
  profile: {
    bio: {
      text: string;
      mentioned_profiles: UserDehydrated[];
      mentioned_profiles_ranges: Range[];
      mentioned_channels: ChannelDehydrated[];
      mentioned_channels_ranges: Range[];
    };
    location?: {
      latitude: number;
      longitude: number;
      address: {
        city: string;
        state: string;
        state_code: string;
        country: string;
        country_code: string;
      };
      radius: number;
    };
    banner_url?: string;
  };
  follower_count: number;
  following_count: number;
  verifications: string[];
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
    primary: {
      eth_address: string;
      sol_address: string;
    };
  };
  verified_accounts: {
    platform: string;
    username: string;
  }[];
  power_badge: boolean;
  experimental: {
    deprecation_notice: string;
    neynar_user_score: number;
  };
  viewer_context: {
    following: boolean;
    followed_by: boolean;
    blocking: boolean;
    blocked_by: boolean;
  };
  score: number;
}

export interface Range {
  start: number;
  end: number;
}

export interface ChannelDehydrated {
  id: string;
  name: string;
  object: string;
  image_url: string;
  viewer_context: {
    following: boolean;
    role: string;
  };
}

export interface Channel extends ChannelDehydrated {
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

export interface Embed {
  cast_id?: {
    fid: number;
    hash: string;
  };
  cast?: CastDehydrated;
}

export interface CastDehydrated {
  object: string;
  hash: string;
  author: UserDehydrated;
  app: UserDehydrated;
}

export interface Frame {
  version: string;
  image: string;
  frames_url: string;
  buttons: {
    title: string;
    index: number;
    action_type: string;
    target: string;
    post_url: string;
  }[];
  post_url: string;
  title: string;
  image_aspect_ratio: string;
  input: {
    text: string;
  };
  state: {
    serialized: string;
  };
}

export interface Reaction {
  fid: number;
  fname: string;
}

export interface FeedResponse {
  casts: Cast[];
  next?: {
    cursor: string;
  };
}

export interface CastRecord {
  fid: string;
  casts: { data: Cast[] };
}

export interface PowerUserFIDsResponse {
  result: {
    fids: number[];
  }
}