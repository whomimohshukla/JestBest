import { pino } from 'pino';
import { env } from './environment';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
  base: {
    service: 'jestbest-api',
    env: env.NODE_ENV,
  },
});

export const childLogger = (module: string) => logger.child({ module });
