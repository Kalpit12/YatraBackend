const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Helper function to format settings
function formatSettings(settings) {
    const formatted = {};
    settings.forEach(setting => {
        let value = setting.setting_value;
        
        // Parse based on type
        if (setting.setting_type === 'number') {
            value = parseFloat(value);
        } else if (setting.setting_type === 'boolean') {
            value = value === 'true' || value === '1';
        } else if (setting.setting_type === 'json') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = setting.setting_value;
            }
        }
        
        formatted[setting.setting_key] = value;
    });
    return formatted;
}

// Get all settings (public - for user frontend)
router.get('/public', async (req, res) => {
    try {
        const settings = await query('SELECT * FROM settings');
        const formatted = formatSettings(settings);
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching public settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Get single setting (public - for user frontend)
router.get('/public/:key', async (req, res) => {
    try {
        const [setting] = await query(
            'SELECT * FROM settings WHERE setting_key = ?',
            [req.params.key]
        );
        
        if (!setting) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        
        let value = setting.setting_value;
        if (setting.setting_type === 'number') {
            value = parseFloat(value);
        } else if (setting.setting_type === 'boolean') {
            value = value === 'true' || value === '1';
        } else if (setting.setting_type === 'json') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = setting.setting_value;
            }
        }
        
        res.json({ key: setting.setting_key, value: value, type: setting.setting_type });
    } catch (error) {
        console.error('Error fetching public setting:', error);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
});

// Get all settings (protected - admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = await query('SELECT * FROM settings');
        
        const formatted = formatSettings(settings);
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Get single setting (protected - admin only)
router.get('/:key', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [setting] = await query(
            'SELECT * FROM settings WHERE setting_key = ?',
            [req.params.key]
        );
        
        if (!setting) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        
        let value = setting.setting_value;
        if (setting.setting_type === 'number') {
            value = parseFloat(value);
        } else if (setting.setting_type === 'boolean') {
            value = value === 'true' || value === '1';
        } else if (setting.setting_type === 'json') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = setting.setting_value;
            }
        }
        
        res.json({ key: setting.setting_key, value: value, type: setting.setting_type });
    } catch (error) {
        console.error('Error fetching setting:', error);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
});

// Update setting
// Update single setting (protected - requires admin)
router.put('/:key', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { value, type } = req.body;
        
        let settingValue = value;
        let settingType = type || 'string';
        
        // Convert to string for storage
        if (typeof value === 'object') {
            settingValue = JSON.stringify(value);
            settingType = 'json';
        } else if (typeof value === 'boolean') {
            settingValue = value.toString();
            settingType = 'boolean';
        } else if (typeof value === 'number') {
            settingValue = value.toString();
            settingType = 'number';
        } else {
            settingValue = String(value);
        }
        
        await query(`
            INSERT INTO settings (setting_key, setting_value, setting_type)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                setting_value = VALUES(setting_value),
                setting_type = VALUES(setting_type)
        `, [req.params.key, settingValue, settingType]);
        
        res.json({ message: 'Setting updated successfully' });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});

// Update multiple settings
// Update multiple settings (protected - requires admin)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = req.body;
        
        for (const [key, value] of Object.entries(settings)) {
            let settingValue = value;
            let settingType = 'string';
            
            if (typeof value === 'object') {
                settingValue = JSON.stringify(value);
                settingType = 'json';
            } else if (typeof value === 'boolean') {
                settingValue = value.toString();
                settingType = 'boolean';
            } else if (typeof value === 'number') {
                settingValue = value.toString();
                settingType = 'number';
            } else {
                settingValue = String(value);
            }
            
            await query(`
                INSERT INTO settings (setting_key, setting_value, setting_type)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    setting_type = VALUES(setting_type)
            `, [key, settingValue, settingType]);
        }
        
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;

