const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool    = require('../config/db');
const requireAuth = require('../middleware/requireAuth');

const SALT_ROUNDS = 12;
const ACCESS_TTL  = '15m';
const REFRESH_TTL = '30d';

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefresh(userId) {
  const token = uuidv4();
  return token;
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password)
    return res.status(400).json({ error: 'All fields are required.' });

  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email))
    return res.status(400).json({ error: 'Invalid email address.' });

  const usernameRe = /^[a-z0-9_]{3,30}$/;
  if (!usernameRe.test(username))
    return res.status(400).json({ error: 'Username must be 3–30 lowercase letters, digits, or underscores.' });

  try {
    const exists = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2', [email.toLowerCase(), username.toLowerCase()]
    );
    if (exists.rows.length)
      return res.status(409).json({ error: 'Email or username already taken.' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows: [user] } = await pool.query(
      `INSERT INTO users (name, email, username, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, username, role, created_at`,
      [name.trim(), email.toLowerCase(), username.toLowerCase(), hashed]
    );

    // Welcome notification
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'Welcome to AdvoHQ!', 'Your account has been created. Start by adding your first case.', 'success']
    );

    const access  = signAccess(user);
    const refresh = signRefresh(user.id);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, refresh, expiresAt]
    );

    return res.status(201).json({ token: access, refresh_token: refresh, user });
  } catch (err) {
    console.error(err);
    console.error("REGISTER ERROR:", err);

return res.status(500).json({ 
  error: err.message 
});
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { login, password } = req.body;   // login = username OR email

  if (!login || !password)
    return res.status(400).json({ error: 'Username/email and password are required.' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email=$1 OR username=$1',
      [login.toLowerCase()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const access  = signAccess(user);
    const refresh = signRefresh(user.id);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, refresh, expiresAt]
    );

    const { password: _, ...safeUser } = user;
    return res.json({ token: access, refresh_token: refresh, user: safeUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required.' });

  try {
    const { rows } = await pool.query(
      `SELECT rt.*, u.* FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token=$1 AND rt.expires_at > now()`,
      [refresh_token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or expired refresh token.' });

    const row = rows[0];
    // Rotate: delete old, issue new
    await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [refresh_token]);

    const user    = { id: row.user_id || row.id, username: row.username, role: row.role };
    const access  = signAccess(user);
    const newRefresh = signRefresh(user.id);
    const expiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, newRefresh, expiresAt]
    );

    return res.json({ token: access, refresh_token: newRefresh });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Token refresh failed.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  const { refresh_token } = req.body;
  if (refresh_token) {
    await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [refresh_token]).catch(() => {});
  }
  return res.json({ message: 'Logged out.' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, username, role, avatar_url, bar_number, firm_name, settings, created_at FROM users WHERE id=$1',
      [req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch user.' });
  }
});

module.exports = router;
