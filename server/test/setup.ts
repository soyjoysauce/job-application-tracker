// Fake environment for tests. No real Supabase or Anthropic call is ever made:
// both clients are replaced with fakes (see test/helpers.ts).
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.DAILY_CLAUDE_LIMIT = '3';
process.env.CLAUDE_MODEL = 'claude-sonnet-5';
