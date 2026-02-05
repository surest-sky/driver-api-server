import * as fs from "fs";
import * as path from "path";
import { createPool } from "mysql2/promise";
import * as dotenv from "dotenv";
import { expand as dotenvExpand } from "dotenv-expand";

// Read .env (with dotenv-expand support)
const env = dotenv.config();
dotenvExpand(env);

async function main() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT || 33067);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASS || "12345";
  const database = process.env.DB_NAME || "driver_app";

  console.log("init-db: connecting", JSON.stringify({ host, port, user, database }));

  const pool = await createPool({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    // MySQL 8 default timeout is short, increase connection timeout appropriately
    connectTimeout: 15_000,
  });

  // Initialize using schema files from sql directory (sorted by filename)
  const sqlDir = path.join(__dirname, "..", "sql");
  if (!fs.existsSync(sqlDir)) {
    console.log("init-db: sql dir not found, skip");
    await pool.end();
    return;
  }

  const files = fs
    .readdirSync(sqlDir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  console.log("init-db: found sql files:", files);

  for (const f of files) {
    const p = path.join(sqlDir, f);
    const sql = fs.readFileSync(p, "utf-8");
    // Skip empty files
    if (!sql.trim()) continue;
    try {
      console.log("init-db: applying", f);
      await pool.query(sql);
      console.log("init-db: applied", f);
    } catch (e) {
      // If failed due to duplicate table or other reasons, print and continue with remaining files
      console.warn("init-db: error in", f, "=>", (e as any).message);
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error("init-db: fatal", e);
  process.exit(1);
});
