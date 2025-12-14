const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Helper function to format traveler data
function formatTravelerData(travelers) {
    return travelers.map(t => ({
        id: t.id,
        tirthId: t.tirth_id,
        firstName: t.first_name,
        middleName: t.middle_name || '',
        lastName: t.last_name,
        name: `${t.first_name} ${t.middle_name ? t.middle_name + ' ' : ''}${t.last_name}`.trim(),
        email: t.email,
        phone: t.phone,
        city: t.city,
        country: t.country,
        center: t.center,
        birthDate: t.birth_date ? t.birth_date.toISOString().split('T')[0] : null,
        age: t.age ? String(t.age) : null,
        passportNo: t.passport_no,
        passportIssueDate: t.passport_issue_date ? t.passport_issue_date.toISOString().split('T')[0] : null,
        passportExpiryDate: t.passport_expiry_date ? t.passport_expiry_date.toISOString().split('T')[0] : null,
        nationality: t.nationality,
        gender: t.gender,
        hoodiSize: t.hoodi_size,
        vehicleId: t.vehicle_id,
        profileLine: t.profile_line,
        aboutMe: t.about_me,
        image: t.image_url || '',
        vehicleName: t.vehicle_name,
        vehicleColor: t.vehicle_color
    }));
}

// Get all travelers (public - for logged-in users to view profiles)
router.get('/public', authenticateToken, async (req, res) => {
    try {
        const travelers = await query(`
            SELECT 
                t.*,
                v.name as vehicle_name,
                v.color as vehicle_color
            FROM travelers t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            ORDER BY t.first_name ASC, t.last_name ASC
        `);
        
        const formatted = formatTravelerData(travelers);
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching public travelers:', error);
        res.status(500).json({ error: 'Failed to fetch travelers' });
    }
});

// Get all travelers (protected - requires admin authentication)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const travelers = await query(`
            SELECT 
                t.*,
                v.name as vehicle_name,
                v.color as vehicle_color
            FROM travelers t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            ORDER BY t.id ASC
        `);
        
        const formatted = formatTravelerData(travelers);
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching travelers:', error);
        res.status(500).json({ error: 'Failed to fetch travelers' });
    }
});

// Get single traveler by ID (protected - admin or own profile)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const travelerId = parseInt(req.params.id);
        
        // Allow access if admin or if accessing own profile
        if (!req.user.isAdmin && req.user.id !== travelerId) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You can only access your own profile'
            });
        }
        
        const [traveler] = await query(
            'SELECT * FROM travelers WHERE id = ?',
            [travelerId]
        );
        
        if (!traveler) {
            return res.status(404).json({ error: 'Traveler not found' });
        }
        
        const { password_hash, ...travelerData } = traveler;
        res.json({
            ...travelerData,
            name: `${traveler.first_name} ${traveler.middle_name ? traveler.middle_name + ' ' : ''}${traveler.last_name}`.trim(),
            image: traveler.image_url || ''
        });
    } catch (error) {
        console.error('Error fetching traveler:', error);
        res.status(500).json({ error: 'Failed to fetch traveler' });
    }
});

// Get traveler by email (for login)
// Get traveler by email (protected - users can only access their own data, admins can access any)
router.get('/email/:email', authenticateToken, async (req, res) => {
    try {
        const email = req.params.email;
        
        // Users can only access their own data unless they're admin
        if (!req.user.isAdmin && req.user.email !== email) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You can only access your own information'
            });
        }
        
        const [traveler] = await query(`
            SELECT 
                t.id, 
                t.email, 
                t.first_name, 
                t.last_name, 
                t.middle_name,
                t.image_url,
                t.vehicle_id,
                v.name as vehicle_name,
                v.color as vehicle_color
            FROM travelers t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            WHERE t.email = ?
        `, [email]);
        
        if (!traveler) {
            return res.status(404).json({ error: 'Traveler not found' });
        }
        
        res.json({
            id: traveler.id,
            email: traveler.email,
            firstName: traveler.first_name,
            lastName: traveler.last_name,
            middleName: traveler.middle_name || '',
            name: `${traveler.first_name} ${traveler.middle_name ? traveler.middle_name + ' ' : ''}${traveler.last_name}`.trim(),
            image: traveler.image_url || '',
            vehicleId: traveler.vehicle_id,
            vehicle_id: traveler.vehicle_id, // Include both field names for compatibility
            vehicleName: traveler.vehicle_name || null,
            vehicleColor: traveler.vehicle_color || null
        });
    } catch (error) {
        console.error('Error fetching traveler by email:', error);
        res.status(500).json({ error: 'Failed to fetch traveler' });
    }
});

// Create new traveler (protected - requires admin authentication)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            tirthId, firstName, middleName, lastName, email, password,
            phone, city, country, center, birthDate, age, passportNo,
            passportIssueDate, passportExpiryDate, nationality, gender,
            hoodiSize, vehicleId, profileLine, aboutMe, image
        } = req.body;
        
        // Hash password
        const passwordHash = password ? await bcrypt.hash(password, 10) : '';
        
        const result = await query(`
            INSERT INTO travelers (
                tirth_id, first_name, middle_name, last_name, email, password_hash,
                phone, city, country, center, birth_date, age, passport_no,
                passport_issue_date, passport_expiry_date, nationality, gender,
                hoodi_size, vehicle_id, profile_line, about_me, image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tirthId, firstName, middleName || '', lastName, email, passwordHash,
            phone, city, country || 'India', center, birthDate || null, age ? parseInt(age) : null,
            passportNo, passportIssueDate || null, passportExpiryDate || null,
            nationality || 'Indian', gender || 'Male', hoodiSize, vehicleId || null,
            profileLine, aboutMe, image || ''
        ]);
        
        res.status(201).json({ 
            id: result.insertId, 
            message: 'Traveler created successfully' 
        });
    } catch (error) {
        console.error('Error creating traveler:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Email or Tirth ID already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create traveler' });
        }
    }
});

