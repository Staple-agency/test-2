const router = require('express').Router();
const pool   = require('../config/db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// ── GET /api/files?case_id=... ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { case_id } = req.query;
  let text  = 'SELECT * FROM case_files WHERE user_id=$1';
  const vals = [req.user.sub];

  if (case_id) { vals.push(case_id); text += ` AND case_id=$${vals.length}`; }
  text += ' ORDER BY created_at DESC';

  try {
    const { rows } = await pool.query(text, vals);
    return res.json({ files: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch files.' });
  }
});

// ── POST /api/files ───────────────────────────────────────────────────────────
// Registers a file record. Actual binary upload should go to S3/Cloudinary
// and the client passes back the storage_url.
router.post('/', async (req, res) => {
  const { case_id, name, size, mime_type, storage_url, canvas_data } = req.body;

  if (!case_id) return res.status(400).json({ error: 'case_id is required.' });
  if (!name)    return res.status(400).json({ error: 'name is required.' });

  try {
    // Verify the case belongs to this user
    const { rows: caseRows } = await pool.query(
      'SELECT id FROM cases WHERE id=$1 AND user_id=$2', [case_id, req.user.sub]
    );
    if (!caseRows.length) return res.status(404).json({ error: 'Case not found.' });

    const { rows: [file] } = await pool.query(
      `INSERT INTO case_files (case_id, user_id, name, size, mime_type, storage_url, canvas_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING *`,
      [case_id, req.user.sub, name.trim(), size||null, mime_type||null,
       storage_url||null, canvas_data ? JSON.stringify(canvas_data) : null]
    );
    return res.status(201).json({ file });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create file record.' });
  }
});

// ── GET /api/files/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM case_files WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]
    );
    if (!rows.length) return res.status(404).json({ error: 'File not found.' });
    return res.json({ file: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not fetch file.' });
  }
});

// ── PATCH /api/files/:id/canvas ───────────────────────────────────────────────
// Save pen/highlight annotation layers from the editor
router.patch('/:id/canvas', async (req, res) => {
  const { canvas_data } = req.body;

  try {
    const { rows: [file] } = await pool.query(
      `UPDATE case_files SET canvas_data=$1::jsonb
       WHERE id=$2 AND user_id=$3 RETURNING *`,
      [JSON.stringify(canvas_data), req.params.id, req.user.sub]
    );
    if (!file) return res.status(404).json({ error: 'File not found.' });
    return res.json({ file });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not save canvas data.' });
  }
});

// ── DELETE /api/files/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM case_files WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]
    );
    if (!rowCount) return res.status(404).json({ error: 'File not found.' });
    return res.json({ message: 'File deleted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not delete file.' });
  }
});

module.exports = router;
