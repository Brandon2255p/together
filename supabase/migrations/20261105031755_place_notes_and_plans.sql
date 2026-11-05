ALTER TABLE "public"."events"
  ADD COLUMN "place_id" uuid;

ALTER TABLE "public"."places"
  ADD COLUMN "note" text NOT NULL DEFAULT ''::text;

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_place_fkey" FOREIGN KEY (place_id, together_id) REFERENCES public.places(id, together_id) ON DELETE SET NULL (place_id);

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_note_check" CHECK ((char_length(note) <= 500));

CREATE INDEX events_place_idx ON public.events USING btree (place_id, day)
  WHERE (place_id IS NOT NULL);
