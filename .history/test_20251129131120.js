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


app.post("/import-users", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "❌ Please upload an Excel file." });
  }

  let connection;

  try {
    // قراءة ملف Excel
    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    connection = await getConnection();

    let successCount = 0;
    let failCount = 0;
    const results = [];
    let userCounter = 1;

    for (const [index, row] of rows.entries()) {
      try {
        // التحقق من الحقول المطلوبة
        if (!row.USERNAME || row.USERNAME.toString().trim() === '') {
          throw new Error("USERNAME is required");
        }
        if (!row.EMAIL || row.EMAIL.toString().trim() === '') {
          throw new Error("EMAIL is required");
        }
        if (!row.FULL_NAME || row.FULL_NAME.toString().trim() === '') {
          throw new Error("FULL_NAME is required");
        }

        // إنشاء USER_ID إذا غير موجود
        let USER_ID;
        if (row.USER_ID && row.USER_ID.toString().trim() !== '') {
          USER_ID = row.USER_ID.toString().trim();
        } else {
          const rolePrefix = getRolePrefix(row.ROLE || row.role);
          const timestamp = Date.now().toString().slice(-6);
          USER_ID = `${rolePrefix}${timestamp}_${userCounter}`;
          userCounter++;
        }

        const FULL_NAME = row.FULL_NAME.toString().trim();
        const EMAIL = row.EMAIL.toString().trim();
        const USERNAME = row.USERNAME.toString().trim();
        const ROLE = row.ROLE || row.role || "user";

        const IS_ACTIVE = row.IS_ACTIVE !== undefined ? Number(row.IS_ACTIVE) : 1;
        const IS_DEAN = row.IS_DEAN ? Number(row.IS_DEAN) : 0;

        // =============================
        // NO AUTO PASSWORD GENERATION
        // =============================
        let plainPassword;

        if (row.password) {
          plainPassword = row.password.toString().trim();
        } else if (row.PASSWORD) {
          plainPassword = row.PASSWORD.toString().trim();
        } else {
          throw new Error("PASSWORD is required in Excel file and cannot be auto-generated.");
        }

        const PASSWORD_HASH = await bcrypt.hash(plainPassword, 10);

        // التحقق من عدم تكرار USERNAME
        const existingUsername = await connection.execute(
          `SELECT COUNT(*) as count FROM USERS WHERE USERNAME = :USERNAME`,
          { USERNAME },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (existingUsername.rows[0].COUNT > 0) {
          results.push({ row: index + 1, username: USERNAME, status: 'skipped', reason: 'USERNAME already exists' });
          continue;
        }

        // التحقق من عدم تكرار EMAIL
        const existingEmail = await connection.execute(
          `SELECT COUNT(*) as count FROM USERS WHERE EMAIL = :EMAIL`,
          { EMAIL },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (existingEmail.rows[0].COUNT > 0) {
          results.push({ row: index + 1, username: USERNAME, status: 'skipped', reason: 'EMAIL already exists' });
          continue;
        }

        // التحقق من عدم تكرار USER_ID
        const existingUser = await connection.execute(
          `SELECT COUNT(*) as count FROM USERS WHERE USER_ID = :USER_ID`,
          { USER_ID },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (existingUser.rows[0].COUNT > 0) {
          results.push({ row: index + 1, username: USERNAME, status: 'skipped', reason: 'USER_ID already exists' });
          continue;
        }

        // إدخال المستخدم
        await connection.execute(
          `INSERT INTO USERS (
            USER_ID, FULL_NAME, CREATED_AT, EMAIL, IS_ACTIVE, ROLE, USERNAME, PASSWORD_HASH, IS_DEAN
          ) VALUES (
            :USER_ID, :FULL_NAME, SYSDATE, :EMAIL, :IS_ACTIVE, :ROLE, :USERNAME, :PASSWORD_HASH, :IS_DEAN
          )`,
          {
            USER_ID,
            FULL_NAME,
            EMAIL,
            IS_ACTIVE,
            ROLE,
            USERNAME,
            PASSWORD_HASH,
            IS_DEAN
          },
          { autoCommit: false }
        );

        // إذا كان طالب
        if (ROLE.includes('student') || ROLE.includes('طالب')) {
          const studentUniId =
            row.STUDENT_UNIVERSITY_ID ||
            row.student_university_id ||
            row.university_id;

          if (!studentUniId) {
            throw new Error("STUDENT_UNIVERSITY_ID is required for student");
          }

          const studyYear = extractStudyYear(row);

          await connection.execute(
            `INSERT INTO STUDENTS (USER_ID, STUDENT_UNIVERSITY_ID, STUDY_YEAR)
             VALUES (:USER_ID, :STUDENT_UNIVERSITY_ID, :STUDY_YEAR)`,
            {
              USER_ID,
              STUDENT_UNIVERSITY_ID: studentUniId.toString(),
              STUDY_YEAR: studyYear
            },
            { autoCommit: false }
          );
        }

        // إذا كان طبيب
        if (ROLE.includes('doctor') || ROLE.includes('طبيب')) {
          let ALLOWED_FEATURES = row.ALLOWED_FEATURES || "[]";

          await connection.execute(
            `INSERT INTO DOCTORS (
              DOCTOR_ID, ALLOWED_FEATURES, DOCTOR_TYPE, IS_ACTIVE, CREATED_AT
            ) VALUES (
              :DOCTOR_ID, :ALLOWED_FEATURES, :DOCTOR_TYPE, 1, SYSTIMESTAMP
            )`,
            {
              DOCTOR_ID: USER_ID,
              ALLOWED_FEATURES,
              DOCTOR_TYPE: row.DOCTOR_TYPE || 'طبيب عام'
            },
            { autoCommit: false }
          );
        }

        successCount++;
        results.push({
          row: index + 1,
          user_id: USER_ID,
          username: USERNAME,
          email: EMAIL,
          password: plainPassword,
          role: ROLE,
          status: "success"
        });

      } catch (err) {
        failCount++;
        results.push({
          row: index + 1,
          username: row.USERNAME || 'Unknown',
          status: "failed",
          error: err.message
        });
      }
    }

    await connection.commit();

    res.json({
      message: "📥 Import completed successfully",
      summary: {
        total: rows.length,
        inserted: successCount,
        failed: failCount,
      },
      details: results
    });

  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ message: "Server error during import", error: error.message });

  } finally {
    if (connection) await connection.close();
    try {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch {}
  }
});













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

