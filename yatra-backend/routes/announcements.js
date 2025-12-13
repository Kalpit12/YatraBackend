const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all announcements (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const announcements = await query(`
            SELECT * FROM announcements 
            ORDER BY created_at DESC
        `);
        
        res.json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

// Get pending announcements for users (public - no auth required)
router.get('/pending', async (req, res) => {
    try {
        const announcements = await query(`
            SELECT * FROM announcements 
            WHERE sent = FALSE 
            AND (timing_type = 'instant' OR (timing_type = 'scheduled' AND scheduled_time <= NOW()))
            ORDER BY created_at DESC
        `);
        
        res.json(announcements);
    } catch (error) {
        console.error('Error fetching pending announcements:', error);
        res.status(500).json({ error: 'Failed to fetch pending announcements' });
    }
});

// Get announcements for specific user (public - checks if user should receive)
router.get('/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        // Get all pending announcements
        const allAnnouncements = await query(`
            SELECT * FROM announcements 
            WHERE sent = FALSE 
            AND (timing_type = 'instant' OR (timing_type = 'scheduled' AND scheduled_time <= NOW()))
            ORDER BY created_at DESC
        `);
        
        // Filter announcements user should receive
        const userAnnouncements = [];
        
        for (const announcement of allAnnouncements) {
            let shouldReceive = false;
            
            if (announcement.recipient_type === 'all-travelers') {
                shouldReceive = true;
            } else if (announcement.recipient_type === 'specific-traveler') {
                shouldReceive = announcement.recipient_value === email;
            } else if (announcement.recipient_type === 'specific-vehicle') {
                // Check if user is in this vehicle
                const [traveler] = await query(
                    'SELECT id FROM travelers WHERE email = ? AND vehicle_id = ?',
                    [email, announcement.recipient_value]
                );
                shouldReceive = !!traveler;
            } else if (announcement.recipient_type === 'all-group-leaders') {
                // Check if user is a group leader
                const [vehicle] = await query(
                    'SELECT id FROM vehicles WHERE group_leader_email = ?',
                    [email]
                );
                shouldReceive = !!vehicle;
            } else if (announcement.recipient_type === 'by-vehicle') {
                // Check if user is in this vehicle
                const [traveler] = await query(
                    'SELECT id FROM travelers WHERE email = ? AND vehicle_id = ?',
                    [email, announcement.recipient_value]
                );
                shouldReceive = !!traveler;
            }
            
            if (shouldReceive) {
                userAnnouncements.push(announcement);
            }
        }
        
        res.json(userAnnouncements);
    } catch (error) {
        console.error('Error fetching user announcements:', error);
        res.status(500).json({ error: 'Failed to fetch user announcements' });
    }
});

// Create announcement (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            recipientType,
            recipientValue,
            message,
            displayType,
            timingType,
            scheduledTime,
            recipients // Array of email addresses for complex recipient types
        } = req.body;
        
        if (!message || !recipientType) {
            return res.status(400).json({ 
                error: 'Missing required fields: message, recipientType' 
            });
        }
        
        // Map recipient types to database enum values
        // Database has: 'all-travelers', 'specific-vehicle', 'specific-traveler'
        // Frontend uses: 'all-travelers', 'all-group-leaders', 'specific-traveler', 'specific-group-leader', 'by-vehicle'
        let dbRecipientType = recipientType;
        if (recipientType === 'by-vehicle') {
            dbRecipientType = 'specific-vehicle';
        } else if (recipientType === 'all-group-leaders' || recipientType === 'specific-group-leader') {
            // Store as 'specific-traveler' with the email in recipient_value
            dbRecipientType = 'specific-traveler';
        }
        
        // Store recipient value
        let recipientValueToStore = recipientValue || null;
        if (recipientType === 'all-travelers' || recipientType === 'all-group-leaders') {
            // For "all" types, store recipients array as JSON
            if (recipients && Array.isArray(recipients) && recipients.length > 0) {
                recipientValueToStore = JSON.stringify(recipients);
            }
        } else if (recipientType === 'specific-group-leader') {
            // Store the group leader email
            recipientValueToStore = recipientValue || (recipients && recipients[0]) || null;
        }
        
        const result = await query(`
            INSERT INTO announcements (
                recipient_type, 
                recipient_value, 
                message, 
                display_type, 
                timing_type, 
                scheduled_time,
                sent
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            dbRecipientType,
            recipientValueToStore,
            message,
            displayType || 'notification',
            timingType || 'instant',
            scheduledTime || null,
            timingType === 'instant' ? true : false
        ]);
        
        res.status(201).json({ 
            id: result.insertId, 
            message: 'Announcement created successfully' 
        });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
});

// Mark announcement as sent (admin only)
router.put('/:id/sent', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await query(`
            UPDATE announcements 
            SET sent = TRUE, sent_at = NOW() 
            WHERE id = ?
        `, [req.params.id]);
        
        res.json({ message: 'Announcement marked as sent' });
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({ error: 'Failed to update announcement' });
    }
});

// Delete announcement (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
});

module.exports = router;

