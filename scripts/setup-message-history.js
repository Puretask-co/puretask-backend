const { Pool } = require("pg");
require("dotenv").config();
const fs = require("fs");

async function setupMessageHistory() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log("🚀 Setting up Message History System...\n");

    // Read SQL file
    const sql = fs.readFileSync("./DB/migrations/031_message_history_system.sql", "utf8");

    // Execute migration
    await pool.query(sql);

    console.log("✅ Message History System setup complete!\n");
    console.log("📊 Created tables:");
    console.log("   - cleaner_message_history (logs all sent messages)");
    console.log("   - cleaner_saved_messages (saved drafts/favorites)");
    console.log("\n🎯 New API endpoints available:");
    console.log("   POST   /cleaner/messages/log");
    console.log("   GET    /cleaner/messages/history");
    console.log("   GET    /cleaner/messages/stats");
    console.log("   GET    /cleaner/messages/saved");
    console.log("   POST   /cleaner/messages/saved");
    console.log("   PUT    /cleaner/messages/saved/:id");
    console.log("   DELETE /cleaner/messages/saved/:id");
    console.log("   POST   /cleaner/messages/saved/:id/use");

  } catch (error) {
    console.error("❌ Error setting up message history:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupMessageHistory();

