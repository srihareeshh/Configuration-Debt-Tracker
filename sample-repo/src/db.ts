/**
 * Database client connection pool
 */

export function createConnectionPool(): void {
  const dbUrl = process.env.DATABASE_URL;
  console.log(`Connecting to database at ${dbUrl ? 'specified URI' : 'default'}...`);
}
