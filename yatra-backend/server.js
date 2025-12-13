const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { testConnection } = require('./config/database');

// Import routes
const travelersRoutes = require('./routes/travelers');
const itineraryRoutes = require('./routes/itinerary');
const vehiclesRoutes = require('./routes/vehicles');
const postsRoutes = require('./routes/posts');
const roomPairsRoutes = require('./routes/roomPairs');
const checkInsRoutes = require('./routes/checkIns');
const settingsRoutes = require('./routes/settings');
const hotelsRoutes = require('./routes/hotels');
const adminRoutes = require('./routes/admin');
const sectionsRoutes = require('./routes/sections');
const journalsRoutes = require('./routes/journals');
const announcementsRoutes = require('./routes/announcements');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS configuration - handle preflight requests
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [];
        
        // Auto-allow aksharjobs.com domain
        const aksharjobsDomains = [
            'https://aksharjobs.com',
            'http://aksharjobs.com',
            'https://www.aksharjobs.com',
            'http://www.aksharjobs.com'
        ];
        
        // Auto-allow Vercel domains
        const isVercelDomain = origin && (
            origin.includes('.vercel.app') || 
            origin.includes('vercel.app')
        );
        
        // Auto-allow Cloudflare Pages domains
        const isCloudflarePagesDomain = origin && (
            origin.includes('.pages.dev') || 
            origin.includes('pages.dev')
        );
        
        // In production, reject if no CORS_ORIGIN is set (unless aksharjobs.com, Vercel, or Cloudflare Pages is detected)
        if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
            // Allow if origin is from aksharjobs.com, Vercel, or Cloudflare Pages
            if (origin && (aksharjobsDomains.some(domain => origin.startsWith(domain)) || isVercelDomain || isCloudflarePagesDomain)) {
                return callback(null, true);
            }
            console.error('⚠️  SECURITY WARNING: CORS_ORIGIN not set in production!');
            return callback(new Error('CORS configuration required in production'));
        }
        
        // Allow requests with no origin (mobile apps, Postman, etc.) only in development
        if (!origin) {
            if (process.env.NODE_ENV === 'production') {
                return callback(new Error('Origin required in production'));
            }
            return callback(null, true);
        }
        
        // Check if origin is allowed (including aksharjobs.com, Vercel, and Cloudflare Pages)
        if (allowedOrigins.includes(origin) || 
            aksharjobsDomains.some(domain => origin.startsWith(domain)) || 
            isVercelDomain ||
            isCloudflarePagesDomain) {
            callback(null, true);
        } else {
            console.warn(`🚫 CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
// Increase body parser limit to handle large base64 images (50MB limit)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('✅ Health check requested');
    res.status(200).json({ 
        status: 'ok', 
        message: 'Yatra API Server is running',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/travelers', travelersRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/room-pairs', roomPairsRoutes);
app.use('/api/check-ins', checkInsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/hotels', hotelsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sections', sectionsRoutes);
app.use('/api/journals', journalsRoutes);
app.use('/api/announcements', announcementsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found', 
        message: `Route ${req.method} ${req.path} not found` 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server
async function startServer() {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.error('⚠️  Warning: Database connection failed. Server will start but API calls may fail.');
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Yatra API Server running on http://0.0.0.0:${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

