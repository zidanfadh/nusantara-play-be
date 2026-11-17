-- Executed by the postgres image on the FIRST start of an empty volume only
-- (docker-compose.dev.yml mounts this folder at /docker-entrypoint-initdb.d).
-- Creates the local development and test databases. Schema and seed data
-- come from `npm run db:setup` (src/scripts/db-local-setup.ts), not from here.
CREATE DATABASE nusantara_play_dev;
CREATE DATABASE nusantara_play_test;
