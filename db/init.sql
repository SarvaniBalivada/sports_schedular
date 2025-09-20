-- Create database
CREATE DATABASE sport_scheduler;

-- Use the database
\c sport_scheduler;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'player')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sports table
CREATE TABLE sports (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  sport_id INTEGER REFERENCES sports(id) ON DELETE CASCADE,
  creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date_time TIMESTAMP NOT NULL,
  venue VARCHAR(255) NOT NULL,
  max_players INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancel_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session players table (for joining sessions)
CREATE TABLE session_players (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  team INTEGER CHECK (team IN (1, 2)),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, player_id)
);

-- Insert a default admin user (password: admin123 hashed)
INSERT INTO users (name, email, password, role) VALUES ('Admin', 'admin@example.com', '$2a$10$examplehashedpassword', 'admin');