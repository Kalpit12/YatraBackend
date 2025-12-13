const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all posts (protected read)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { approved, section, author, limit, offset } = req.query;
        
        // Check if is_private column exists, if not, add it
        try {
            const [columnCheck] = await query(`
                SELECT COUNT(*) as count 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'posts' 
                AND COLUMN_NAME = 'is_private'
            `);
            
            if (!columnCheck || columnCheck.count === 0) {
                // Column doesn't exist, add it
                await query(`
                    ALTER TABLE posts 
                    ADD COLUMN is_private BOOLEAN DEFAULT FALSE
                `);
                console.log('✅ Added is_private column to posts table');
            }
        } catch (alterError) {
            // Error checking or adding column
            console.warn('⚠️ Could not check/add is_private column:', alterError.message);
        }
        
        let sql = `
            SELECT 
                p.*,
                GROUP_CONCAT(DISTINCT pt.tag_name) as tags
            FROM posts p
            LEFT JOIN post_tags pt ON p.id = pt.post_id
            WHERE 1=1
        `;
        const params = [];
        
        // If not admin, only show approved posts
        // If admin and no approved filter specified, show ALL posts (including unapproved)
        if (!req.user || !req.user.isAdmin) {
            sql += ' AND p.approved = ?';
            params.push(true);
        } else if (approved !== undefined) {
            // Admins can filter by approval status if explicitly requested
            sql += ' AND p.approved = ?';
            params.push(approved === 'true');
        }
        // If admin and approved is undefined, show all posts (no filter)
        if (section) {
            sql += ' AND p.section_id = ?';
            params.push(section);
        }
        if (author) {
            sql += ' AND p.author_email = ?';
            params.push(author);
        }
        
        sql += ' GROUP BY p.id ORDER BY p.created_at DESC';
        
        if (limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(limit));
            if (offset) {
                sql += ' OFFSET ?';
                params.push(parseInt(offset));
            }
        }
        
        const posts = await query(sql, params);
        
        // Get media for all posts separately (to avoid issues with base64 URLs containing special chars)
        const postIds = posts.map(p => p.id);
        let allMedia = [];
        if (postIds.length > 0) {
            const placeholders = postIds.map(() => '?').join(',');
            // First, ensure the column is LONGTEXT to handle very long base64 URLs
            try {
                await query(`
                    ALTER TABLE post_media 
                    MODIFY COLUMN media_url LONGTEXT NOT NULL
                `);
                console.log('✅ Ensured media_url column is LONGTEXT');
            } catch (alterError) {
                // Column might already be LONGTEXT or we don't have permission
                console.log('ℹ️ Could not alter column (may already be correct):', alterError.message);
            }
            
            allMedia = await query(
                `SELECT post_id, 
                        media_url, 
                        media_type, 
                        display_order,
                        LENGTH(media_url) as url_length,
                        CHAR_LENGTH(media_url) as char_length
                 FROM post_media 
                 WHERE post_id IN (${placeholders}) 
                 ORDER BY post_id, display_order, id`,
                postIds
            );
            
            // Debug: Check if URLs are being truncated
            allMedia.forEach(m => {
                const retrievedLength = m.media_url ? m.media_url.length : 0;
                const storedLength = m.url_length || 0;
                
                if (storedLength > 0 && retrievedLength !== storedLength) {
                    console.error(`⚠️ URL TRUNCATION DETECTED for post ${m.post_id}!`);
                    console.error(`   Stored length: ${storedLength}, Retrieved length: ${retrievedLength}`);
                    console.error(`   Retrieved preview: ${m.media_url ? m.media_url.substring(0, 100) : 'null'}...`);
                }
                
                // Check if URL is suspiciously short
                if (m.media_url && m.media_url.startsWith('data:image/') && retrievedLength < 50) {
                    console.error(`❌ CRITICAL: URL appears truncated for post ${m.post_id}! Length: ${retrievedLength}`);
                    console.error(`   URL: ${m.media_url}`);
                }
            });
            
            // Debug: Log media URLs to verify they're being retrieved correctly
            allMedia.forEach(m => {
                if (m.media_url) {
                    const preview = m.media_url.substring(0, 100);
                    console.log(`📸 Retrieved media for post ${m.post_id}: length=${m.url_length}, starts with: ${preview}...`);
                    
                    // Check if prefix is present
                    if (!m.media_url.startsWith('data:') && !m.media_url.startsWith('http://') && !m.media_url.startsWith('https://')) {
                        console.error(`❌ CRITICAL: Media URL missing prefix for post ${m.post_id}! URL starts with: ${preview}`);
                    }
                }
            });
        }
        
        // Group media by post_id
        const mediaByPostId = {};
        allMedia.forEach(m => {
            if (!mediaByPostId[m.post_id]) {
                mediaByPostId[m.post_id] = [];
            }
            
            // Validate and clean media URL
            let mediaUrl = m.media_url || '';
            
            // Check if URL is just base64 data without prefix (starts with /9j/ or similar)
            // This happens when the data: prefix is missing
            if (mediaUrl && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://') && !mediaUrl.startsWith('/')) {
                // Looks like raw base64 data without prefix - skip it
                if (!mediaByPostId[m.post_id] || mediaByPostId[m.post_id].length === 0) {
                    console.warn(`⚠️ Invalid URL format for post ${m.post_id}: missing data: prefix (starts with: ${mediaUrl.substring(0, 20)}...)`);
                }
                return; // Skip this corrupted URL
            }
            
            // Check if URL is truncated (base64 URLs should be much longer)
            if (mediaUrl.startsWith('data:image/') || mediaUrl.startsWith('data:video/')) {
                // Base64 data URLs should be at least 100 chars (header + minimal data)
                if (mediaUrl.length < 100) {
                    if (!mediaByPostId[m.post_id] || mediaByPostId[m.post_id].length === 0) {
                        console.warn(`⚠️ Suspiciously short base64 URL for post ${m.post_id}: ${mediaUrl.substring(0, 50)}... (length: ${mediaUrl.length})`);
                    }
                    // Skip invalid URLs
                    return;
                }
                
                // Validate base64 format: should have comma after base64 prefix
                const commaIndex = mediaUrl.indexOf(',');
                if (commaIndex === -1 || commaIndex < 20) {
                    // Only log once per post to avoid spam
                    if (!mediaByPostId[m.post_id] || mediaByPostId[m.post_id].length === 0) {
                        console.warn(`⚠️ Invalid base64 URL for post ${m.post_id}: missing comma separator (skipping corrupted media)`);
                    }
                    // Skip this corrupted URL silently
                    return;
                }
            }
            
            // Ensure URL is preserved exactly - convert to string to prevent any issues
            const finalUrl = String(mediaUrl || '').trim();
            
            // Log for debugging
            if (finalUrl && finalUrl.length > 0) {
                console.log(`✅ Adding media for post ${m.post_id}: length=${finalUrl.length}, starts with: ${finalUrl.substring(0, 50)}...`);
                
                // Verify the URL is complete
                if (finalUrl.startsWith('data:image/') || finalUrl.startsWith('data:video/')) {
                    if (!finalUrl.includes(',')) {
                        console.error(`❌ ERROR: Data URL missing comma for post ${m.post_id}! URL: ${finalUrl.substring(0, 100)}`);
                        return; // Skip this corrupted URL
                    }
                }
            }
            
            mediaByPostId[m.post_id].push({
                type: m.media_type || (finalUrl && finalUrl.startsWith('data:video/') ? 'video' : 'image'),
                url: finalUrl // Use the validated URL
            });
        });
        
        // Format response
        const formatted = posts.map(post => {
            // Get media for this post
            const media = mediaByPostId[post.id] || [];
            
            return {
                id: post.id,
                author: post.author_name || post.author_email,
                email: post.author_email,
                authorImage: post.author_image_url || '',
                place: post.place,
                location: post.location,
                section: post.section_id,
                description: post.description,
                timestamp: post.created_at.toISOString(),
                lat: post.lat ? parseFloat(post.lat) : null,
                lng: post.lng ? parseFloat(post.lng) : null,
                approved: post.approved === 1,
                isPrivate: post.is_private === 1 || post.is_private === true || false,
                media: media,
                tags: post.tags ? post.tags.split(',') : []
            };
        });
        
        console.log(`📊 Fetched ${formatted.length} posts with media`);
        
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Get single post (public read - but check approval for non-authenticated users)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [post] = await query(
            'SELECT * FROM posts WHERE id = ?',
            [req.params.id]
        );
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // If not authenticated or not admin, only show approved posts
        if (!req.user || !req.user.isAdmin) {
            if (!post.approved) {
                return res.status(403).json({ error: 'Post not available' });
            }
        }
        
        // Get media with type information
        const media = await query(
            'SELECT media_url, media_type, display_order FROM post_media WHERE post_id = ? ORDER BY display_order, id',
            [req.params.id]
        );
        
        // Get tags
        const tags = await query(
            'SELECT tag_name FROM post_tags WHERE post_id = ?',
            [req.params.id]
        );
        
        // Format media as objects with url and type
        const formattedMedia = media.map(m => ({
            type: m.media_type || (m.media_url && m.media_url.startsWith('data:video/') ? 'video' : 'image'),
            url: m.media_url
        }));
        
        res.json({
            id: post.id,
            author: post.author_name || post.author_email,
            email: post.author_email,
            authorImage: post.author_image_url || '',
            place: post.place,
            location: post.location,
            section: post.section_id,
            description: post.description,
            timestamp: post.created_at.toISOString(),
            lat: post.lat ? parseFloat(post.lat) : null,
            lng: post.lng ? parseFloat(post.lng) : null,
            approved: post.approved === 1,
            media: formattedMedia,
            tags: tags.map(t => t.tag_name)
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Failed to fetch post' });
    }
});

