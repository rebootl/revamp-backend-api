import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

// Connect to SQLite database
const db = new Database('./db/db.sqlite');

// better-sqlite3 has pragma foreign key constraints
// enabled by default, so we don't need to run it here
// https://github.com/WiseLibs/better-sqlite3/issues/739
// db.prepare(`
//   PRAGMA foreign_keys = ON;
// `).run();

// Initialize sessions table
db.prepare(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
  	user_agent TEXT NOT NULL DEFAULT "",
  	ip TEXT NOT NULL DEFAULT "",
  	created_at TEXT NOT NULL,
  	FOREIGN KEY (user_id) REFERENCES users (id)
  );
`).run();

// Initialize users table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    pwhash TEXT NOT NULL,
    admin INTEGER DEFAULT 0 NOT NULL
  );
`).run();

// Add an admin user
const adminUsername = 'admin';
const adminPassword = '1234';
// Hash the password
const hashedPassword = bcrypt.hashSync(adminPassword, 10);

const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUsername);
if (!adminExists) {
  db.prepare('INSERT INTO users (username, pwhash, admin) VALUES (?, ?, ?)')
    .run(adminUsername, hashedPassword, 1);
}

// Add a test user
const testUsername = 'test';
const testPassword = '1234';
const hashedTestPassword = bcrypt.hashSync(testPassword, 10);
const testUserExists = db.prepare('SELECT * FROM users WHERE username = ?').get(testUsername);
if (!testUserExists) {
  db.prepare('INSERT INTO users (username, pwhash, admin) VALUES (?, ?, ?)')
    .run(testUsername, hashedTestPassword, 0);
}

// test foreign keys by inserting I session with an invalid user id
// const invalidSession = db.prepare(`
//   INSERT INTO sessions (session_id, user_id, expires)
//   VALUES (?, ?, ?);
// `).run('invalid-session-id', 9999, Date.now() + 1000 * 60 * 60 * 24);
