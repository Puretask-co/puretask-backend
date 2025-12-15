# Database Schema Export Guide

**Purpose:** Export current database schema to verify all tables, enums, and indexes

---

## Option 1: Using pg_dump (Recommended - Command Line)

If you have `pg_dump` installed and access to your Neon database connection string:

### Export Full Schema (Tables + Indexes)
```bash
pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges > schema.sql
```

### Export Tables Only (No Indexes)
```bash
pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges --section=pre-data > schema-tables-only.sql
```

### Export Indexes Only
```bash
pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges --section=post-data > schema-indexes-only.sql
```

### Replace `$DATABASE_URL` with your actual connection string
Example:
```bash
pg_dump "postgresql://user:password@host:5432/dbname" --schema-only --no-owner --no-privileges > schema.sql
```

---

## Option 2: Using Neon SQL Editor (Query-Based)

**Note:** Neon's SQL Editor supports SQL queries but NOT shell commands like `pg_dump`. However, you can run queries to inspect your schema.

### List All Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### List All Enums
```sql
SELECT t.typname AS enum_name,
       string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname NOT LIKE 'pg_%'
GROUP BY t.typname
ORDER BY t.typname;
```

### Get Table Structure for a Specific Table
```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'jobs'  -- Replace with your table name
ORDER BY ordinal_position;
```

### List All Indexes
```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Get All Foreign Keys
```sql
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public';
```

### Export All Tables as CREATE TABLE Statements (Complex Query)
```sql
-- This generates CREATE TABLE statements (may need adjustments)
SELECT 
    'CREATE TABLE ' || table_name || ' (' || 
    string_agg(
        column_name || ' ' || 
        CASE 
            WHEN data_type = 'USER-DEFINED' THEN udt_name
            ELSE data_type
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ', '
        ORDER BY ordinal_position
    ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
```

---

## Option 3: Using psql Command Line

If you have `psql` installed:

### Connect and Export
```bash
psql "$DATABASE_URL" -c "\dt" > tables-list.txt
psql "$DATABASE_URL" -c "\d+ jobs" > jobs-table-structure.txt  # Replace jobs with any table
```

### Export Full Schema
```bash
psql "$DATABASE_URL" -c "\d" > all-tables.txt
```

---

## Option 4: Using a Node.js Script (If pg_dump Not Available)

Create a script to export schema:

```javascript
// export-schema.js
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function exportSchema() {
  // Get all tables
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);

  let output = '-- PureTask Database Schema Export\n';
  output += `-- Generated: ${new Date().toISOString()}\n\n`;

  // For each table, get structure
  for (const row of tables.rows) {
    const tableName = row.table_name;
    const columns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    output += `\n-- Table: ${tableName}\n`;
    output += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    output += columns.rows.map(col => {
      const type = col.udt_name || col.data_type;
      const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      return `  ${col.column_name} ${type}${nullable}${defaultVal}`;
    }).join(',\n');
    output += '\n);\n';
  }

  fs.writeFileSync('schema-export.sql', output);
  console.log('Schema exported to schema-export.sql');
  await pool.end();
}

exportSchema().catch(console.error);
```

Run with:
```bash
node export-schema.js
```

---

## Recommended Approach for Neon

**Best Option:** Use `pg_dump` from your local machine or a CI/CD environment with your Neon connection string.

**Quick Check:** Use Neon SQL Editor with the queries above to verify specific tables exist.

**Full Export:** Use `pg_dump` command line tool for complete schema export.

---

## What to Look For in Exported Schema

Compare exported schema against `CURRENT_SYSTEM_INVENTORY.md` to verify:

1. All tables from migrations exist
2. All enum types are present
3. All indexes are created
4. Foreign key relationships are correct
5. No unexpected tables (might indicate drift)

---

## Next Steps After Export

1. Save exported schema to `docs/schema-export.sql`
2. Compare with expected tables in `CURRENT_SYSTEM_INVENTORY.md`
3. Identify any missing tables or columns
4. Document discrepancies

---

END OF GUIDE

