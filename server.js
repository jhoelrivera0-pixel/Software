const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const JWT_SECRET = 'stockvibe_super_secret_key_123'; // Para entorno de producción debería estar en variables de entorno

async function checkLowStockAndAlert(productId) {
  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) return;
    if (product.stock <= product.stock_min) {
      db.all('SELECT key, value FROM settings WHERE key IN ("smtp_host", "smtp_port", "smtp_user", "smtp_pass", "alert_email")', [], (err, rows) => {
        if (err || rows.length === 0) return;
        const config = {};
        rows.forEach(r => config[r.key] = r.value);
        if (config.smtp_host && config.smtp_user && config.smtp_pass && config.alert_email) {
          const transporter = nodemailer.createTransport({
            host: config.smtp_host,
            port: parseInt(config.smtp_port) || 587,
            secure: parseInt(config.smtp_port) === 465,
            auth: {
              user: config.smtp_user,
              pass: config.smtp_pass
            }
          });
          const mailOptions = {
            from: config.smtp_user,
            to: config.alert_email,
            subject: `Alerta de Stock Bajo: ${product.name}`,
            text: `El producto ${product.name} (SKU: ${product.sku}) tiene un stock actual de ${product.stock}, el cual es menor o igual al mínimo permitido (${product.stock_min}).`
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.error('Error enviando alerta de stock:', error);
            else console.log('Alerta de stock enviada:', info.messageId);
          });
        }
      });
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Estado de configuración
let isConfigured = false;
let workDir = '';
let db = null;
const configPath = path.join(__dirname, 'config.json');

// Cargar configuración inicial si existe
function loadConfig() {
  // 1. Prioridad: Variable de entorno WORK_DIR
  if (process.env.WORK_DIR) {
    workDir = process.env.WORK_DIR;
    isConfigured = true;
    initDatabase();
    return;
  }

  // 2. Prioridad: Archivo config.json local
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.workDir) {
        workDir = config.workDir;
        isConfigured = true;
        initDatabase();
        return;
      }
    } catch (err) {
      console.error('Error leyendo config.json:', err);
    }
  }

  // Si está corriendo en Render y no hay configuración, sugerimos una por defecto
  if (process.env.RENDER) {
    // Si se monta un volumen en Render, suele ser /var/data
    workDir = '/var/data';
    // Si la carpeta existe o podemos crearla, nos autoconfiguramos
    try {
      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
      }
      isConfigured = true;
      initDatabase();
      console.log('Autoconfigurado en Render con directorio:', workDir);
    } catch (e) {
      console.log('No se pudo autoconfigurar en Render en /var/data, se requerirá configuración manual.');
      isConfigured = false;
    }
  }
}

// Inicializar Base de Datos SQLite y carpetas
function initDatabase() {
  try {
    const dbDir = path.join(workDir, 'db');
    const uploadsDir = path.join(workDir, 'uploads');

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'inventario.sqlite');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error al abrir la base de datos:', err);
        isConfigured = false;
        return;
      }
      console.log('Base de datos conectada en:', dbPath);
      createTables();
    });
  } catch (err) {
    console.error('Error al inicializar carpetas y BD:', err);
    isConfigured = false;
  }
}

