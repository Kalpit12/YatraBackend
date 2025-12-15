/**
 * Yatra API Integration Module
 * Replace localStorage with MySQL database API calls
 */

// API Configuration
// For local development: 'http://localhost:3000/api'
// Production: Railway backend URL
const API_BASE = (() => {
    // Auto-detect: if running on localhost, use localhost API, otherwise use production API
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    // Production backend URL
    return 'https://yatrabackend-production.up.railway.app/api';
})();
let API_CACHE = {}; // Cache for offline support
let API_CACHE_TIMESTAMP = {};

// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Get authentication token from localStorage
 */
function getAuthToken() {
    try {
        const adminData = localStorage.getItem('adminData');
        if (adminData) {
            const admin = JSON.parse(adminData);
            return admin.token || null;
        }
    } catch (e) {
        console.error('Error getting auth token:', e);
    }
    return null;
}

/**
 * API Helper Functions
 */
const api = {
    /**
     * Generic fetch wrapper with error handling and caching
     */
    async fetch(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const cacheKey = `${options.method || 'GET'}_${endpoint}`;
        
        // Check cache first (for GET requests)
        if (!options.method || options.method === 'GET') {
            const cached = API_CACHE[cacheKey];
            const cachedTime = API_CACHE_TIMESTAMP[cacheKey];
            if (cached && cachedTime && (Date.now() - cachedTime) < CACHE_DURATION) {
                console.log(`📦 Using cached data for ${endpoint}`);
                return cached;
            }
        }
        
        // Get auth token and add to headers
        const token = getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: headers
            });
            
            if (!response.ok) {
                // Try to get error message from response body
                let errorMessage = `${response.status} ${response.statusText}`;
                try {
                    // Read response as text first, then try to parse as JSON
                    const text = await response.text();
                    if (text) {
                        try {
                            const errorData = JSON.parse(text);
                            if (errorData.message) {
                                errorMessage = errorData.message;
                            } else if (errorData.error) {
                                errorMessage = errorData.error;
                            } else {
                                errorMessage = JSON.stringify(errorData);
                            }
                            console.error(`❌ Backend error details:`, errorData);
                        } catch (e) {
                            // Not JSON, use text as error message
                            errorMessage = text;
                            console.error(`❌ Backend error text:`, text);
                        }
                    }
                } catch (e) {
                    // Use default error message
                    console.error(`❌ Could not read error response:`, e);
                }
                throw new Error(`API Error: ${errorMessage}`);
            }
            
            const data = await response.json();
            
            // Cache GET requests
            if (!options.method || options.method === 'GET') {
                API_CACHE[cacheKey] = data;
                API_CACHE_TIMESTAMP[cacheKey] = Date.now();
            }
            
            return data;
        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error);
            
            // Return cached data if available (offline support)
            if (API_CACHE[cacheKey]) {
                console.log(`⚠️ Using cached data (offline mode)`);
                return API_CACHE[cacheKey];
            }
            
            throw error;
        }
    },
    
    // ==================== TRAVELERS ====================
    async getTravelers() {
        return this.fetch('/travelers');
    },
    
    async getTraveler(id) {
        return this.fetch(`/travelers/${id}`);
    },
    
    async getTravelerByEmail(email) {
        return this.fetch(`/travelers/email/${email}`);
    },
    
    async createTraveler(traveler) {
        return this.fetch('/travelers', {
            method: 'POST',
            body: JSON.stringify(traveler)
        });
    },
    
    async updateTraveler(id, traveler) {
        return this.fetch(`/travelers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(traveler)
        });
    },
    
    async deleteTraveler(id) {
        return this.fetch(`/travelers/${id}`, {
            method: 'DELETE'
        });
    },
    
    async loginTraveler(email, password) {
        return this.fetch('/travelers/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    // ==================== ITINERARY ====================
    async getItinerary() {
        return this.fetch('/itinerary');
    },
    
    async getItineraryDay(id) {
        return this.fetch(`/itinerary/${id}`);
    },
    
    async createItineraryDay(day) {
        return this.fetch('/itinerary', {
            method: 'POST',
            body: JSON.stringify(day)
        });
    },
    
    async updateItineraryDay(id, day) {
        return this.fetch(`/itinerary/${id}`, {
            method: 'PUT',
            body: JSON.stringify(day)
        });
    },
    
    async deleteItineraryDay(id) {
        return this.fetch(`/itinerary/${id}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== VEHICLES ====================
    async getVehicles() {
        return this.fetch('/vehicles');
    },
    
    async getVehicle(id) {
        return this.fetch(`/vehicles/${id}`);
    },
    
    async createVehicle(vehicle) {
        return this.fetch('/vehicles', {
            method: 'POST',
            body: JSON.stringify(vehicle)
        });
    },
    
    async updateVehicle(id, vehicle) {
        return this.fetch(`/vehicles/${id}`, {
            method: 'PUT',
            body: JSON.stringify(vehicle)
        });
    },
    
    async updateVehicleLocation(id, lat, lng) {
        return this.fetch(`/vehicles/${id}/location`, {
            method: 'POST',
            body: JSON.stringify({ lat, lng })
        });
    },
    
    async deleteVehicle(id) {
        return this.fetch(`/vehicles/${id}`, {
            method: 'DELETE'
        });
    },

    // ==================== VEHICLE ALLOTMENTS (Day-wise) ====================
    async getVehicleAllotments(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.fetch(`/vehicles/allotments?${params}`);
    },

    async saveVehicleAllotments(date, assignments = [], replaceExisting = true) {
        return this.fetch('/vehicles/allotments/bulk', {
            method: 'POST',
            body: JSON.stringify({ date, assignments, replaceExisting })
        });
    },

    async deleteVehicleAllotments(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.fetch(`/vehicles/allotments?${params}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== POSTS ====================
    async getPosts(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.fetch(`/posts?${params}`);
    },
    
    async getPost(id) {
        return this.fetch(`/posts/${id}`);
    },
    
    async createPost(post) {
        return this.fetch('/posts', {
            method: 'POST',
            body: JSON.stringify(post)
        });
    },
    
    async updatePost(id, post) {
        return this.fetch(`/posts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(post)
        });
    },
    
    async approvePost(id, approved = true) {
        return this.fetch(`/posts/${id}/approve`, {
            method: 'PATCH',
            body: JSON.stringify({ approved })
        });
    },
    
    async deletePost(id) {
        return this.fetch(`/posts/${id}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== ANNOUNCEMENTS ====================
    async getAnnouncements() {
        return this.fetch('/announcements');
    },
    
    async getPendingAnnouncements() {
        return this.fetch('/announcements/pending');
    },
    
    async getUserAnnouncements(email) {
        return this.fetch(`/announcements/user/${encodeURIComponent(email)}`);
    },
    
    async createAnnouncement(announcement) {
        return this.fetch('/announcements', {
            method: 'POST',
            body: JSON.stringify(announcement)
        });
    },
    
    async markAnnouncementSent(id) {
        return this.fetch(`/announcements/${id}/sent`, {
            method: 'PUT'
        });
    },
    
    async deleteAnnouncement(id) {
        return this.fetch(`/announcements/${id}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== ROOM PAIRS ====================
    async getRoomPairs() {
        return this.fetch('/room-pairs');
    },
    
    async getRoomPair(id) {
        return this.fetch(`/room-pairs/${id}`);
    },
    
    async createRoomPair(pair) {
        return this.fetch('/room-pairs', {
            method: 'POST',
            body: JSON.stringify(pair)
        });
    },
    
    async updateRoomPair(id, pair) {
        return this.fetch(`/room-pairs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(pair)
        });
    },
    
    async deleteRoomPair(id) {
        return this.fetch(`/room-pairs/${id}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== CHECK-INS ====================
    async getCheckIns(vehicleId = null) {
        if (vehicleId) {
            return this.fetch(`/check-ins/vehicle/${vehicleId}`);
        }
        return this.fetch('/check-ins');
    },
    
    async createCheckIn(vehicleId, travelerEmail, travelerId = null) {
        return this.fetch('/check-ins', {
            method: 'POST',
            body: JSON.stringify({ vehicleId, travelerEmail, travelerId })
        });
    },
    
    async checkoutCheckIn(id) {
        return this.fetch(`/check-ins/${id}/checkout`, {
            method: 'POST'
        });
    },
    
    async clearVehicleCheckIns(vehicleId) {
        return this.fetch(`/check-ins/vehicle/${vehicleId}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== SECTIONS ====================
    async getSections() {
        return this.fetch('/sections');
    },
    
    async getSection(id) {
        return this.fetch(`/sections/${id}`);
    },
    
    async createSection(section) {
        return this.fetch('/sections', {
            method: 'POST',
            body: JSON.stringify(section)
        });
    },
    
    async updateSection(id, section) {
        return this.fetch(`/sections/${id}`, {
            method: 'PUT',
            body: JSON.stringify(section)
        });
    },
    
    async deleteSection(id) {
        return this.fetch(`/sections/${id}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== SETTINGS ====================
    async getSettings() {
        return this.fetch('/settings');
    },
    
    async getSetting(key) {
        return this.fetch(`/settings/${key}`);
    },
    
    async updateSetting(key, value) {
        return this.fetch(`/settings/${key}`, {
            method: 'PUT',
            body: JSON.stringify({ value })
        });
    },
    
    async updateSettings(settings) {
        return this.fetch('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    },
    
    // ==================== HOTELS ====================
    async getHotels() {
        return this.fetch('/hotels');
    },
    
    async getHotel(id) {
        return this.fetch(`/hotels/${id}`);
    },
    
    async getRoomAllotments(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.fetch(`/hotels/allotments?${params}`);
    },
    
    async createHotel(hotel) {
        return this.fetch('/hotels', {
            method: 'POST',
            body: JSON.stringify(hotel)
        });
    },
    
    async updateHotel(id, hotel) {
        return this.fetch(`/hotels/${id}`, {
            method: 'PUT',
            body: JSON.stringify(hotel)
        });
    },
    
    async deleteHotel(id) {
        return this.fetch(`/hotels/${id}`, {
            method: 'DELETE'
        });
    },
    
    async createRoomAllotment(allotment) {
        return this.fetch('/hotels/allotments', {
            method: 'POST',
            body: JSON.stringify(allotment)
        });
    },
    
    async deleteRoomAllotments(hotelId, date) {
        const params = new URLSearchParams({ hotelId, date });
        return this.fetch(`/hotels/allotments?${params}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== ADMIN ====================
    async adminLogin(username, password) {
        return this.fetch('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },
    
    async getAdminProfile(email) {
        return this.fetch(`/admin/profile?email=${email}`);
    },
    
    async updateAdminProfile(profile) {
        return this.fetch('/admin/profile', {
            method: 'PUT',
            body: JSON.stringify(profile)
        });
    },
    
    async getTags() {
        return this.fetch('/admin/tags');
    },
    
    async addTag(tagName) {
        return this.fetch('/admin/tags', {
            method: 'POST',
            body: JSON.stringify({ tagName })
        });
    },
    
    async deleteTag(tagName) {
        return this.fetch(`/admin/tags/${encodeURIComponent(tagName)}`, {
            method: 'DELETE'
        });
    },
    
    // ==================== CACHE MANAGEMENT ====================
    clearCache() {
        API_CACHE = {};
        API_CACHE_TIMESTAMP = {};
        console.log('🗑️ API cache cleared');
    },
    
    clearCacheFor(endpoint) {
        Object.keys(API_CACHE).forEach(key => {
            if (key.includes(endpoint)) {
                delete API_CACHE[key];
                delete API_CACHE_TIMESTAMP[key];
            }
        });
    }
};

/**
 * Enhanced safeGetFromStorage - tries API first, falls back to localStorage
 */
async function safeGetFromStorage(key, defaultValue = []) {
    // Map localStorage keys to API endpoints
    const keyMap = {
        'authorizedTravelers': () => api.getTravelers(),
        'itinerary': () => api.getItinerary(),
        'vehicles': () => api.getVehicles(),
        'posts': () => api.getPosts({ approved: true }),
        'roomPairs': () => api.getRoomPairs(),
        'yatraSettings': () => api.getSettings(),
        'tags': () => api.getTags()
    };
    
    // If key has API mapping, use API
    if (keyMap[key]) {
        try {
            const data = await keyMap[key]();
            // Also cache in localStorage for offline support
            if (data !== null && data !== undefined) {
                localStorage.setItem(key, JSON.stringify(data));
            }
            return data || defaultValue;
        } catch (error) {
            console.warn(`⚠️ API failed for ${key}, using localStorage fallback:`, error);
            // Fallback to localStorage
            try {
                const data = localStorage.getItem(key);
                if (!data || data === 'undefined' || data === 'null') {
                    return defaultValue;
                }
                return JSON.parse(data);
            } catch (e) {
                return defaultValue;
            }
        }
    }
    
    // For other keys, use localStorage
    try {
        const data = localStorage.getItem(key);
        if (!data || data === 'undefined' || data === 'null') {
            return defaultValue;
        }
        return JSON.parse(data);
    } catch (error) {
        return defaultValue;
    }
}

/**
 * Enhanced safeSetToStorage - saves to API and localStorage
 */
async function safeSetToStorage(key, value) {
    // Map localStorage keys to API endpoints
    const keyMap = {
        'authorizedTravelers': (data) => {
            // For arrays, we need to handle bulk operations
            // For now, just cache in localStorage
            // Individual create/update should use api.createTraveler() etc.
            return Promise.resolve();
        },
        'itinerary': (data) => {
            // Similar - use api.createItineraryDay() for individual items
            return Promise.resolve();
        },
        'vehicles': (data) => {
            // Similar - use api.createVehicle() for individual items
            return Promise.resolve();
        },
        'posts': (data) => {
            // Similar - use api.createPost() for individual items
            return Promise.resolve();
        },
        'roomPairs': (data) => {
            // Similar - use api.createRoomPair() for individual items
            return Promise.resolve();
        },
        'yatraSettings': (data) => api.updateSettings(data),
        'tags': (data) => {
            // Tags are handled individually via api.addTag()
            return Promise.resolve();
        }
    };
    
    // Try API first if mapped
    if (keyMap[key]) {
        try {
            await keyMap[key](value);
            // Clear cache for this key
            api.clearCacheFor(key);
        } catch (error) {
            console.warn(`⚠️ API save failed for ${key}, using localStorage only:`, error);
        }
    }
    
    // Always save to localStorage as backup
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`❌ Error saving ${key} to localStorage:`, error);
        return false;
    }
}

// Export for use in HTML files
if (typeof window !== 'undefined') {
    window.api = api;
    window.safeGetFromStorage = safeGetFromStorage;
    window.safeSetToStorage = safeSetToStorage;
}

