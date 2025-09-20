const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// PostgreSQL connection - Update these credentials for your setup
let pool;

try {
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sport_scheduler',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3000,
  });

  // Test database connection
  pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    console.error('❌ Database connection error:', err.message);
    pool = null; // Set pool to null to prevent further queries
  });
} catch (err) {
  console.error('❌ PostgreSQL connection failed:', err.message);
  pool = null;
}

// JWT secret - use environment variable or generate a secure random secret
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');


// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  console.log('🔐 Auth middleware - Authorization header:', authHeader ? '[PRESENT]' : 'MISSING');

  const token = authHeader?.split(' ')[1];
  if (!token) {
    console.log('❌ Auth middleware - No token provided');
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Auth middleware - Invalid token:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('✅ Auth middleware - Token valid for user:', user.id);
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  const userRole = role || 'player'; // Default to player if not specified

  // Validate role
  if (!['player', 'admin'].includes(userRole)) {
    return res.status(400).json({ error: 'Invalid role. Must be player or admin' });
  }


  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, userRole]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ user, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(400).json({ error: 'User already exists or invalid data' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;


  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/signout', authenticateToken, (req, res) => {
  // For JWT, signout is handled client-side by removing the token
  res.json({ message: 'Signed out successfully' });
});

// Update profile (name and/or password)
app.put('/api/auth/update-profile', authenticateToken, async (req, res) => {
  console.log('🔄 Profile update request received');
  console.log('User ID:', req.user?.id);
  console.log('Request body:', { name: req.body.name, hasCurrentPassword: !!req.body.currentPassword, hasNewPassword: !!req.body.newPassword });

  const { name, currentPassword, newPassword } = req.body;


  try {
    // Start building the update query
    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    // Add name update if provided
    if (name) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }

    // Add password update if provided
    if (newPassword) {
      // First verify current password
      const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      if (!validPassword) return res.status(400).json({ error: 'Current password is incorrect' });

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      updateFields.push(`password = $${paramIndex}`);
      updateValues.push(hashedNewPassword);
      paramIndex++;
    } else if (currentPassword) {
      // If current password is provided but no new password, still verify it for name-only updates
      const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      if (!validPassword) return res.status(400).json({ error: 'Current password is incorrect' });
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    // Execute the update
    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
    updateValues.push(req.user.id);

    await pool.query(updateQuery, updateValues);

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sports routes
app.get('/api/sports', async (req, res) => {

  try {
    const result = await pool.query('SELECT * FROM sports ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sports:', err);
    res.status(500).json({ error: 'Database connection error. Please check PostgreSQL setup.' });
  }
});

app.post('/api/sports', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO sports (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Sessions routes
app.post('/api/sessions', authenticateToken, async (req, res) => {
  const { sport_id, date_time, venue, max_players, existing_players = [] } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO sessions (sport_id, creator_id, date_time, venue, max_players) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [sport_id, req.user.id, date_time, venue, max_players]
    );
    const session = result.rows[0];

    // Add existing players
    for (let i = 0; i < existing_players.length; i++) {
      const playerId = existing_players[i];
      const team = (i % 2) + 1; // Alternate teams
      await pool.query(
        'INSERT INTO session_players (session_id, player_id, team) VALUES ($1, $2, $3)',
        [session.id, playerId, team]
      );
    }

    res.json(session);
  } catch (err) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Get all sessions (available for viewing/joining)
app.get('/api/sessions', authenticateToken, async (req, res) => {

  try {
    const result = await pool.query(`
      SELECT s.*, sp.name as sport_name, u.name as creator_name,
             COUNT(sp2.player_id) as current_players,
             CASE
               WHEN s.status = 'active' AND s.date_time > NOW() AND COUNT(sp2.player_id) < s.max_players THEN true
               ELSE false
             END as is_joinable,
             EXISTS(
               SELECT 1 FROM session_players sp3
               WHERE sp3.session_id = s.id AND sp3.player_id = $1
             ) as has_joined
      FROM sessions s
      JOIN sports sp ON s.sport_id = sp.id
      JOIN users u ON s.creator_id = u.id
      LEFT JOIN session_players sp2 ON s.id = sp2.session_id
      GROUP BY s.id, sp.name, u.name
      ORDER BY s.date_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ error: 'Database connection error. Please check PostgreSQL setup.' });
  }
});

// Get user's created sessions
app.get('/api/sessions/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, sp.name as sport_name
      FROM sessions s
      JOIN sports sp ON s.sport_id = sp.id
      WHERE s.creator_id = $1
      ORDER BY s.date_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's joined sessions
app.get('/api/sessions/joined', authenticateToken, async (req, res) => {

  try {
    const result = await pool.query(`
      SELECT s.*, sp.name as sport_name, u.name as creator_name, sp2.team
      FROM sessions s
      JOIN sports sp ON s.sport_id = sp.id
      JOIN users u ON s.creator_id = u.id
      JOIN session_players sp2 ON s.id = sp2.session_id
      WHERE sp2.player_id = $1 AND s.status = 'active'
      ORDER BY s.date_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching joined sessions:', err);
    res.status(500).json({ error: 'Database connection error. Please check PostgreSQL setup.' });
  }
});

// Join a session
app.post('/api/sessions/:id/join', authenticateToken, async (req, res) => {
  const sessionId = parseInt(req.params.id);


  try {
    // Check if session exists and is joinable
    const sessionResult = await pool.query(`
      SELECT s.*, COUNT(sp.player_id) as current_players
      FROM sessions s
      LEFT JOIN session_players sp ON s.id = sp.session_id
      WHERE s.id = $1 AND s.status = 'active' AND s.date_time > NOW()
      GROUP BY s.id
    `, [sessionId]);

    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found or not joinable' });

    const session = sessionResult.rows[0];
    if (session.current_players >= session.max_players) return res.status(400).json({ error: 'Session is full' });

    // Check if user already joined
    const existing = await pool.query('SELECT * FROM session_players WHERE session_id = $1 AND player_id = $2', [sessionId, req.user.id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Already joined' });

    // Check for time conflicts - prevent joining multiple sessions at the same time
    const timeConflictResult = await pool.query(`
      SELECT s.id, sp2.name as sport_name, s.date_time, s.venue
      FROM sessions s
      JOIN session_players sp ON s.id = sp.session_id
      JOIN sports sp2 ON s.sport_id = sp2.id
      WHERE sp.player_id = $1
        AND s.status = 'active'
        AND DATE(s.date_time) = DATE($2)
        AND ABS(EXTRACT(EPOCH FROM (s.date_time - $2))) < 3600
    `, [req.user.id, session.date_time]);

    if (timeConflictResult.rows.length > 0) {
      const conflictSession = timeConflictResult.rows[0];
      return res.status(400).json({
        error: `You are already joined to another session at this time: ${conflictSession.sport_name} on ${new Date(conflictSession.date_time).toLocaleString()}`
      });
    }

    // Assign team (simple: count players in each team)
    const teamResult = await pool.query(`
      SELECT team, COUNT(*) as count
      FROM session_players
      WHERE session_id = $1
      GROUP BY team
      ORDER BY count ASC
    `, [sessionId]);

    let team = 1;
    if (teamResult.rows.length > 0) {
      team = teamResult.rows[0].team;
    }

    await pool.query('INSERT INTO session_players (session_id, player_id, team) VALUES ($1, $2, $3)', [sessionId, req.user.id, team]);
    res.json({ message: 'Joined successfully', team });
  } catch (err) {
    console.error('Error joining session:', err);
    res.status(500).json({ error: 'Database connection error. Please check PostgreSQL setup.' });
  }
});

// Cancel a session
app.put('/api/sessions/:id/cancel', authenticateToken, async (req, res) => {
  const sessionId = req.params.id;
  const { reason } = req.body;
  try {
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

    const session = sessionResult.rows[0];
    if (session.creator_id !== req.user.id) return res.status(403).json({ error: 'Only creator can cancel' });

    await pool.query('UPDATE sessions SET status = $1, cancel_reason = $2 WHERE id = $3', ['cancelled', reason, sessionId]);
    res.json({ message: 'Session cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin reports
app.get('/api/admin/reports/sessions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { start_date, end_date } = req.query;
  const start = start_date || '1970-01-01';
  const end = end_date || '2100-01-01';

  try {
    console.log('Reports query params:', start, end);
    // Total sessions scheduled in period
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total_sessions FROM sessions WHERE DATE(date_time) BETWEEN DATE($1) AND DATE($2)',
      [start, end]
    );
    console.log('Total result:', totalResult.rows);

    // Sport popularity
    const sportResult = await pool.query(`
      SELECT sp.name, COUNT(s.id) as session_count
      FROM sessions s
      JOIN sports sp ON s.sport_id = sp.id
      WHERE DATE(s.date_time) BETWEEN DATE($1) AND DATE($2)
      GROUP BY sp.name
      ORDER BY session_count DESC
    `, [start, end]);
    console.log('Sport result:', sportResult.rows);

    res.json({
      total_sessions: totalResult.rows[0].total_sessions,
      sport_popularity: sportResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Test endpoint to verify server and auth are working
app.get('/api/test', authenticateToken, (req, res) => {
  console.log('🧪 Test endpoint called by user:', req.user.id);
  res.json({
    message: 'Server and authentication are working!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Simple ping endpoint to test if routes are loaded
app.get('/api/ping', (req, res) => res.json({ pong: true }));

// Routes will be added here

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Test endpoint available at: http://localhost:${port}/api/test`);
});