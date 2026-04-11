const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const pool    = require('../config/db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, username, role, avatar_url, bar_number, firm_name, settings, created_at
       FROM users WHERE id=$1`,
      [req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch user.' });
  }
});

// ── PATCH /api/users/me ───────────────────────────────────────────────────────
router.patch('/me', async (req, res) => {
  const { name, email, username, avatar_url, bar_number, firm_name } = req.body;

  try {
    // Uniqueness checks
    if (email) {
      const { rows } = await pool.query(
        'SELECT id FROM users WHERE email=$1 AND id<>$2', [email.toLowerCase(), req.user.sub]
      );
      if (rows.length) return res.status(409).json({ error: 'Email already in use.' });
    }
    if (username) {
      const { rows } = await pool.query(
        'SELECT id FROM users WHERE username=$1 AND id<>$2', [username.toLowerCase(), req.user.sub]
      );
      if (rows.length) return res.status(409).json({ error: 'Username already in use.' });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE users SET
         name       = COALESCE($1, name),
         email      = COALESCE($2, email),
         username   = COALESCE($3, username),
         avatar_url = COALESCE($4, avatar_url),
         bar_number = COALESCE($5, bar_number),
         firm_name  = COALESCE($6, firm_name),
         updated_at = now()
       WHERE id=$7
       RETURNING id, name, email, username, role, avatar_url, bar_number, firm_name, settings, created_at`,
      [name||null, email ? email.toLowerCase() : null, username ? username.toLowerCase() : null,
       avatar_url||null, bar_number||null, firm_name||null, req.user.sub]
    );
    return res.json({ user: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not update profile.' });
  }
});

// ── PATCH /api/users/me/password ──────────────────────────────────────────────
router.patch('/me/password', async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    return res.status(400).json({ error: 'current_password and new_password are required.' });

  if (new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });

  try {
    const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.sub]);
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });

    const ok = await bcrypt.compare(current_password, rows[0].password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password=$1, updated_at=now() WHERE id=$2', [hashed, req.user.sub]);

    return res.json({ message: 'Password updated.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not update password.' });
  }
});

// ── PATCH /api/users/me/settings ──────────────────────────────────────────────
// Merges the given settings keys into the user's settings JSONB column
router.patch('/me/settings', async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object')
    return res.status(400).json({ error: 'settings object required.' });

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE users SET settings = settings || $1::jsonb, updated_at=now()
       WHERE id=$2
       RETURNING id, name, email, username, role, settings`,
      [JSON.stringify(settings), req.user.sub]
    );
    return res.json({ user: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not save settings.' });
  }
});

// ── DELETE /api/users/me ──────────────────────────────────────────────────────
router.delete('/me', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password confirmation required.' });

  try {
    const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.sub]);
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });

    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(401).json({ error: 'Incorrect password.' });

    await pool.query('DELETE FROM users WHERE id=$1', [req.user.sub]);
    return res.json({ message: 'Account deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not delete account.' });
  }
});

module.exports = router;
