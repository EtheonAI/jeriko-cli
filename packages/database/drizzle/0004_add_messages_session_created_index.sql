CREATE INDEX IF NOT EXISTS "idx_messages_session_created" ON "messages" ("session_id","created_at");
