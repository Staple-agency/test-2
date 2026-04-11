const router = require('express').Router();
const pool   = require('../config/db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id=$1
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.sub]
    );
    const unread_count = rows.filter(n => !n.read).length;
    return res.json({ notifications: rows, unread_count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch notifications.' });
  }
});

// ── GET /api/notifications/count ─────────────────────────────────────────────
router.get('/count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id=$1 AND read=false',
      [req.user.sub]
    );
    return res.json({ unread_count: rows[0].unread_count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch count.' });
  }
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.sub]
    );
    return res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not update notification.' });
  }
});

// ── POST /api/notifications/read-all ─────────────────────────────────────────
router.post('/read-all', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read=true WHERE user_id=$1', [req.user.sub]
    );
    return res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not update notifications.' });
  }
});

// ── DELETE /api/notifications/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.sub]
    );
    return res.json({ message: 'Notification deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not delete notification.' });
  }
});

module.exports = router;
