-- Enums used across the schema. Mirror the unions in lib/models.

-- assigned in join order, repeating after four
create type public.member_tone as enum ('accent', 'partner', 'success', 'warning');
-- the creator is the owner; owners invite, remove and promote
create type public.member_role as enum ('owner', 'member');
create type public.chore_repeat as enum ('once', 'daily', 'weekly', 'monthly');
create type public.place_status as enum ('been', 'want');
create type public.hue as enum ('accent', 'partner', 'success', 'warning');
-- challenges repeat their goals each day, week (Monday to Sunday) or month (from the 1st)
create type public.challenge_cadence as enum ('daily', 'weekly', 'monthly');
-- what became of a period: done, covered by a streak booster, or missed and let go
create type public.challenge_outcome as enum ('done', 'boosted', 'reset');
-- shared files: the gallery holds photos and videos, the drive holds documents
create type public.file_kind as enum ('photo', 'video', 'document');
-- a file row is inserted before its bytes are uploaded; v1_finish_upload makes it ready
create type public.file_status as enum ('uploading', 'ready');
