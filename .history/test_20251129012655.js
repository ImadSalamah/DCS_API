const oracledb = require("oracledb");
require("dotenv").config();

async function test() {
  try {
    console.log("Connecting...");

    const conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT
    });

    console.log("CONNECTED SUCCESSFULLY!");

    const result = await conn.execute("SELECT SYSDATE FROM DUAL");
    console.log(result.rows);

    await conn.close();

  } catch (err) {
    console.error("❌ CONNECTION ERROR:", err);
  }
}

test();
