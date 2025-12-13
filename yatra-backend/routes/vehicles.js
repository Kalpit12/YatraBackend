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

// Create new vehicle (protected - requires admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('📥 POST /vehicles - Received request body:', JSON.stringify(req.body, null, 2));
        
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
            console.error('❌ Missing required fields:', { name, type, capacity });
            return res.status(400).json({
                error: 'Missing required fields: name, type, capacity'
            });
        }

        const parsedCapacity = Number(capacity);
        if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
            console.error('❌ Invalid capacity:', capacity);
            return res.status(400).json({
                error: 'Capacity must be a positive number'
            });
        }

        const safeCapacity = parsedCapacity;
        
        console.log('📝 Inserting vehicle with data:', {
            name,
            type,
            capacity: safeCapacity,
            regNo,
            groupLeaderEmail,
            groupLeaderName,
            driver,
            driverPhone,
            color: color || '#FF9933',
            status: status || 'Active',
            notes: notes || ''
        });
        
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
                name || '',
                type || '',
                safeCapacity,
                regNo || null,
                groupLeaderEmail || null,
                groupLeaderName || null,
                driver || '',
                driverPhone || '',
                color || '#FF9933',
                status || 'Active',
                notes || ''
            ]
        );

        console.log('✅ Vehicle created successfully, ID:', result.insertId);
        
        res.status(201).json({
            id: result.insertId,
            message: 'Vehicle created successfully'
        });
    } catch (error) {
        console.error('❌ Error creating vehicle:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Failed to create vehicle',
            details: error.message 
        });
    }
});

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