// Create new post (protected - requires authentication, users can create their own posts)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            authorEmail, authorName, authorImage, place, location,
            section, description, lat, lng, media, tags, approved,
            // Support legacy field names
            email, author
        } = req.body;
        
        // Ensure the post is created by the authenticated user (unless admin)
        const postAuthorEmail = authorEmail || email || req.user.email;
        if (!req.user.isAdmin && postAuthorEmail !== req.user.email) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You can only create posts for yourself'
            });
        }
        
        // Helper function to convert undefined to null
        const toNull = (val) => (val === undefined || val === '') ? null : val;
        const toEmpty = (val) => (val === undefined || val === null) ? '' : String(val);
        
        // Section name to ID mapping (if sections table exists, query it; otherwise use mapping)
        const getSectionId = async (sectionNameOrId) => {
            if (!sectionNameOrId) {
                console.log('📝 Section is empty, returning null');
                return null;
            }
            
            // If it's already a number, return it as integer
            const numId = parseInt(sectionNameOrId);
            if (!isNaN(numId) && numId > 0) {
                console.log(`📝 Section is already a number: ${numId}`);
                return numId;
            }
            
            // Try to find section in database first (table is called 'post_sections')
            try {
                // Check if post_sections table exists
                const [tableCheck] = await query(
                    `SELECT COUNT(*) as count FROM information_schema.tables 
                     WHERE table_schema = DATABASE() AND table_name = 'post_sections'`
                );
                
                if (tableCheck && tableCheck.count > 0) {
                    // Table exists, try to query it
                    const [sectionRow] = await query(
                        'SELECT id FROM post_sections WHERE name = ? OR LOWER(name) = LOWER(?) LIMIT 1',
                        [sectionNameOrId, sectionNameOrId]
                    );
                    if (sectionRow && sectionRow.id) {
                        console.log(`📝 Found section in database: "${sectionNameOrId}" → ${sectionRow.id}`);
                        return sectionRow.id;
                    }
                } else {
                    console.log(`📝 post_sections table doesn't exist, using mapping`);
                }
            } catch (e) {
                // post_sections table might not exist or query failed, use mapping
                console.log(`📝 post_sections table query failed, using mapping: ${e.message}`);
            }
            
            // Fallback: Map common section names to IDs
            const sectionMap = {
                'temples': 1,
                'temple': 1,
                'experiences': 2,
                'experience': 2,
                'food': 3,
                'travel': 4,
                'accommodation': 5,
                'culture': 6,
                'nature': 7,
                'scenic': 8,
                'events': 9,
                'event': 9,
                'heritage': 10
            };
            
            const lowerSection = String(sectionNameOrId).toLowerCase().trim();
            const mappedId = sectionMap[lowerSection];
            
            if (mappedId) {
                console.log(`📝 Mapped section name to ID: "${sectionNameOrId}" → ${mappedId}`);
                return mappedId;
            } else {
                console.warn(`⚠️ Section "${sectionNameOrId}" not found in mapping, returning null`);
                return null;
            }
        };
        
        // Use provided values or fallback to legacy names
        const finalAuthorEmail = authorEmail || email || '';
        const finalAuthorName = authorName || author || '';
        const finalAuthorImage = toEmpty(authorImage);
        const finalPlace = toEmpty(place);
        const finalLocation = toEmpty(location);
        
        // Convert section name to ID (MUST be done before INSERT)
        const finalSection = await getSectionId(section);
        console.log(`📝 Section conversion: "${section}" → ${finalSection}`);
        
        const finalDescription = toEmpty(description);
        const finalLat = toNull(lat);
        const finalLng = toNull(lng);
        const finalApproved = approved !== undefined ? (approved === true || approved === 'true') : false;
        
        // Validate finalSection is a number or null - CRITICAL CHECK
        let sectionIdForInsert = null;
        if (finalSection !== null && finalSection !== undefined) {
            const parsedId = parseInt(finalSection);
            if (!isNaN(parsedId) && parsedId > 0) {
                sectionIdForInsert = parsedId;
            } else {
                console.error(`❌ Invalid section_id: ${finalSection} (type: ${typeof finalSection})`);
                return res.status(400).json({ 
                    error: `Invalid section: "${section}". Section must be a valid ID or name. Received: ${finalSection} (${typeof finalSection})` 
                });
            }
        }
        
        console.log(`📦 Inserting post with section_id: ${sectionIdForInsert} (original: "${section}")`);
        
        // Handle isPrivate field (add column if it doesn't exist)
        const finalIsPrivate = req.body.isPrivate !== undefined ? (req.body.isPrivate === true || req.body.isPrivate === 'true') : false;
        
        // Check if is_private column exists, if not, add it
        try {
            // Check if column exists first
            const [columnCheck] = await query(`
                SELECT COUNT(*) as count 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'posts' 
                AND COLUMN_NAME = 'is_private'
            `);
            
            if (!columnCheck || columnCheck.count === 0) {
                // Column doesn't exist, add it
                await query(`
                    ALTER TABLE posts 
                    ADD COLUMN is_private BOOLEAN DEFAULT FALSE
                `);
                console.log('✅ Added is_private column to posts table');
            }
        } catch (alterError) {
            // Error checking or adding column
            console.warn('⚠️ Could not check/add is_private column:', alterError.message);
        }
        
        // Insert post
        const result = await query(`
            INSERT INTO posts (
                author_email, author_name, author_image_url, place, location,
                section_id, description, lat, lng, approved, is_private
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            finalAuthorEmail, finalAuthorName, finalAuthorImage, finalPlace, finalLocation,
            sectionIdForInsert, finalDescription, finalLat, finalLng, finalApproved, finalIsPrivate
        ]);
        
        const postId = result.insertId;
        
        // Insert media
        if (media && media.length > 0) {
            for (let i = 0; i < media.length; i++) {
                // Handle both URL strings and media objects with url property
                let mediaUrl = typeof media[i] === 'string' ? media[i] : (media[i].url || media[i].data || '');
                
                if (mediaUrl) {
                    // Log the URL length and preview for debugging
                    console.log(`📸 Inserting media ${i + 1}/${media.length} for post ${postId}:`);
                    console.log(`   URL length: ${mediaUrl.length} chars`);
                    console.log(`   URL preview: ${mediaUrl.substring(0, 100)}...`);
                    
                    // Validate URL format
                    if (mediaUrl.startsWith('data:') && !mediaUrl.includes(',')) {
                        console.error(`❌ Invalid base64 URL: missing comma separator`);
                        continue; // Skip this media item
                    }
                    
                    // Check if column type can handle the length
                    // TEXT can hold up to 65,535 bytes, LONGTEXT can hold up to 4GB
                    // Base64 data URLs can be very long, so we need to ensure column is TEXT or LONGTEXT
                    
                    try {
                        await query(`
                            INSERT INTO post_media (post_id, media_url, display_order, media_type)
                            VALUES (?, ?, ?, ?)
                        `, [
                            postId, 
                            mediaUrl, 
                            i,
                            (mediaUrl.startsWith('data:video/') ? 'video' : 'image')
                        ]);
                        console.log(`✅ Inserted media ${i + 1}/${media.length} (length: ${mediaUrl.length} chars)`);
                        
                        // Verify what was actually stored
                        const [stored] = await query(
                            'SELECT media_url, LENGTH(media_url) as url_length FROM post_media WHERE id = LAST_INSERT_ID()'
                        );
                        if (stored && stored.url_length !== mediaUrl.length) {
                            console.error(`⚠️ URL length mismatch! Stored: ${stored.url_length}, Original: ${mediaUrl.length}`);
                            console.error(`   Stored preview: ${stored.media_url.substring(0, 100)}...`);
                        }
                    } catch (mediaError) {
                        if (mediaError.code === 'ER_DATA_TOO_LONG') {
                            console.error(`❌ Media URL too long for column. Length: ${mediaUrl.length} chars`);
                            console.error(`   The media_url column needs to be TEXT or LONGTEXT, not VARCHAR`);
                            
                            // Try to alter the column type if possible
                            try {
                                await query(`
                                    ALTER TABLE post_media 
                                    MODIFY COLUMN media_url LONGTEXT NOT NULL
                                `);
                                console.log(`✅ Altered media_url column to LONGTEXT`);
                                
                                // Retry the insert
                                await query(`
                                    INSERT INTO post_media (post_id, media_url, display_order, media_type)
                                    VALUES (?, ?, ?, ?)
                                `, [
                                    postId, 
                                    mediaUrl, 
                                    i,
                                    (mediaUrl.startsWith('data:video/') ? 'video' : 'image')
                                ]);
                                console.log(`✅ Successfully inserted media after column alteration`);
                            } catch (alterError) {
                                console.error(`❌ Failed to alter column: ${alterError.message}`);
                                throw new Error(`Media URL is too long (${mediaUrl.length} chars). Please alter the post_media.media_url column to LONGTEXT type.`);
                            }
                        } else {
                            throw mediaError;
                        }
                    }
                }
            }
        }
        
        // Insert tags
        if (tags && tags.length > 0) {
            for (const tag of tags) {
                await query(`
                    INSERT INTO post_tags (post_id, tag_name)
                    VALUES (?, ?)
                `, [postId, tag]);
            }
        }
        
        console.log(`✅ Post created successfully: ID=${postId}, Author=${finalAuthorEmail}, Approved=${finalApproved}, Private=${finalIsPrivate}`);
        
        res.status(201).json({ 
            id: postId, 
            message: 'Post created successfully',
            approved: finalApproved,
            isPrivate: finalIsPrivate
        });
    } catch (error) {
        console.error('❌ Error creating post:', error);
        console.error('Error stack:', error.stack);
        console.error('Request body:', {
            authorEmail: req.body.authorEmail || req.body.email,
            place: req.body.place,
            hasMedia: !!(req.body.media && req.body.media.length > 0),
            mediaCount: req.body.media ? req.body.media.length : 0
        });
        res.status(500).json({ 
            error: 'Failed to create post',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Update post (protected - users can update own posts, admins can update any)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (!Number.isFinite(postId) || postId <= 0) {
            return res.status(400).json({ error: 'Invalid post ID' });
        }
        
        // Check if user owns the post or is admin
        const [post] = await query('SELECT author_email FROM posts WHERE id = ?', [postId]);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        if (!req.user.isAdmin && post.author_email !== req.user.email) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You can only update your own posts'
            });
        }
        
        const {
            place, location, section, description, lat, lng,
            media, tags, approved
        } = req.body;
        
        // Update post
        const updateFields = [];
        const updateValues = [];
        
        if (place) { updateFields.push('place = ?'); updateValues.push(place); }
        if (location) { updateFields.push('location = ?'); updateValues.push(location); }
        if (section !== undefined) { updateFields.push('section_id = ?'); updateValues.push(section); }
        if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }
        if (lat !== undefined) { updateFields.push('lat = ?'); updateValues.push(lat); }
        if (lng !== undefined) { updateFields.push('lng = ?'); updateValues.push(lng); }
        // Only admins can change approval status
        if (approved !== undefined && req.user.isAdmin) { 
            updateFields.push('approved = ?'); 
            updateValues.push(approved); 
        }
        
        if (updateFields.length > 0) {
            updateValues.push(postId);
            await query(
                `UPDATE posts SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
        }
        
        // Update media if provided
        if (media !== undefined) {
            await query('DELETE FROM post_media WHERE post_id = ?', [postId]);
            if (media.length > 0) {
                for (let i = 0; i < media.length; i++) {
                    await query(`
                        INSERT INTO post_media (post_id, media_url, display_order)
                        VALUES (?, ?, ?)
                    `, [postId, media[i], i]);
                }
            }
        }
        
        // Update tags if provided
        if (tags !== undefined) {
            await query('DELETE FROM post_tags WHERE post_id = ?', [postId]);
            if (tags.length > 0) {
                for (const tag of tags) {
                    await query(`
                        INSERT INTO post_tags (post_id, tag_name)
                        VALUES (?, ?)
                    `, [postId, tag]);
                }
            }
        }
        
        res.json({ message: 'Post updated successfully' });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// Delete post (protected - users can delete own posts, admins can delete any)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (!Number.isFinite(postId) || postId <= 0) {
            return res.status(400).json({ error: 'Invalid post ID' });
        }
        
        // Check if user owns the post or is admin
        const [post] = await query('SELECT author_email FROM posts WHERE id = ?', [postId]);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        if (!req.user.isAdmin && post.author_email !== req.user.email) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You can only delete your own posts'
            });
        }
        
        await query('DELETE FROM posts WHERE id = ?', [postId]);
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// Approve/Disapprove post (protected - requires admin)
router.patch('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (!Number.isFinite(postId) || postId <= 0) {
            return res.status(400).json({ error: 'Invalid post ID' });
        }
        
        const { approved } = req.body;
        const approvedValue = approved === true || approved === 'true' || approved === 1;
        
        console.log(`📝 Approving post ${postId}: approved = ${approvedValue}`);
        
        await query(
            'UPDATE posts SET approved = ? WHERE id = ?',
            [approvedValue, postId]
        );
        
        // Verify the update and return updated post data
        const [updatedPost] = await query('SELECT id, approved, author_email, place, is_private FROM posts WHERE id = ?', [postId]);
        if (updatedPost) {
            console.log(`✅ Post ${postId} approval status updated: approved = ${updatedPost.approved}`);
            res.json({ 
                message: `Post ${approvedValue ? 'approved' : 'disapproved'} successfully`,
                post: {
                    id: updatedPost.id,
                    approved: updatedPost.approved === 1 || updatedPost.approved === true,
                    isPrivate: updatedPost.is_private === 1 || updatedPost.is_private === true,
                    author_email: updatedPost.author_email,
                    place: updatedPost.place
                }
            });
        } else {
            console.error(`❌ Post ${postId} not found after update`);
            res.status(404).json({ error: 'Post not found after update' });
        }
    } catch (error) {
        console.error('Error updating post approval:', error);
        res.status(500).json({ error: 'Failed to update post approval' });
    }
});

module.exports = router;