// Crear Tablas y Migrar Esquema
function createTables() {
  db.serialize(() => {
    // Tabla Settings (Para Branding)
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Tabla Categorías
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
      )
    `);

    // Tabla Productos
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        category_id INTEGER,
        price_buy REAL DEFAULT 0.0,
        price_sell REAL DEFAULT 0.0,
        stock INTEGER DEFAULT 0,
        stock_min INTEGER DEFAULT 0,
        image_path TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    // Tabla Clientes (Fase 4)
    db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        ruc TEXT
      )
    `);

    // Tabla Proyectos/Sedes (Fase 4)
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        name TEXT NOT NULL,
        address TEXT,
        coordinates TEXT,
        managers TEXT,
        phones TEXT,
        ruc TEXT,
        FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);

    // Tabla Movimientos (Esquema actualizado)
    db.run(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        ruc TEXT,
        contact TEXT,
        email TEXT,
        phone TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        date TEXT DEFAULT (datetime('now', 'localtime')),
        status TEXT DEFAULT 'Pendiente',
        total REAL DEFAULT 0.0,
        FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        type TEXT CHECK(type IN ('input', 'output')),
        quantity INTEGER NOT NULL,
        concept TEXT,
        client_name TEXT,
        user_name TEXT,
        client_id INTEGER,
        project_id INTEGER,
        supplier_id INTEGER,
        date TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
      )
    `);

    // Ejecutar migración automática si la tabla movements ya existía sin las nuevas columnas
    db.all("PRAGMA table_info(movements)", [], (err, rows) => {
      if (err) {
        console.error('Error verificando esquema de la base de datos:', err);
        return;
      }
      if (rows && rows.length > 0) {
        const hasClientName = rows.some(row => row.name === 'client_name');
        const hasUserName = rows.some(row => row.name === 'user_name');
        const hasClientId = rows.some(row => row.name === 'client_id');
        const hasProjectId = rows.some(row => row.name === 'project_id');
        const hasSupplierId = rows.some(row => row.name === 'supplier_id');

        if (!hasClientName) {
          db.run("ALTER TABLE movements ADD COLUMN client_name TEXT");
        }
        if (!hasUserName) {
          db.run("ALTER TABLE movements ADD COLUMN user_name TEXT");
        }
        if (!hasClientId) {
          db.run("ALTER TABLE movements ADD COLUMN client_id INTEGER");
        }
        if (!hasProjectId) {
          db.run("ALTER TABLE movements ADD COLUMN project_id INTEGER");
        }
        if (!hasSupplierId) {
          db.run("ALTER TABLE movements ADD COLUMN supplier_id INTEGER");
        }
      }
    });

    // Tabla Usuarios (Autenticación y Roles)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Administrador', 'Supervisor', 'Liquidador'))
      )
    `, (err) => {
        // Crear usuario por defecto
        db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
          if (!row) {
            const hash = await bcrypt.hash('administrador', 10);
            db.run("INSERT INTO users (username, password, name, role) VALUES ('admin', ?, 'Administrador Principal', 'Administrador')", [hash]);
          }
        });

        // Configuración inicial por defecto (Settings)
        db.get("SELECT * FROM settings WHERE key = 'app_name'", (err, row) => {
          if (!row) db.run("INSERT INTO settings (key, value) VALUES ('app_name', 'IDEESE INV')");
        });
        db.get("SELECT * FROM settings WHERE key = 'app_logo'", (err, row) => {
          if (!row) db.run("INSERT INTO settings (key, value) VALUES ('app_logo', '')");
        });
    });
  });
}

// Configurar almacenamiento de imágenes dinámico basado en workDir
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(workDir, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Middleware para validar configuración
function checkConfig(req, res, next) {
  if (!isConfigured) {
    return res.status(403).json({ error: 'System not configured', setupRequired: true });
  }
  next();
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Falta token de autorización' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido o expirado' });
    req.user = decoded; // { id, username, role, name }
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'Administrador') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Requiere privilegios de Administrador' });
  }
}

// Endpoints de Autenticación y Usuarios
app.post('/api/login', checkConfig, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Error interno del servidor' });
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  });
});

