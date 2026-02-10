-- Migration 049: Step 7 SQL helpers for Metrics Contract v1
-- Haversine distance and radius checks for on-time, GPS validation, good-faith distance.

-- Haversine distance in meters
CREATE OR REPLACE FUNCTION pt_haversine_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2 * 6371000 * asin(
    sqrt(
      pow(sin(radians((lat2 - lat1) / 2)), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians((lon2 - lon1) / 2)), 2)
    )
  );
$$;

-- Haversine distance in miles
CREATE OR REPLACE FUNCTION pt_haversine_miles(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pt_haversine_meters(lat1, lon1, lat2, lon2) / 1609.344;
$$;

-- Within radius (meters)
CREATE OR REPLACE FUNCTION pt_within_radius_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision,
  radius_m double precision
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pt_haversine_meters(lat1, lon1, lat2, lon2) <= radius_m;
$$;

COMMENT ON FUNCTION pt_haversine_meters IS 'Haversine distance in meters for GPS validation';
COMMENT ON FUNCTION pt_haversine_miles IS 'Haversine distance in miles (e.g. good-faith 11mi rule)';
COMMENT ON FUNCTION pt_within_radius_meters IS 'True if point within radius_m of job location (e.g. 250m clock-in)';

SELECT 'Migration 049 Completed' AS status;
