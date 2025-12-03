const oracledb = require("oracledb");

async function runApp() {
  console.log("executing runApp");

  const user = "ADMIN";
  const password = "Emad@65842108";

  // Connection string EXACTLY from Oracle console
  const connectString =
    "(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.me-dubai-1.oraclecloud.com))(connect_data=(service_name=g726fbd2db1e524_ly9ipz17cdqszsiw_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))";

  let connection;

  try {
    connection = await oracledb.getConnection({
      user,
      password,
      connectString
    });

    console.log("Connected successfully!");

    const result = await connection.execute("SELECT SYSDATE FROM DUAL");
    console.log(result.rows);

  } catch (err) {
    console.error(err);
  } finally {
    if (connection) await connection.close();
  }
}

runApp();
