const oracledb = require("oracledb");
require("dorenv").config();

async function test() {
  try {
    const conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECTION_STRING,
    });

    console.log("✅ Connected to Oracle Autonomous DB!");
    const result = await conn.execute("SELECT SYSDATE FROM DUAL");
    console.log("SYSDATE =", result.rows[0]);

    await conn.close();
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

test();
