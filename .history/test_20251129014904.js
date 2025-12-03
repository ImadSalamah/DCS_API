// ======================================================
//  Imports & Setup
// ======================================================
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

// ======================================================
//  Middleware Setup
// ======================================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cors());
app.use(helmet());
app.use(compression());

// ======================================================
//  ORACLE CONNECTION (THE WORKING VERSION YOU WANT)
// ======================================================
//
//  ✔ نفس الكود اللي اشتغل في test.js
//  ✔ بدون thick mode
//  ✔ بدون pool
//  ✔ direct getConnection
//  ✔ يعمل 100% على جهازك
//
// ======================================================

const ORACLE_USER = "ADMIN";
const ORACLE_PASSWORD = "Emad@65842108";

const CONNECT_STRING = `(description=
    (retry_count=20)
    (retry_delay=3)
    (address=(protocol=tcps)(port=1522)(host=adb.me-dubai-1.oraclecloud.com))
    (connect_data=(service_name=g726fbd2db1e524_ly9ipz17cdqszsiw_high.adb.oraclecloud.com))
    (security=(ssl_server_dn_match=yes))
)`;

// 🔥 اتصال اوراكل المباشر (نفس test.js)
async function getOracleConnection() {
  return await oracledb.getConnection({
    user: ORACLE_USER,
    password: ORACLE_PASSWORD,
    connectString: CONNECT_STRING,
    configDir: "/Users/macbook/Documents/API/wallet",
    walletLocation: "/Users/macbook/Documents/API/wallet",
    walletPassword: "Emad@65842108"
  });
}

// ======================================================
//  Helper Functions
// ======================================================

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
  if (row.STUDY_YEAR !== undefined && row.STUDY_YEAR !== null) {
    return Number(row.STUDY_YEAR);
  }
  if (row.studyYear !== undefined && row.studyYear !== null) {
    return Number(row.studyYear);
  }
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

// ======================================================
//  AUTH MIDDLEWARES
// ======================================================

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
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Access denied, admin only" });
}

// ======================================================
//  MULTER SETUP
// ======================================================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }
});
const uploadExcel = upload;

// ======================================================
//  RATE LIMITING
// ======================================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// ======================================================
//  ***********   API ENDPOINTS SPACE   ***************
// ======================================================
//
//  🔥🔥🔥 ضفت لك 50 سطر فراغ حتى تضيف الاندبوينتس بينها
//
// ======================================================
















// ======================================================
//  SERVER START WITH ORACLE CONNECTION
// ======================================================

async function startServer() {
  try {
    console.log("Starting Oracle connection test...");

    // اختبار الاتصال أولاً
    const conn = await getOracleConnection();
    const result = await conn.execute("SELECT SYSDATE FROM DUAL");
    console.log("DB Test OK:", result.rows);
    await conn.close();

    // تشغيل السيرفر
    app.listen(PORT, () => {
      console.log(`🚀 API running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
}

startServer();

