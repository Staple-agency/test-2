require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./db');

async function seed() {
  const client = await pool.connect();
  try {
    // Demo user
    const hash = await bcrypt.hash('demo1234', 12);
    const { rows: [user] } = await client.query(`
      INSERT INTO users (name, email, username, password, bar_number, firm_name)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
      RETURNING id, username
    `, ['Demo Advocate', 'demo@advohq.com', 'demo', hash, 'BAR-2024-001', 'AdvoHQ Law Chambers']);

    console.log(`✅  Demo user: ${user.username} (id: ${user.id})`);

    // Sample cases
    const cases = [
      { title: 'State v. Sharma', client: 'Ramesh Sharma', court: 'Sessions Court, Delhi', case_number: 'SC/2024/1234', status: 'active', notes: 'Bail application pending.' },
      { title: 'Mehta Estate Dispute', client: 'Priya Mehta', court: 'High Court, Bombay', case_number: 'HC/2024/5678', status: 'active', notes: 'Property division hearing next month.' },
      { title: 'TechCorp IP Infringement', client: 'TechCorp Pvt Ltd', court: 'IP Tribunal', case_number: 'IPT/2024/0099', status: 'pending', notes: '' },
    ];

    for (const c of cases) {
      const { rows: [inserted] } = await client.query(`
        INSERT INTO cases (user_id, title, client, court, case_number, status, notes, points)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT DO NOTHING RETURNING id, title
      `, [user.id, c.title, c.client, c.court, c.case_number, c.status, c.notes,
          JSON.stringify([{ id: Date.now().toString(), text: 'Review initial documents', done: false }])]);
      if (inserted) console.log(`   Case: ${inserted.title}`);
    }

    // Sample events
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    const add = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

    const events = [
      { title: 'Bail Hearing — Sharma', type: 'hearing',  date: fmt(add(2)),  time: '10:30', location: 'Court Room 4' },
      { title: 'Client Meeting — Mehta', type: 'meeting', date: fmt(add(4)),  time: '14:00', location: 'Office' },
      { title: 'Brief Submission Deadline', type: 'deadline', date: fmt(add(7)), time: null, location: null },
      { title: 'IP Tribunal Preliminary', type: 'hearing', date: fmt(add(14)), time: '11:00', location: 'IP Tribunal, Room 2' },
    ];

    for (const e of events) {
      await client.query(`
        INSERT INTO events (user_id, title, type, date, time, location)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT DO NOTHING
      `, [user.id, e.title, e.type, e.date, e.time||null, e.location||null]);
      console.log(`   Event: ${e.title}`);
    }

    // Welcome notifications
    const notifs = [
      { title: 'Upcoming hearing in 2 days', body: 'Bail Hearing — Sharma is scheduled for ' + fmt(add(2)), type: 'warning' },
      { title: 'Brief deadline in 7 days',   body: 'Brief Submission Deadline is coming up.',               type: 'info'    },
    ];
    for (const n of notifs) {
      await client.query(`
        INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,$4)
      `, [user.id, n.title, n.body, n.type]);
    }

    console.log('\n✅  Seed complete');
    console.log('   Login: demo / demo1234');
  } finally {
    client.release();
  }
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
