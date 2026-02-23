-- Add boundary column to beaches table for storing OSM polygon data
ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS boundary JSONB;
