import { PrismaClient } from "@prisma/client";
import { assertPrismaClientMatchesDatabaseUrl } from "@/lib/prisma-env-contract";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

assertPrismaClientMatchesDatabaseUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
