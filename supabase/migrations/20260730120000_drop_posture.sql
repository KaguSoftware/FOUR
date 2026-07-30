-- Remove alert posture (strict/soft). Decided 2026-07-30: the app is
-- strict-only. Posture only ever changed copy — never a number, a threshold,
-- or what counts as up (that constraint was core/posture.ts's whole contract)
-- — so dropping it changes nothing about any account's data or alerts.
--
-- SEQUENCING: apply this only after every distributed client has stopped
-- selecting the column. TestFlight build 4 still lists `posture` in its
-- system_state select and would break against a database where the column is
-- gone; build 5+ and the current web deploy do not read it. HANDOFF.md carries
-- the reminder.

alter table public.system_state drop column if exists posture;
