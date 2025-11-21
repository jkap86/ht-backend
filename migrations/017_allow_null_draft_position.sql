-- Allow NULL draft_position for derby drafts (users pick their slots)
ALTER TABLE draft_order
ALTER COLUMN draft_position DROP NOT NULL;
