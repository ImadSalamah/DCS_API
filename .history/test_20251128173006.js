const oracledb = require("oracledb");

async function test() {
  try {
    oracledb.initOracleClient({
      libDir: "/Users/macbook/instantclient_19_8"
    });

    process.env.TNS_ADMIN = "/Users/macbook/Documents/API/wallet";

    const conn = await oracledb.getConnection({
      user: "ADMIN",
      password: "Dd@12345678",
      connectString: "dcsaauj_high"
    });

    console.log("Connected OK!");
    const r = await conn.execute("SELECT 1 FROM dual");
    console.log(r.rows);
  } catch (err) {
    console.error(err);
  }
}

test();
