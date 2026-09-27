process.env.NODE_ENV = 'test';
// Keep test output readable: pino would otherwise print a JSON line per request.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://veribot:veribot@localhost:5432/veribot_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-at-least-32-chars-000';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-32-chars-00';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.PORT = process.env.PORT || '4000';

// Rate limiting is a Redis-backed singleton shared across the whole test run, so
// the production caps (20 auth attempts / 15 min) would fail the suite on
// unrelated ordering. Raise them here rather than weakening the product default.
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '100000';
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX || '100000';
// The Stripe webhook must be reachable in tests to assert raw-body handling.
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';