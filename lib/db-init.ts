// Database initialization utility
import { DatabaseService } from './database';

export async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Test database connection
    const stats = await DatabaseService.getStats();
    console.log('Database initialized successfully:', stats);

    // Run cleanup (remove sessions older than 30 days)
    const cleaned = await DatabaseService.cleanupOldSessions(30);
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old test sessions`);
    }

    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    console.warn('Falling back to localStorage-only mode');

    // Return false to indicate database is not available
    return false;
  }
}

// Graceful fallback for when database operations fail
export function handleDatabaseError(operation: string, error: any) {
  console.warn(`Database operation '${operation}' failed:`, error);
  console.warn('Operation will continue with localStorage fallback');
}
