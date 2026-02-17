// Update local PostgreSQL schema (ES module version)
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateSchema() {
  const client = new Client({
    connectionString: 'postgresql://postgres:On0mastic0n!@localhost:5433/civic_trivia'
  });

  try {
    console.log('Connecting to local PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema updates...');
    await client.query(schema);
    console.log('✅ Schema updated successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

updateSchema();
