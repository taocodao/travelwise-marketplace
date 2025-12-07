import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class UserPreferencesService {
  async getPreferences(userId: string) {
    return prisma.userPreference.findUnique({ where: { userId } });
  }

  async updatePreferences(userId: string, preferences: any) {
    return prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...preferences },
      update: { ...preferences, lastUpdated: new Date() },
    });
  }
}