app.get('/api/users', checkConfig, requireAuth, requireAdmin, (req, res) => {
  db.all('SELECT id, username, name, role FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', checkConfig, requireAuth, requireAdmin, async (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'Todos los campos son requeridos' });

  const hash = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', [username, hash, name, role], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'El nombre de usuario ya existe' });
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

app.delete('/api/users/:id', checkConfig, requireAuth, requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.put('/api/users/:id', checkConfig, requireAuth, requireAdmin, async (req, res) => {
  const { password, name, role } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Faltan campos' });

  let query = 'UPDATE users SET name = ?, role = ? WHERE id = ?';
  let params = [name, role, req.params.id];

  if (password && password.trim() !== '') {
    const hash = await bcrypt.hash(password, 10);
    query = 'UPDATE users SET name = ?, role = ?, password = ? WHERE id = ?';
    params = [name, role, hash, req.params.id];
  }

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Endpoints de configuración e inicialización
app.get('/api/config', (req, res) => {
  res.json({
    isConfigured,
    workDir,
    isRender: !!process.env.RENDER,
    defaultRenderDir: '/var/data'
  });
});

app.post('/api/setup', (req, res) => {
  const { path: reqPath } = req.body;
  if (!reqPath) {
    return res.status(400).json({ error: 'Ruta no especificada' });
  }

  // Resolver ruta absoluta
  let resolvedPath = path.resolve(reqPath);

  try {
    // Intentar crear la carpeta de trabajo
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    // Verificar permisos de escritura intentando crear un archivo temporal
    const tempFile = path.join(resolvedPath, '.test_write');
    fs.writeFileSync(tempFile, 'test');
    fs.unlinkSync(tempFile);

    // Guardar en config.json
    fs.writeFileSync(configPath, JSON.stringify({ workDir: resolvedPath }, null, 2));

    workDir = resolvedPath;
    isConfigured = true;
    initDatabase();

    res.json({ success: true, workDir });
  } catch (err) {
    console.error('Error durante el setup:', err);
    res.status(500).json({ error: `No se pudo escribir en la ruta especificada. Detalles: ${err.message}` });
  }
});

// Middleware dinámico para servir imágenes
app.use('/uploads', (req, res, next) => {
  if (!isConfigured) return res.status(404).send('Not configured');
  express.static(path.join(workDir, 'uploads'))(req, res, next);
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// === ENDPOINTS DE LA API DE INVENTARIO (PROTEGIDOS POR CONFIGURACIÓN Y AUTENTICACIÓN) ===
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/config' || req.path === '/setup' || req.path === '/settings/public') {
    return next();
  }
  return requireAuth(req, res, next);
});

// --- SETTINGS (Branding) ---
app.get('/api/settings/public', checkConfig, (req, res) => {
  db.all('SELECT key, value FROM settings', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  });
});

app.put('/api/settings', checkConfig, requireAuth, requireAdmin, (req, res) => {
  const { app_name, app_logo } = req.body;
  if (!app_name) return res.status(400).json({ error: 'Falta el nombre de la app' });

  db.serialize(() => {
    db.run('UPDATE settings SET value = ? WHERE key = ?', [app_name, 'app_name']);
    if (app_logo !== undefined) {
      db.run('UPDATE settings SET value = ? WHERE key = ?', [app_logo, 'app_logo']);
    }
  });
  res.json({ success: true });
});

// --- CATEGORÍAS ---
app.get('/api/categories', checkConfig, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/categories', checkConfig, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  db.run(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    [name.trim(), description || ''],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Ya existe una categoría con este nombre' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, name, description });
    }
  );
});

app.delete('/api/categories/:id', checkConfig, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM categories WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});


