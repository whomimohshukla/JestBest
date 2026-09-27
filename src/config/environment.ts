import 'dotenv/config';
import { z } from 'zod';

const INSECURE_ENCRYPTION_KEYS = new Set([
  '0000000000000000000000000000000000000000000000000000000000000000',
  'replace-with-32-byte-hex-encryption-key',
]);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default('jestbest:'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PASSWORD_RESET_EXPIRES_IN: z.string().default('1h'),
  JWT_ISSUER: z.string().default('jestbest'),

  ENCRYPTION_KEY: z.string().min(32),

  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.string().default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(20),

  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().default('jestbest-artifacts'),
  AWS_S3_ENDPOINT: z.string().optional(),

  AI_PROVIDER: z.enum(['openai', 'gemini', 'huggingface', 'mock']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash-lite'),
  HUGGINGFACE_API_KEY: z.string().optional(),
  HUGGINGFACE_MODEL: z.string().default('meta-llama/Meta-Llama-3.1-8B-Instruct'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_MAX_TOKENS: z.coerce.number().default(2048),
  LLM_TEMPERATURE: z.coerce.number().default(0.2),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['sendgrid', 'ses', 'smtp', 'log']).default('log'),
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('notifications@jestbest.ai'),
  EMAIL_INBOX_FILE: z.string().default('.dev-mailbox.log'),
  REQUIRE_EMAIL_VERIFICATION: z
    .string()
    .optional()
    .transform((value) => value === undefined || value === '' || value.toLowerCase() !== 'false'),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_CALLBACK_URL: z.string().optional(),
  JIRA_CLIENT_ID: z.string().optional(),
  JIRA_CLIENT_SECRET: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),

  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

if (INSECURE_ENCRYPTION_KEYS.has(env.ENCRYPTION_KEY)) {
  console.error(
    'Invalid environment configuration:\n' +
      `  - ENCRYPTION_KEY: the configured value is a known-insecure placeholder. Generate a fresh 32-byte hex key (e.g. \`openssl rand -hex 32\`) and set it explicitly.`
  );
  process.exit(1);
}
