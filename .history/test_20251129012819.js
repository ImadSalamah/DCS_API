const oracledb = require("oracledb");
require("dotenv").config();

async function test() {
  try {
    console.log("Connecting...");

    const conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: "(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.me-dubai-1.oraclecloud.com))(connect_data=(service_name=g726fbd2db1e524_dcsaauj_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))"
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
