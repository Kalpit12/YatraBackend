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
        
        // Validate recipient type is in allowed enum values
        const allowedTypes = ['all-travelers', 'specific-vehicle', 'specific-traveler'];
        if (!allowedTypes.includes(dbRecipientType)) {
            return res.status(400).json({ 
                error: `Invalid recipient type: ${dbRecipientType}. Allowed values: ${allowedTypes.join(', ')}` 
            });
        }
        
        // Store recipient value
        let recipientValueToStore = recipientValue || null;
        
        if (recipientType === 'all-travelers' || recipientType === 'all-group-leaders') {
            // For "all" types, store recipients array as JSON
            // Note: recipient_value should be TEXT type to support large arrays
            // If VARCHAR(255) is still in use, we'll handle it gracefully
            if (recipients && Array.isArray(recipients) && recipients.length > 0) {
                const recipientsJson = JSON.stringify(recipients);
                // Check if it exceeds VARCHAR(255) limit - if so, store a summary
                if (recipientsJson.length > 255) {
                    // Store count and first few emails as fallback
                    const firstFew = recipients.slice(0, 5);
                    recipientValueToStore = JSON.stringify({
                        count: recipients.length,
                        sample: firstFew
                    });
                    // If still too long, just store count
                    if (recipientValueToStore.length > 255) {
                        recipientValueToStore = `count:${recipients.length}`;
                    }
                } else {
                    recipientValueToStore = recipientsJson;
                }
            } else {
                // No recipients provided, store as null
                recipientValueToStore = null;
            }
        } else if (recipientType === 'specific-group-leader') {
            // Store the group leader email
            recipientValueToStore = recipientValue || (recipients && recipients[0]) || null;
        } else if (recipientType === 'specific-traveler') {
            // Store the traveler email
            recipientValueToStore = recipientValue || (recipients && recipients[0]) || null;
        } else if (recipientType === 'by-vehicle' || recipientType === 'specific-vehicle') {
            // Store vehicle ID as string
            recipientValueToStore = recipientValue ? String(recipientValue) : null;
        }
        
        // Validate message is not empty
        if (!message || message.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Message cannot be empty' 
            });
        }
        
        // Validate display type
        const allowedDisplayTypes = ['notification', 'banner', 'modal'];
        const finalDisplayType = displayType && allowedDisplayTypes.includes(displayType) 
            ? displayType 
            : 'notification';
        
        // Validate timing type
        const allowedTimingTypes = ['instant', 'scheduled'];
        const finalTimingType = timingType && allowedTimingTypes.includes(timingType) 
            ? timingType 
            : 'instant';
        
        // Validate scheduled time if timing is scheduled
        let finalScheduledTime = null;
        if (finalTimingType === 'scheduled' && scheduledTime) {
            try {
                finalScheduledTime = new Date(scheduledTime).toISOString().slice(0, 19).replace('T', ' ');
            } catch (e) {
                return res.status(400).json({ 
                    error: 'Invalid scheduled time format' 
                });
            }
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
            message.trim(),
            finalDisplayType,
            finalTimingType,
            finalScheduledTime,
            false // Always set to false initially so users can receive it
        ]);
        
        res.status(201).json({ 
            id: result.insertId, 
            message: 'Announcement created successfully' 
        });
    } catch (error) {
        console.error('Error creating announcement:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to create announcement';
        if (error.code === 'ER_DATA_TOO_LONG') {
            errorMessage = 'Recipient value is too long. Please reduce the number of recipients.';
        } else if (error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
            errorMessage = 'Invalid value for recipient type or display type.';
        } else if (error.sqlMessage) {
            errorMessage = error.sqlMessage;
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message
        });
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

