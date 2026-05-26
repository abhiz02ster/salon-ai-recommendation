-- Salon Management System Database Schema
-- Compatible with SQLite (maintaining consistency with existing inv_mgmt system)

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ============================================================================
-- CLIENT MANAGEMENT TABLES
-- ============================================================================

-- Clients table - stores customer information and preferences
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(10),
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    postal_code VARCHAR(10),
    country VARCHAR(50),

    -- Physical attributes for AI recommendations
    height_cm DECIMAL(5,2),  -- Height in centimeters
    face_shape VARCHAR(20),  -- oval, round, square, heart, diamond, oblong
    body_type VARCHAR(20),   -- ectomorph, mesomorph, endomorph
    hair_type VARCHAR(20),   -- straight, wavy, curly, coily
    hair_length VARCHAR(20), -- short, medium, long
    skin_tone VARCHAR(20),   -- fair, light, medium, tan, deep
    undertone VARCHAR(20),   -- warm, cool, neutral

    -- Preferences and lifestyle
    preferred_style VARCHAR(50),    -- casual, formal, trendy, classic, etc.
    lifestyle VARCHAR(50),          -- active, professional, casual, glamorous
    maintenance_level VARCHAR(20),  -- low, medium, high
    allergies TEXT,                 -- Product allergies or sensitivities

    -- Service history and value
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    last_visit_date DATE,
    preferred_stylist_id INTEGER,   -- Reference to staff/stylist (if applicable)

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,

    -- Consent and privacy
    marketing_consent BOOLEAN DEFAULT 0,
    data_processing_consent BOOLEAN DEFAULT 0,
    photo_consent BOOLEAN DEFAULT 0  -- Consent to store photos for AI analysis
);

-- Client photos for AI analysis and history
CREATE TABLE IF NOT EXISTS client_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    photo_url VARCHAR(255) NOT NULL,  -- Path or URL to stored photo
    photo_type VARCHAR(20) NOT NULL,  -- full_body, face_closeup, side_profile, etc.
    analysis_results TEXT,            -- JSON string of AI analysis results
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ============================================================================
-- SERVICES AND STAFF TABLES
-- ============================================================================

-- Services table - salon service catalog
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),           -- haircut, color, treatment, styling, etc.
    description TEXT,
    duration_minutes INTEGER,       -- Expected service duration
    base_price DECIMAL(8,2) NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service variations/add-ons
CREATE TABLE IF NOT EXISTS service_variations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,     -- e.g., "Balayage", "Keratin Treatment"
    description TEXT,
    additional_price DECIMAL(8,2) DEFAULT 0.00,
    additional_duration INTEGER DEFAULT 0,  -- Additional minutes
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Staff/Stylists table
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    specialty VARCHAR(100),         -- e.g., "Color Specialist", "Cutting Expert"
    hire_date DATE,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff service capabilities (which services each staff member can perform)
CREATE TABLE IF NOT EXISTS staff_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    proficiency_level VARCHAR(20),  -- beginner, intermediate, expert
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE (staff_id, service_id)
);

-- ============================================================================
-- APPOINTMENTS AND BOOKING TABLES
-- ============================================================================

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    staff_id INTEGER,               -- NULL if not assigned yet
    service_id INTEGER NOT NULL,
    appointment_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP,         -- Calculated or manually set
    status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, confirmed, in_progress, completed, cancelled, no_show
    notes TEXT,
    total_price DECIMAL(10,2),      -- Final price after any discounts/add-ons
    discount_amount DECIMAL(8,2) DEFAULT 0.00,
    tax_amount DECIMAL(8,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Appointment service variations (add-ons selected for appointment)
CREATE TABLE IF NOT EXISTS appointment_service_variations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    service_variation_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (service_variation_id) REFERENCES service_variations(id) ON DELETE CASCADE
);

