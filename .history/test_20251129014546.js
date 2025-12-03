// ================================
//  Imports & Setup
// ================================
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

// ================================
//  Middleware Setup
// ================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());
app.use(helmet());
app.use(compression());

// ================================
//  ORACLE THICK MODE (THE WORKING VERSION)
// ================================
oracledb.initOracleClient({
  libDir: "/Users/macbook/instantclient_19_16",
  configDir: "/Users/macbook/Documents/API/wallet"
});

// ================================
//  Oracle DB Settings
// ================================
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.fetchArraySize = 200;

const POOL_ALIAS = "DCS_POOL_01";
let poolInitPromise = null;

// ================================
//  Create / Reuse Oracle Pool
// ================================
async function initOraclePool() {
  if (poolInitPromise) return poolInitPromise;

  poolInitPromise = (async () => {
    try {
      // Try reuse
      try {
        const existing = oracledb.getPool(POOL_ALIAS);
        console.log(`♻️ Reusing Oracle pool: ${POOL_ALIAS}`);
        return existing;
      } catch {}

      console.log("🔄 Creating new Oracle Pool...");

      const pool = await oracledb.createPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: "dcsaauj_high",
        poolAlias: POOL_ALIAS,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
        poolTimeout: 60,
        queueTimeout: 30000
      });

      console.log("✅ Oracle Pool Created Successfully");

      const connection = await pool.getConnection();
      try {
        await connection.execute("SELECT 1 FROM DUAL");
        console.log("🔌 DB Test Connection: OK");
      } finally {
        await connection.close();
      }

      return pool;

    } catch (error) {
      poolInitPromise = null;

      console.error("❌ Oracle Pool Creation Failed:", {
        message: error.message,
        code: error.code,
        errorNum: error.errorNum,
        offset: error.offset
      });

      throw error;
    }
  })();

  return poolInitPromise;
}

// ================================
//  Cleanup Pools
// ================================
async function cleanupExistingPools() {
  try {
    try {
      const aliasPool = oracledb.getPool(POOL_ALIAS);
      await aliasPool.close(0);
      console.log(`✅ Closed pool alias: ${POOL_ALIAS}`);
    } catch {}

    try {
      const defaultPool = oracledb.getPool();
      await defaultPool.close(0);
      console.log("✅ Closed default pool");
    } catch {}

  } catch (err) {
    console.log("ℹ️ No pools to close");
  }
}

// ================================
//  Get DB Connection
// ================================
async function getConnection() {
  try {
    const pool = await initOraclePool();
    return await pool.getConnection();
  } catch (err) {
    console.error("❌ Failed to get Oracle connection:", err);
    throw err;
  }
}

// ================================
//  Graceful Shutdown
// ================================
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await cleanupExistingPools();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 SIGTERM received...");
  await cleanupExistingPools();
  process.exit(0);
});

// ================================
//  Helper Functions
// ================================
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

function extractStudyYear(row) {
  if (row.STUDY_YEAR != null) return Number(row.STUDY_YEAR);
  if (row.studyYear != null) return Number(row.studyYear);
  return null;
}

function cleanNotesField(notes) {
  if (!notes) return "";
  if (typeof notes === "string") return notes;
  if (typeof notes === "object") return notes.toString();
  return String(notes);
}

function parseDoubleEncodedJSON(str) {
  try {
    const first = JSON.parse(str);
    if (typeof first === "string") return JSON.parse(first);
    return first;
  } catch {
    return {};
  }
}

// ================================
//  JWT Auth Middleware
// ================================
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Token missing" });

  const token = header.split(" ")[1];
  if (!process.env.JWT_SECRET)
    return res.status(500).json({ message: "Missing JWT_SECRET" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

// ================================
//  Admin Middleware
// ================================
function isAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Admins only" });
}

// ================================
//  Multer Setup
// ================================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ================================
//  Rate Limiting
// ================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);


















// ======================================================
//     ⬇⬇⬇⬇⬇  ضع الــ ENDPOINTS هنا  ⬇⬇⬇⬇⬇
// ======================================================

















// ================================
//  Start Server
// ================================
async function startServer() {
  try {
    await initOraclePool();

    app.listen(PORT, () => {
      console.log(`🚀 API Server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("❌ Server failed to start:", err);
  }
}

startServer();