// --- PRODUCTOS ---
app.get('/api/products', checkConfig, (req, res) => {
  const query = `
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.name ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', checkConfig, upload.single('image'), (req, res) => {
  const { sku, name, description, category_id, price_buy, price_sell, stock, stock_min } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const initialStock = parseInt(stock) || 0;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run(
      `INSERT INTO products (sku, name, description, category_id, price_buy, price_sell, stock, stock_min, image_path) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku ? sku.trim() : null,
        name.trim(),
        description || '',
        category_id ? parseInt(category_id) : null,
        parseFloat(price_buy) || 0.0,
        parseFloat(price_sell) || 0.0,
        initialStock,
        parseInt(stock_min) || 0,
        imagePath
      ],
      function (err) {
        if (err) {
          db.run('ROLLBACK');
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Ya existe un producto con este SKU' });
          }
          return res.status(500).json({ error: err.message });
        }

        const productId = this.lastID;

        // Si hay stock inicial, registramos el movimiento de entrada inicial
        if (initialStock > 0) {
          db.run(
            `INSERT INTO movements (product_id, type, quantity, concept) VALUES (?, 'input', ?, 'Inventario Inicial')`,
            [productId, initialStock],
            (moveErr) => {
              if (moveErr) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: moveErr.message });
              }
              db.run('COMMIT');
              res.status(201).json({ id: productId, success: true });
            }
          );
        } else {
          db.run('COMMIT');
          res.status(201).json({ id: productId, success: true });
        }
      }
    );
  });
});

app.put('/api/products/:id', checkConfig, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { sku, name, description, category_id, price_buy, price_sell, stock_min } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  // Si se subió una nueva imagen, actualizamos la ruta, si no, conservamos la actual
  let imageUpdateSql = '';
  let params = [
    sku ? sku.trim() : null,
    name.trim(),
    description || '',
    category_id ? parseInt(category_id) : null,
    parseFloat(price_buy) || 0.0,
    parseFloat(price_sell) || 0.0,
    parseInt(stock_min) || 0
  ];

  if (req.file) {
    imageUpdateSql = ', image_path = ?';
    params.push(`/uploads/${req.file.filename}`);
  }
  params.push(id);

  const query = `
    UPDATE products 
    SET sku = ?, name = ?, description = ?, category_id = ?, price_buy = ?, price_sell = ?, stock_min = ? ${imageUpdateSql}
    WHERE id = ?
  `;

  db.run(query, params, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Ya existe un producto con este SKU' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, changes: this.changes });
  });
});

app.delete('/api/products/:id', checkConfig, (req, res) => {
  const { id } = req.params;

  // Primero obtener la información del producto para poder borrar su imagen si existe
  db.get('SELECT image_path FROM products WHERE id = ?', [id], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });

    db.run('DELETE FROM products WHERE id = ?', [id], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message });

      // Si tiene imagen física, intentar borrarla
      if (product && product.image_path) {
        const fullImgPath = path.join(workDir, product.image_path);
        fs.unlink(fullImgPath, (unlinkErr) => {
          if (unlinkErr) console.error('No se pudo borrar el archivo físico de imagen:', unlinkErr.message);
        });
      }

      res.json({ success: true, changes: this.changes });
    });
  });
});

