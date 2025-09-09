import * as fs from "fs";
import * as path from "path";
import { createPool } from "mysql2/promise";
// 加载 .env（支持 dotenv-expand）
import * as dotenv from "dotenv";
import { expand as dotenvExpand } from "dotenv-expand";

const env = dotenv.config();
dotenvExpand(env);

async function main() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT || 33067);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASS || "12345";
  const database = process.env.DB_NAME || "driver_app";

  // 打印用于连接的关键信息，便于排查（不打印密码）
  console.log(
    "init-db: connecting",
    JSON.stringify({ host, port, user, database })
  );

  const pool = await createPool({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });
  const migDir = path.join(__dirname, "..", "migrations");
  if (!fs.existsSync(migDir)) {
    console.log("init-db: migrations dir not found, skip");
    return;
  }
  const files = fs
    .readdirSync(migDir)
    .filter((f) => /^(\d+)_.*\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b));
  for (const f of files) {
    const p = path.join(migDir, f);
    const sql = fs.readFileSync(p, "utf-8");
    try {
      await pool.query(sql);
      console.log("init-db: applied", f);
    } catch (e) {
      console.log(
        "init-db: migration error for",
        f,
        "(may be safe to ignore):",
        (e as any).message
      );
    }
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
