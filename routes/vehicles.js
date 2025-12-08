const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Get all vehicles
router.get('/', async (req, res) => {
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

// Get single vehicle
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
        if (!name || !type || !capacity || !regNo) {
            return res.status(400).json({
                error: 'Missing required fields: name, type, capacity, regNo'
            });
        }

        const safeCapacity = Number.isFinite(Number(capacity)) ? Number(capacity) : null;
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
router.put('/:id', async (req, res) => {
    try {
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
        
        updateValues.push(req.params.id);
        
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
router.delete('/:id', async (req, res) => {
    try {
        await query('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
        res.json({ message: 'Vehicle deleted successfully' });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ error: 'Failed to delete vehicle' });
    }
});

// Update vehicle location (for real-time tracking)
router.post('/:id/location', async (req, res) => {
    try {
        const { lat, lng } = req.body;
        
        await query(`
            UPDATE vehicles 
            SET current_lat = ?, current_lng = ?, last_update = NOW()
            WHERE id = ?
        `, [lat, lng, req.params.id]);
        
        res.json({ message: 'Vehicle location updated successfully' });
    } catch (error) {
        console.error('Error updating vehicle location:', error);
        res.status(500).json({ error: 'Failed to update vehicle location' });
    }
});

module.exports = router;

