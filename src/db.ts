import { createPool } from "mysql2/promise";

const {
  DB_HOST,
  DB_PORT,
  DB_USERNAME,
  DB_PASSWORD,
  DB_DATABASE
} = process.env;

if (!DB_HOST || !DB_USERNAME || DB_PASSWORD === undefined || !DB_DATABASE) {
  throw new Error("Missing required MySQL environment variables.");
}

export const pool = createPool({
  host: DB_HOST,
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

export async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
} 