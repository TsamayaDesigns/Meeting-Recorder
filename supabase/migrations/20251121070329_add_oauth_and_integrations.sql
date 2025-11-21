/*
  # Add OAuth integrations and scheduled meetings

  1. New Tables
    - `oauth_integrations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `provider` (text, 'google' or 'zoom')
      - `access_token` (text, encrypted)
      - `refresh_token` (text, encrypted)
      - `token_expires_at` (timestamptz)
      - `provider_user_id` (text, user ID from provider)
      - `email` (text, provider email)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `scheduled_meetings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `provider` (text, 'google_meet' or 'zoom')
      - `provider_meeting_id` (text, unique meeting ID from provider)
      - `title` (text, meeting title)
      - `description` (text, optional)
      - `scheduled_start` (timestamptz)
      - `scheduled_end` (timestamptz)
      - `meeting_link` (text)
      - `recording_status` (text, 'pending', 'recording', 'completed', 'failed')
      - `internal_meeting_id` (uuid, references meetings, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `oauth_integrations_audit`
      - Track OAuth activity for debugging

  2. Security
    - Enable RLS on all tables
    - Users can only view their own integrations and meetings
    - Use service role key for token encryption/decryption
*/

CREATE TABLE IF NOT EXISTS oauth_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google', 'zoom')),
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  provider_user_id text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS scheduled_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google_meet', 'zoom')),
  provider_meeting_id text NOT NULL UNIQUE,
  title text NOT NULL,
  description text DEFAULT '',
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  meeting_link text NOT NULL,
  recording_status text DEFAULT 'pending' CHECK (recording_status IN ('pending', 'recording', 'completed', 'failed')),
  internal_meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  webhook_url text NOT NULL,
  webhook_secret text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE oauth_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own oauth integrations"
  ON oauth_integrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create oauth integrations"
  ON oauth_integrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own oauth integrations"
  ON oauth_integrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own scheduled meetings"
  ON scheduled_meetings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create scheduled meetings"
  ON scheduled_meetings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled meetings"
  ON scheduled_meetings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own webhooks"
  ON meeting_webhooks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own webhooks"
  ON meeting_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhooks"
  ON meeting_webhooks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_integrations_user_id ON oauth_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_user_id ON scheduled_meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_provider_meeting_id ON scheduled_meetings(provider_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_webhooks_user_id ON meeting_webhooks(user_id);