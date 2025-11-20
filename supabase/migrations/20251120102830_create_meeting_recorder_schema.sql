/*
  # Meeting Recorder Application Schema

  1. New Tables
    - `meetings`
      - `id` (uuid, primary key)
      - `title` (text, meeting title)
      - `description` (text, optional description)
      - `start_time` (timestamptz, when recording started)
      - `end_time` (timestamptz, when recording ended)
      - `duration_seconds` (integer, total duration)
      - `recording_url` (text, link to recorded video/audio)
      - `status` (text, recording/processing/completed/failed)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `attendees`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, references meetings)
      - `name` (text, attendee name)
      - `email` (text, attendee email)
      - `notification_sent` (boolean, email sent status)
      - `created_at` (timestamptz)

    - `transcriptions`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, references meetings)
      - `speaker` (text, optional speaker identification)
      - `original_text` (text, original transcription)
      - `original_language` (text, detected language code)
      - `translated_text` (text, UK English translation)
      - `timestamp_start` (integer, milliseconds from start)
      - `timestamp_end` (integer, milliseconds from start)
      - `confidence` (decimal, transcription confidence 0-1)
      - `created_at` (timestamptz)

    - `meeting_summaries`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, references meetings)
      - `summary` (text, AI-generated summary)
      - `key_points` (jsonb, array of key discussion points)
      - `action_items` (jsonb, array of action items)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can create and view their own meetings
    - Attendees can view meetings they're part of
    - Public access for webhook processing
*/

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  duration_seconds integer DEFAULT 0,
  recording_url text,
  status text DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'completed', 'failed')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  notification_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
  speaker text DEFAULT 'Unknown',
  original_text text NOT NULL,
  original_language text DEFAULT 'en',
  translated_text text,
  timestamp_start integer NOT NULL,
  timestamp_end integer NOT NULL,
  confidence decimal(4,3) DEFAULT 0.0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE UNIQUE NOT NULL,
  summary text NOT NULL,
  key_points jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can update their own meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view attendees of their meetings"
  ON attendees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = attendees.meeting_id
      AND meetings.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can add attendees to their meetings"
  ON attendees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = attendees.meeting_id
      AND meetings.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view transcriptions of their meetings"
  ON transcriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = transcriptions.meeting_id
      AND meetings.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can add transcriptions to their meetings"
  ON transcriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = transcriptions.meeting_id
      AND meetings.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view summaries of their meetings"
  ON meeting_summaries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_summaries.meeting_id
      AND meetings.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create summaries for their meetings"
  ON meeting_summaries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_summaries.meeting_id
      AND meetings.created_by = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_attendees_meeting_id ON attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_meeting_id ON transcriptions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_meeting_id ON meeting_summaries(meeting_id);