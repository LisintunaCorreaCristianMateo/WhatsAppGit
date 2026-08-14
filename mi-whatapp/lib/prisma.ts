import { PrismaClient } from '../app/generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Provide a clear message in server logs when DATABASE_URL is missing
  // so production 500s are easier to diagnose.
  // Do not expose sensitive info — keep message high-level.
  console.error('Prisma: missing DATABASE_URL environment variable.');
  throw new Error('Missing DATABASE_URL environment variable');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;