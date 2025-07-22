"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.testConnection = testConnection;
const promise_1 = require("mysql2/promise");
const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE } = process.env;
if (!DB_HOST || !DB_USERNAME || DB_PASSWORD === undefined || !DB_DATABASE) {
    throw new Error("Missing required MySQL environment variables.");
}
exports.pool = (0, promise_1.createPool)({
    host: DB_HOST,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});
async function testConnection() {
    const conn = await exports.pool.getConnection();
    await conn.ping();
    conn.release();
}
