const oracledb = require("oracledb");
require("dotenv").config();

async function test() {
  try {
    const conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECTION_STRING,
    });

    console.log("Connected!");
    console.log((await conn.execute("SELECT SYSDATE FROM DUAL")).rows);

    await conn.close();
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

test();
