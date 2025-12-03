// =======================================
//  Imports & Basic Setup
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
//  Oracle DB (TLS Direct — No Wallet)
// =======================================

// تحويل CLOB إلى string تلقائياً
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.fetchArraySize = 200;

// إعدادات البوول
const POOL_ALIAS = "DCS_POOL";
let poolInitPromise = null;

// إنشاء البوول
async function initOraclePool() {
  if (poolInitPromise) return poolInitPromise;

  poolInitPromise = (async () => {
    try {
      console.log("🔄 Creating Oracle TLS Pool...");

      const pool = await oracledb.createPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING, // TLS direct
        poolAlias: POOL_ALIAS,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
      });

      console.log("✅ Oracle Pool Created");

      const conn = await pool.getConnection();
      await conn.execute("SELECT 1 FROM dual");
      await conn.close();
      console.log("🔌 Test Connection OK");

      return pool;

    } catch (err) {
      poolInitPromise = null;
      console.error("❌ Oracle Pool Error:", err);
      throw err;
    }
  })();

  return poolInitPromise;
}

// الحصول على connection
async function getConnection() {
  try {
    const pool = await initOraclePool();
    return await pool.getConnection();
  } catch (err) {
    console.error("❌ Failed to get Oracle connection:", err);
    throw err;
  }
}

// إغلاق البوول عند إيقاف السيرفر
async function closeOraclePool() {
  try {
    const pool = oracledb.getPool(POOL_ALIAS);
    await pool.close(0);
    console.log("🟢 Oracle pool closed");
  } catch {
    console.log("ℹ️ No pool to close");
  }
}

// إغلاق السيرفر بأمان
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
      binds: { offset, limit },
    };
  }
  return { clause: "", binds: {} };
}

function extractStudyYear(row) {
  if (row.STUDY_YEAR !== undefined && row.STUDY_YEAR !== null)
    return Number(row.STUDY_YEAR);
  if (row.studyYear !== undefined && row.studyYear !== null)
    return Number(row.studyYear);
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
    if (typeof str === "string") {
      const first = JSON.parse(str);
      if (typeof first === "string") return JSON.parse(first);
      return first;
    }
    return str || {};
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

  if (!process.env.JWT_SECRET) {
    console.error("❌ Missing JWT_SECRET");
    return res.status(500).json({ message: "Server configuration error" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ message: "Invalid or expired token" });
  }
}

function isAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();
  res.status(403).json({ message: "Access denied, admin only" });
}

// =======================================
//  Multer Uploads
// =======================================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadExcel = upload;

// =======================================
//  Rate Limiting
// =======================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

// =======================================
//  🚀 READY FOR ENDPOINTS — ضع API هنا
// =======================================

// مثال بسيط لاختبار الداتا بيس
app.get("/test-db", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute("SELECT 'Oracle OK' FROM dual");
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
