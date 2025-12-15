const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Normalize date input to YYYY-MM-DD (returns null if invalid)
const normalizeDate = (value) => {
    const parsed = value ? new Date(value) : new Date();
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
};

// Get all check-ins (admin only to avoid data leakage)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { vehicleId, active, travelerEmail } = req.query;
        
        let sql = `
            SELECT 
                ci.*,
                t.name as traveler_name,
                t.first_name,
                t.last_name,
                v.name as vehicle_name
            FROM check_ins ci
            LEFT JOIN travelers t ON ci.traveler_id = t.id
            LEFT JOIN vehicles v ON ci.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];
        
        if (vehicleId) {
            sql += ' AND ci.vehicle_id = ?';
            params.push(vehicleId);
        }
        if (active !== undefined) {
            sql += ' AND ci.active = ?';
            params.push(active === 'true');
        }
        if (travelerEmail) {
            sql += ' AND ci.traveler_email = ?';
            params.push(travelerEmail);
        }
        
        sql += ' ORDER BY ci.checked_in_at DESC';
        
        const checkIns = await query(sql, params);
        
        res.json(checkIns);
    } catch (error) {
        console.error('Error fetching check-ins:', error);
        res.status(500).json({ error: 'Failed to fetch check-ins' });
    }
});

// Get check-in status for traveler's own vehicle (public endpoint for travelers)
router.get('/my-status', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const targetDate = normalizeDate(req.query.date);
        
        // Get traveler id and base vehicle ID
        const [traveler] = await query(
            'SELECT id, vehicle_id FROM travelers WHERE email = ?',
            [userEmail]
        );
        
        if (!traveler || !traveler.vehicle_id) {
            console.warn('⚠️ Traveler not found or no base vehicle_id for', userEmail);
        }
        
        // Prefer day-wise vehicle allotment if present for the date
        let vehicleId = null;
        if (traveler && traveler.id && targetDate) {
            const [dayAllotment] = await query(
                'SELECT vehicle_id FROM vehicle_allotments WHERE traveler_id = ? AND date = ?',
                [traveler.id, targetDate]
            );
            if (dayAllotment && dayAllotment.vehicle_id) {
                vehicleId = dayAllotment.vehicle_id;
            }
        }

        // Fallback to base vehicle_id stored on traveler
        if (!vehicleId && traveler && traveler.vehicle_id) {
            vehicleId = traveler.vehicle_id;
        }

        if (!vehicleId) {
            return res.json({
                vehicleId: null,
                active: false,
                checkedIn: [],
                isCheckedIn: false
            });
        }
        
        // Check if user is checked in (check both active=1 and any check-in record)
        const [checkIn] = await query(`
            SELECT * FROM check_ins 
            WHERE vehicle_id = ? AND traveler_email = ? AND active = 1
        `, [vehicleId, userEmail]);
        
        // Also check if there's any check-in record (even if inactive) for debugging
        const [anyCheckIn] = await query(`
            SELECT * FROM check_ins 
            WHERE vehicle_id = ? AND traveler_email = ?
            ORDER BY checked_in_at DESC
            LIMIT 1
        `, [vehicleId, userEmail]);
        
        console.log('🔍 Check-in lookup for:', { vehicleId, userEmail, found: !!checkIn, anyCheckIn: !!anyCheckIn });
        if (anyCheckIn && !checkIn) {
            console.log('⚠️ Found check-in record but it\'s inactive:', anyCheckIn);
        }
        
        // Debug: Get all check-ins for this vehicle
        const allCheckIns = await query(`
            SELECT * FROM check_ins 
            WHERE vehicle_id = ?
            ORDER BY checked_in_at DESC
        `, [vehicleId]);
        console.log('🔍 All check-ins for vehicle', vehicleId, ':', allCheckIns.length);
        if (allCheckIns.length > 0) {
            console.log('🔍 Check-ins:', allCheckIns.map(ci => ({
                id: ci.id,
                email: ci.traveler_email,
                active: ci.active,
                checked_in_at: ci.checked_in_at
            })));
        }
        
        // Get count of active check-ins for this vehicle (to determine if check-in is "active")
        const [activeCheckIns] = await query(`
            SELECT COUNT(*) as count FROM check_ins 
            WHERE vehicle_id = ? AND active = 1
        `, [vehicleId]);
        
        const hasActiveCheckIns = activeCheckIns && activeCheckIns.count > 0;
        
        res.json({
            vehicleId: vehicleId,
            active: true, // Check-in is always available if vehicle is allocated
            checkedIn: checkIn ? [userEmail] : [],
            isCheckedIn: !!checkIn
        });
    } catch (error) {
        console.error('Error fetching traveler check-in status:', error);
        // Return safe default on error
        res.json({
            vehicleId: null,
            active: false,
            checkedIn: [],
            isCheckedIn: false
        });
    }
});

// Get check-ins by vehicle (admin only to avoid data leakage)
router.get('/vehicle/:vehicleId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.vehicleId);
        if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
            return res.status(400).json({ error: 'Invalid vehicle ID' });
        }
        
        const { active } = req.query;
        
        // Check if check_ins table exists, if not return empty result
        try {
            await query('SELECT 1 FROM check_ins LIMIT 1');
        } catch (tableError) {
            if (tableError.code === 'ER_NO_SUCH_TABLE') {
                // Table doesn't exist, return empty result
                return res.json({
                    vehicleId: vehicleId,
                    active: true,
                    checkedIn: [],
                    travelers: []
                });
            }
            throw tableError;
        }
        
        // Build query - use COALESCE to handle missing traveler data gracefully
        // Note: travelers table has first_name, last_name (not name column)
        let sql = `
            SELECT 
                ci.id,
                ci.vehicle_id,
                ci.traveler_email,
                ci.traveler_id,
                ci.active,
                ci.checked_in_at,
                ci.checked_out_at,
                COALESCE(t.first_name, '') as first_name,
                COALESCE(t.last_name, '') as last_name,
                COALESCE(t.middle_name, '') as middle_name,
                COALESCE(t.email, ci.traveler_email, '') as email
            FROM check_ins ci
            LEFT JOIN travelers t ON ci.traveler_id = t.id
            WHERE ci.vehicle_id = ?
        `;
        const params = [vehicleId];
        
        if (active !== undefined) {
            // MySQL BOOLEAN is stored as TINYINT(1): 1 = true, 0 = false
            const activeValue = active === 'true' || active === true || active === '1' || active === 1 ? 1 : 0;
            sql += ' AND ci.active = ?';
            params.push(activeValue);
        }
        
        sql += ' ORDER BY ci.checked_in_at DESC';
        
        const checkIns = await query(sql, params);
        
        // Get ALL travelers assigned to this vehicle (not just those with check-in records)
        const allTravelers = await query(`
            SELECT 
                id,
                email,
                first_name,
                middle_name,
                last_name
            FROM travelers
            WHERE vehicle_id = ?
            ORDER BY first_name ASC, last_name ASC
        `, [vehicleId]);
        
        // Check if vehicle has any travelers allocated (to determine if check-in is enabled)
        const hasTravelers = allTravelers.length > 0;
        
        // Create a map of check-in status by email
        const checkInMap = new Map();
        checkIns.forEach(ci => {
            const email = ci.traveler_email || ci.email || '';
            if (email) {
                const isActive = ci.active === 1 || ci.active === true || ci.active === '1';
                checkInMap.set(email.toLowerCase(), {
                    checkedIn: isActive,
                    timestamp: ci.checked_in_at || null
                });
            }
        });
        
        // Format response - include ALL travelers assigned to vehicle
        // MySQL BOOLEAN is stored as TINYINT(1): 1 = true, 0 = false
        const formatted = allTravelers.map(t => {
            // Build name from first_name, middle_name, last_name
            const nameParts = [];
            if (t.first_name) nameParts.push(t.first_name);
            if (t.middle_name) nameParts.push(t.middle_name);
            if (t.last_name) nameParts.push(t.last_name);
            const fullName = nameParts.join(' ').trim() || '';
            
            // Check if this traveler has a check-in record
            const checkInStatus = checkInMap.get(t.email.toLowerCase());
            
            return {
                email: t.email || '',
                name: fullName,
                checkedIn: checkInStatus ? checkInStatus.checkedIn : false,
                timestamp: checkInStatus ? checkInStatus.timestamp : null
            };
        });
        
        // Also include any check-in records for travelers not in the travelers table
        // (edge case: check-in exists but traveler not assigned to vehicle)
        checkIns.forEach(ci => {
            const email = ci.traveler_email || ci.email || '';
            if (email && !formatted.find(t => t.email.toLowerCase() === email.toLowerCase())) {
                const isActive = ci.active === 1 || ci.active === true || ci.active === '1';
                const nameParts = [];
                if (ci.first_name) nameParts.push(ci.first_name);
                if (ci.middle_name) nameParts.push(ci.middle_name);
                if (ci.last_name) nameParts.push(ci.last_name);
                const fullName = nameParts.join(' ').trim() || '';
                
                formatted.push({
                    email: email,
                    name: fullName,
                    checkedIn: isActive,
                    timestamp: ci.checked_in_at || null
                });
            }
        });
        
        // Check-in is "active" (enabled) if vehicle has travelers allocated
        // This allows travelers to check in even if no one has checked in yet
        res.json({
            vehicleId: vehicleId,
            active: hasTravelers, // Check-in is enabled if vehicle has travelers
            checkedIn: formatted.filter(c => c.checkedIn && c.email).map(c => c.email),
            travelers: formatted
        });
    } catch (error) {
        console.error('Error fetching vehicle check-ins:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            stack: error.stack
        });
        
        // Provide more specific error message
        let errorMessage = 'Failed to fetch vehicle check-ins';
        if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'Check-ins table does not exist. Please run database setup.';
        } else if (error.sqlMessage) {
            errorMessage = error.sqlMessage;
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message
        });
    }
});

// Create check-in (protected - travelers can only check themselves in)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { vehicleId, travelerEmail, travelerId } = req.body;
        
        if (!vehicleId || !travelerEmail) {
            return res.status(400).json({ error: 'Vehicle ID and traveler email required' });
        }
        
        // Validate vehicle ID
        const parsedVehicleId = parseInt(vehicleId);
        if (!Number.isFinite(parsedVehicleId) || parsedVehicleId <= 0) {
            return res.status(400).json({ error: 'Invalid vehicle ID' });
        }
        
        // Only allow self check-in unless admin
        if (!req.user.isAdmin && req.user.email !== travelerEmail) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only check in yourself'
            });
        }

        // Check if already checked in
        const [existing] = await query(`
            SELECT * FROM check_ins 
            WHERE vehicle_id = ? AND traveler_email = ? AND active = 1
        `, [parsedVehicleId, travelerEmail]);
        
        if (existing) {
            return res.status(400).json({ error: 'Already checked in' });
        }
        
        // Get traveler ID if not provided
        let finalTravelerId = travelerId;
        if (!finalTravelerId) {
            const [traveler] = await query(
                'SELECT id FROM travelers WHERE email = ?',
                [travelerEmail]
            );
            finalTravelerId = traveler ? traveler.id : null;
        }
        
        // Insert check-in
        const result = await query(`
            INSERT INTO check_ins (vehicle_id, traveler_email, traveler_id, active)
            VALUES (?, ?, ?, 1)
        `, [parsedVehicleId, travelerEmail, finalTravelerId]);
        
        res.status(201).json({ 
            id: result.insertId, 
            message: 'Checked in successfully' 
        });
    } catch (error) {
        console.error('Error creating check-in:', error);
        res.status(500).json({ error: 'Failed to create check-in' });
    }
});

// Checkout (protected - only admin or owner)
router.post('/:id/checkout', authenticateToken, async (req, res) => {
    try {
        const [checkIn] = await query(
            'SELECT traveler_email FROM check_ins WHERE id = ?',
            [req.params.id]
        );

        if (!checkIn) {
            return res.status(404).json({ error: 'Check-in not found' });
        }

        if (!req.user.isAdmin && checkIn.traveler_email !== req.user.email) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only check out yourself'
            });
        }

        await query(`
            UPDATE check_ins 
            SET active = 0, checked_out_at = NOW()
            WHERE id = ?
        `, [req.params.id]);
        
        res.json({ message: 'Checked out successfully' });
    } catch (error) {
        console.error('Error checking out:', error);
        res.status(500).json({ error: 'Failed to check out' });
    }
});

// Clear all check-ins for a vehicle
// Clear all check-ins for vehicle (protected - requires admin)
router.delete('/vehicle/:vehicleId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await query(`
            UPDATE check_ins 
            SET active = 0, checked_out_at = NOW()
            WHERE vehicle_id = ? AND active = 1
        `, [req.params.vehicleId]);
        
        res.json({ message: 'All check-ins cleared for vehicle' });
    } catch (error) {
        console.error('Error clearing check-ins:', error);
        res.status(500).json({ error: 'Failed to clear check-ins' });
    }
});

module.exports = router;

