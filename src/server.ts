import express from 'express'
import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const port: number = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const cookieName: string = process.env.COOKIE_NAME || 'revamp-backend-session-id';

// DB model

interface User {
  id: number;
  username: string;
  pwhash: string;
  admin: number;
}

interface Session {
  session_id: string;
  user_id: number;
  created_at: string;
}

// Results

interface UserResult {
  id: number;
  username: string;
  admin: boolean;
}

// Requests

interface LoginRequest {
  username: string;
  password: string;
}

const app = express();
app.use(express.json());

// Connect to SQLite database
const db = new Database('./db/db.sqlite');

app.get('/hello', (req, res) => {
    res.send('Hello, this is some text data!');
});

// Hello endpoint
app.get('/api/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello, this is some JSON data from the server backend!' });
});

// Login endpoint
app.post('/api/login', async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  const { username, password } = req.body;

  // Validate input
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).send({ message: 'Invalid input: username and password must be strings' });
    return;
  }

  if (!username || !password) {
    res.status(401).send({ message: 'Username and password are required' });
    return;
  }

  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get([username]) as User | undefined;

  if (!user) {
    res.status(401).send({ message: 'Invalid username or password' });
    return;
  }

  try {
    // Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.pwhash);
    
    if (!isMatch) {
      res.status(401).send({ message: 'Invalid username or password' });
      return;
    }

    // Generate session ID using UUID v4
    const sessionId = uuidv4();
    const now = new Date();

    const sessionStmt = db.prepare(
      'INSERT INTO sessions (session_id, user_id, created_at) VALUES (?, ?, ?)'
    );
    sessionStmt.run([
      sessionId, 
      user.id, 
      now.toISOString()
    ]);

    // Set session cookie
    res.cookie(cookieName, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    const userResult: UserResult = {
      id: user.id,
      username: user.username,
      admin: Boolean(user.admin)
    };

    res.json({ 
      message: 'Login successful',
      user: userResult
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send({ message: 'An error occurred during login' });
  }
});

// Logout endpoint
app.post('/logout', (req: Request, res: Response): void => {
  const sessionId = req.cookies[cookieName];
  
  if (!sessionId) {
    res.status(401).send({ message: 'Not logged in' });
    return;
  }

  try {
    // Delete the session from the database
    const stmt = db.prepare('DELETE FROM sessions WHERE session_id = ?');
    const result = stmt.run([sessionId]);

    // Clear the session cookie
    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).send({ message: 'An error occurred during logout' });
  }
});

// Middleware to check if user is logged in
function isLoggedIn(req: Request, res: Response, next: () => void) {
  const sessionId = req.cookies[cookieName];
  
  if (!sessionId) {
    res.status(401).send({ message: 'Not logged in' });
    return;
  }

  try {
    const stmt = db.prepare('SELECT * FROM sessions WHERE session_id = ?');
    const session = stmt.get([sessionId]) as Session | undefined;

    if (!session) {
      res.status(401).send({ message: 'Invalid session' });
      return;
    }

    next();
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).send({ message: 'An error occurred while checking session' });
  }
}

// Example protected endpoint
app.get('/protected', isLoggedIn, (req: Request, res: Response) => {
  res.json({ message: 'This is a protected endpoint' });
});

app.listen(port, () => {
  console.log(`App listening on port: ${port}`);
});
