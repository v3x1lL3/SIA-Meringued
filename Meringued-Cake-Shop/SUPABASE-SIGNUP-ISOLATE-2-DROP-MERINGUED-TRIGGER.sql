-- Run this AFTER isolate-1 if you want to test signup WITHOUT the Meringued trigger.
-- (Listing triggers in isolate-1 does not remove them — you must run THIS file.)

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now try sign up in the browser with a NEW email.
-- If it still fails, the cause is not this trigger name — check other trigger_name
-- rows from isolate-1, Authentication → Hooks, and browser F12 → Network on the signup request.
