-- Allow an artist_manager to register more than one artist in the same circuit.
-- Previously a unique constraint on (circuit_id, artist_manager_id) prevented this.

alter table public.circuit_participants
  drop constraint if exists circuit_participants_circuit_id_artist_manager_id_key;
