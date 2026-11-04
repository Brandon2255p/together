-- Enums used across the schema. Mirror the unions in lib/models.

create type public.member_tone as enum ('accent', 'partner');
create type public.chore_repeat as enum ('once', 'daily', 'weekly', 'monthly');
create type public.place_status as enum ('been', 'want');
create type public.hue as enum ('accent', 'partner', 'success', 'warning');
