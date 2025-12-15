const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all vehicles (protected read)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const vehicles = await query(`
            SELECT 
                v.*,
                COUNT(DISTINCT t.id) as current_travelers
            FROM vehicles v
            LEFT JOIN travelers t ON v.id = t.vehicle_id
            GROUP BY v.id
            ORDER BY v.id ASC
        `);
        
        const formatted = vehicles.map(v => ({
            id: v.id,
            name: v.name,
            type: v.type,
            capacity: v.capacity,
            regNo: v.reg_no,
            groupLeaderEmail: v.group_leader_email,
            groupLeaderName: v.group_leader_name,
            driver: v.driver_name,
            driverPhone: v.driver_phone,
            color: v.color,
            status: v.status,
            currentLat: v.current_lat ? parseFloat(v.current_lat) : null,
            currentLng: v.current_lng ? parseFloat(v.current_lng) : null,
            lastUpdate: v.last_update,
            notes: v.notes,
            createdAt: v.created_at,
            currentTravelers: v.current_travelers
        }));
        
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
});

// Helper to normalize date input to YYYY-MM-DD
const normalizeDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
};

// Get vehicle allotments (day-wise assignments)
router.get('/allotments', authenticateToken, async (req, res) => {
    try {
        const { date, travelerId, vehicleId } = req.query;

        let sql = `
            SELECT 
                va.*,
                t.first_name,
                t.last_name,
                t.email,
                v.name as vehicle_name
            FROM vehicle_allotments va
            LEFT JOIN travelers t ON va.traveler_id = t.id
            LEFT JOIN vehicles v ON va.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (date) {
            const normalizedDate = normalizeDate(date);
            if (!normalizedDate) {
                return res.status(400).json({ error: 'Invalid date format' });
            }
            sql += ' AND va.date = ?';
            params.push(normalizedDate);
        }
        if (travelerId) {
            sql += ' AND va.traveler_id = ?';
            params.push(travelerId);
        }
        if (vehicleId) {
            sql += ' AND va.vehicle_id = ?';
            params.push(vehicleId);
        }

        sql += ' ORDER BY va.date, va.traveler_id';

        const allotments = await query(sql, params);
        res.json(allotments);
    } catch (error) {
        console.error('Error fetching vehicle allotments:', error);
        res.status(500).json({ error: 'Failed to fetch vehicle allotments' });
    }
});

// Create or update a single vehicle allotment (day-wise)
router.post('/allotments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { date, travelerId, vehicleId } = req.body;

        const normalizedDate = normalizeDate(date);
        const traveler = parseInt(travelerId);
        const vehicle = parseInt(vehicleId);

        if (!normalizedDate || !Number.isFinite(traveler) || !Number.isFinite(vehicle)) {
            return res.status(400).json({ error: 'date, travelerId and vehicleId are required' });
        }

        await query(`
            INSERT INTO vehicle_allotments (date, traveler_id, vehicle_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                vehicle_id = VALUES(vehicle_id),
                updated_at = CURRENT_TIMESTAMP
        `, [normalizedDate, traveler, vehicle]);

        res.status(201).json({ message: 'Vehicle allotment saved successfully' });
    } catch (error) {
        console.error('Error creating vehicle allotment:', error);
        res.status(500).json({ error: 'Failed to save vehicle allotment' });
    }
});

// Bulk save vehicle allotments for a date (replaces existing date allotments when replaceExisting is true)
router.post('/allotments/bulk', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { date, assignments, replaceExisting = true } = req.body;

        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ error: 'assignments array is required' });
        }

        // Normalize and validate rows
        const rows = [];
        const datesToClear = new Set();

        assignments.forEach((assignment, idx) => {
            const targetDate = normalizeDate(assignment.date || date);
            const travelerId = parseInt(assignment.travelerId ?? assignment.traveler_id);
            const vehicleId = parseInt(assignment.vehicleId ?? assignment.vehicle_id);

            if (!targetDate) {
                throw new Error(`Invalid date in assignment index ${idx}`);
            }
            if (!Number.isFinite(travelerId) || !Number.isFinite(vehicleId)) {
                throw new Error(`Invalid travelerId or vehicleId in assignment index ${idx}`);
            }

            rows.push([targetDate, travelerId, vehicleId]);
            datesToClear.add(targetDate);
        });

        // Optionally clear existing allotments for involved dates first
        if (replaceExisting && datesToClear.size > 0) {
            for (const d of datesToClear) {
                await query('DELETE FROM vehicle_allotments WHERE date = ?', [d]);
            }
        }

        const placeholders = rows.map(() => '(?, ?, ?)').join(', ');
        const flatParams = rows.flat();

        await query(`
            INSERT INTO vehicle_allotments (date, traveler_id, vehicle_id)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE 
                vehicle_id = VALUES(vehicle_id),
                updated_at = CURRENT_TIMESTAMP
        `, flatParams);

        res.status(201).json({ 
            message: 'Vehicle allotments saved successfully',
            count: rows.length,
            dates: Array.from(datesToClear)
        });
    } catch (error) {
        console.error('Error saving vehicle allotments (bulk):', error);
        res.status(500).json({ error: error.message || 'Failed to save vehicle allotments' });
    }
});

// Delete vehicle allotments for a date (or specific traveler/vehicle on that date)
router.delete('/allotments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { date, travelerId, vehicleId } = req.query;

        const normalizedDate = normalizeDate(date);
        if (!normalizedDate) {
            return res.status(400).json({ error: 'Valid date query param is required' });
        }

        let sql = 'DELETE FROM vehicle_allotments WHERE date = ?';
        const params = [normalizedDate];

        if (travelerId) {
            sql += ' AND traveler_id = ?';
            params.push(travelerId);
        }

        if (vehicleId) {
            sql += ' AND vehicle_id = ?';
            params.push(vehicleId);
        }

        const result = await query(sql, params);
        res.json({ 
            message: 'Vehicle allotments deleted successfully', 
            deletedCount: result.affectedRows 
        });
    } catch (error) {
        console.error('Error deleting vehicle allotments:', error);
        res.status(500).json({ error: 'Failed to delete vehicle allotments' });
    }
});

// Get single vehicle (protected read)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [vehicle] = await query(
            'SELECT * FROM vehicles WHERE id = ?',
            [req.params.id]
        );
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        
        res.json(vehicle);
    } catch (error) {
        console.error('Error fetching vehicle:', error);
        res.status(500).json({ error: 'Failed to fetch vehicle' });
    }
});

// Create new vehicle
// Create new vehicle (protected - requires admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            type,
            capacity,
            regNo,
            groupLeaderEmail,
            groupLeaderName,
            driver,
            driverPhone,
            color,
            status,
            notes
        } = req.body;

        // Basic validation to avoid DB errors and return clear message
        if (!name || !type || capacity === undefined || capacity === null) {
            return res.status(400).json({
                error: 'Missing required fields: name, type, capacity'
            });
        }

        const parsedCapacity = Number(capacity);
        if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
            return res.status(400).json({
                error: 'Capacity must be a positive number'
            });
        }

        const safeCapacity = parsedCapacity;
        const result = await query(
            `
            INSERT INTO vehicles (
                name,
                type,
                capacity,
                reg_no,
                group_leader_email,
                group_leader_name,
                driver_name,
                driver_phone,
                color,
                status,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            [
                name,
                type,
                safeCapacity,
                regNo,
                groupLeaderEmail || null,
                groupLeaderName || null,
                driver || '',
                driverPhone || '',
                color || '#FF9933',
                status || 'Active',
                notes || ''
            ]
        );

        res.status(201).json({
            id: result.insertId,
            message: 'Vehicle created successfully'
        });
    } catch (error) {
        console.error('Error creating vehicle:', error);
        res.status(500).json({ error: 'Failed to create vehicle' });
    }
});

// Update vehicle
// Update vehicle (protected - requires admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        if (!Number.isFinite(vehicleId)) {
            return res.status(400).json({ error: 'Invalid vehicle id' });
        }

        const {
            name, type, capacity, regNo, groupLeaderEmail,
            groupLeaderName, driver, driverPhone, color, status,
            currentLat, currentLng, notes
        } = req.body;
        
        const updateFields = [];
        const updateValues = [];
        
        if (name) { updateFields.push('name = ?'); updateValues.push(name); }
        if (type) { updateFields.push('type = ?'); updateValues.push(type); }
        if (capacity) { updateFields.push('capacity = ?'); updateValues.push(capacity); }
        if (regNo) { updateFields.push('reg_no = ?'); updateValues.push(regNo); }
        if (groupLeaderEmail) { updateFields.push('group_leader_email = ?'); updateValues.push(groupLeaderEmail); }
        if (groupLeaderName) { updateFields.push('group_leader_name = ?'); updateValues.push(groupLeaderName); }
        if (driver) { updateFields.push('driver_name = ?'); updateValues.push(driver); }
        if (driverPhone) { updateFields.push('driver_phone = ?'); updateValues.push(driverPhone); }
        if (color) { updateFields.push('color = ?'); updateValues.push(color); }
        if (status) { updateFields.push('status = ?'); updateValues.push(status); }
        if (currentLat !== undefined) { updateFields.push('current_lat = ?'); updateValues.push(currentLat); }
        if (currentLng !== undefined) { updateFields.push('current_lng = ?'); updateValues.push(currentLng); }
        if (currentLat !== undefined || currentLng !== undefined) {
            updateFields.push('last_update = NOW()');
        }
        if (notes !== undefined) { updateFields.push('notes = ?'); updateValues.push(notes); }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateValues.push(vehicleId);
        
        await query(
            `UPDATE vehicles SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        res.json({ message: 'Vehicle updated successfully' });
    } catch (error) {
        console.error('Error updating vehicle:', error);
        res.status(500).json({ error: 'Failed to update vehicle' });
    }
});

// Delete vehicle
// Delete vehicle (protected - requires admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await query('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
        res.json({ message: 'Vehicle deleted successfully' });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ error: 'Failed to delete vehicle' });
    }
});

// Update vehicle location (protected - requires authentication, can be group leader or admin)
router.post('/:id/location', authenticateToken, async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        if (!Number.isFinite(vehicleId)) {
            return res.status(400).json({ error: 'Invalid vehicle id' });
        }

        const { lat, lng } = req.body;

        // Only admin or vehicle's group leader can update location
        const [vehicle] = await query(
            'SELECT group_leader_email FROM vehicles WHERE id = ?',
            [vehicleId]
        );

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        if (!req.user.isAdmin && vehicle.group_leader_email !== req.user.email) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Only admin or the assigned group leader can update location'
            });
        }

        await query(`
            UPDATE vehicles 
            SET current_lat = ?, current_lng = ?, last_update = NOW()
            WHERE id = ?
        `, [lat, lng, vehicleId]);
        
        res.json({ message: 'Vehicle location updated successfully' });
    } catch (error) {
        console.error('Error updating vehicle location:', error);
        res.status(500).json({ error: 'Failed to update vehicle location' });
    }
});

module.exports = router;

