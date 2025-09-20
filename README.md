# Sport Scheduler

A web application for scheduling sport sessions.

## Features

- User authentication (signup, signin, signout) with role selection
- Role-based access: Player and Administrator perspectives
- Players can create and join sport sessions
- Admins can manage sports and view reports
- Session cancellation with reasons

## Setup

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

### Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up PostgreSQL database:**
   ```bash
   # Option 1: Automatic setup (recommended)
   npm run setup

   # Option 2: Manual setup
   # - Create a database named 'sport_scheduler'
   # - Run the SQL script in db/init.sql
   # - Update database credentials in server/server.js if needed
   ```

3. **Configure database (if needed):**
   Update the database credentials in `server/server.js`:
   ```javascript
   const pool = new Pool({
     user: 'your_postgres_username',
     host: 'localhost',
     database: 'sport_scheduler',
     password: 'your_postgres_password',
     port: 5432,
   });
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open the application:**
   Visit http://localhost:3004 in your browser

## Default Admin

- Email: admin@example.com
- Password: admin123 (hashed in init.sql)

## API Endpoints

- POST /api/auth/signup - User registration
- POST /api/auth/signin - User login
- POST /api/auth/signout - User logout
- GET /api/sports - Get all sports
- POST /api/sports - Create sport (admin only)
- POST /api/sessions - Create session
- GET /api/sessions - Get available sessions
- GET /api/sessions/my - Get user's created sessions
- GET /api/sessions/joined - Get user's joined sessions
- POST /api/sessions/:id/join - Join session
- PUT /api/sessions/:id/cancel - Cancel session
- GET /api/admin/reports/sessions - Admin reports