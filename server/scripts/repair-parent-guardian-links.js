/**
 * Repair misclassified student_guardian_links for Parent-role users.
 * Run once per tenant DB after guardian dedupe migration issues.
 *
 * Usage: node scripts/repair-parent-guardian-links.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const { repairMisclassifiedParentLinkRelations } = require('../src/utils/studentContactSync');

const pool = new Pool({
  host: process.env.DB_SCHOOL_HOST || 'localhost',
  port: Number(process.env.DB_SCHOOL_PORT || 5432),
  database: process.env.DB_SCHOOL_NAME || process.env.DB_NAME || 'schooldb',
  user: process.env.DB_SCHOOL_USER || process.env.DB_USER || 'postgres',
  password: process.env.DB_SCHOOL_PASS || process.env.DB_PASSWORD || '',
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await repairMisclassifiedParentLinkRelations(client);
    await client.query('COMMIT');
    console.log('Repair complete:', result);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Repair failed:', err.message);
  process.exit(1);
});
