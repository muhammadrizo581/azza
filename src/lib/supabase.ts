import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = 
  Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-supabase-url-here'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface Message {
  id: string;
  sender_id: 'me' | 'partner';
  text: string;
  media_url?: string;
  media_urls?: string[];
  media_type?: 'image' | 'voice' | 'video_note' | 'sticker' | 'file';
  duration?: number;
  reply_to?: {
    id: string;
    text: string;
    sender_id: 'me' | 'partner';
    media_type?: 'image' | 'voice' | 'video_note' | 'sticker' | 'file' | string;
  } | null;
  is_edited?: boolean;
  is_read: boolean;
  created_at: string;
}

export interface UserProfile {
  id: 'me' | 'partner';
  name: string;
  tagline: string;
  avatar: string;
  status: 'online' | 'typing...' | 'offline';
  bio: string;
  phone?: string;
  username: string;
}
