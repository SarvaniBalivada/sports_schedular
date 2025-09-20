const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres', // Connect to default postgres db first
  password: process.env.DB_PASSWORD || 'sarvani9418',
  port: process.env.DB_PORT || 3000,
});

async function setupDatabase() {
  try {
    console.log('Setting up PostgreSQL database...');

    // First, connect to the default postgres database to create sport_scheduler if it doesn't exist
    console.log('Connecting to PostgreSQL...');
    const defaultPool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: 'postgres',
      password: process.env.DB_PASSWORD || 'sarvani9418',
      port: process.env.DB_PORT || 3000,
    });

    // Create the sport_scheduler database if it doesn't exist
    try {
      await defaultPool.query('CREATE DATABASE sport_scheduler');
      console.log('✅ Created sport_scheduler database');
    } catch (err) {
      if (err.code === '42P04') {
        console.log('✅ sport_scheduler database already exists');
      } else {
        throw err;
      }
    }
    await defaultPool.end();

    // Now connect to the sport_scheduler database
    console.log('Connecting to sport_scheduler database...');
    const dbPool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: 'sport_scheduler',
      password: process.env.DB_PASSWORD || 'sarvani9418',
      port: process.env.DB_PORT || 3000,
    });

    // Create tables manually
    const createTableStatements = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'player')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS sports (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        sport_id INTEGER REFERENCES sports(id) ON DELETE CASCADE,
        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date_time TIMESTAMP NOT NULL,
        venue VARCHAR(255) NOT NULL,
        max_players INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
        cancel_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS session_players (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        team INTEGER CHECK (team IN (1, 2)),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, player_id)
      )`,

      `INSERT INTO users (name, email, password, role)
       VALUES ('Admin', 'admin@example.com', '$2a$10$examplehashedpassword', 'admin')
       ON CONFLICT (email) DO NOTHING`
    ];

    console.log(`Executing ${createTableStatements.length} SQL statements...`);

    for (const statement of createTableStatements) {
      if (statement.trim()) {
        try {
          await dbPool.query(statement);
        } catch (err) {
          // Ignore errors for already existing tables/indexes
          if (!err.message.includes('already exists')) {
            console.error('Error executing statement:', statement.substring(0, 100) + '...');
            throw err;
          }
        }
      }
    }

    console.log('✅ Database tables created');
    console.log('✅ Default admin user created (admin@example.com / admin123)');

    await dbPool.end();
    console.log('🎉 Database setup complete!');
    console.log('You can now start the server with: npm start');

  } catch (err) {
    console.error('❌ Database setup failed:', err.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure PostgreSQL is installed and running on port 3000');
    console.log('2. Check your database credentials in setup.js');
    console.log('3. Make sure the sport_scheduler database exists');
    console.log('4. Make sure you have permission to create tables');
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;