const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all sections (protected read)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const sections = await query(`
            SELECT id, name, description, display_order, created_at
            FROM post_sections
            ORDER BY display_order ASC, id ASC
        `);
        
        // Count posts per section
        const sectionsWithCount = await Promise.all(sections.map(async (section) => {
            const [countResult] = await query(
                'SELECT COUNT(*) as count FROM posts WHERE section_id = ?',
                [section.id]
            );
            return {
                id: section.id,
                name: section.name,
                description: section.description,
                display_order: section.display_order,
                count: countResult ? countResult.count : 0,
                created_at: section.created_at
            };
        }));
        
        res.json(sectionsWithCount);
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
});

// Get single section (protected read)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [section] = await query(
            'SELECT * FROM post_sections WHERE id = ?',
            [req.params.id]
        );
        
        if (!section) {
            return res.status(404).json({ error: 'Section not found' });
        }
        
        res.json(section);
    } catch (error) {
        console.error('Error fetching section:', error);
        res.status(500).json({ error: 'Failed to fetch section' });
    }
});

// Create new section (protected - requires admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, display_order } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Section name is required' });
        }
        
        // Check if section with same name already exists
        const [existing] = await query(
            'SELECT id FROM post_sections WHERE LOWER(name) = LOWER(?)',
            [name.trim()]
        );
        
        if (existing) {
            return res.status(400).json({ error: 'Section with this name already exists' });
        }
        
        // Get next display_order if not provided
        let order = display_order;
        if (order === undefined || order === null) {
            const [maxOrder] = await query(
                'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM post_sections'
            );
            order = maxOrder ? maxOrder.next_order : 1;
        }
        
        const result = await query(`
            INSERT INTO post_sections (name, description, display_order)
            VALUES (?, ?, ?)
        `, [name.trim(), description ? description.trim() : null, order]);
        
        res.status(201).json({ 
            id: result.insertId, 
            message: 'Section created successfully' 
        });
    } catch (error) {
        console.error('Error creating section:', error);
        res.status(500).json({ error: 'Failed to create section' });
    }
});

// Update section (protected - requires admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, display_order } = req.body;
        const sectionId = req.params.id;
        
        // Check if section exists
        const [existing] = await query(
            'SELECT id FROM post_sections WHERE id = ?',
            [sectionId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Section not found' });
        }
        
        // Check if name is being changed and if new name conflicts
        if (name && name.trim()) {
            const [nameConflict] = await query(
                'SELECT id FROM post_sections WHERE LOWER(name) = LOWER(?) AND id != ?',
                [name.trim(), sectionId]
            );
            
            if (nameConflict) {
                return res.status(400).json({ error: 'Section with this name already exists' });
            }
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description ? description.trim() : null);
        }
        if (display_order !== undefined) {
            updates.push('display_order = ?');
            values.push(display_order);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        values.push(sectionId);
        
        await query(`
            UPDATE post_sections 
            SET ${updates.join(', ')}
            WHERE id = ?
        `, values);
        
        res.json({ message: 'Section updated successfully' });
    } catch (error) {
        console.error('Error updating section:', error);
        res.status(500).json({ error: 'Failed to update section' });
    }
});

// Delete section (protected - requires admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const sectionId = req.params.id;
        
        // Check if section exists
        const [existing] = await query(
            'SELECT id FROM post_sections WHERE id = ?',
            [sectionId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Section not found' });
        }
        
        // Check if section is being used by any posts
        const [postsUsingSection] = await query(
            'SELECT COUNT(*) as count FROM posts WHERE section_id = ?',
            [sectionId]
        );
        
        if (postsUsingSection && postsUsingSection.count > 0) {
            return res.status(400).json({ 
                error: `Cannot delete section. It is being used by ${postsUsingSection.count} post(s). Please update or delete those posts first.` 
            });
        }
        
        await query('DELETE FROM post_sections WHERE id = ?', [sectionId]);
        res.json({ message: 'Section deleted successfully' });
    } catch (error) {
        console.error('Error deleting section:', error);
        res.status(500).json({ error: 'Failed to delete section' });
    }
});

module.exports = router;

