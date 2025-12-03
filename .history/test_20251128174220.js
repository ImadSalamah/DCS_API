const oracledb = require("oracledb");
require("dotenv").config();

oracledb.initOracleClient({
  libDir: process.env.ORACLE_CLIENT_LIB,  
  configDir: process.env.TNS_ADMIN
});

async function test() {
  try {
    const conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECTION_STRING,
    });

    console.log("Connected!");
    const r = await conn.execute("SELECT SYSDATE FROM DUAL");
    console.log(r.rows);

    await conn.close();
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

test();
