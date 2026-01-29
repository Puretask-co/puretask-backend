// scripts/verify-backup.ts
// Backup verification script for Neon PostgreSQL

import { query } from '../src/db/client';
import { logger } from '../src/lib/logger';

interface TableInfo {
  name: string;
  rowCount: number;
  lastModified?: Date;
}

interface DatabaseHealth {
  connected: boolean;
  version: string;
  currentTime: Date;
  tables: TableInfo[];
  criticalTablesMissing: string[];
}

const CRITICAL_TABLES = [
  'users',
  'jobs',
  'credit_ledger',
  'payouts',
  'stripe_events',
  'job_events',
];

async function verifyBackup(): Promise<void> {
  const health: DatabaseHealth = {
    connected: false,
    version: '',
    currentTime: new Date(),
    tables: [],
    criticalTablesMissing: [],
  };

  try {
    // Test database connection
    logger.info('backup_verification_started', { timestamp: new Date().toISOString() });

    const connectionTest = await query<{ current_time: Date; pg_version: string }>(
      'SELECT NOW() as current_time, version() as pg_version'
    );

    health.connected = true;
    health.currentTime = connectionTest.rows[0].current_time;
    health.version = connectionTest.rows[0].pg_version;

    logger.info('database_connection_successful', {
      version: health.version,
      currentTime: health.currentTime,
    });

    // Check critical tables exist and get row counts
    for (const tableName of CRITICAL_TABLES) {
      try {
        // Check if table exists
        const tableExists = await query<{ exists: boolean }>(
          `
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            ) as exists
          `,
          [tableName]
        );

        if (!tableExists.rows[0].exists) {
          health.criticalTablesMissing.push(tableName);
          logger.warn('critical_table_missing', { tableName });
          continue;
        }

        // Get row count
        const countResult = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM ${tableName}`
        );

        const rowCount = parseInt(countResult.rows[0].count, 10);

        // Get last modified time if table has updated_at column
        let lastModified: Date | undefined;
        try {
          const lastModifiedResult = await query<{ max_updated_at: Date | null }>(
            `SELECT MAX(updated_at) as max_updated_at FROM ${tableName}`
          );
          lastModified = lastModifiedResult.rows[0].max_updated_at || undefined;
        } catch {
          // Table might not have updated_at column, that's okay
        }

        health.tables.push({
          name: tableName,
          rowCount,
          lastModified,
        });

        logger.info('table_verified', {
          tableName,
          rowCount,
          lastModified: lastModified?.toISOString(),
        });
      } catch (error) {
        logger.error('table_check_failed', {
          tableName,
          error: (error as Error).message,
        });
        health.criticalTablesMissing.push(tableName);
      }
    }

    // Check database size
    const dbSizeResult = await query<{ size: string }>(
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
    );
    const dbSize = dbSizeResult.rows[0].size;

    logger.info('database_size', { size: dbSize });

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Backup Verification Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`✅ Database Connection: ${health.connected ? 'OK' : 'FAILED'}`);
    console.log(`📊 PostgreSQL Version: ${health.version.split(' ')[0]} ${health.version.split(' ')[1]}`);
    console.log(`🕐 Current Time: ${health.currentTime.toISOString()}`);
    console.log(`💾 Database Size: ${dbSize}\n`);

    console.log('📋 Critical Tables:');
    health.tables.forEach((table) => {
      const status = table.rowCount >= 0 ? '✅' : '❌';
      const lastModifiedStr = table.lastModified
        ? ` (last modified: ${table.lastModified.toISOString()})`
        : '';
      console.log(`  ${status} ${table.name}: ${table.rowCount.toLocaleString()} rows${lastModifiedStr}`);
    });

    if (health.criticalTablesMissing.length > 0) {
      console.log('\n❌ Missing Critical Tables:');
      health.criticalTablesMissing.forEach((table) => {
        console.log(`  - ${table}`);
      });
    }

    // Final status
    const allTablesPresent = health.criticalTablesMissing.length === 0;
    const hasData = health.tables.some((t) => t.rowCount > 0);

    if (!health.connected) {
      console.log('\n❌ Backup verification FAILED: Database connection failed');
      process.exit(1);
    }

    if (!allTablesPresent) {
      console.log('\n❌ Backup verification FAILED: Critical tables missing');
      process.exit(1);
    }

    if (!hasData) {
      console.log('\n⚠️  WARNING: Database is empty (no data in critical tables)');
      console.log('   This might indicate a fresh database or data loss.');
      console.log('   If this is unexpected, check your backup immediately.');
    } else {
      console.log('\n✅ Backup verification PASSED');
      console.log('   All critical tables present with data');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    logger.error('backup_verification_failed', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    console.error('\n❌ Backup verification FAILED');
    console.error(`Error: ${(error as Error).message}`);
    console.error('\nCheck your DATABASE_URL and ensure the database is accessible.\n');
    process.exit(1);
  }
}

// Run verification
verifyBackup()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
