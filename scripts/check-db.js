#!/usr/bin/env node
/**
 * Check that DATABASE_URL is set and that we can connect to the database.
 * Run from repo root: node scripts/check-db.js
 * Does not print your connection string.
 */
require("dotenv").config();

const { Pool } = require("pg");

function main() {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    console.error("DATABASE_URL is not set.");
    console.error("");
    console.error("Do this:");
    console.error("  1. In the repo root, create a file named .env (or copy from .env.example).");
    console.error("  2. Add a line: DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require");
    console.error("  3. Get the connection string from Neon: Dashboard -> your project -> Connection string.");
    console.error("  4. Ensure it ends with ?sslmode=require (Neon requires SSL).");
    console.error("");
    console.error("Then run this script again from the repo root: node scripts/check-db.js");
    process.exit(1);
  }

  if (!url.includes("sslmode=")) {
    console.warn("Warning: DATABASE_URL has no sslmode. For Neon add: ?sslmode=require");
  }

  console.log("DATABASE_URL is set. Testing connection...");
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 15000,
  });

  pool
    .query("SELECT 1 as ok")
    .then((res) => {
      console.log("Connection OK. Database responded:", res.rows[0]);
      pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Connection failed:", err.message);
      if (err.message.includes("timeout") || err.message.includes("ETIMEDOUT")) {
        console.error("  -> Neon may be paused (free tier). Open the Neon dashboard to wake it, then retry.");
      }
      if (err.message.includes("SSL") || err.message.includes("ssl")) {
        console.error("  -> Add ?sslmode=require to the end of DATABASE_URL.");
      }
      pool.end();
      process.exit(1);
    });
}

main();
