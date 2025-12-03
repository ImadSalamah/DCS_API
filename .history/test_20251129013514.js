const oracledb = require('oracledb');


async function runApp()
{
	console.log("executing runApp");
	const user = "ADMIN";
	const password = "Emad@65842108";
	const connectString = '(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.me-dubai-1.oraclecloud.com))(connect_data=(service_name=g726fbd2db1e524_ly9ipz17cdqszsiw_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))';
	
	let connection;
	try {
		connection = await oracledb.getConnection({
			user,
			password,
			connectString,
		
            configDir: "/Users/macbook/Documents/API/wallet",
            walletLocation: "/Users/macbook/Documents/API/wallet/",
            walletPassword: "Emad@65842108"
		});
		console.log("Successfully connected to Oracle Databas");
		const result = await connection.execute("select * from dual");
		console.log("Query rows", result.rows);
	} catch (err) {
		console.error(err);
	} finally {
		 if (connection){
			try {
				await connection.close();
			} catch (err) {
				console.error(err);
			}
		}
	}
}

runApp();