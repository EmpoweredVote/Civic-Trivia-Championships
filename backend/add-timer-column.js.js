// Add only the missing timer_multiplier column
import pg from 'pg';

const { Client } = pg;

async function addMissingColumn() {
  const client = new Client({
    connectionString: 'postgresql://postgres:On0mastic0n!@localhost:5433/civic_trivia'
  });

  try {
    console.log('Connecting to local PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!');

    console.log('Adding timer_multiplier column...');
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS timer_multiplier REAL DEFAULT 1.0 NOT NULL;
    `);
    
    console.log('✅ Column added successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

addMissingColumn();
