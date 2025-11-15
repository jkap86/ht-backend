-- migrations/002_create_users.sql
-- Core users table for authentication.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Unique username login (your primary login method)
    username TEXT NOT NULL UNIQUE,
    -- Optional email (unique if present)
    email TEXT UNIQUE,
    -- Phone number field (unique if present)
    phone_number TEXT UNIQUE,
    -- Hashed password (bcrypt or argon2)
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes for login lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users (phone_number);