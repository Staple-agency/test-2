// src/routes/ai.js
const router = require('express').Router();
const requireAuth = require('../middleware/requireAuth');
const Anthropic = require('@anthropic-ai/sdk');

router.use(requireAuth);

router.post('/summarise', async (req, res) => {
  const { prompt } = req.body;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });
  res.json({ text: msg.content[0].text });
});

module.exports = router;