// Importar Productos Masivamente (Fase 2)
app.post('/api/products/import', checkConfig, async (req, res) => {
  const { products: importList, user_name } = req.body;
  if (!Array.isArray(importList)) {
    return res.status(400).json({ error: 'La lista de productos es requerida y debe ser un array' });
  }

  const runQuery = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

  const getQuery = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  let importedCount = 0;
  let updatedCount = 0;

  try {
    await runQuery('BEGIN TRANSACTION');

    for (const item of importList) {
      const name = item.name ? item.name.trim() : null;
      if (!name) continue;

      const sku = item.sku ? item.sku.trim() : null;
      const description = item.description || '';
      const categoryName = item.category_name ? item.category_name.trim() : null;
      const priceBuy = parseFloat(item.price_buy) || 0.0;
      const priceSell = parseFloat(item.price_sell) || 0.0;
      const stock = parseInt(item.stock) || 0;
      const stockMin = parseInt(item.stock_min) || 0;

      // 1. Resolver Categoría
      let categoryId = null;
      if (categoryName) {
        let catRow = await getQuery('SELECT id FROM categories WHERE name = ?', [categoryName]);
        if (catRow) {
          categoryId = catRow.id;
        } else {
          const insertCat = await runQuery('INSERT INTO categories (name, description) VALUES (?, ?)', [categoryName, 'Categoría creada por importación masiva']);
          categoryId = insertCat.lastID;
        }
      }

      // 2. Verificar si el SKU ya existe
      let existingProduct = null;
      if (sku) {
        existingProduct = await getQuery('SELECT id, stock FROM products WHERE sku = ?', [sku]);
      }

      if (existingProduct) {
        const newStock = existingProduct.stock + stock;
        await runQuery(
          `UPDATE products SET name = ?, description = ?, category_id = ?, price_buy = ?, price_sell = ?, stock = ?, stock_min = ? WHERE id = ?`,
          [name, description, categoryId, priceBuy, priceSell, newStock, stockMin, existingProduct.id]
        );

        if (stock > 0) {
          await runQuery(
            `INSERT INTO movements (product_id, type, quantity, concept, user_name) VALUES (?, 'input', ?, 'Importación Masiva (Stock Adicional)', ?)`,
            [existingProduct.id, stock, user_name || 'Sistema']
          );
        }
        updatedCount++;
      } else {
        const insertProd = await runQuery(
          `INSERT INTO products (sku, name, description, category_id, price_buy, price_sell, stock, stock_min) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [sku, name, description, categoryId, priceBuy, priceSell, stock, stockMin]
        );
        const productId = insertProd.lastID;

        if (stock > 0) {
          await runQuery(
            `INSERT INTO movements (product_id, type, quantity, concept, user_name) VALUES (?, 'input', ?, 'Importación Masiva (Stock Inicial)', ?)`,
            [productId, stock, user_name || 'Sistema']
          );
        }
        importedCount++;
      }
    }

    await runQuery('COMMIT');
    res.json({ success: true, imported: importedCount, updated: updatedCount });
  } catch (err) {
    await runQuery('ROLLBACK').catch(() => {});
    console.error('Error durante la importación masiva:', err);
    res.status(500).json({ error: `Error durante la importación masiva: ${err.message}` });
  }
});


// --- MOVIMIENTOS ---
app.get('/api/movements', checkConfig, (req, res) => {
  const query = `
    SELECT m.*, p.name as product_name, p.sku as product_sku, p.price_buy
    FROM movements m
    JOIN products p ON m.product_id = p.id
    ORDER BY m.date DESC, m.id DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/movements', checkConfig, (req, res) => {
  const { product_id, type, quantity, concept, client_name, client_id, project_id } = req.body;
  const user_name = req.user ? req.user.name : 'Desconocido';
  const qty = parseInt(quantity);

  if (!product_id || !type || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Parámetros inválidos o incompletos' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 1. Obtener stock actual
    db.get('SELECT stock FROM products WHERE id = ?', [product_id], (err, product) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (!product) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      let newStock = product.stock;
      if (type === 'input') {
        newStock += qty;
      } else if (type === 'output') {
        if (product.stock < qty) {
          db.run('ROLLBACK');
          return res.status(400).json({ error: 'Stock insuficiente para esta salida' });
        }
        newStock -= qty;
      } else {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'Tipo de movimiento inválido' });
      }

      // 2. Registrar movimiento (Con client_name y user_name)
      db.run(
        'INSERT INTO movements (product_id, type, quantity, concept, client_name, user_name, client_id, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [product_id, type, qty, concept || null, client_name || null, user_name, client_id || null, project_id || null],
        function(insertErr) {
          if (insertErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: insertErr.message });
          }

          // 3. Actualizar stock del producto
          db.run(
            'UPDATE products SET stock = ? WHERE id = ?',
            [newStock, product_id],
            (updateErr) => {
              if (updateErr) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: updateErr.message });
              }
              db.run('COMMIT');
              if (type === 'output') checkLowStockAndAlert(product_id);
              res.status(201).json({ success: true, newStock });
            }
          );
        }
      );
    });
  });
});

