SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."v1_calendar_feed"(text) FROM "anon";

GRANT EXECUTE ON FUNCTION "public"."v1_calendar_feed"(text) TO "anon";

REVOKE ALL ON FUNCTION "public"."v1_calendar_feed"(text) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."v1_calendar_feed"(text) TO "authenticated";
