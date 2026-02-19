import { pool } from '../config/database.js';

/**
 * Migration: Add is_admin column to users table
 * This column enables role-based access control for admin features.
 */
async function migrateAdminRole() {
  const client = await pool.connect();
  try {
    console.log('Starting admin role migration...');

    // Users table is in the public schema
    await client.query('SET search_path TO public');

    // Add is_admin column with default false
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
    `);

    console.log('✓ is_admin column added to users table');
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateAdminRole().catch((error) => {
  console.error('Fatal migration error:', error);
  process.exit(1);
});
