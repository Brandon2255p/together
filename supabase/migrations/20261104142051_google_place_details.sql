ALTER TABLE "public"."places"
  ADD COLUMN "google_place_id" text;

ALTER TABLE "public"."places"
  ADD COLUMN "google_rating" numeric(2,1);

ALTER TABLE "public"."places"
  ADD COLUMN "google_photo" text;

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_google_photo_check" CHECK ((google_photo ~ '^places/[^/]+/photos/[^/]+$'::text));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_google_place_id_check" CHECK (((char_length(google_place_id) >= 1) AND (char_length(google_place_id) <= 300)));

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_google_rating_check" CHECK (((google_rating >= (1)::numeric) AND (google_rating <= (5)::numeric)));
