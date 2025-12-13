const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all itinerary days (protected read)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const itinerary = await query(`
            SELECT 
                i.*,
                GROUP_CONCAT(
                    JSON_OBJECT('time', ia.time, 'activity', ia.activity)
                    ORDER BY ia.display_order, ia.id
                ) as activities_json,
                GROUP_CONCAT(ii.image_url ORDER BY ii.display_order, ii.id) as images
            FROM itinerary i
            LEFT JOIN itinerary_activities ia ON i.id = ia.itinerary_id
            LEFT JOIN itinerary_images ii ON i.id = ii.itinerary_id
            GROUP BY i.id
            ORDER BY i.day ASC
        `);
        
        // Format response
        const formatted = itinerary.map(item => {
            const activities = item.activities_json 
                ? JSON.parse('[' + item.activities_json + ']')
                : [];
            const images = item.images ? item.images.split(',') : [];
            
            return {
                id: item.id,
                day: item.day,
                date: new Date(item.date).toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                }),
                dateObj: item.date,
                place: item.place,
                city: item.city,
                state: item.state,
                country: item.country,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lng),
                description: item.description,
                activities: activities,
                images: images
            };
        });
        
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching itinerary:', error);
        res.status(500).json({ error: 'Failed to fetch itinerary' });
    }
});

// Get single itinerary day (protected read)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [itinerary] = await query(
            'SELECT * FROM itinerary WHERE id = ?',
            [req.params.id]
        );
        
        if (!itinerary) {
            return res.status(404).json({ error: 'Itinerary day not found' });
        }
        
        // Get activities
        const activities = await query(
            'SELECT * FROM itinerary_activities WHERE itinerary_id = ? ORDER BY display_order, id',
            [req.params.id]
        );
        
        // Get images
        const images = await query(
            'SELECT image_url FROM itinerary_images WHERE itinerary_id = ? ORDER BY display_order, id',
            [req.params.id]
        );
        
        res.json({
            ...itinerary,
            activities: activities.map(a => ({ time: a.time, activity: a.activity })),
            images: images.map(img => img.image_url)
        });
    } catch (error) {
        console.error('Error fetching itinerary day:', error);
        res.status(500).json({ error: 'Failed to fetch itinerary day' });
    }
});

// Create new itinerary day
// Create new itinerary day (protected - requires admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            day, date, dateObj, place, city, state, country, lat, lng,
            description, activities, images
        } = req.body;
        
        // Validate required fields
        if (!day || !place || lat === undefined || lng === undefined) {
            return res.status(400).json({ 
                error: 'Missing required fields: day, place, lat, lng are required' 
            });
        }
        
        // Parse date - prefer dateObj if available, otherwise parse date string
        let dateValue = date;
        if (dateObj) {
            // If dateObj is provided, use it
            dateValue = new Date(dateObj).toISOString().split('T')[0];
        } else if (date) {
            // Try to parse the date string (could be formatted like "29 Nov 2024" or ISO format)
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                dateValue = parsedDate.toISOString().split('T')[0];
            } else {
                // If parsing fails, use today's date as fallback
                dateValue = new Date().toISOString().split('T')[0];
            }
        } else {
            // No date provided, use today
            dateValue = new Date().toISOString().split('T')[0];
        }
        
        // Insert itinerary
        const result = await query(`
            INSERT INTO itinerary (day, date, place, city, state, country, lat, lng, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            parseInt(day), 
            dateValue, 
            place, 
            city || null, 
            state || null, 
            country || 'India', 
            parseFloat(lat), 
            parseFloat(lng), 
            description || ''
        ]);
        
        const itineraryId = result.insertId;
        
        // Insert activities
        if (activities && Array.isArray(activities) && activities.length > 0) {
            for (let i = 0; i < activities.length; i++) {
                const activity = activities[i];
                // Handle different activity formats
                const activityTime = activity.time || activity.Time || '';
                const activityText = activity.activity || activity.place || activity.Place || activity.description || '';
                
                if (activityText) { // Only insert if there's actual activity text
                    await query(`
                        INSERT INTO itinerary_activities (itinerary_id, time, activity, display_order)
                        VALUES (?, ?, ?, ?)
                    `, [itineraryId, activityTime, activityText, i]);
                }
            }
        }
        
        // Insert images
        if (images && Array.isArray(images) && images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                const imageUrl = images[i];
                if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
                    await query(`
                        INSERT INTO itinerary_images (itinerary_id, image_url, display_order)
                        VALUES (?, ?, ?)
                    `, [itineraryId, imageUrl.trim(), i]);
                }
            }
        }
        
        res.status(201).json({ 
            id: itineraryId, 
            message: 'Itinerary day created successfully' 
        });
    } catch (error) {
        console.error('Error creating itinerary:', error);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to create itinerary day',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Update itinerary day
// Update itinerary day (protected - requires admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            day, date, dateObj, place, city, state, country, lat, lng,
            description, activities, images
        } = req.body;
        
        // Parse date - prefer dateObj if available, otherwise parse date string
        let dateValue = date;
        if (dateObj) {
            // If dateObj is provided, use it
            dateValue = new Date(dateObj).toISOString().split('T')[0];
        } else if (date) {
            // Try to parse the date string (could be formatted like "29 Nov 2024" or ISO format)
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                dateValue = parsedDate.toISOString().split('T')[0];
            } else {
                // If parsing fails, use today's date as fallback
                dateValue = new Date().toISOString().split('T')[0];
            }
        } else {
            // No date provided, use today
            dateValue = new Date().toISOString().split('T')[0];
        }
        
        // Update itinerary
        await query(`
            UPDATE itinerary 
            SET day = ?, date = ?, place = ?, city = ?, state = ?, country = ?, 
                lat = ?, lng = ?, description = ?
            WHERE id = ?
        `, [day, dateValue, place, city, state, country, lat, lng, description, req.params.id]);
        
        // Delete old activities and images
        await query('DELETE FROM itinerary_activities WHERE itinerary_id = ?', [req.params.id]);
        await query('DELETE FROM itinerary_images WHERE itinerary_id = ?', [req.params.id]);
        
        // Insert new activities
        if (activities && Array.isArray(activities) && activities.length > 0) {
            for (let i = 0; i < activities.length; i++) {
                const activity = activities[i];
                // Handle different activity formats
                const activityTime = activity.time || activity.Time || '';
                const activityText = activity.activity || activity.place || activity.Place || activity.description || '';
                
                if (activityText) { // Only insert if there's actual activity text
                    await query(`
                        INSERT INTO itinerary_activities (itinerary_id, time, activity, display_order)
                        VALUES (?, ?, ?, ?)
                    `, [req.params.id, activityTime, activityText, i]);
                }
            }
        }
        
        // Insert new images
        if (images && Array.isArray(images) && images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                const imageUrl = images[i];
                if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
                    await query(`
                        INSERT INTO itinerary_images (itinerary_id, image_url, display_order)
                        VALUES (?, ?, ?)
                    `, [req.params.id, imageUrl.trim(), i]);
                }
            }
        }
        
        res.json({ message: 'Itinerary day updated successfully' });
    } catch (error) {
        console.error('Error updating itinerary:', error);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to update itinerary day',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Delete itinerary day
// Delete itinerary day (protected - requires admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await query('DELETE FROM itinerary WHERE id = ?', [req.params.id]);
        res.json({ message: 'Itinerary day deleted successfully' });
    } catch (error) {
        console.error('Error deleting itinerary:', error);
        res.status(500).json({ error: 'Failed to delete itinerary day' });
    }
});

module.exports = router;

