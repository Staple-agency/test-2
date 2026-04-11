const router = require('express').Router();
const pool   = require('../config/db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

const VALID_TYPES = ['hearing','meeting','deadline','filing','other'];

// ── GET /api/events ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { from, to, type, case_id } = req.query;
  let text  = 'SELECT e.*, c.title AS case_title FROM events e LEFT JOIN cases c ON c.id=e.case_id WHERE e.user_id=$1';
  const vals = [req.user.sub];

  if (from)    { vals.push(from);    text += ` AND e.date >= $${vals.length}`; }
  if (to)      { vals.push(to);      text += ` AND e.date <= $${vals.length}`; }
  if (type)    { vals.push(type);    text += ` AND e.type  = $${vals.length}`; }
  if (case_id) { vals.push(case_id); text += ` AND e.case_id = $${vals.length}`; }

  text += ' ORDER BY e.date ASC, e.time ASC';

  try {
    const { rows } = await pool.query(text, vals);
    return res.json({ events: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch events.' });
  }
});

// ── GET /api/events/upcoming  (next 7 days) ───────────────────────────────────
router.get('/upcoming', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, c.title AS case_title FROM events e
       LEFT JOIN cases c ON c.id=e.case_id
       WHERE e.user_id=$1 AND e.date BETWEEN now()::date AND (now()::date + interval '7 days')
       ORDER BY e.date ASC, e.time ASC`,
      [req.user.sub]
    );
    return res.json({ events: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch upcoming events.' });
  }
});

// ── POST /api/events ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { title, type = 'hearing', date, time, location, notes, color, case_id } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required.' });
  if (!date)  return res.status(400).json({ error: 'Date is required.' });
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });

  try {
    const { rows: [evt] } = await pool.query(
      `INSERT INTO events (user_id, case_id, title, type, date, time, location, notes, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [req.user.sub, case_id||null, title.trim(), type, date, time||null, location||null, notes||null, color||null]
    );
    return res.status(201).json({ event: evt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create event.' });
  }
});

// ── PUT /api/events/:id ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { title, type, date, time, location, notes, color, case_id } = req.body;

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE events SET
         title    = COALESCE($1, title),
         type     = COALESCE($2, type),
         date     = COALESCE($3, date),
         time     = COALESCE($4, time),
         location = COALESCE($5, location),
         notes    = COALESCE($6, notes),
         color    = COALESCE($7, color),
         case_id  = COALESCE($8, case_id),
         updated_at = now()
       WHERE id=$9 AND user_id=$10
       RETURNING *`,
      [title||null, type||null, date||null, time||null, location||null, notes||null, color||null,
       case_id||null, req.params.id, req.user.sub]
    );
    if (!updated) return res.status(404).json({ error: 'Event not found.' });
    return res.json({ event: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not update event.' });
  }
});

// ── DELETE /api/events/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM events WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]
    );
    if (!rowCount) return res.status(404).json({ error: 'Event not found.' });
    return res.json({ message: 'Event deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not delete event.' });
  }
});

module.exports = router;
