SET local check_function_bodies = off;

DROP POLICY "read self and my together" ON "public"."profiles";

DROP POLICY "leave" ON "public"."together_members";

DROP POLICY "unclaim own" ON "public"."wish_claims";

DROP POLICY "edit own" ON "public"."wishes";

DROP POLICY "remove own" ON "public"."wishes";

ALTER TABLE "public"."together_members"
  DROP CONSTRAINT "together_members_profile_id_key";

ALTER TABLE "public"."together_members"
  DROP CONSTRAINT "together_members_together_id_tone_key";

ALTER TABLE "public"."profiles"
  ADD COLUMN "current_together_id" uuid;

ALTER TABLE "public"."togethers"
  ADD COLUMN "invite_expires_at" timestamp WITH time zone NOT NULL DEFAULT (now() + '48:00:00'::interval);

CREATE TYPE "public"."member_role" AS ENUM (
  'owner',
  'member'
);

ALTER TABLE "public"."together_members"
  ADD COLUMN "role" public.member_role NOT NULL DEFAULT 'member'::public.member_role;

ALTER TABLE "public"."together_members"
  ADD COLUMN "left_at" timestamp WITH time zone;

ALTER TABLE "public"."together_members"
  ADD COLUMN "last_seen_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TYPE "public"."member_tone" ADD VALUE 'success' AFTER 'partner';