// Registrar Movimientos en Lote (Fase 3)
app.post('/api/movements/bulk', requireAuth, checkConfig, async (req, res) => {
  const { movements, type, concept, client_name, client_id, project_id, date } = req.body;
  const user_name = req.user.name;

  if (!Array.isArray(movements) || movements.length === 0 || !type) {
    return res.status(400).json({ error: 'Parámetros de lote inválidos o vacíos' });
  }

  const runQuery = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

  const getQuery = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  try {
    await runQuery('BEGIN TRANSACTION');

    for (const item of movements) {
      const productId = parseInt(item.product_id);
      const qty = parseInt(item.quantity);

      if (!productId || !qty || qty <= 0) {
        throw new Error('ID de producto o cantidad inválidos en la lista');
      }

      // 1. Obtener stock actual
      const product = await getQuery('SELECT name, stock FROM products WHERE id = ?', [productId]);
      if (!product) {
        throw new Error(`Producto con ID ${productId} no encontrado`);
      }

      let newStock = product.stock;
      if (type === 'input') {
        newStock += qty;
      } else if (type === 'output') {
        if (product.stock < qty) {
          throw new Error(`Stock insuficiente para el producto: ${product.name} (Disponible: ${product.stock}, Requerido: ${qty})`);
        }
        newStock -= qty;
      } else {
        throw new Error('Tipo de movimiento inválido');
      }

      // 2. Registrar movimiento
      await runQuery(
        'INSERT INTO movements (product_id, type, quantity, concept, client_name, user_name, client_id, project_id, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime("now", "localtime")))',
        [productId, type, qty, concept || '', client_name || null, user_name || 'Admin', client_id || null, project_id || null, date || null]
      );

      // 3. Actualizar stock
      await runQuery('UPDATE products SET stock = ? WHERE id = ?', [newStock, productId]);
    }

    await runQuery('COMMIT');
    // Check stock for all output movements
    if (type === 'output') {
      const uniqueProductIds = [...new Set(movements.map(m => parseInt(m.product_id)))];
      uniqueProductIds.forEach(id => checkLowStockAndAlert(id));
    }
    res.json({ success: true, count: movements.length });
  } catch (err) {
    await runQuery('ROLLBACK').catch(() => {});
    console.error('Error en movimientos en lote:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// --- CLIENTES (Fase 4) ---
app.get('/api/clients', checkConfig, (req, res) => {
  db.all('SELECT * FROM clients ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/clients', checkConfig, (req, res) => {
  const { name, ruc } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre es requerido' });
  
  db.run('INSERT INTO clients (name, ruc) VALUES (?, ?)', [name, ruc], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, ruc });
  });
});

app.put('/api/clients/:id', checkConfig, (req, res) => {
  const { name, ruc } = req.body;
  db.run('UPDATE clients SET name = ?, ruc = ? WHERE id = ?', [name, ruc, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- PROYECTOS / SEDES (Fase 4) ---
app.get('/api/clients/:id/projects', checkConfig, (req, res) => {
  db.all('SELECT * FROM projects WHERE client_id = ? ORDER BY name ASC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/clients/:id/projects', checkConfig, (req, res) => {
  const client_id = req.params.id;
  const { name, address, coordinates, managers, phones, ruc } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre del proyecto es requerido' });
  
  const query = `INSERT INTO projects (client_id, name, address, coordinates, managers, phones, ruc) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [client_id, name, address, coordinates, managers, phones, ruc], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, client_id, name, address, coordinates, managers, phones, ruc });
  });
});

app.put('/api/projects/:id', checkConfig, (req, res) => {
  const { name, address, coordinates, managers, phones, ruc } = req.body;
  const query = `UPDATE projects SET name = ?, address = ?, coordinates = ?, managers = ?, phones = ?, ruc = ? WHERE id = ?`;
  db.run(query, [name, address, coordinates, managers, phones, ruc, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/projects/:id', checkConfig, (req, res) => {
  db.run('DELETE FROM projects WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- MOVIMIENTOS POR CLIENTE ---
app.get('/api/clients/:id/movements', checkConfig, (req, res) => {
  const query = `
    SELECT m.*, p.name as product_name, p.sku as product_sku, p.description as product_description,
           proj.name as project_name
    FROM movements m
    JOIN products p ON m.product_id = p.id
    LEFT JOIN projects proj ON m.project_id = proj.id
    WHERE m.type = 'output' AND m.client_id = ?
    ORDER BY m.date DESC
  `;
  db.all(query, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- DASHBOARD ---
app.get('/api/dashboard', checkConfig, (req, res) => {
  const stats = {};

  db.serialize(() => {
    // 1. Total Productos
    db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.totalProducts = row.count;

      // 2. Valor Total del Inventario (Suma de stock * precio_compra)
      db.get('SELECT SUM(stock * price_buy) as total_value FROM products', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.totalValue = row.total_value || 0;

        // 3. Alertas de bajo stock (stock <= stock_min)
        db.get('SELECT COUNT(*) as count FROM products WHERE stock <= stock_min', [], (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.lowStockAlerts = row.count;

          // 4. Últimos movimientos (10 más recientes)
          const movementQuery = `
            SELECT m.*, p.name as product_name
            FROM movements m
            JOIN products p ON m.product_id = p.id
            ORDER BY m.date DESC, m.id DESC LIMIT 10
          `;
          db.all(movementQuery, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.recentMovements = rows;

            // 5. Productos con stock crítico (los 5 más críticos)
            const criticalQuery = `
              SELECT id, name, stock, stock_min
              FROM products
              WHERE stock <= stock_min
              ORDER BY (stock - stock_min) ASC, stock ASC LIMIT 5
            `;
            db.all(criticalQuery, [], (err, rows) => {
              if (err) return res.status(500).json({ error: err.message });
              stats.criticalProducts = rows;

              res.json(stats);
            });
          });
        });
      });
    });
  });
});

// --- PROVEEDORES (Suppliers) ---
app.get('/api/suppliers', checkConfig, (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/suppliers', checkConfig, (req, res) => {
  const { name, ruc, contact, email, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  db.run(
    'INSERT INTO suppliers (name, ruc, contact, email, phone) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), ruc, contact, email, phone],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Ya existe un proveedor con este nombre' });
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, name });
    }
  );
});

app.put('/api/suppliers/:id', checkConfig, (req, res) => {
  const { name, ruc, contact, email, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  db.run(
    'UPDATE suppliers SET name = ?, ruc = ?, contact = ?, email = ?, phone = ? WHERE id = ?',
    [name.trim(), ruc, contact, email, phone, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete('/api/suppliers/:id', checkConfig, (req, res) => {
  db.run('DELETE FROM suppliers WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- ÓRDENES DE COMPRA (Purchase Orders) ---
app.get('/api/purchase_orders', checkConfig, (req, res) => {
  const query = `
    SELECT po.*, s.name as supplier_name 
    FROM purchase_orders po 
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    ORDER BY po.date DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/purchase_orders/:id', checkConfig, (req, res) => {
  const orderId = req.params.id;
  db.get(`
    SELECT po.*, s.name as supplier_name, s.ruc as supplier_ruc, s.contact as supplier_contact, s.phone as supplier_phone, s.email as supplier_email
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    WHERE po.id = ?
  `, [orderId], (err, order) => {
    if (err || !order) return res.status(404).json({ error: 'Órden de compra no encontrada' });
    db.all(`
      SELECT poi.*, p.name as product_name, p.sku as product_sku
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      WHERE poi.order_id = ?
    `, [orderId], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      order.items = items || [];
      res.json(order);
    });
  });
});

app.post('/api/purchase_orders', checkConfig, (req, res) => {
  const { supplier_id, total, items } = req.body;
  if (!supplier_id || !items || items.length === 0) return res.status(400).json({ error: 'Proveedor e items son obligatorios' });
  
  // Calcular total real de los items si no viene especificado
  const calculatedTotal = total !== undefined ? parseFloat(total) : items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.price)), 0);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('INSERT INTO purchase_orders (supplier_id, total, status) VALUES (?, ?, "Pendiente")', [supplier_id, calculatedTotal], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      const orderId = this.lastID;
      const stmt = db.prepare('INSERT INTO purchase_order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
      items.forEach(item => {
        stmt.run([orderId, item.product_id, item.quantity, item.price]);
      });
      stmt.finalize((err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        db.run('COMMIT');
        res.status(201).json({ id: orderId, success: true });
      });
    });
  });
});

const handleReceivePurchase = (req, res) => {
  const orderId = req.params.id;
  const userName = req.user ? req.user.name : 'Admin';
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.get('SELECT * FROM purchase_orders WHERE id = ?', [orderId], (err, order) => {
      if (err || !order) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      if (order.status === 'Recibida') {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'La orden ya fue recibida anteriormente' });
      }
      db.all('SELECT * FROM purchase_order_items WHERE order_id = ?', [orderId], (err, items) => {
        if (err || !items.length) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Error obteniendo items de la orden' });
        }
        
        let completed = 0;
        let hasError = false;
        items.forEach(item => {
          if (hasError) return;
          db.get('SELECT stock FROM products WHERE id = ?', [item.product_id], (err, product) => {
            if (err || !product) { hasError = true; return; }
            let newStock = product.stock + item.quantity;
            db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product_id], (err) => {
              if (err) { hasError = true; return; }
              db.run('INSERT INTO movements (product_id, type, quantity, concept, user_name, supplier_id) VALUES (?, ?, ?, ?, ?, ?)',
                [item.product_id, 'input', item.quantity, 'Recepción OC #' + orderId, userName, order.supplier_id], (err) => {
                if (err) { hasError = true; return; }
                completed++;
                if (completed === items.length) {
                  db.run('UPDATE purchase_orders SET status = "Recibida" WHERE id = ?', [orderId], (err) => {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
                    db.run('COMMIT');
                    res.json({ success: true });
                  });
                }
              });
            });
          });
        });
      });
    });
  });
};

