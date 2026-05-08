-- Add IN_APP value to AlertChannel enum
-- PostgreSQL requires ALTER TYPE to add enum values
ALTER TYPE "AlertChannel" ADD VALUE IF NOT EXISTS 'IN_APP' BEFORE 'EMAIL';
