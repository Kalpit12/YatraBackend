-- Yatra Database Schema for Railway MySQL
-- Run this in Railway's MySQL database

-- Note: Database is already created by Railway, so we skip CREATE DATABASE

-- ==================== TRAVELERS TABLE ====================
CREATE TABLE IF NOT EXISTS travelers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tirth_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    center VARCHAR(100),
    birth_date DATE,
    age INT,
    passport_no VARCHAR(50),
    passport_issue_date DATE,
    passport_expiry_date DATE,
    nationality VARCHAR(100) DEFAULT 'Indian',
    gender ENUM('Male', 'Female', 'Other') DEFAULT 'Male',
    hoodi_size ENUM('S', 'M', 'L', 'XL', 'XXL'),
    vehicle_id INT,
    profile_line VARCHAR(200),
    about_me TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_vehicle (vehicle_id),
    INDEX idx_tirth_id (tirth_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ADMIN USERS TABLE ====================
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    image_url TEXT,
    include_in_contributors BOOLEAN DEFAULT TRUE,
    image_compression_quality DECIMAL(3,2) DEFAULT 0.85,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== VEHICLES TABLE ====================
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    reg_no VARCHAR(50) UNIQUE,
    group_leader_email VARCHAR(255),
    group_leader_name VARCHAR(200),
    driver_name VARCHAR(200),
    driver_phone VARCHAR(20),
    color VARCHAR(20) DEFAULT '#FF9933',
    status ENUM('Active', 'Inactive', 'Maintenance') DEFAULT 'Active',
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    last_update TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_group_leader (group_leader_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ITINERARY TABLE ====================
CREATE TABLE IF NOT EXISTS itinerary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day INT NOT NULL,
    date DATE NOT NULL,
    place VARCHAR(200) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_day (day),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ITINERARY ACTIVITIES TABLE ====================
CREATE TABLE IF NOT EXISTS itinerary_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itinerary_id INT NOT NULL,
    time VARCHAR(20) NOT NULL,
    activity TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (itinerary_id) REFERENCES itinerary(id) ON DELETE CASCADE,
    INDEX idx_itinerary (itinerary_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ITINERARY IMAGES TABLE ====================
CREATE TABLE IF NOT EXISTS itinerary_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itinerary_id INT NOT NULL,
    image_url TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (itinerary_id) REFERENCES itinerary(id) ON DELETE CASCADE,
    INDEX idx_itinerary (itinerary_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ROOM PAIRS TABLE ====================
CREATE TABLE IF NOT EXISTS room_pairs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pair_no INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_pair_no (pair_no),
    INDEX idx_pair_no (pair_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ROOM PAIR TRAVELERS (Many-to-Many) ====================
CREATE TABLE IF NOT EXISTS room_pair_travelers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_pair_id INT NOT NULL,
    traveler_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_pair_id) REFERENCES room_pairs(id) ON DELETE CASCADE,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_pair_traveler (room_pair_id, traveler_id),
    INDEX idx_pair (room_pair_id),
    INDEX idx_traveler (traveler_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== HOTELS TABLE ====================
CREATE TABLE IF NOT EXISTS hotels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    phone VARCHAR(20),
    email VARCHAR(255),
    total_floors INT,
    total_rooms INT,
    check_in_date DATE,
    check_out_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ROOM ALLOTMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS room_allotments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT NOT NULL,
    traveler_id INT NOT NULL,
    date DATE NOT NULL,
    floor VARCHAR(20),
    room VARCHAR(50),
    pair_no INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE CASCADE,
    INDEX idx_hotel_date (hotel_id, date),
    INDEX idx_traveler (traveler_id),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POST SECTIONS TABLE ====================
CREATE TABLE IF NOT EXISTS post_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POSTS TABLE ====================
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    author_email VARCHAR(255) NOT NULL,
    author_name VARCHAR(200),
    author_image_url TEXT,
    place VARCHAR(200),
    location VARCHAR(200),
    section_id INT,
    description TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES post_sections(id) ON DELETE SET NULL,
    INDEX idx_author (author_email),
    INDEX idx_approved (approved),
    INDEX idx_created (created_at),
    INDEX idx_location (lat, lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POST MEDIA TABLE ====================
CREATE TABLE IF NOT EXISTS post_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    media_url TEXT NOT NULL,
    media_type ENUM('image', 'video') DEFAULT 'image',
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    INDEX idx_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== POST TAGS TABLE ====================
CREATE TABLE IF NOT EXISTS post_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    tag_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    INDEX idx_post (post_id),
    INDEX idx_tag (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CHECK-INS TABLE ====================
CREATE TABLE IF NOT EXISTS check_ins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    traveler_email VARCHAR(255) NOT NULL,
    traveler_id INT,
    active BOOLEAN DEFAULT TRUE,
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TIMESTAMP NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE SET NULL,
    INDEX idx_vehicle (vehicle_id),
    INDEX idx_traveler_email (traveler_email),
    INDEX idx_active (active),
    INDEX idx_checked_in (checked_in_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== SETTINGS TABLE ====================
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== TAGS TABLE ====================
CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tag_name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tag_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ANNOUNCEMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient_type ENUM('all-travelers', 'specific-vehicle', 'specific-traveler') NOT NULL,
    recipient_value TEXT,
    message TEXT NOT NULL,
    display_type ENUM('notification', 'banner', 'modal') DEFAULT 'notification',
    timing_type ENUM('instant', 'scheduled') DEFAULT 'instant',
    scheduled_time DATETIME NULL,
    sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sent (sent),
    INDEX idx_scheduled (scheduled_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== INSERT DEFAULT DATA ====================

-- Insert default post sections
INSERT INTO post_sections (id, name, description, display_order) VALUES
(1, 'Temples & Sacred Sites', 'Posts about temples and holy places', 1),
(2, 'Spiritual Experiences', 'Share spiritual moments and insights', 2),
(3, 'Food & Prasad', 'Traditional food and temple offerings', 3),
(4, 'Travel Updates', 'Journey progress and updates', 4)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Insert default tags
INSERT INTO tags (tag_name) VALUES
('Temple'), ('Food'), ('Nature'), ('Culture'), ('Festival'),
('Sunrise'), ('Sunset'), ('Prayer'), ('Meditation'), ('Architecture'),
('People'), ('Journey')
ON DUPLICATE KEY UPDATE tag_name=tag_name;

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, setting_type) VALUES
('yatra_title', 'SPIRITUAL NEPAL YATRA 2025', 'string'),
('start_location', 'Mumbai, India', 'string'),
('destination', 'Muktinath, Nepal', 'string'),
('start_date', '2025-12-14', 'string'),
('end_date', '2025-12-24', 'string'),
('top_contributors_count', '10', 'number'),
('emergency_doctor_name', 'Dr. Rajesh Kumar', 'string'),
('emergency_doctor_phone', '+91-9876543210', 'string'),
('wake_up_time', '06:00', 'string'),
('alarm_message', 'Good morning travelers! 🌅 Time to wake up and prepare for today\'s sacred journey. Jay Swaminarayan!', 'string'),
('alarm_enabled', 'true', 'boolean')
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value);

