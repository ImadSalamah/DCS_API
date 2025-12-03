const oracledb = require("oracledb");
require("dotenv").config();

// ===========================
//   ORACLE THICK MODE
//   (macOS Intel Works)
// ===========================
oracledb.initOracleClient({
  libDir: "/Users/macbook/instantclient_19_16",
  configDir: "/Users/macbook/Documents/API/wallet"  // IMPORTANT
});

async function test() {
  try {
    console.log("Connecting...");

    const conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: "dcsaauj_high"  // MUST MATCH tnsnames.ora
    });

    console.log("CONNECTED SUCCESSFULLY! 🎉");
    const result = await conn.execute("SELECT SYSDATE FROM DUAL");
    console.log(result.rows);

    await conn.close();
  } catch (err) {
    console.error("❌ CONNECTION ERROR:", err);
  }
}

test();
