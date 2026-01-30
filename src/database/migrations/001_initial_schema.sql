-- Nusantara Play - Initial Database Schema
-- Created: 2026-01-29
-- Description: Complete database schema for Nusantara Play MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('admin_kpoti', 'kurator_daerah', 'pakar', 'publik');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE daerah_level AS ENUM ('provinsi', 'kabupaten', 'kota');
CREATE TYPE permainan_status AS ENUM ('draft', 'dikurasi', 'diverifikasi', 'arsip_nasional');
CREATE TYPE verifikasi_status AS ENUM ('pending', 'approved', 'rejected', 'revision_needed');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'ongoing', 'completed', 'cancelled');
CREATE TYPE certificate_type AS ENUM ('participation', 'achievement', 'completion');

-- ================================================
-- AUTHENTICATION & USERS
-- ================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_user_id UUID UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'publik',
    status user_status NOT NULL DEFAULT 'active',
    phone VARCHAR(20),
    avatar_url TEXT,
    bio TEXT,
    daerah_id UUID,
    institution VARCHAR(255),
    expertise TEXT[],
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Daerah (Regional Data) table
CREATE TABLE daerah (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(255) NOT NULL,
    kode VARCHAR(10) NOT NULL UNIQUE,
    provinsi VARCHAR(100) NOT NULL,
    level daerah_level NOT NULL,
    parent_id UUID,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ================================================
-- PERMAINAN (GAMES ARCHIVE)
-- ================================================

-- Permainan table
CREATE TABLE permainan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(255) NOT NULL,
    nama_alternatif TEXT[],
    deskripsi TEXT NOT NULL,
    daerah_id UUID NOT NULL,
    kategori VARCHAR(100),
    jumlah_pemain VARCHAR(50),
    durasi_bermain VARCHAR(50),
    tingkat_kesulitan VARCHAR(50),
    peralatan TEXT[],
    cara_bermain TEXT NOT NULL,
    nilai_budaya TEXT,
    foto_utama TEXT,
    galeri_foto TEXT[],
    video_url TEXT,
    status permainan_status NOT NULL DEFAULT 'draft',
    kurator_id UUID,
    tanggal_kurasi TIMESTAMP,
    pakar_id UUID,
    tanggal_verifikasi TIMESTAMP,
    admin_id UUID,
    tanggal_publish TIMESTAMP,
    metadata JSONB,
    search_vector tsvector,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID
);

-- Verifikasi table
CREATE TABLE verifikasi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permainan_id UUID NOT NULL,
    pakar_id UUID NOT NULL,
    status verifikasi_status NOT NULL DEFAULT 'pending',
    catatan TEXT,
    saran_perbaikan TEXT,
    dokumen_pendukung TEXT[],
    verified_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Verifikasi Queue table
CREATE TABLE verifikasi_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permainan_id UUID NOT NULL,
    assigned_pakar_id UUID,
    priority INTEGER DEFAULT 0,
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ================================================
-- EVENTS & COMMUNITIES
-- ================================================

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(255) NOT NULL,
    deskripsi TEXT NOT NULL,
    jenis VARCHAR(100) NOT NULL, -- teras_bermain, workshop, festival, etc.
    tanggal_mulai TIMESTAMP NOT NULL,
    tanggal_selesai TIMESTAMP NOT NULL,
    lokasi VARCHAR(255) NOT NULL,
    daerah_id UUID NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    kuota_peserta INTEGER,
    jumlah_peserta INTEGER DEFAULT 0,
    banner_url TEXT,
    galeri_foto TEXT[],
    status event_status NOT NULL DEFAULT 'draft',
    persyaratan TEXT,
    formulir_custom JSONB,
    contact_person VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID
);

-- Event Registrations table
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    data_pendaftaran JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'registered', -- registered, checked_in, cancelled
    checked_in_at TIMESTAMP,
    certificate_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Communities table
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(255) NOT NULL,
    deskripsi TEXT NOT NULL,
    daerah_id UUID NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    contact_person VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    social_media JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID
);

-- Community Members table
CREATE TABLE community_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- admin, moderator, member
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(community_id, user_id)
);

-- ================================================
-- CERTIFICATIONS
-- ================================================

-- Certificates table
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_sertifikat VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    jenis certificate_type NOT NULL,
    nama_penerima VARCHAR(255) NOT NULL,
    nama_kegiatan VARCHAR(255) NOT NULL,
    tanggal_kegiatan DATE NOT NULL,
    tanggal_terbit DATE NOT NULL DEFAULT CURRENT_DATE,
    pdf_url TEXT,
    qr_code_url TEXT,
    verification_code VARCHAR(100) UNIQUE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);

-- ================================================
-- SYSTEM & AUDIT
-- ================================================

-- Audit Logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    changes JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    related_entity_type VARCHAR(100),
    related_entity_id UUID,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Settings table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by UUID
);

-- ================================================
-- FOREIGN KEY CONSTRAINTS
-- ================================================

-- Users
ALTER TABLE users ADD CONSTRAINT fk_users_daerah
    FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Daerah
ALTER TABLE daerah ADD CONSTRAINT fk_daerah_parent
    FOREIGN KEY (parent_id) REFERENCES daerah(id) ON DELETE CASCADE;

-- Permainan
ALTER TABLE permainan ADD CONSTRAINT fk_permainan_daerah
    FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE RESTRICT;
