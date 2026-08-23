-- One-off: tom@educatr.co already had an account before usernames existed,
-- so their profile is seeded directly here rather than through signup —
-- which is also why it's exempt from the 3-character minimum enforced in
-- the app's signup form.
insert into public.profiles (id, username)
select id, 't'
from auth.users
where email = 'tom@educatr.co'
on conflict (id) do update set username = excluded.username;
