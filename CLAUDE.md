Create a script `embeddings_generator.ts`.

Steps to follow:

- Fetch all the casts from the `casts` table in Supabase.
- Filter the data for each `fid` from the casts for the `data[0].author`
- Now use this filtered data, and add it to the `users` table in Supabase with their `fid` as the primary key.

Information about the `casts` table:

- `fid`: `text`
- `casts`: `jsonb` (data: Cast[])

Information about the `users` table:

- `fid`: `text`
- `user_name`: `text`
- `following_count`: `integer`
- `followers_count`: `integer`
- `pfp_url`: `text`
- `embeddings`: `vector`
- `summary`: `text`
- `channels_following`: `jsonb`
- `channels_member`: `jsonb`
- `verified_addresses`: `jsonb`

TASK:

- Fetch the data from the `casts` table.
- Filter the data for each `fid` from the casts for the `data[0].author`
- Upload the data to the `users` table in Supabase.

DO NOT WORK ON THE `channels_following`, `channels_member`, `embeddings` and `summary` column.
