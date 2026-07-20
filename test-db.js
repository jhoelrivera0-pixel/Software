const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./inventario.sqlite');
db.serialize(() => {
  db.run("INSERT INTO suppliers (name, ruc, contact, email, phone) VALUES ('Test Supplier X', '123', 'John', 'test@test.com', '123')", function(err) {
    if(err) console.error('Supplier Error:', err.message);
    else console.log('Supplier added:', this.lastID);
  });
  db.run("INSERT INTO purchase_orders (supplier_id, total) VALUES (1, 100)", function(err) {
    if(err) console.error('PO Error:', err.message);
    else console.log('PO added:', this.lastID);
  });
});
