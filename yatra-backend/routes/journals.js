const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all journal entries for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Ensure journal_entries table exists
        await ensureJournalTableExists();
        
        const userEmail = req.user.email;
        
        const entries = await query(
            'SELECT * FROM journal_entries WHERE user_email = ? ORDER BY entry_date DESC, created_at DESC',
            [userEmail]
        );
        
        // Format response
        const formatted = entries.map(entry => ({
            id: entry.id.toString(),
            date: entry.entry_date,
            mood: entry.mood,
            content: entry.content,
            location: entry.location || '',
            createdAt: entry.created_at ? entry.created_at.toISOString() : new Date().toISOString(),
            userEmail: entry.user_email
        }));
        
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching journal entries:', error);
        res.status(500).json({ error: 'Failed to fetch journal entries' });
    }
});

// Get single journal entry
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const entryId = parseInt(req.params.id);
        if (!Number.isFinite(entryId) || entryId <= 0) {
            return res.status(400).json({ error: 'Invalid journal entry ID' });
        }
        
        const [entry] = await query(
            'SELECT * FROM journal_entries WHERE id = ? AND user_email = ?',
            [entryId, req.user.email]
        );
        
        if (!entry) {
            return res.status(404).json({ error: 'Journal entry not found' });
        }
        
        res.json({
            id: entry.id.toString(),
            date: entry.entry_date,
            mood: entry.mood,
            content: entry.content,
            location: entry.location || '',
            createdAt: entry.created_at ? entry.created_at.toISOString() : new Date().toISOString(),
            userEmail: entry.user_email
        });
    } catch (error) {
        console.error('Error fetching journal entry:', error);
        res.status(500).json({ error: 'Failed to fetch journal entry' });
    }
});

// Create new journal entry
router.post('/', authenticateToken, async (req, res) => {
    try {
        await ensureJournalTableExists();
        
        const { date, mood, content, location } = req.body;
        
        if (!date || !content) {
            return res.status(400).json({ error: 'Date and content are required' });
        }
        
        const result = await query(
            `INSERT INTO journal_entries (user_email, entry_date, mood, content, location) 
             VALUES (?, ?, ?, ?, ?)`,
            [req.user.email, date, mood || '', content, location || '']
        );
        
        const [newEntry] = await query(
            'SELECT * FROM journal_entries WHERE id = ?',
            [result.insertId]
        );
        
        res.status(201).json({
            id: newEntry.id.toString(),
            date: newEntry.entry_date,
            mood: newEntry.mood,
            content: newEntry.content,
            location: newEntry.location || '',
            createdAt: newEntry.created_at ? newEntry.created_at.toISOString() : new Date().toISOString(),
            userEmail: newEntry.user_email
        });
    } catch (error) {
        console.error('Error creating journal entry:', error);
        res.status(500).json({ error: 'Failed to create journal entry' });
    }
});

// Update journal entry
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const entryId = parseInt(req.params.id);
        if (!Number.isFinite(entryId) || entryId <= 0) {
            return res.status(400).json({ error: 'Invalid journal entry ID' });
        }
        
        const { date, mood, content, location } = req.body;
        
        // Check if entry exists and belongs to user
        const [existingEntry] = await query(
            'SELECT id FROM journal_entries WHERE id = ? AND user_email = ?',
            [entryId, req.user.email]
        );
        
        if (!existingEntry) {
            return res.status(404).json({ error: 'Journal entry not found' });
        }
        
        await query(
            `UPDATE journal_entries 
             SET entry_date = ?, mood = ?, content = ?, location = ?, updated_at = NOW()
             WHERE id = ? AND user_email = ?`,
            [date, mood || '', content, location || '', entryId, req.user.email]
        );
        
        const [updatedEntry] = await query(
            'SELECT * FROM journal_entries WHERE id = ?',
            [entryId]
        );
        
        res.json({
            id: updatedEntry.id.toString(),
            date: updatedEntry.entry_date,
            mood: updatedEntry.mood,
            content: updatedEntry.content,
            location: updatedEntry.location || '',
            createdAt: updatedEntry.created_at ? updatedEntry.created_at.toISOString() : new Date().toISOString(),
            userEmail: updatedEntry.user_email
        });
    } catch (error) {
        console.error('Error updating journal entry:', error);
        res.status(500).json({ error: 'Failed to update journal entry' });
    }
});

// Delete journal entry
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const entryId = parseInt(req.params.id);
        if (!Number.isFinite(entryId) || entryId <= 0) {
            return res.status(400).json({ error: 'Invalid journal entry ID' });
        }
        
        // Check if entry exists and belongs to user
        const [existingEntry] = await query(
            'SELECT id FROM journal_entries WHERE id = ? AND user_email = ?',
            [entryId, req.user.email]
        );
        
        if (!existingEntry) {
            return res.status(404).json({ error: 'Journal entry not found' });
        }
        
        await query(
            'DELETE FROM journal_entries WHERE id = ? AND user_email = ?',
            [entryId, req.user.email]
        );
        
        res.json({ message: 'Journal entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting journal entry:', error);
        res.status(500).json({ error: 'Failed to delete journal entry' });
    }
});

// Helper function to ensure journal_entries table exists
async function ensureJournalTableExists() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS journal_entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                entry_date DATE NOT NULL,
                mood VARCHAR(100) DEFAULT '',
                content TEXT NOT NULL,
                location VARCHAR(255) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_email (user_email),
                INDEX idx_entry_date (entry_date),
                UNIQUE KEY unique_user_date (user_email, entry_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Journal entries table ensured');
    } catch (error) {
        console.error('Error ensuring journal_entries table:', error);
        throw error;
    }
}

module.exports = router;

