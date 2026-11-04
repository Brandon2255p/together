ALTER TABLE "public"."places"
  DROP CONSTRAINT "places_google_photo_check";

ALTER TABLE "public"."places"
  DROP CONSTRAINT "places_google_place_id_check";

ALTER TABLE "public"."places"
  DROP CONSTRAINT "places_google_rating_check";

ALTER TABLE "public"."places"
  DROP COLUMN "google_photo";

ALTER TABLE "public"."places"
  DROP COLUMN "google_rating";

ALTER TABLE "public"."places"
  ADD COLUMN "street" text NOT NULL DEFAULT ''::text;

ALTER TABLE "public"."places"
  ADD COLUMN "city" text NOT NULL DEFAULT ''::text;

ALTER TABLE "public"."places"
  ADD COLUMN "province" text NOT NULL DEFAULT ''::text;

ALTER TABLE "public"."places"
  ADD COLUMN "country" text NOT NULL DEFAULT ''::text;

ALTER TABLE "public"."places"
  ADD COLUMN "lat" double precision;

ALTER TABLE "public"."places"
  ADD COLUMN "lng" double precision;

ALTER TABLE "public"."places"
  ADD COLUMN "location_fetched_at" timestamp WITH time zone;

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_check" CHECK ((((lat IS NULL) = (lng IS NULL)) AND ((lat IS NULL) = (location_fetched_at IS NULL))));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_city_check" CHECK ((char_length(city) <= 80));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_country_check" CHECK ((char_length(country) <= 80));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_google_place_id_check" CHECK (((google_place_id ~ '^[A-Za-z0-9_-]+$'::text) AND (char_length(google_place_id) <= 300)));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_lat_check" CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_lng_check" CHECK (((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_province_check" CHECK ((char_length(province) <= 80));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_street_check" CHECK ((char_length(street) <= 80));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_together_id_google_place_id_key" UNIQUE (together_id, google_place_id);

CREATE INDEX places_area_idx ON public.places USING btree (together_id, country, province, city);
