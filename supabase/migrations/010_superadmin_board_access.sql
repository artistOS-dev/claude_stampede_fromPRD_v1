-- ── Migration 010: Super admin full board access ─────────────────
-- is_super_admin gets full board-level access (read + vote) on all
-- challenge proposals, unlike superfan which is read-only.

-- Allow super admin to INSERT votes on any circle's proposals
do $$ begin
  create policy "proposal_votes: super admin insert"
    on public.challenge_proposal_votes for insert
    with check (public.is_super_admin());
exception when duplicate_object then null;
end $$;

-- Allow super admin to UPDATE (change) their own votes
do $$ begin
  create policy "proposal_votes: super admin update"
    on public.challenge_proposal_votes for update
    using (voter_id = auth.uid() and public.is_super_admin());
exception when duplicate_object then null;
end $$;

-- Allow super admin to SELECT all votes (for tally context)
do $$ begin
  create policy "proposal_votes: super admin read all"
    on public.challenge_proposal_votes for select
    using (public.is_super_admin());
exception when duplicate_object then null;
end $$;
