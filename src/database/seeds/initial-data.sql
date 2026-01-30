-- Nusantara Play - Initial Seed Data
-- Created: 2026-01-29

-- ================================================
-- SEED INDONESIAN PROVINCES (34 Provinsi)
-- ================================================

INSERT INTO daerah (id, nama, kode, provinsi, level) VALUES
    (gen_random_uuid(), 'Aceh', 'AC', 'Aceh', 'provinsi'),
    (gen_random_uuid(), 'Sumatera Utara', 'SU', 'Sumatera Utara', 'provinsi'),
    (gen_random_uuid(), 'Sumatera Barat', 'SB', 'Sumatera Barat', 'provinsi'),
    (gen_random_uuid(), 'Riau', 'RI', 'Riau', 'provinsi'),
    (gen_random_uuid(), 'Jambi', 'JA', 'Jambi', 'provinsi'),
    (gen_random_uuid(), 'Sumatera Selatan', 'SS', 'Sumatera Selatan', 'provinsi'),
    (gen_random_uuid(), 'Bengkulu', 'BE', 'Bengkulu', 'provinsi'),
    (gen_random_uuid(), 'Lampung', 'LA', 'Lampung', 'provinsi'),
    (gen_random_uuid(), 'Kepulauan Bangka Belitung', 'BB', 'Kepulauan Bangka Belitung', 'provinsi'),
    (gen_random_uuid(), 'Kepulauan Riau', 'KR', 'Kepulauan Riau', 'provinsi'),
    (gen_random_uuid(), 'DKI Jakarta', 'JK', 'DKI Jakarta', 'provinsi'),
    (gen_random_uuid(), 'Jawa Barat', 'JB', 'Jawa Barat', 'provinsi'),
    (gen_random_uuid(), 'Jawa Tengah', 'JT', 'Jawa Tengah', 'provinsi'),
    (gen_random_uuid(), 'DI Yogyakarta', 'YO', 'DI Yogyakarta', 'provinsi'),
    (gen_random_uuid(), 'Jawa Timur', 'JI', 'Jawa Timur', 'provinsi'),
    (gen_random_uuid(), 'Banten', 'BT', 'Banten', 'provinsi'),
    (gen_random_uuid(), 'Bali', 'BA', 'Bali', 'provinsi'),
    (gen_random_uuid(), 'Nusa Tenggara Barat', 'NB', 'Nusa Tenggara Barat', 'provinsi'),
    (gen_random_uuid(), 'Nusa Tenggara Timur', 'NT', 'Nusa Tenggara Timur', 'provinsi'),
    (gen_random_uuid(), 'Kalimantan Barat', 'KB', 'Kalimantan Barat', 'provinsi'),
    (gen_random_uuid(), 'Kalimantan Tengah', 'KT', 'Kalimantan Tengah', 'provinsi'),
    (gen_random_uuid(), 'Kalimantan Selatan', 'KS', 'Kalimantan Selatan', 'provinsi'),
    (gen_random_uuid(), 'Kalimantan Timur', 'KI', 'Kalimantan Timur', 'provinsi'),
    (gen_random_uuid(), 'Kalimantan Utara', 'KU', 'Kalimantan Utara', 'provinsi'),
    (gen_random_uuid(), 'Sulawesi Utara', 'SA', 'Sulawesi Utara', 'provinsi'),
    (gen_random_uuid(), 'Sulawesi Tengah', 'ST', 'Sulawesi Tengah', 'provinsi'),
    (gen_random_uuid(), 'Sulawesi Selatan', 'SN', 'Sulawesi Selatan', 'provinsi'),
    (gen_random_uuid(), 'Sulawesi Tenggara', 'SG', 'Sulawesi Tenggara', 'provinsi'),
    (gen_random_uuid(), 'Gorontalo', 'GO', 'Gorontalo', 'provinsi'),
    (gen_random_uuid(), 'Sulawesi Barat', 'SR', 'Sulawesi Barat', 'provinsi'),
    (gen_random_uuid(), 'Maluku', 'MA', 'Maluku', 'provinsi'),
    (gen_random_uuid(), 'Maluku Utara', 'MU', 'Maluku Utara', 'provinsi'),
    (gen_random_uuid(), 'Papua', 'PA', 'Papua', 'provinsi'),
    (gen_random_uuid(), 'Papua Barat', 'PB', 'Papua Barat', 'provinsi');

-- ================================================
-- SEED DEFAULT SETTINGS
-- ================================================

INSERT INTO settings (key, value, description) VALUES
    ('site_name', '"Nusantara Play"', 'Application name'),
    ('site_description', '"Platform Digital Arsip Permainan Rakyat Indonesia"', 'Site description'),
    ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
    ('max_file_size_mb', '10', 'Maximum file upload size in MB'),
    ('allowed_file_types', '["jpg", "jpeg", "png", "pdf", "mp4"]', 'Allowed file types for upload');

-- Note: Admin user should be created through Supabase first
-- Then insert into users table with the supabase_user_id
-- Example:
-- INSERT INTO users (supabase_user_id, email, full_name, role, status)
-- VALUES ('uuid-from-supabase', 'admin@nusantara-play.id', 'System Admin', 'admin_kpoti', 'active');
