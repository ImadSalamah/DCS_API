// =======================================
//  Imports & Setup
// =======================================
const path = require("path");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const multer = require("multer");
const express = require("express");
const XLSX = require("xlsx");
const compression = require("compression");
const oracledb = require("oracledb");
const apicache = require("apicache");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const cache = apicache.middleware;

// =======================================
//  Middleware
// =======================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cors());
app.use(helmet());
app.use(compression());

// =======================================
//  Oracle Wallet (NO initOracleClient)
// =======================================

// Autonomous DB لا يحتاج initOracleClient()
// لذلك نحذفها لأنها تسبب ORA-00001

oracledb.fetchAsString = [oracledb.CLOB];
oracledb.fetchArraySize = 200;

const POOL_ALIAS = "DCS_POOL";
let poolInitPromise = null;

// =======================================
//  Create Oracle Pool (Safe Version)
// =======================================
async function initOraclePool() {
  if (poolInitPromise) return poolInitPromise;

  poolInitPromise = (async () => {
    try {
      console.log("🔄 Creating Oracle Wallet Pool...");

      const pool = await oracledb.createPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECTION_STRING, // Wallet connect string
        poolAlias: POOL_ALIAS,
        poolMin: 1,
        poolMax: 10,
        poolIncrement: 1
      });

      console.log("✅ Oracle Wallet Pool Created");

      // 🔌 Test connection
      const conn = await pool.getConnection();
      await conn.execute("SELECT 1 FROM dual");
      await conn.close();

      console.log("🔌 Wallet Connection OK");

      return pool;

    } catch (err) {
      poolInitPromise = null; // reset if failed
      console.error("❌ Oracle Wallet Pool Error:", err);
      throw err;
    }
  })();

  return poolInitPromise;
}

// =======================================
//  Get Connection
// =======================================
async function getConnection() {
  const pool = await initOraclePool();
  return await pool.getConnection();
}

// =======================================
//  Test Endpoint
// =======================================
app.get("/test-db", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT 'ORACLE CONNECTED (WALLET MODE)' AS status FROM dual`
    );
    res.json({ success: true, result: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// =======================================
//  Start Server
// =======================================
async function startServer() {
  try {
    await initOraclePool();
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
}

startServer();
