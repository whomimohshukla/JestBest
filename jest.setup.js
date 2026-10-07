process.env.NODE_ENV = 'test';
// Keep test output readable: pino would otherwise print a JSON line per request.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
// Tests must never be able to touch the development database: every integration
// suite truncates this one between tests, so an ambient DATABASE_URL (which .env
// points at the dev database) would silently wipe it. Prefer an explicit
// TEST_DATABASE_URL, then fall back to jestbest_test, and deliberately ignore
// DATABASE_URL here. Note dotenv does not override already-set variables, so
// this value survives the `dotenv/config` import in src/config/environment.ts.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://jestbest:jestbest@localhost:5432/jestbest_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-at-least-32-chars-000';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-32-chars-00';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.PORT = process.env.PORT || '4000';
// Expose a Google OAuth client so the authorize route can be exercised
// end-to-end (state issuance → provider URL) without hitting Google.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'google-test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'google-test-client-secret';
process.env.GOOGLE_OAUTH_CALLBACK_URL =
  process.env.GOOGLE_OAUTH_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/oauth/google/callback';

// Rate limiting is a Redis-backed singleton shared across the whole test run, so
// the production caps (20 auth attempts / 15 min) would fail the suite on
// unrelated ordering. Raise them here rather than weakening the product default.
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '100000';
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX || '100000';

// Never send real email from the test suite. .env points EMAIL_PROVIDER at a
// live SMTP provider and `dotenv/config` (imported by src/config/environment)
// would apply it here, so this is set unconditionally rather than defaulted.
process.env.EMAIL_PROVIDER = 'log';
// The Stripe webhook must be reachable in tests to assert raw-body handling.
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';