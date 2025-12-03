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
//  Oracle DB (TLS Direct Mode - No Wallet)
// =======================================

oracledb.fetchAsString = [oracledb.CLOB];
oracledb.fetchArraySize = 200;

const POOL_ALIAS = "DCS_POOL";
let poolInitPromise = null;

async function initOraclePool() {
  if (poolInitPromise) return poolInitPromise;

  poolInitPromise = (async () => {
    try {
      console.log("🔄 Creating Oracle TLS Pool...");

      const pool = await oracledb.createPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
        poolAlias: POOL_ALIAS,
        poolMin: 1,
        poolMax: 10,
        poolIncrement: 1,
        queueTimeout: 60000
      });

      console.log("✅ Oracle Pool Created");

      // Test connection
      const conn = await pool.getConnection();
      await conn.execute("SELECT 1 FROM dual");
      await conn.close();

      console.log("🔌 Oracle Test Connection OK");

      return pool;

    } catch (err) {
      poolInitPromise = null;
      console.error("❌ Oracle Pool Error:", err);
      throw err;
    }
  })();

  return poolInitPromise;
}

async function getConnection() {
  try {
    const pool = await initOraclePool();
    return await pool.getConnection();
  } catch (err) {
    console.error("❌ Failed to get connection:", err);
    throw err;
  }
}

async function closeOraclePool() {
  try {
    const pool = oracledb.getPool(POOL_ALIAS);
    await pool.close(0);
    console.log("🟢 Oracle pool closed");
  } catch {
    console.log("ℹ️ No pool to close");
  }
}

process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await closeOraclePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 SIGTERM received...");
  await closeOraclePool();
  process.exit(0);
});

// =======================================
//  Helper Functions
// =======================================
function getPagination(req, defaultLimit = 50, maxLimit = 500) {
  let limit = parseInt(req.query.limit) || defaultLimit;
  let offset = parseInt(req.query.offset) || 0;

  limit = Math.min(limit, maxLimit);
  offset = Math.max(offset, 0);

  return { limit, offset };
}

function buildPaginationClause(limit, offset) {
  if (limit > 0) {
    return {
      clause: " OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY",
      binds: { offset, limit }
    };
  }
  return { clause: "", binds: {} };
}

function parseDoubleEncodedJSON(str) {
  try {
    if (typeof str === "string") {
      const first = JSON.parse(str);
      if (typeof first === "string") return JSON.parse(first);
      return first;
    }
    return str;
  } catch {
    return {};
  }
}

// =======================================
//  Auth Middleware
// =======================================
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header)
    return res.status(401).json({ message: "Access denied, token missing" });

  const token = header.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ message: "Invalid or expired token" });
  }
}

function isAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();
  res.status(403).json({ message: "Admin only" });
}

// =======================================
//  Multer Setup
// =======================================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }
});

// =======================================
//  Rate Limiting
// =======================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(limiter);

// =======================================
//  Test Endpoint
// =======================================
app.get("/test-db", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(`SELECT 'CONNECTED OK' FROM dual`);
    res.json({ success: true, result });
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
  await initOraclePool();

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

startServer();
