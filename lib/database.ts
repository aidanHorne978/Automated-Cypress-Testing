// Database utilities for TestFlow AI

// If '@prisma/client' is not available, handle the error gracefully.
let PrismaClient;
try {
  // Dynamically require PrismaClient to avoid crashing if module not found
  // @ts-ignore
  PrismaClient = require('@prisma/client').PrismaClient;
} catch {
  // Assign a dummy class if Prisma is unavailable (e.g., during build or lint)
  PrismaClient = class { };
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: InstanceType<typeof PrismaClient>;
};

let prisma: InstanceType<typeof PrismaClient>;
let isDatabaseAvailable = false;

try {
  prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
  isDatabaseAvailable = true;
} catch (error) {
  console.warn('Database not available, using localStorage fallback:', error);
  // Create a dummy client that will fail gracefully
  prisma = {} as InstanceType<typeof PrismaClient>;
  isDatabaseAvailable = false;
}

export { prisma, isDatabaseAvailable };

// Database operations
export class DatabaseService {
  // Save test session and tests
  static async saveTestSession(
    url: string,
    tests: any[],
    summary: string,
    userAgent?: string,
    ipAddress?: string
  ) {
    if (!isDatabaseAvailable) {
      throw new Error('Database not available');
    }

    try {
      // Create session
      const session = await prisma.testSession.create({
        data: {
          url,
          userAgent,
          ipAddress,
        },
      });

      // Create tests
      await prisma.test.createMany({
        data: tests.map((test: any) => ({
          sessionId: session.id,
          title: test.title || 'Untitled Test',
          description: test.why || test.description,
          code: test.code || '',
          category: test.category || 'general',
        })),
      });

      return { sessionId: session.id, testCount: tests.length };
    } catch (error) {
      console.error('Error saving test session:', error);
      throw new Error('Failed to save test data');
    }
  }

  // Get tests for a URL (latest session)
  static async getLatestTestsForUrl(url: string) {
    if (!isDatabaseAvailable) {
      throw new Error('Database not available');
    }

    try {
      const session = await prisma.testSession.findFirst({
        where: { url },
        orderBy: { createdAt: 'desc' },
        include: {
          tests: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!session) return null;

      return {
        url: session.url,
        tests: session.tests.map((test: any) => ({
          id: test.id,
          title: test.title,
          why: test.description,
          code: test.code,
          category: test.category,
        })),
        summary: '', // We'll store summary separately in future
        timestamp: session.createdAt.getTime(),
      };
    } catch (error) {
      console.error('Error fetching tests for URL:', error);
      throw error;
    }
  }

  // Get test history for a URL
  static async getTestHistoryForUrl(url: string, limit: number = 5) {
    if (!isDatabaseAvailable) {
      throw new Error('Database not available');
    }

    try {
      const sessions = await prisma.testSession.findMany({
        where: { url },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          tests: true,
        },
      });

      return sessions.map((session: any) => ({
        sessionId: session.id,
        url: session.url,
        testCount: session.tests.length,
        createdAt: session.createdAt,
        tests: session.tests.map((test: any) => ({
          id: test.id,
          title: test.title,
          description: test.description,
          code: test.code,
          category: test.category,
        })),
      }));
    } catch (error) {
      console.error('Error fetching test history:', error);
      throw error;
    }
  }

  // Delete old test sessions (cleanup)
  static async cleanupOldSessions(daysOld: number = 30) {
    if (!isDatabaseAvailable) {
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.testSession.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`Cleaned up ${result.count} old test sessions`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      return 0;
    }
  }

  // Get statistics
  static async getStats() {
    if (!isDatabaseAvailable) {
      return { totalSessions: 0, totalTests: 0, uniqueUrls: 0 };
    }

    try {
      const [totalSessions, totalTests, uniqueUrls] = await Promise.all([
        prisma.testSession.count(),
        prisma.test.count(),
        prisma.testSession.findMany({
          select: { url: true },
          distinct: ['url'],
        }).then((results: any) => results.length),
      ]);

      return {
        totalSessions,
        totalTests,
        uniqueUrls,
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return { totalSessions: 0, totalTests: 0, uniqueUrls: 0 };
    }
  }
}