-- Stylist notes table (chronological stylist logs per appointment/consultation)
CREATE TABLE IF NOT EXISTS stylist_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    stylist_id INTEGER NOT NULL,
    note_type VARCHAR(20) DEFAULT 'general', -- formula, general_preference, complaint
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (stylist_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Loyalty points history tracking
CREATE TABLE IF NOT EXISTS loyalty_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    points_delta INTEGER NOT NULL, -- positive for earn, negative for redeem
    reason VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Client profiles table (advanced CRM characteristics)
CREATE TABLE IF NOT EXISTS client_profiles (
    client_id INTEGER PRIMARY KEY,
    hair_density VARCHAR(20),
    hair_porosity VARCHAR(20),
    hair_elasticity VARCHAR(20),
    natural_color VARCHAR(30),
    scalp_type VARCHAR(30),
    chemical_treatment_history TEXT,
    allergies TEXT,
    typical_maintenance VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ============================================================================
-- TRANSACTIONS AND PAYMENTS TABLES
-- ============================================================================

-- Transactions table - billing and payments
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER,         -- Linked to appointment (if applicable)
    client_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(20),     -- cash, card, upi, wallet, etc.
    upi_transaction_id VARCHAR(100), -- UPI transaction reference if applicable
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, completed, failed, refunded, partially_refunded
    payment_details TEXT,           -- JSON string of payment gateway response
    receipt_number VARCHAR(50),     -- Unique receipt identifier
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ============================================================================
-- INVENTORY MANAGEMENT TABLES
-- ============================================================================

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    postal_code VARCHAR(10),
    country VARCHAR(50),
    tax_id VARCHAR(50),
    payment_terms VARCHAR(50),      -- e.g., "Net 30", "COD"
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table - extending existing inventory management for salon-specific needs
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),           -- general category
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2),   -- retail price
    stock INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    salon_category VARCHAR(50),     -- hair_care, styling, color, nails, disposables
    brand VARCHAR(100),
    size_volume VARCHAR(50),        -- e.g. "250ml"
    is_professional_use BOOLEAN DEFAULT 0,
    minimum_stock_level INTEGER DEFAULT 5,
    reorder_quantity INTEGER DEFAULT 10,
    supplier_id INTEGER,            -- Reference to suppliers table
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Materials table - raw inputs (e.g. dye tube grams, bleach volume)
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0.0,
    unit VARCHAR(20),               -- g, ml, etc.
    unit_cost DECIMAL(10,4) NOT NULL DEFAULT 0.0,
    is_active BOOLEAN DEFAULT 1,
    salon_category VARCHAR(50),     -- hair_color, developer, treatment
    brand VARCHAR(100),
    size_volume VARCHAR(50),
    is_professional_use BOOLEAN DEFAULT 1,
    minimum_stock_level DECIMAL(10,2) DEFAULT 1.0,
    reorder_quantity DECIMAL(10,2) DEFAULT 5.0,
    supplier_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Service inventory usage tracking - links products/materials used in services
CREATE TABLE IF NOT EXISTS service_inventory_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    product_id INTEGER,             -- NULL if material used
    material_id INTEGER,            -- NULL if product used
    quantity_used DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20),               -- pcs, ml, g, oz, etc.
    cost_per_unit DECIMAL(10,4),    -- Cost at time of usage
    total_cost DECIMAL(10,2),       -- Calculated: quantity_used * cost_per_unit
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL,
    CHECK ((product_id IS NOT NULL AND material_id IS NULL) OR
           (product_id IS NULL AND material_id IS NOT NULL))
);

-- Stock transactions table (logs additions/deductions)
CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,             -- NULL if material
    material_id INTEGER,            -- NULL if product
    transaction_type VARCHAR(20) NOT NULL, -- receive, sale, usage, adjustment
    quantity REAL NOT NULL,         -- negative for deductions
    reference_id INTEGER,           -- appointment_id, purchase_order_id, etc.
    performed_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL,
    CHECK ((product_id IS NOT NULL AND material_id IS NULL) OR
           (product_id IS NULL AND material_id IS NOT NULL))
);

-- Product recommendations association (maps recommended products to consultations)
CREATE TABLE IF NOT EXISTS product_recommendations_association (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'recommended', -- recommended, substituted, purchased
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consultation_id) REFERENCES client_consultations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================================
-- REVIEWS AND FEEDBACK TABLES
-- ============================================================================

-- Reviews table - customer feedback and ratings
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    appointment_id INTEGER,         -- Optional: link to specific appointment
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    comments TEXT,
    service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
    staff_rating INTEGER CHECK (staff_rating >= 1 AND staff_rating <= 5),
    cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
    value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
    would_recommend BOOLEAN,
    is_public BOOLEAN DEFAULT 0,    -- Whether review can be displayed publicly
    response_from_staff TEXT,       -- Staff response to review
    response_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

