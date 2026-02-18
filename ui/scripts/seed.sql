INSERT OR IGNORE INTO profiles (id, name, created_at) VALUES ('default', 'Default Profile', datetime('now'));
INSERT OR IGNORE INTO settings (id, profile_id) VALUES (1, 'default');
INSERT OR IGNORE INTO global_prompt (id, prompt, profile_id) VALUES (1, 'You are a helpful assistant.', 'default');
INSERT OR IGNORE INTO predefined_prompts (id, title, prompt, profile_id) VALUES ('msg-1', 'Welcome', 'Hello world', 'default');
INSERT OR IGNORE INTO quick_replies (id, title, prompt, profile_id) VALUES ('reply-1', 'LGTM', 'Looks good to me', 'default');
INSERT OR IGNORE INTO jobs (id, name, session_ids, created_at, repo, branch, profile_id, status, auto_approval, background) VALUES ('job-1', 'Job 1', '["session-1"]', datetime('now'), 'test/repo', 'main', 'default', 'PENDING', 0, 0);
INSERT OR IGNORE INTO sessions (id, name, title, prompt, state, last_updated, profile_id) VALUES ('session-1', 'Session 1', 'Session 1', 'Test Prompt', 'COMPLETED', strftime('%s','now')*1000, 'default');
INSERT OR IGNORE INTO sessions (id, name, title, prompt, state, last_updated, profile_id) VALUES ('mock-1', 'Mock Session 1', 'Mock Session 1', 'Mock Prompt 1', 'COMPLETED', strftime('%s','now')*1000, 'default');
INSERT OR IGNORE INTO sessions (id, name, title, prompt, state, last_updated, profile_id) VALUES ('mock-2', 'Mock Session 2', 'Mock Session 2', 'Mock Prompt 2', 'AWAITING_USER_FEEDBACK', strftime('%s','now')*1000, 'default');