// Update traveler (protected - admin or own profile)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const travelerId = parseInt(req.params.id);

        // Only admins or the owner can update this traveler
        if (!req.user.isAdmin && req.user.id !== travelerId) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only update your own profile'
            });
        }

        const {
            firstName, middleName, lastName, email, password,
            phone, city, country, center, birthDate, age, passportNo,
            passportIssueDate, passportExpiryDate, nationality, gender,
            hoodiSize, vehicleId, profileLine, aboutMe, image
        } = req.body;
        
        // If password is provided, hash it
        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }
        
        const updateFields = [];
        const updateValues = [];
        
        if (firstName) { updateFields.push('first_name = ?'); updateValues.push(firstName); }
        if (middleName !== undefined) { updateFields.push('middle_name = ?'); updateValues.push(middleName); }
        if (lastName) { updateFields.push('last_name = ?'); updateValues.push(lastName); }
        if (email) { updateFields.push('email = ?'); updateValues.push(email); }
        if (passwordHash) { updateFields.push('password_hash = ?'); updateValues.push(passwordHash); }
        if (phone) { updateFields.push('phone = ?'); updateValues.push(phone); }
        if (city) { updateFields.push('city = ?'); updateValues.push(city); }
        if (country) { updateFields.push('country = ?'); updateValues.push(country); }
        if (center) { updateFields.push('center = ?'); updateValues.push(center); }
        if (birthDate) { updateFields.push('birth_date = ?'); updateValues.push(birthDate); }
        if (age) { updateFields.push('age = ?'); updateValues.push(parseInt(age)); }
        if (passportNo) { updateFields.push('passport_no = ?'); updateValues.push(passportNo); }
        if (passportIssueDate) { updateFields.push('passport_issue_date = ?'); updateValues.push(passportIssueDate); }
        if (passportExpiryDate) { updateFields.push('passport_expiry_date = ?'); updateValues.push(passportExpiryDate); }
        if (nationality) { updateFields.push('nationality = ?'); updateValues.push(nationality); }
        if (gender) { updateFields.push('gender = ?'); updateValues.push(gender); }
        if (hoodiSize) { updateFields.push('hoodi_size = ?'); updateValues.push(hoodiSize); }
        if (vehicleId !== undefined) { updateFields.push('vehicle_id = ?'); updateValues.push(vehicleId); }
        if (profileLine) { updateFields.push('profile_line = ?'); updateValues.push(profileLine); }
        if (aboutMe) { updateFields.push('about_me = ?'); updateValues.push(aboutMe); }
        if (image !== undefined) { updateFields.push('image_url = ?'); updateValues.push(image); }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateValues.push(travelerId);
        
        await query(
            `UPDATE travelers SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        res.json({ message: 'Traveler updated successfully' });
    } catch (error) {
        console.error('Error updating traveler:', error);
        res.status(500).json({ error: 'Failed to update traveler' });
    }
});

// Delete traveler (protected - requires admin authentication)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await query('DELETE FROM travelers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Traveler deleted successfully' });
    } catch (error) {
        console.error('Error deleting traveler:', error);
        res.status(500).json({ error: 'Failed to delete traveler' });
    }
});

// Login traveler (verify password and generate token)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        const [traveler] = await query(
            'SELECT * FROM travelers WHERE email = ?',
            [email]
        );
        
        if (!traveler) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Verify password
        const isValid = await bcrypt.compare(password, traveler.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check JWT secret is configured
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'Server configuration error' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: traveler.id, 
                email: traveler.email,
                isAdmin: false 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // Travelers get 7 days, admins get 24h
        );
        
        // Return traveler data (without password)
        const { password_hash, ...travelerData } = traveler;
        res.json({
            token,
            traveler: {
                ...travelerData,
                name: `${traveler.first_name} ${traveler.middle_name ? traveler.middle_name + ' ' : ''}${traveler.last_name}`.trim(),
                image: traveler.image_url || ''
            },
            expiresIn: '7d'
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = router;

