const oracledb = require('oracledb');
require("dotenv").config();

async function runApp() {
  console.log("Running test connection...");

  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  // 🔥 Thin Mode connect string (بدون Wallet)
  const connectString = `(description=
    (retry_count=20)
    (retry_delay=3)
    (address=(protocol=tcps)(port=1522)(host=adb.me-dubai-1.oraclecloud.com))
    (connect_data=(service_name=g726fbd2db1e524_dcsaauj_high.adb.oraclecloud.com))
    (security=(ssl_server_dn_match=yes))
  )`;

  let connection;
  try {
    connection = await oracledb.getConnection({
      user,
      password,
      connectString
    });

    console.log("🎉 Successfully connected to Oracle Autonomous DB!");
    const result = await connection.execute("SELECT SYSDATE FROM DUAL");
    console.log("Query Result:", result.rows);

  } catch (err) {
    console.error("❌ ERROR:", err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

runApp();