ALTER TABLE permainan ADD CONSTRAINT fk_permainan_kurator
    FOREIGN KEY (kurator_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE permainan ADD CONSTRAINT fk_permainan_pakar
    FOREIGN KEY (pakar_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE permainan ADD CONSTRAINT fk_permainan_admin
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE permainan ADD CONSTRAINT fk_permainan_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE permainan ADD CONSTRAINT fk_permainan_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Verifikasi
ALTER TABLE verifikasi ADD CONSTRAINT fk_verifikasi_permainan
    FOREIGN KEY (permainan_id) REFERENCES permainan(id) ON DELETE CASCADE;
ALTER TABLE verifikasi ADD CONSTRAINT fk_verifikasi_pakar
    FOREIGN KEY (pakar_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Verifikasi Queue
ALTER TABLE verifikasi_queue ADD CONSTRAINT fk_verifikasi_queue_permainan
    FOREIGN KEY (permainan_id) REFERENCES permainan(id) ON DELETE CASCADE;
ALTER TABLE verifikasi_queue ADD CONSTRAINT fk_verifikasi_queue_pakar
    FOREIGN KEY (assigned_pakar_id) REFERENCES users(id) ON DELETE SET NULL;

-- Events
ALTER TABLE events ADD CONSTRAINT fk_events_daerah
    FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE RESTRICT;
ALTER TABLE events ADD CONSTRAINT fk_events_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE events ADD CONSTRAINT fk_events_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Event Registrations
ALTER TABLE event_registrations ADD CONSTRAINT fk_event_registrations_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE event_registrations ADD CONSTRAINT fk_event_registrations_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE event_registrations ADD CONSTRAINT fk_event_registrations_certificate
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE SET NULL;

-- Communities
ALTER TABLE communities ADD CONSTRAINT fk_communities_daerah
    FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE RESTRICT;
ALTER TABLE communities ADD CONSTRAINT fk_communities_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE communities ADD CONSTRAINT fk_communities_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Community Members
ALTER TABLE community_members ADD CONSTRAINT fk_community_members_community
    FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;
ALTER TABLE community_members ADD CONSTRAINT fk_community_members_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Certificates
ALTER TABLE certificates ADD CONSTRAINT fk_certificates_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE certificates ADD CONSTRAINT fk_certificates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;

-- Audit Logs
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Notifications
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Settings
ALTER TABLE settings ADD CONSTRAINT fk_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ================================================
-- INDEXES
-- ================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_supabase_user_id ON users(supabase_user_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_daerah_id ON users(daerah_id);

-- Daerah
CREATE INDEX idx_daerah_level ON daerah(level);
CREATE INDEX idx_daerah_provinsi ON daerah(provinsi);
CREATE INDEX idx_daerah_parent_id ON daerah(parent_id);

-- Permainan
CREATE INDEX idx_permainan_daerah_id ON permainan(daerah_id);
CREATE INDEX idx_permainan_status ON permainan(status);
CREATE INDEX idx_permainan_kurator_id ON permainan(kurator_id);
CREATE INDEX idx_permainan_pakar_id ON permainan(pakar_id);
CREATE INDEX idx_permainan_created_by ON permainan(created_by);
CREATE INDEX idx_permainan_search_vector ON permainan USING gin(search_vector);
CREATE INDEX idx_permainan_kategori ON permainan(kategori);

-- Verifikasi
CREATE INDEX idx_verifikasi_permainan_id ON verifikasi(permainan_id);
CREATE INDEX idx_verifikasi_pakar_id ON verifikasi(pakar_id);
CREATE INDEX idx_verifikasi_status ON verifikasi(status);

-- Verifikasi Queue
CREATE INDEX idx_verifikasi_queue_permainan_id ON verifikasi_queue(permainan_id);
CREATE INDEX idx_verifikasi_queue_assigned_pakar_id ON verifikasi_queue(assigned_pakar_id);
CREATE INDEX idx_verifikasi_queue_priority ON verifikasi_queue(priority DESC);

-- Events
CREATE INDEX idx_events_daerah_id ON events(daerah_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_tanggal_mulai ON events(tanggal_mulai);
CREATE INDEX idx_events_jenis ON events(jenis);
CREATE INDEX idx_events_created_by ON events(created_by);

-- Event Registrations
CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);
CREATE INDEX idx_event_registrations_status ON event_registrations(status);

-- Communities
CREATE INDEX idx_communities_daerah_id ON communities(daerah_id);
CREATE INDEX idx_communities_status ON communities(status);
CREATE INDEX idx_communities_created_by ON communities(created_by);

-- Community Members
CREATE INDEX idx_community_members_community_id ON community_members(community_id);
CREATE INDEX idx_community_members_user_id ON community_members(user_id);

-- Certificates
CREATE INDEX idx_certificates_user_id ON certificates(user_id);
CREATE INDEX idx_certificates_verification_code ON certificates(verification_code);
CREATE INDEX idx_certificates_nomor_sertifikat ON certificates(nomor_sertifikat);

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ================================================
-- TRIGGERS & FUNCTIONS
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daerah_updated_at BEFORE UPDATE ON daerah
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permainan_updated_at BEFORE UPDATE ON permainan
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verifikasi_updated_at BEFORE UPDATE ON verifikasi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_registrations_updated_at BEFORE UPDATE ON event_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON communities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update search vector for permainan
CREATE OR REPLACE FUNCTION update_permainan_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector =
        setweight(to_tsvector('indonesian', COALESCE(NEW.nama, '')), 'A') ||
        setweight(to_tsvector('indonesian', COALESCE(NEW.deskripsi, '')), 'B') ||
        setweight(to_tsvector('indonesian', COALESCE(NEW.cara_bermain, '')), 'C') ||
        setweight(to_tsvector('indonesian', COALESCE(NEW.nilai_budaya, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search vector
CREATE TRIGGER update_permainan_search_vector_trigger
    BEFORE INSERT OR UPDATE ON permainan
    FOR EACH ROW EXECUTE FUNCTION update_permainan_search_vector();

-- Schema creation completed successfully
