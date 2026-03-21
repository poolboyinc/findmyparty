-- Creates the three application databases on the shared PostgreSQL instance.
-- The default database (postgres) is created automatically by the container.

SELECT 'CREATE DATABASE fmp_identity' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fmp_identity')\gexec
SELECT 'CREATE DATABASE fmp_parties' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fmp_parties')\gexec
SELECT 'CREATE DATABASE fmp_bookings' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fmp_bookings')\gexec
