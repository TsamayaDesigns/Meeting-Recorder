import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Meeting = {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  recording_url: string | null;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Attendee = {
  id: string;
  meeting_id: string;
  name: string;
  email: string;
  notification_sent: boolean;
  created_at: string;
};

export type Transcription = {
  id: string;
  meeting_id: string;
  speaker: string;
  original_text: string;
  original_language: string;
  translated_text: string | null;
  timestamp_start: number;
  timestamp_end: number;
  confidence: number;
  created_at: string;
};

export type MeetingSummary = {
  id: string;
  meeting_id: string;
  summary: string;
  key_points: string[];
  action_items: string[];
  created_at: string;
};
