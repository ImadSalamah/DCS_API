const oracledb = require("oracledb");

async function test() {
  try {
    const conn = await oracledb.getConnection({
      user: "ADMIN",
      password: "YOUR_PASSWORD",
      connectString: "tcps://adb.me-dubai-1.oraclecloud.com:1522/g726fbd2db1e524_dcsaauj_high.adb.oraclecloud.com?ssl_server_dn_match=true"
    });

    console.log("CONNECTED SUCCESSFULLY!");
    const result = await conn.execute("SELECT SYSDATE FROM DUAL");
    console.log(result.rows);

    await conn.close();
  } catch (err) {
    console.error(err);
  }
}

test();
