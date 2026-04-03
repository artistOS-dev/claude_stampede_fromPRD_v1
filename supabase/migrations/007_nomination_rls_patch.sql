-- ============================================================
-- Stampede — RLS patch for nomination_budgets and nominations
-- Migration: 007_nomination_rls_patch.sql
--
-- Fixes missing INSERT/UPDATE policies that caused "Could not load
-- budget" errors when authenticated users tried to nominate artists.
-- nomination_budgets only had SELECT policies; nominations only had
-- a SELECT policy.  Both tables need user-facing write policies
-- because NominationService runs under the authenticated user's JWT.
-- ============================================================

-- nomination_budgets: allow users to create and update their own budget rows
create policy if not exists "nomination_budgets: user inserts own"
  on public.nomination_budgets for insert
  with check (user_id = auth.uid());

create policy if not exists "nomination_budgets: user updates own"
  on public.nomination_budgets for update
  using (user_id = auth.uid());

-- nominations: allow circle members to submit nominations for their circle
create policy if not exists "nominations: circle members insert"
  on public.nominations for insert
  with check (
    nominated_by = auth.uid()
    and exists (
      select 1 from public.circle_members cm
      where cm.circle_id = nominations.circle_id
        and cm.user_id = auth.uid()
    )
  );
