/*
  # Emergency Response System Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - matches auth.users.id
      - `full_name` (text)
      - `phone_number` (text)
      - `medical_conditions` (text[])
      - `blood_type` (text)
      - `push_token` (text)
      - `created_at` (timestamptz)

    - `responders`
      - `id` (uuid, primary key) - matches auth.users.id
      - `organization_name` (text)
      - `responder_type` (text) - 'police' or 'hospital'
      - `jurisdiction` (text)
      - `verification_status` (boolean)
      - `push_token` (text)
      - `created_at` (timestamptz)

    - `contacts`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - references users.id
      - `name` (text)
      - `relationship` (text)
      - `phone_number` (text)
      - `email` (text)
      - `is_primary` (boolean)
      - `created_at` (timestamptz)

    - `alerts`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - references users.id
      - `type` (text) - 'police', 'medical', or 'general'
      - `status` (text) - 'pending', 'acknowledged', 'responding', 'resolved'
      - `latitude` (float8)
      - `longitude` (float8)
      - `created_at` (timestamptz)

    - `responses`
      - `id` (uuid, primary key)
      - `alert_id` (uuid) - references alerts.id
      - `responder_id` (uuid) - references responders.id
      - `action_taken` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  phone_number text,
  medical_conditions text[],
  blood_type text,
  push_token text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create responders table
CREATE TABLE IF NOT EXISTS responders (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  organization_name text NOT NULL,
  responder_type text NOT NULL CHECK (responder_type IN ('police', 'hospital')),
  jurisdiction text,
  verification_status boolean DEFAULT false,
  push_token text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE responders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Responders can read own data"
  ON responders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Responders can update own data"
  ON responders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  phone_number text,
  email text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own contacts"
  ON contacts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('police', 'medical', 'general')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'responding', 'resolved')),
  latitude float8 NOT NULL,
  longitude float8 NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create alerts"
  ON alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own alerts"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM responders WHERE id = auth.uid() AND verification_status = true
  ));

CREATE POLICY "Responders can update alerts"
  ON alerts
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM responders WHERE id = auth.uid() AND verification_status = true
  ));

-- Create responses table
CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid REFERENCES alerts(id) ON DELETE CASCADE,
  responder_id uuid REFERENCES responders(id),
  action_taken text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read responses to their alerts"
  ON responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM alerts WHERE id = alert_id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM responders WHERE id = auth.uid() AND verification_status = true
    )
  );

CREATE POLICY "Responders can create responses"
  ON responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM responders WHERE id = auth.uid() AND verification_status = true
    )
  );