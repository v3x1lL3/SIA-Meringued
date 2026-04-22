-- Run this alone in SQL Editor. It only SHOWS triggers — it does NOT change anything.
-- Signup will behave the same before and after this query.

SELECT t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
