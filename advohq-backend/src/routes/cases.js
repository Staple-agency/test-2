const router = require('express').Router();
const pool   = require('../config/db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// ── GET /api/cases ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, q } = req.query;
  let text  = 'SELECT * FROM cases WHERE user_id=$1';
  const vals = [req.user.sub];

  if (status) { vals.push(status); text += ` AND status=$${vals.length}`; }
  if (q) {
    vals.push(`%${q}%`);
    text += ` AND (title ILIKE $${vals.length} OR client ILIKE $${vals.length} OR case_number ILIKE $${vals.length})`;
  }
  text += ' ORDER BY updated_at DESC';

  try {
    const { rows } = await pool.query(text, vals);
    return res.json({ cases: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch cases.' });
  }
});

// ── POST /api/cases ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { title, client, court, case_number, status = 'active', notes, points = [], tags = [] } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required.' });

  try {
    const { rows: [c] } = await pool.query(
      `INSERT INTO cases (user_id, title, client, court, case_number, status, notes, points, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [req.user.sub, title.trim(), client||null, court||null, case_number||null, status, notes||null,
       JSON.stringify(points), tags]
    );
    return res.status(201).json({ case: c });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create case.' });
  }
});

// ── GET /api/cases/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM cases WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Case not found.' });
    return res.json({ case: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch case.' });
  }
});

// ── PUT /api/cases/:id ────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { title, client, court, case_number, status, notes, points, tags } = req.body;

  try {
    const { rows } = await pool.query(
      'SELECT id FROM cases WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'Case not found.' });

    const { rows: [updated] } = await pool.query(
      `UPDATE cases SET
         title       = COALESCE($1, title),
         client      = COALESCE($2, client),
         court       = COALESCE($3, court),
         case_number = COALESCE($4, case_number),
         status      = COALESCE($5, status),
         notes       = COALESCE($6, notes),
         points      = COALESCE($7::jsonb, points),
         tags        = COALESCE($8, tags),
         updated_at  = now()
       WHERE id=$9 AND user_id=$10
       RETURNING *`,
      [title||null, client||null, court||null, case_number||null, status||null, notes||null,
       points ? JSON.stringify(points) : null,
       tags || null, req.params.id, req.user.sub]
    );
    return res.json({ case: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not update case.' });
  }
});

// ── PATCH /api/cases/:id/points ───────────────────────────────────────────────
router.patch('/:id/points', async (req, res) => {
  const { points } = req.body;
  if (!Array.isArray(points)) return res.status(400).json({ error: 'points must be an array.' });

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE cases SET points=$1::jsonb, updated_at=now()
       WHERE id=$2 AND user_id=$3 RETURNING *`,
      [JSON.stringify(points), req.params.id, req.user.sub]
    );
    if (!updated) return res.status(404).json({ error: 'Case not found.' });
    return res.json({ case: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not update points.' });
  }
});

// ── DELETE /api/cases/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM cases WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]
    );
    if (!rowCount) return res.status(404).json({ error: 'Case not found.' });
    return res.json({ message: 'Case deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not delete case.' });
  }
});

module.exports = router;
