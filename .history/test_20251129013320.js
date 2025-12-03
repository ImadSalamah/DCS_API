const oracledb = require("oracledb");

async function getDB() {
  return await oracledb.getConnection({
    user: "ADMIN",
    password: "Emad@65842108",
    connectString:
      "(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.me-dubai-1.oraclecloud.com))(connect_data=(service_name=g726fbd2db1e524_ly9ipz17cdqszsiw_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))"
  });
}

(async () => {
  try {
    const conn = await getDB();
    console.log("Connected!");
    const r = await conn.execute("SELECT SYSDATE FROM DUAL");
    console.log(r.rows);
    await conn.close();
  } catch (err) {
    console.log(err);
  }
})();
