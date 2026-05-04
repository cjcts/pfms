const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET / — list entries, filtered by settled status
router.get('/', (req, res) => {
  try {
    const settled = req.query.settled === 'true' ? 1 : 0;
    const rows = db.prepare(`
      SELECT id, direction, person, reason, amount, due_date,
             is_settled, date_added, settled_date, notes, date_given
      FROM owed_owing
      WHERE is_settled = ?
      ORDER BY date_added DESC
    `).all(settled);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / — create a new entry
router.post('/', (req, res) => {
  try {
    const { direction, person, amount, reason, date_given, notes } = req.body;

    if (!['to_give', 'to_get'].includes(direction)) {
      return res.status(400).json({
        success: false,
        error: "direction must be 'to_give' or 'to_get'",
      });
    }
    if (!person || typeof person !== 'string' || !person.trim()) {
      return res.status(400).json({ success: false, error: 'person is required' });
    }
    if (amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ success: false, error: 'amount is required' });
    }
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be a positive number' });
    }

    const date_added = new Date().toISOString().slice(0, 10);

    const result = db.prepare(`
      INSERT INTO owed_owing (direction, person, reason, amount, is_settled, date_added, settled_date, notes, date_given)
      VALUES (?, ?, ?, ?, 0, ?, NULL, ?, ?)
    `).run(
      direction,
      person.trim(),
      reason || null,
      numericAmount,
      date_added,
      notes || null,
      date_given || null
    );

    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id — update an entry
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT id FROM owed_owing WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    const { direction, person, amount, reason, date_given, notes } = req.body;
    db.prepare(`
      UPDATE owed_owing SET direction=?, person=?, amount=?, reason=?, date_given=?, notes=? WHERE id=?
    `).run(
      direction,
      person,
      amount,
      reason || null,
      date_given || null,
      notes || null,
      id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id/settle — mark an entry as settled
router.put('/:id/settle', (req, res) => {
  try {
    const { id } = req.params;
    const settled_date = new Date().toISOString().slice(0, 10);

    const record = db.prepare('SELECT id FROM owed_owing WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    db.prepare(`
      UPDATE owed_owing SET is_settled = 1, settled_date = ? WHERE id = ?
    `).run(settled_date, id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:id — age-based delete policy
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const record = db.prepare(`
      SELECT id, date_added FROM owed_owing WHERE id = ?
    `).get(id);

    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      .toISOString()
      .slice(0, 7);
    const recordMonthKey = record.date_added.slice(0, 7);

    if (recordMonthKey < cutoff) {
      return res.status(403).json({
        success: false,
        error: `This record is from ${recordMonthKey} and cannot be deleted. Only the last 3 months of data can be removed.`,
      });
    }

    db.prepare('DELETE FROM owed_owing WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
