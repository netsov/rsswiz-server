interface List {
  accountId: string;
  id_str: string;
  full_name: string;
  total?: number;
  synced?: string;
}

interface Account {
  token: string;
  tokenSecret: string;
  profile: {
    id: string;
    username: string;
  };
  total?: number;
  synced?: string;
  listsSyncedTS?: string;
  expired?: boolean;
}

interface Feed {
  _id: string;
  usernames: string[];
  lists: string[];
  limit: number;
  synced?: string;
  created?: string;
  updated?: string;
  hashtags?: string[];
  hashtags_ne?: string[];
  url_keywords?: string[];
  url_keywords_ne?: string[];
  exclude_replies?: boolean;
  exclude_retweets?: boolean;
}

interface Email {
  value: string;
  confirmed?: boolean;
  confirmationId?: string;
}

interface Notification {
  type: string;
  code: string;
  text: string;
  id: string;
}

interface Schedule {
  times: {
    i: number;
    on: boolean;
    utcHours: number;
    sent: number;
  }[];
}

interface User {
  _id: string;
  accounts: Account[];
  lists: List[];
  feeds: Feed[];
  email: Email;
  notifications?: Notification[];
  schedule: Schedule;
}

interface Tweet {
  id_str: string;
  created_at: string;
  full_text: string;
  in_reply_to_screen_name: string;
  in_reply_to_status_id_str: string;
  retweeted_status: Tweet;
  user: {
    profile_image_url_https: string;
    name: string;
    screen_name: string;
  };
  entities: {
    media: { media_url_https: string; type: string }[];
    urls: { url: string; display_url: string; expanded_url: string }[];
    hashtags: { text: string }[];
    user_mentions: { screen_name: string }[];
  };
}

interface DbTweet {
  _id: string;
  time: string;
  search: {
    urls: string[];
    hashtags: string[];
    source: string[];
  };
  tweet: Tweet;
}
