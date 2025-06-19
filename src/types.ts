export interface Cast {
  hash: string;
  parent_hash: string;
  parent_url?: string;
  parent_author?: {
    fid: number;
  };
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
  text: string;
  timestamp: string;
  embeds: any[];
  reactions: {
    likes_count: number;
    recasts_count: number;
    likes: any[];
    recasts: any[];
  };
  replies: {
    count: number;
  };
  mentioned_profiles: any[];
  type: string;
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