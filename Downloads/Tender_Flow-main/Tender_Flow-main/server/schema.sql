-- server/schema.sql

-- COMPANY IDENTITY (From configData.ts)
CREATE TABLE IF NOT EXISTS company_profile (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255),
    address TEXT,
    gstin VARCHAR(15) UNIQUE,
    pan VARCHAR(10) UNIQUE,
    annual_turnover_cr NUMERIC, -- New field for qualification
    experience_years INTEGER    -- New field for qualification
);

-- SIGNING AUTHORITIES (From configData.ts)
CREATE TABLE IF NOT EXISTS signing_authorities (
    id VARCHAR(50) PRIMARY KEY, -- e.g., DIR-001
    name VARCHAR(255),
    designation VARCHAR(100),
    din VARCHAR(20)
);

-- COMPLIANCE VAULT (New Feature)
CREATE TABLE IF NOT EXISTS compliance_vault (
    id SERIAL PRIMARY KEY,
    cert_name VARCHAR(255) UNIQUE, -- e.g., 'ISO 9001:2015'
    category VARCHAR(50),          -- 'Technical', 'Financial', 'OEM'
    issued_date DATE,
    expiry_date DATE,
    is_valid BOOLEAN DEFAULT TRUE,
    file_path TEXT
);
-- inventory schema
CREATE TABLE IF NOT EXISTS product_inventory (
    id SERIAL PRIMARY KEY,
    sku_id VARCHAR(100) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    sub_category VARCHAR(100),
    brand VARCHAR(100),
    available_qty INTEGER DEFAULT 0,
    unit_price NUMERIC(15, 2),
    gst_rate NUMERIC(5, 2) DEFAULT 18.0,
    warehouse_location VARCHAR(100),
    technical_specs JSONB, -- Stores the key-value pairs from storeData.ts
    last_restocked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS vault_access (
    id SERIAL PRIMARY KEY,
    recovery_email VARCHAR(255) UNIQUE NOT NULL,
    pin_hash TEXT,
    two_fa_secret TEXT,
    is_2fa_enabled BOOLEAN DEFAULT FALSE,
    is_setup_complete BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    failed_attempts INTEGER DEFAULT 0,
    last_login TIMESTAMP,
    reset_token VARCHAR(6),
    reset_token_expiry TIMESTAMP
);

-- Initialize with your current configData.ts values
INSERT INTO company_profile (company_name, address, gstin, pan, annual_turnover_cr, experience_years)
VALUES ('TenderFlow Industrial Systems', 'Lovely Professional University, Punjab - 144411', '03AAACT0000G1Z5', 'AAACT0000G', 75, 12);