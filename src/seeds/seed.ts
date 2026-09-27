import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { SEED_ROLES, ROLE_DESCRIPTIONS } from './roles';
import { PERMISSION_SEEDS } from './permissions';
import { passwordService } from '../services/auth/passwordService';
import { toSlug } from '../utils/helpers';

const upsertSeeds = async (): Promise<void> => {
  for (const permission of PERMISSION_SEEDS) {
    const [resource, action] = splitKey(permission.key);
    await prisma.permission.upsert({
      where: { name: permission.key },
      update: { description: permission.description, resource, action },
      create: { name: permission.key, description: permission.description, resource, action },
    });
  }

  for (const role of SEED_ROLES) {
    await prisma.role.upsert({
      where: { name: role },
      update: { description: ROLE_DESCRIPTIONS[role] ?? role },
      create: { name: role, description: ROLE_DESCRIPTIONS[role] ?? role },
    });
  }
};

const splitKey = (key: string): [string, string] => {
  const parts = key.split(':');
  return [parts[0] ?? 'system', parts[1] ?? 'read'];
};

const seedAdmin = async (): Promise<void> => {
  const email = env.SEED_ADMIN_EMAIL;
  if (!email) {
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const passwordHash = await passwordService.hash(env.SEED_ADMIN_PASSWORD ?? 'JestBestAdmin!2026');
  const orgName = 'JestBest';
  const slug = toSlug(orgName);

  const organization = await prisma.organization.create({
    data: {
      name: orgName,
      slug,
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      name: 'JestBest Admin',
      passwordHash,
      emailVerified: new Date(),
      memberships: {
        create: {
          organizationId: organization.id,
          role: 'OWNER',
        },
      },
    },
  });

  logger.info({ userId: user.id, organizationId: organization.id }, 'seeded default admin');
};

export const seed = async (): Promise<void> => {
  await upsertSeeds();
  await seedAdmin();
};

if (require.main === module) {
  seed()
    .then(() => {
      logger.info('seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ err: error }, 'seeding failed');
      process.exit(1);
    });
}
