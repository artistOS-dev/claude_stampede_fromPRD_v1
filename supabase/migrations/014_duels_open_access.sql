-- Allow any authenticated user to create duels and read all songs for search.

-- Any logged-in user may insert a duel (they become created_by)
create policy "duels_insert_authenticated" on public.song_duels
  for insert with check (auth.uid() is not null and auth.uid() = created_by);