app.put('/api/purchase_orders/:id/receive', requireAuth, checkConfig, handleReceivePurchase);
app.post('/api/purchase_orders/:id/receive', requireAuth, checkConfig, handleReceivePurchase);

app.delete('/api/purchase_orders/:id', requireAuth, requireAdmin, checkConfig, (req, res) => {
  db.run('DELETE FROM purchase_orders WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- IMPORTACIÓN MASIVA DE PRODUCTOS ---
app.post('/api/products/bulk', checkConfig, (req, res) => {
  const { products } = req.body;
  if (!products || !Array.isArray(products) || products.length === 0) return res.status(400).json({ error: 'Array de productos inválido' });
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    let completed = 0;
    let hasError = false;
    products.forEach(p => {
      if(hasError) return;
      db.run(`INSERT INTO products (sku, name, description, price_buy, price_sell, stock, stock_min) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [p.sku || null, p.name, p.description || '', parseFloat(p.price_buy) || 0, parseFloat(p.price_sell) || 0, parseInt(p.stock) || 0, parseInt(p.stock_min) || 0],
      (err) => {
        if(err) { hasError = true; db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
        completed++;
        if (completed === products.length) {
          db.run('COMMIT');
          res.status(201).json({ success: true, count: completed });
        }
      });
    });
  });
});

// Cualquier otra ruta no capturada por la API sirve el index.html (soporte SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cargar la configuración al arrancar
loadConfig();

app.listen(PORT, () => {
  console.log(`Servidor de inventario escuchando en el puerto ${PORT}`);
  if (isConfigured) {
    console.log(`Carpeta de trabajo activa: ${workDir}`);
  } else {
    console.log('El sistema se encuentra en modo configuración inicial.');
  }
});

module.exports = { app };
