const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
  db.run("CREATE TABLE purchase_orders (id INTEGER PRIMARY KEY, total REAL DEFAULT 0.0)");
  let total = undefined; // Like in Express when req.body.total is missing
  db.run("INSERT INTO purchase_orders (total) VALUES (?)", [total], function(err) {
    if (err) console.error("Error:", err.message);
    else console.log("Success, lastID:", this.lastID);
  });
});
