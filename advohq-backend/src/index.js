require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes         = require('./routes/auth');
const casesRoutes        = require('./routes/cases');
const eventsRoutes       = require('./routes/events');
const notificationsRoutes = require('./routes/notifications');
const filesRoutes        = require('./routes/files');
const usersRoutes        = require('./routes/users');

const app = express();

// ✅ IMPORTANT (fixes rate-limit error)
app.set('trust proxy', 1);

// 🔥 DEBUG (to confirm new deployment)
console.log("🔥 NEW DEPLOYMENT RUNNING");

// ── Security ─────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    "https://test-2-ep9i.vercel.app",
    "https://test-2-ep9i-4pow7nu6s-staple-agencys-projects.vercel.app"
  ],
  credentials: true
}));

// ── Rate limiting ───────────────────────────
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
}));

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
}));

// ── Body parsing ───────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ─────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/cases',         casesRoutes);
app.use('/api/events',        eventsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/files',         filesRoutes);
app.use('/api/users',         usersRoutes);

// ── Health check ───────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() })
);

// ── Error handling ─────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ──────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`AdvoHQ API running on port ${PORT}`));