-- ============================================================================
-- OFFERS AND PROMOTIONS TABLES
-- ============================================================================

-- Offers and promotions table
CREATE TABLE IF NOT EXISTS offers_promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    offer_type VARCHAR(20),         -- percentage, fixed_amount, bogo, package
    discount_value DECIMAL(8,2),    -- Percentage or fixed amount
    applicable_services TEXT,       -- JSON array of service IDs or 'all'
    applicable_clients TEXT,        -- JSON array of client IDs or 'all' or 'new_only'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    max_uses INTEGER,               -- NULL for unlimited
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Offer usage tracking
CREATE TABLE IF NOT EXISTS offer_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    appointment_id INTEGER,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id) REFERENCES offers_promotions(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

-- ============================================================================
-- AI RECOMMENDATIONS AND ANALYTICS TABLES
-- ============================================================================

-- AI recommendations table - stores generated recommendations for clients
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    appointment_id INTEGER,         -- Associated appointment if any
    recommendation_data TEXT NOT NULL,  -- JSON string of recommendations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

-- Client preference evolution tracking
CREATE TABLE IF NOT EXISTS client_style_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    appointment_id INTEGER NOT NULL,
    recommended_style VARCHAR(100), -- What was recommended
    actual_service VARCHAR(100),    -- What client actually chose
    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Client indexes
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_last_visit ON clients(last_visit_date);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);

-- Appointment indexes
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(DATE(appointment_datetime));

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_appointment ON transactions(appointment_id);

-- Review indexes
CREATE INDEX IF NOT EXISTS idx_reviews_client ON reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_appointment ON reviews(appointment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Inventory usage indexes
CREATE INDEX IF NOT EXISTS idx_inventory_usage_appointment ON service_inventory_usage(appointment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_product ON service_inventory_usage(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_material ON service_inventory_usage(material_id);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger to update client's total visits and spent after completed appointment
CREATE TRIGGER IF NOT EXISTS update_client_stats_after_appointment
AFTER UPDATE ON appointments
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    UPDATE clients SET
        total_visits = total_visits + 1,
        last_visit_date = DATE(NEW.appointment_datetime),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.client_id;
END;


-- Trigger to update staff assignment count (optional)
-- Trigger to update client stats after transaction
CREATE TRIGGER IF NOT EXISTS update_client_spent_after_transaction
AFTER INSERT ON transactions
WHEN NEW.status = 'completed'
BEGIN
    UPDATE clients SET
        total_spent = total_spent + NEW.amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.client_id;
END;

-- ============================================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- ============================================================================

/*
-- Sample services
INSERT INTO services (name, category, description, duration_minutes, base_price) VALUES
('Haircut', 'haircut', 'Basic haircut with style consultation', 45, 800.00),
('Hair Coloring', 'color', 'Full hair coloring service', 120, 1500.00),
('Hair Treatment', 'treatment', 'Deep conditioning treatment', 60, 1000.00),
('Bridal Styling', 'styling', 'Complete bridal hair and makeup', 180, 5000.00),
('Beard Trim', 'grooming', 'Professional beard shaping and trim', 30, 400.00);

-- Sample staff
INSERT INTO staff (first_name, last_name, specialty) VALUES
('Priya', 'Sharma', 'Hair Color Specialist'),
('Rahul', 'Kumar', 'Cutting and Styling Expert'),
('Anita', 'Singh', 'Bridal and Occasional Stylist');

-- Sample products (extending existing inventory)
INSERT INTO products (name, sku, category, stock, cost_price, selling_price, salon_category, brand, size_volume)
VALUES
('Argan Oil Shampoo', 'SAO001', 'hair_care', 25, 200.00, 350.00, 'hair_care', 'Moroccanoil', '250ml'),
('Keratin Treatment Mask', 'SAK002', 'treatment', 15, 400.00, 700.00, 'hair_care', 'Brazilian Blowout', '500ml'),
('Hair Color Developer 20V', 'SAC003', 'color', 30, 150.00, 250.00, 'color', 'Wella', '1000ml');
*/