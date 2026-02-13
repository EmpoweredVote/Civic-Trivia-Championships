-- Civic Trivia Championship Database Schema
-- Users table for authentication

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Email format validation
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on row changes
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add progression and profile columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_gems INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_correct INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS timer_multiplier REAL DEFAULT 1.0 NOT NULL;

-- Add CHECK constraints for non-negative values
ALTER TABLE users
  ADD CONSTRAINT check_total_xp_non_negative CHECK (total_xp >= 0),
  ADD CONSTRAINT check_total_gems_non_negative CHECK (total_gems >= 0),
  ADD CONSTRAINT check_games_played_non_negative CHECK (games_played >= 0);

-- Add indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_total_xp_desc ON users(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_best_score_desc ON users(best_score DESC);
