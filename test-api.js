const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

const SECRET = 'stockvibe_super_secret_key_123';
const token = jwt.sign({ id: 1, username: 'admin', role: 'Administrador', name: 'Admin' }, SECRET, { expiresIn: '8h' });

const payload = {
  name: 'Proveedor de Prueba ' + Date.now(),
  ruc: '123456',
  contact: 'Juan',
  email: 'juan@test.com',
  phone: '099999'
};

fetch('http://localhost:3000/api/suppliers', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify(payload)
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(res => console.log('Suppliers:', res))
.catch(err => console.error(err));

const poPayload = {
  supplier_id: 1,
  items: [
    { product_id: 1, quantity: 10, price: 5 }
  ]
};

fetch('http://localhost:3000/api/purchase_orders', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify(poPayload)
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(res => console.log('PO:', res))
.catch(err => console.error(err));
