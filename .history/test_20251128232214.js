const oracledb = require("oracledb");
require("dotenv").config();

// ===========================
//   ORACLE THICK MODE
// ===========================
oracledb.initOracleClient({
  libDir: "/Users/macbook/instantclient_19_16",
  configDir: "/Users/macbook/Documents/API/wallet"
});

async function test() {
  try {
    console.log("Connecting...");

    const conn = await oracledb.getConnection({
   
    });

    console.log("CONNECTED SUCCESSFULLY! 🎉");

    const result = await conn.execute("SELECT SYSDATE FROM DUAL");
    console.log("Result:", result.rows);

    await conn.close();
  } catch (err) {
    console.error("❌ CONNECTION ERROR:", err);
  }
}

test();
