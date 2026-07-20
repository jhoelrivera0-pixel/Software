document.addEventListener('DOMContentLoaded', () => {
  // --- VARIABLES DE ESTADO Y ELEMENTOS DEL DOM ---
  let isConfigured = false;
  let categories = [];
  let products = [];
  let currentEditingProductId = null;
  let activeUser = 'Administrador';
  let currentMoveList = []; // Fase 3

  // Pantallas Principales
  const setupScreen = document.getElementById('setup-screen');
  const appContainer = document.getElementById('app-container');
  const activeWorkDirSpan = document.getElementById('active-work-dir');
  const pageTitle = document.getElementById('page-title');

  // Selector de Usuario Activo (Fase 2)
  const activeUserSelect = document.getElementById('active-user-select');

  // Formularios
  const setupForm = document.getElementById('setup-form');
  const workPathInput = document.getElementById('work-path');
  const renderTip = document.getElementById('render-tip');
  const setupError = document.getElementById('setup-error');

  const categoryForm = document.getElementById('category-form');
  const productForm = document.getElementById('product-form');
  const movementForm = document.getElementById('movement-form');

  // Campo de Cliente en Movimiento (Fase 4)
  const moveClientContainer = document.getElementById('move-client-container');
  const moveClientInput = document.getElementById('move-client');
  const moveProjectContainer = document.getElementById('move-project-container');
  const moveProjectInput = document.getElementById('move-project');
  const moveDateInput = document.getElementById('move-date');

  // Menú Lateral (Navegación SPA)
  const menuItems = document.querySelectorAll('.menu-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Modales
  const modalProduct = document.getElementById('modal-product');
  const modalMovement = document.getElementById('modal-movement');
  
  // Botones de Apertura de Modales
  const btnAddProductQuick = document.getElementById('btn-add-product-quick');
  const btnQuickMovement = document.getElementById('btn-quick-movement');

  // Búsqueda y Filtros de Inventario
  const searchProductInput = document.getElementById('search-product');
  const filterCategorySelect = document.getElementById('filter-category');

  // Botones de Importación/Exportación CSV (Fase 2)
  const btnDownloadTemplate = document.getElementById('btn-download-template');
  const btnImportCsv = document.getElementById('btn-import-csv');
  const csvFileInput = document.getElementById('csv-file-input');
  const btnExportInventory = document.getElementById('btn-export-inventory');

  // Búsqueda y Filtros de Historial (Fase 2)
  const searchHistoryInput = document.getElementById('search-history');
  const searchHistoryClientInput = document.getElementById('search-history-client');
  const filterHistoryTypeSelect = document.getElementById('filter-history-type');
  const filterHistoryUserSelect = document.getElementById('filter-history-user');
  const filterHistoryDateStart = document.getElementById('filter-history-date-start');
  const filterHistoryDateEnd = document.getElementById('filter-history-date-end');
  const btnExportHistory = document.getElementById('btn-export-history');
  const filterHistoryClientSelect = document.getElementById('filter-history-client-select');
  const filterHistoryProjectSelect = document.getElementById('filter-history-project-select');
  const investmentReportSummary = document.getElementById('investment-report-summary');
  const investmentTotalValue = document.getElementById('investment-total-value');
  const btnExportInvestment = document.getElementById('btn-export-investment');

  // Carga de imágenes
  const imgUploadZone = document.getElementById('img-upload-zone');
  const prodImageFileInput = document.getElementById('prod-image');
  const imgPreview = document.getElementById('img-preview');
  const uploadIcon = imgUploadZone.querySelector('.upload-icon');
  const uploadLabel = imgUploadZone.querySelector('.upload-label');

  const loginScreen = document.getElementById('login-screen');
  const loginForm = document.getElementById('login-form');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const btnLogout = document.getElementById('btn-logout');
  const navUsers = document.getElementById('nav-users');

  let currentUser = null;

  // --- FETCH WRAPPER PARA JWT ---
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    let resource = args[0];
    let config = args[1] || {};

    if (typeof resource === 'string' && resource.startsWith('/api/') && !['/api/login', '/api/setup', '/api/config'].includes(resource)) {
      config.headers = config.headers || {};
      const token = localStorage.getItem('authToken');
      
      if (token) {
        if (config.headers instanceof Headers) {
          config.headers.set('Authorization', `Bearer ${token}`);
        } else {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }
    
    args[1] = config;

    try {
      const response = await originalFetch.apply(window, args);
      if (response.status === 401 && typeof resource === 'string' && resource !== '/api/login') {
        alert('Cerrando sesión. Endpoint fallido: ' + resource);
        logout();
      }
      return response;
    } catch (err) {
      throw err;
    }
  };

  // --- AUTENTICACIÓN ---
  function checkAuth() {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('currentUser');
    
    if (!token || !userStr) {
      showLoginScreen();
      return;
    }

    try {
      currentUser = JSON.parse(userStr);
      document.getElementById('active-user-name').textContent = currentUser.name;
      document.getElementById('active-user-role').textContent = currentUser.role;

      const navSettings = document.getElementById('nav-settings');

      if (currentUser.role === 'Administrador') {
        navUsers.classList.remove('hidden');
        if (navSettings) navSettings.classList.remove('hidden');
      } else {
        navUsers.classList.add('hidden');
        if (navSettings) navSettings.classList.add('hidden');
      }

      loginScreen.classList.add('hidden');
      appContainer.classList.remove('hidden');
      
      initThemeConfig();
      navigateTo('dashboard');
    } catch (e) {
      alert('Error local en checkAuth: ' + e.message);
      logout();
    }
  }

  function showLoginScreen() {
    appContainer.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }

  function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    currentUser = null;
    location.reload();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    
    try {
      const res = await originalFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.value,
          password: loginPassword.value
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
      
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      checkAuth();
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  btnLogout.addEventListener('click', logout);

  // --- CONTROLADOR DE TEMA (localStorage) ---
  function initThemeConfig() {
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const iconTheme = document.getElementById('icon-theme') || (btnThemeToggle ? btnThemeToggle.querySelector('i') : null);
    const savedTheme = localStorage.getItem('themePreference') || 'dark';
    
    const applyTheme = (theme) => {
      if (theme === 'light') {
        document.documentElement.classList.add('theme-light');
        if (iconTheme) iconTheme.setAttribute('data-lucide', 'moon');
      } else {
        document.documentElement.classList.remove('theme-light');
        if (iconTheme) iconTheme.setAttribute('data-lucide', 'sun');
      }
      lucide.createIcons();
    };

    applyTheme(savedTheme);

    btnThemeToggle.addEventListener('click', () => {
      const isLight = document.documentElement.classList.contains('theme-light');
      const newTheme = isLight ? 'dark' : 'light';
      localStorage.setItem('themePreference', newTheme);
      applyTheme(newTheme);
    });
  }

  // --- CONTROLADOR DE NAVEGACIÓN ---
  
  // Inicialización de la App
  async function checkSystemConfig() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      
      isConfigured = data.isConfigured;

      if (!isConfigured) {
        setupScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
        
        // Si es Render, sugerir la ruta por defecto
        if (data.isRender) {
          renderTip.classList.remove('hidden');
          workPathInput.value = data.defaultRenderDir;
        }
      } else {
        setupScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        activeWorkDirSpan.textContent = data.workDir;
        activeWorkDirSpan.title = data.workDir;
        
        checkAuth();
      }
      lucide.createIcons();
    } catch (err) {
      console.error('Error al verificar configuración:', err);
      showSetupError('No se pudo conectar con el servidor.');
    }
  }

  // Navegar entre vistas (SPA)
  function navigateTo(targetId) {
    menuItems.forEach(item => {
      if (item.getAttribute('data-target') === targetId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    tabPanels.forEach(panel => {
      if (panel.id === `panel-${targetId}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    const titles = {
      dashboard: 'Dashboard Informativo',
      inventory: 'Inventario de Productos',
      categories: 'Categorías de Inventario',
      clients: 'Directorio de Clientes',
      history: 'Historial de Movimientos de Stock',
      suppliers: 'Directorio de Proveedores',
      purchases: 'Órdenes de Compra',
      users: 'Gestión de Usuarios',
      settings: 'Configuración del Sistema'
    };
    pageTitle.textContent = titles[targetId] || 'Gestión';

    if (targetId === 'dashboard') {
      loadDashboardData();
    } else if (targetId === 'inventory') {
      loadInventoryData();
    } else if (targetId === 'categories') {
      loadCategoriesData();
    } else if (targetId === 'clients') {
      loadClientsData();
    } else if (targetId === 'history') {
      loadHistoryData();
    } else if (targetId === 'suppliers') {
      loadSuppliers();
    } else if (targetId === 'purchases') {
      loadPurchases();
    } else if (targetId === 'users') {
      loadUsers();
    } else if (targetId === 'settings') {
      loadSettingsData();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // --- API OPERATIONS ---

  // Configuración inicial del directorio
  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-setup-submit');
    const originalText = btnSubmit.innerHTML;
    
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Inicializando...</span><i class="animate-spin" data-lucide="loader"></i>';
    lucide.createIcons();
    setupError.classList.add('hidden');

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: workPathInput.value.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        isConfigured = true;
        setupScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        activeWorkDirSpan.textContent = data.workDir;
        activeWorkDirSpan.title = data.workDir;
        initUserConfig();
        initThemeConfig();
        navigateTo('dashboard');
      } else {
        showSetupError(data.error || 'Ocurrió un error al configurar la carpeta.');
      }
    } catch (err) {
      showSetupError('No se pudo establecer comunicación con el servidor.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
      lucide.createIcons();
    }
  });

  function showSetupError(msg) {
    setupError.textContent = msg;
    setupError.classList.remove('hidden');
  }

  // --- DASHBOARD LÓGICA ---
  async function loadDashboardData() {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Error al cargar dashboard');
      const data = await res.json();

      document.getElementById('stat-total-products').textContent = data.totalProducts;
      document.getElementById('stat-total-value').textContent = `S/ ${data.totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      document.getElementById('stat-low-stock').textContent = data.lowStockAlerts;

      const alertCard = document.querySelector('.stat-card.alert');
      if (data.lowStockAlerts > 0) {
        alertCard.classList.add('bg-warning-soft');
      } else {
        alertCard.classList.remove('bg-warning-soft');
      }

      // Renderizar tabla de stock crítico
      const criticalTableBody = document.querySelector('#table-critical-stock tbody');
      criticalTableBody.innerHTML = '';
      
      if (data.criticalProducts.length === 0) {
        criticalTableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="text-align: center; color: var(--text-muted);">Sin alertas de stock crítico. ¡Todo al día!</td></tr>`;
      } else {
        data.criticalProducts.forEach(prod => {
          criticalTableBody.innerHTML += `
            <tr>
              <td><strong>${escapeHtml(prod.name)}</strong></td>
              <td class="text-danger" style="font-weight: 600;">${prod.stock}</td>
              <td>${prod.stock_min}</td>
              <td><span class="badge badge-danger">Bajo Stock</span></td>
            </tr>
          `;
        });
      }

      // Renderizar Actividad Reciente
      const timeline = document.getElementById('timeline-recent');
      timeline.innerHTML = '';

      if (data.recentMovements.length === 0) {
        timeline.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 20px 0;">No se registran movimientos recientes.</p>`;
      } else {
        data.recentMovements.forEach(move => {
          const isInput = move.type === 'input';
          const markerClass = isInput ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger';
          const markerIcon = isInput ? 'arrow-down-left' : 'arrow-up-right';
          
          let title = '';
          if (isInput) {
            title = `Entrada: ${escapeHtml(move.product_name)}`;
          } else {
            const clientStr = move.client_name ? ` para ${escapeHtml(move.client_name)}` : '';
            title = `Salida: ${escapeHtml(move.product_name)}${clientStr}`;
          }
          
          const dateStr = formatDate(move.date);

          timeline.innerHTML += `
            <div class="timeline-item">
              <div class="timeline-marker ${markerClass}">
                <i data-lucide="${markerIcon}"></i>
              </div>
              <div class="timeline-content">
                <span class="timeline-title">${title} (${move.quantity} uds)</span>
                <span class="timeline-concept">${escapeHtml(move.concept || 'Sin concepto')}</span>
                <span class="timeline-time">${dateStr} • Por: ${escapeHtml(move.user_name || 'Admin')}</span>
              </div>
            </div>
          `;
        });
      }
      lucide.createIcons();
    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err);
    }
  }

  // --- INVENTARIO LÓGICA ---
  async function loadInventoryData() {
    await loadCategoriesList();
    
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error();
      products = await res.json();
      renderInventoryTable();
    } catch (err) {
      console.error('Error al obtener productos:', err);
    }
  }

  function getFilteredProducts() {
    const searchTerm = searchProductInput.value.toLowerCase().trim();
    const filterCat = filterCategorySelect.value;

    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm) || (p.sku && p.sku.toLowerCase().includes(searchTerm));
      const matchCat = filterCat === '' || p.category_id == filterCat;
      return matchSearch && matchCat;
    });
  }

  function renderInventoryTable() {
    const tableBody = document.querySelector('#table-products tbody');
    tableBody.innerHTML = '';

    const filtered = getFilteredProducts();

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">No se encontraron productos.</td></tr>`;
      return;
    }

    filtered.forEach(p => {
      const isCritical = p.stock <= p.stock_min;
      const stockColor = isCritical ? 'color: var(--color-danger); font-weight: 700;' : '';
      
      const imgElement = p.image_path 
        ? `<img src="${p.image_path}" class="table-product-img" alt="${escapeHtml(p.name)}">`
        : `<div class="no-img-placeholder"><i data-lucide="package"></i></div>`;

      tableBody.innerHTML += `
        <tr>
          <td>${imgElement}</td>
          <td><code style="font-size: 0.85rem;">${escapeHtml(p.sku || '-')}</code></td>
          <td><strong>${escapeHtml(p.name)}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(p.description || '')}</span></td>
          <td><span class="badge bg-primary-soft text-primary">${escapeHtml(p.category_name || 'Sin Categoría')}</span></td>
          <td>$${p.price_buy.toFixed(2)}</td>
          <td>$${p.price_sell.toFixed(2)}</td>
          <td style="${stockColor}">
            ${p.stock} 
            ${isCritical ? '<i data-lucide="alert-triangle" style="width: 14px; height: 14px; display: inline; stroke: var(--color-danger); margin-left: 4px;"></i>' : ''}
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon edit" onclick="editProduct(${p.id})" title="Editar"><i data-lucide="edit-3"></i></button>
              <button class="btn-icon delete" onclick="deleteProduct(${p.id})" title="Eliminar"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
    lucide.createIcons();
  }

  // --- IMPORTACIÓN Y EXPORTACIÓN CSV (FASE 2) ---

  // Descargar Plantilla CSV
  btnDownloadTemplate.addEventListener('click', () => {
    const csvContent = "\uFEFFsku,nombre,descripcion,categoria,precio_compra,precio_venta,stock_inicial,stock_minimo\n" +
      "PROD-001,Laptop Dell Latitude,Procesador Intel i5 8GB RAM,Electrónica,450.00,600.00,10,2\n" +
      "PROD-002,Mouse Inalámbrico Logitech,Mouse ergonómico 2.4Ghz,Accesorios,15.50,25.00,40,5\n" +
      "PROD-003,Teclado Mecánico RGB,Teclado con switches mecánicos,Accesorios,35.00,55.00,15,3\n";
      
    downloadCSV(csvContent, 'plantilla_importar.csv');
  });

  // Exportar Inventario Actual a CSV
  btnExportInventory.addEventListener('click', () => {
    const filtered = getFilteredProducts();
    if (filtered.length === 0) {
      alert('No hay productos que exportar en la lista actual.');
      return;
    }

    let csvContent = "\uFEFFSKU,Nombre,Descripcion,Categoria,Precio Compra,Precio Venta,Stock,Stock Minimo\n";
    filtered.forEach(p => {
      const row = [
        p.sku || '',
        p.name,
        p.description || '',
        p.category_name || 'Sin Categoria',
        p.price_buy,
        p.price_sell,
        p.stock,
        p.stock_min
      ].map(text => `"${String(text).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    downloadCSV(csvContent, 'inventario_exportado.csv');
  });

  // Abrir selector de archivo CSV al hacer clic en botón de Importar
  btnImportCsv.addEventListener('click', () => {
    csvFileInput.click();
  });

  // Procesar archivo CSV seleccionado
  csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const productsList = parseCSV(text);

      if (productsList.length === 0) {
        alert('El archivo CSV no contiene registros válidos o está vacío.');
        csvFileInput.value = '';
        return;
      }

      if (confirm(`Se detectaron ${productsList.length} productos listos para importar. ¿Deseas continuar?`)) {
        try {
          const res = await fetch('/api/products/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products: productsList, user_name: activeUser })
          });

          let data;
          try {
            data = await res.json();
          } catch (jsonError) {
            throw new Error('La respuesta del servidor no es válida. Por favor, reinicia la aplicación (ejecuta run.bat nuevamente).');
          }

          if (res.ok) {
            alert(`¡Importación exitosa!\nProductos Nuevos Creados: ${data.imported}\nProductos Existentes Actualizados: ${data.updated}`);
            loadInventoryData();
          } else {
            alert('Error al importar: ' + (data.error || 'Ocurrió un error inesperado'));
          }
        } catch (error) {
          console.error(error);
          alert(error.message === 'Failed to fetch' 
            ? 'Error de conexión. Verifica que el servidor esté activo.' 
            : (error.message || 'Error desconocido al importar productos.'));
        }
      }
      csvFileInput.value = ''; // Limpiar input file
    };
    reader.readAsText(file, 'UTF-8');
  });

  // Parser CSV Sencillo
  function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["\uFEFF]+|["\uFEFF]+$/g, ''));
    
    // Mapeo esperado de cabeceras en español o inglés
    const skuIdx = headers.findIndex(h => h === 'sku' || h === 'codigo');
    const nameIdx = headers.findIndex(h => h === 'nombre' || h === 'name');
    const descIdx = headers.findIndex(h => h === 'descripcion' || h === 'description');
    const catIdx = headers.findIndex(h => h === 'categoria' || h === 'category' || h === 'categoría');
    const priceBuyIdx = headers.findIndex(h => h === 'precio_compra' || h === 'price_buy' || h === 'compra');
    const priceSellIdx = headers.findIndex(h => h === 'precio_venta' || h === 'price_sell' || h === 'venta');
    const stockIdx = headers.findIndex(h => h === 'stock_inicial' || h === 'stock' || h === 'cantidad');
    const stockMinIdx = headers.findIndex(h => h === 'stock_minimo' || h === 'stock_min' || h === 'minimo');

    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Dividir por comas, considerando campos con comillas
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const fields = matches.map(f => f.trim().replace(/^"+|"+$/g, ''));

      if (fields.length === 0 || !fields[nameIdx]) continue;

      result.push({
        sku: skuIdx !== -1 ? fields[skuIdx] : null,
        name: fields[nameIdx],
        description: descIdx !== -1 ? fields[descIdx] : '',
        category_name: catIdx !== -1 ? fields[catIdx] : null,
        price_buy: priceBuyIdx !== -1 ? parseFloat(fields[priceBuyIdx]) || 0.0 : 0.0,
        price_sell: priceSellIdx !== -1 ? parseFloat(fields[priceSellIdx]) || 0.0 : 0.0,
        stock: stockIdx !== -1 ? parseInt(fields[stockIdx]) || 0 : 0,
        stock_min: stockMinIdx !== -1 ? parseInt(fields[stockMinIdx]) || 0 : 5
      });
    }

    return result;
  }

  // Descarga Física del Archivo
  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }


  // --- CATEGORÍAS LÓGICA ---
  async function loadCategoriesData() {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error();
      categories = await res.json();
      renderCategoriesTable();
    } catch (err) {
      console.error('Error al obtener categorías:', err);
    }
  }

  function renderCategoriesTable() {
    const tableBody = document.querySelector('#table-categories tbody');
    tableBody.innerHTML = '';

    if (categories.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 30px 0;">No se han creado categorías aún.</td></tr>`;
      return;
    }

    categories.forEach(cat => {
      tableBody.innerHTML += `
        <tr>
          <td><strong>${escapeHtml(cat.name)}</strong></td>
          <td style="color: var(--text-muted);">${escapeHtml(cat.description || '-')}</td>
          <td>
            <button class="btn-icon delete" onclick="deleteCategory(${cat.id})" title="Eliminar"><i data-lucide="trash-2"></i></button>
          </td>
        </tr>
      `;
    });
    lucide.createIcons();
  }

  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('cat-name');
    const descInput = document.getElementById('cat-description');

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.value, description: descInput.value })
      });

      const data = await res.json();

      if (res.ok) {
        categoryForm.reset();
        loadCategoriesData();
      } else {
        alert(data.error || 'Error al crear categoría');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  });

  window.deleteCategory = async function(id) {
    if (!confirm('¿Estás seguro de eliminar esta categoría? Los productos asociados quedarán "Sin Categoría".')) return;

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadCategoriesData();
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo eliminar la categoría');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  async function loadCategoriesList() {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error();
      categories = await res.json();

      // Filtro de categoría en listado
      filterCategorySelect.innerHTML = '<option value="">Todas las Categorías</option>';
      categories.forEach(cat => {
        filterCategorySelect.innerHTML += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
      });

      // Select de categoría en modal producto
      const prodCategorySelect = document.getElementById('prod-category');
      prodCategorySelect.innerHTML = '<option value="">Seleccione Categoría</option>';
      categories.forEach(cat => {
        prodCategorySelect.innerHTML += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
      });
    } catch (err) {
      console.error('Error al cargar lista de categorías:', err);
    }
  }


  // --- CLIENTES Y SEDES LÓGICA (FASE 4) ---
  let clientsData = [];
  
  async function loadClientsData() {
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error();
      clientsData = await res.json();
      renderClientsTable();
      populateClientsDropdowns();
    } catch (err) {
      console.error('Error al obtener clientes:', err);
    }
  }

  function getFilteredClients() {
    const searchTerm = document.getElementById('search-client').value.toLowerCase().trim();
    return clientsData.filter(c => c.name.toLowerCase().includes(searchTerm) || (c.ruc && c.ruc.toLowerCase().includes(searchTerm)));
  }

  function renderClientsTable() {
    const tableBody = document.querySelector('#table-clients tbody');
    tableBody.innerHTML = '';
    const filtered = getFilteredClients();

    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px 0;">No se encontraron clientes.</td></tr>';
      return;
    }

    filtered.forEach(c => {
      tableBody.innerHTML += `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${escapeHtml(c.ruc || '-')}</td>
          <td>
            <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="toggleProjectsRow(${c.id}, this)">
              <i data-lucide="plus"></i> Sedes
            </button>
          </td>
          <td>
            <button class="btn-secondary" onclick="editClient(${c.id}, '${escapeHtml(c.name)}', '${escapeHtml(c.ruc || '')}')">
              <i data-lucide="edit-2"></i> Editar
            </button>
          </td>
        </tr>
        <tr id="projects-row-${c.id}" class="accordion-row hidden">
          <td colspan="4">
            <div class="accordion-content">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; color: var(--text-color);">Sedes de ${escapeHtml(c.name)}</h4>
                <button class="btn-primary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="addProjectToClient(${c.id})">
                  <i data-lucide="plus"></i> Añadir Sede
                </button>
              </div>
              <table class="data-table" id="table-projects-${c.id}">
                <thead>
                  <tr>
                    <th>SEDE / PROYECTO</th>
                    <th>DIRECCIÓN</th>
                    <th>MAPS</th>
                    <th>ENCARGADOS</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colspan="5" style="text-align: center;">Cargando...</td></tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      `;
    });
    lucide.createIcons();
  }

  document.getElementById('search-client').addEventListener('input', renderClientsTable);

  document.getElementById('btn-add-client').addEventListener('click', () => {
    document.getElementById('modal-client-title').textContent = 'Nuevo Cliente';
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    openModal(document.getElementById('modal-client-form'));
  });

  window.editClient = function(id, name, ruc) {
    document.getElementById('modal-client-title').textContent = 'Editar Cliente';
    document.getElementById('client-id').value = id;
    document.getElementById('client-name').value = name;
    document.getElementById('client-ruc').value = ruc;
    openModal(document.getElementById('modal-client-form'));
  };

  document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const data = {
      name: document.getElementById('client-name').value,
      ruc: document.getElementById('client-ruc').value
    };

    const url = id ? `/api/clients/${id}` : '/api/clients';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error();
      closeModal(document.getElementById('modal-client-form'));
      loadClientsData();
    } catch (err) {
      alert('Error al guardar cliente');
    }
  });

  // Proyectos / Sedes
  let currentProjects = [];
  let currentClientIdForProjects = null;

  window.toggleProjectsRow = async function(clientId, btnElement) {
    const row = document.getElementById(`projects-row-${clientId}`);
    
    if (row.classList.contains('hidden')) {
      row.classList.remove('hidden');
      btnElement.innerHTML = '<i data-lucide="minus"></i> Ocultar';
      lucide.createIcons();
      await loadProjectsForClientRow(clientId);
    } else {
      row.classList.add('hidden');
      btnElement.innerHTML = '<i data-lucide="plus"></i> Sedes';
      lucide.createIcons();
    }
  };

  async function loadProjectsForClientRow(clientId) {
    const tbody = document.querySelector(`#table-projects-${clientId} tbody`);
    try {
      const res = await fetch(`/api/clients/${clientId}/projects`);
      if (!res.ok) throw new Error();
      const projects = await res.json();
      
      if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay sedes registradas para este cliente.</td></tr>';
        return;
      }

      let html = '';
      projects.forEach(p => {
        let mapsLink = p.coordinates ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.coordinates)}" target="_blank" style="color: var(--color-primary); text-decoration: underline;">${escapeHtml(p.coordinates)}</a>` : '-';
        html += `
          <tr>
            <td><strong>${escapeHtml(p.name)}</strong><br><span style="font-size:0.75rem; color: var(--text-muted);">RUC: ${escapeHtml(p.ruc || 'Mismo que cliente')}</span></td>
            <td>${escapeHtml(p.address || '-')}</td>
            <td>${mapsLink}</td>
            <td>${escapeHtml(p.managers || '-')} <br><span style="font-size:0.75rem; color: var(--text-muted);">${escapeHtml(p.phones || '-')}</span></td>
            <td>
              <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick='editProject(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
                <i data-lucide="edit-2"></i> Editar
              </button>
              <button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem; margin-left: 5px;" onclick="deleteProject(${p.id}, ${p.client_id})">
                <i data-lucide="trash-2"></i> Eliminar
              </button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
      lucide.createIcons();
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-danger);">Error al cargar sedes.</td></tr>';
    }
  }

  window.addProjectToClient = function(clientId) {
    document.getElementById('modal-project-title').textContent = 'Nueva Sede';
    document.getElementById('project-form').reset();
    document.getElementById('project-id').value = '';
    document.getElementById('project-client-id').value = clientId;
    openModal(document.getElementById('modal-project-form'));
  };

  document.getElementById('btn-add-project').addEventListener('click', () => {
    document.getElementById('modal-project-title').textContent = 'Nueva Sede';
    document.getElementById('project-form').reset();
    document.getElementById('project-id').value = '';
    document.getElementById('project-client-id').value = currentClientIdForProjects;
    openModal(document.getElementById('modal-project-form'));
  });

  window.editProject = function(p) {
    document.getElementById('modal-project-title').textContent = 'Editar Sede';
    document.getElementById('project-id').value = p.id;
    document.getElementById('project-client-id').value = p.client_id;
    document.getElementById('project-name').value = p.name;
    document.getElementById('project-address').value = p.address || '';
    document.getElementById('project-coordinates').value = p.coordinates || '';
    document.getElementById('project-managers').value = p.managers || '';
    document.getElementById('project-ruc').value = p.ruc || '';
    openModal(document.getElementById('modal-project-form'));
  };

  window.deleteProject = async function(projectId, clientId) {
    if (!confirm('¿Estás seguro de eliminar esta sede?')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        await loadProjectsForClientRow(clientId);
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo eliminar la sede');
      }
    } catch (err) {
      console.error(err);
      alert('Error al conectar con el servidor');
    }
  };

  document.getElementById('project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('project-id').value;
    const clientId = document.getElementById('project-client-id').value;
    const data = {
      name: document.getElementById('project-name').value,
      address: document.getElementById('project-address').value,
      coordinates: document.getElementById('project-coordinates').value,
      managers: document.getElementById('project-managers').value,
      phones: document.getElementById('project-managers').value, // Simple mapping for now
      ruc: document.getElementById('project-ruc').value
    };

    const url = id ? `/api/projects/${id}` : `/api/clients/${clientId}/projects`;
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error();
      closeModal(document.getElementById('modal-project-form'));
      loadProjectsForClientRow(clientId);
    } catch (err) {
      alert('Error al guardar sede');
    }
  });

  // --- HISTORIAL/MOVIMIENTOS LÓGICA (FASE 2) ---
  let historyMovementsList = [];

  async function loadHistoryData() {
    try {
      const res = await fetch('/api/movements');
      if (!res.ok) throw new Error();
      historyMovementsList = await res.json();
      populateHistoryClientFilter();
      renderHistoryTable();
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
    }
  }

  async function populateHistoryClientFilter() {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        filterHistoryClientSelect.innerHTML = '<option value="">Seleccionar Cliente...</option>';
        data.forEach(c => {
          filterHistoryClientSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
        });
      }
    } catch (e) {
      console.error('Error al cargar clientes:', e);
    }
  }

  filterHistoryClientSelect.addEventListener('change', async () => {
    const clientId = filterHistoryClientSelect.value;
    filterHistoryProjectSelect.innerHTML = '<option value="">Seleccionar Sede...</option>';
    if (!clientId) {
      filterHistoryProjectSelect.disabled = true;
    } else {
      filterHistoryProjectSelect.disabled = false;
      try {
        const res = await fetch(`/api/clients/${clientId}/projects`);
        if (res.ok) {
          const projects = await res.json();
          projects.forEach(p => {
            filterHistoryProjectSelect.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
          });
        }
      } catch (err) {
        console.error('Error cargando sedes para historial:', err);
      }
    }
    renderHistoryTable();
  });

  filterHistoryProjectSelect.addEventListener('change', renderHistoryTable);

  function getFilteredHistory() {
    const searchProd = searchHistoryInput.value.toLowerCase().trim();
    const searchClient = searchHistoryClientInput.value.toLowerCase().trim();
    const filterType = filterHistoryTypeSelect.value;
    const filterUser = filterHistoryUserSelect.value;
    const dateStart = filterHistoryDateStart.value; // YYYY-MM-DD
    const dateEnd = filterHistoryDateEnd.value; // YYYY-MM-DD

    const filterClientId = filterHistoryClientSelect.value;
    const filterProjectId = filterHistoryProjectSelect.value;
    
    // Extraer texto seleccionado para buscar compatibilidad con registros antiguos
    let filterClientText = '';
    if (filterClientId !== '') {
      const opt = filterHistoryClientSelect.options[filterHistoryClientSelect.selectedIndex];
      if (opt) filterClientText = opt.text.toLowerCase();
    }
    let filterProjectText = '';
    if (filterProjectId !== '') {
      const opt = filterHistoryProjectSelect.options[filterHistoryProjectSelect.selectedIndex];
      if (opt) filterProjectText = opt.text.toLowerCase();
    }

    return historyMovementsList.filter(m => {
      const matchProd = m.product_name.toLowerCase().includes(searchProd) || (m.product_sku && m.product_sku.toLowerCase().includes(searchProd));
      const matchClientText = m.client_name ? m.client_name.toLowerCase().includes(searchClient) : (searchClient === '');
      
      const matchClientDrop = filterClientId === '' || 
                              String(m.client_id) === String(filterClientId) || 
                              (m.client_id == null && m.client_name && m.client_name.toLowerCase() === filterClientText);
                              
      // Para proyectos, asumimos que si haba un concepto con el nombre de la sede, podra coincidir, o simplemente dejamos que si es null, se compare con client_name/concept si el usuario lo necesita. Pero es ms difcil con project. 
      const matchProjectDrop = filterProjectId === '' || 
                               String(m.project_id) === String(filterProjectId) ||
                               (m.project_id == null && m.concept && m.concept.toLowerCase().includes(filterProjectText));

      const matchType = filterType === '' || m.type === filterType;
      const matchUser = filterUser === '' || m.user_name === filterUser;
      
      // Filtros de fecha (extrayendo YYYY-MM-DD del formato SQLite YYYY-MM-DD HH:MM:SS)
      let matchDate = true;
      if (m.date) {
        const itemDate = m.date.substring(0, 10); // "YYYY-MM-DD"
        if (dateStart && itemDate < dateStart) matchDate = false;
        if (dateEnd && itemDate > dateEnd) matchDate = false;
      }

      return matchProd && matchClientText && matchClientDrop && matchProjectDrop && matchType && matchUser && matchDate;
    });
  }

  function renderHistoryTable() {
    const tableBody = document.querySelector('#table-movements tbody');
    tableBody.innerHTML = '';

    const filtered = getFilteredHistory();

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">No se encontraron movimientos con los filtros aplicados.</td></tr>`;
      return;
    }

    filtered.forEach(m => {
      const isInput = m.type === 'input';
      const typeBadge = isInput 
        ? '<span class="badge badge-success"><i data-lucide="arrow-down-left" style="width:12px; height:12px; display:inline; margin-right:4px;"></i>Entrada</span>'
        : '<span class="badge badge-danger"><i data-lucide="arrow-up-right" style="width:12px; height:12px; display:inline; margin-right:4px;"></i>Salida</span>';
      
      let detailsText = escapeHtml(m.concept || '-');
      if (m.client_name) {
        detailsText = `<strong>Cliente: ${escapeHtml(m.client_name)}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(m.concept || '')}</span>`;
      }

      let printButton = '';
      if (!isInput) {
        printButton = `<button class="btn-icon" onclick="printRemissionGuide(${m.id})" title="Imprimir Guía de Remisión" style="color: var(--color-info); background: var(--color-info-soft); border-color: rgba(6, 182, 212, 0.2);"><i data-lucide="printer"></i></button>`;
      }

      tableBody.innerHTML += `
        <tr>
          <td>${formatDate(m.date)}</td>
          <td><strong>${escapeHtml(m.product_name)}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">SKU: ${escapeHtml(m.product_sku || '-')}</span></td>
          <td>${typeBadge}</td>
          <td style="font-weight:600; color: ${isInput ? 'var(--color-success)' : 'var(--color-danger)'};">${isInput ? '+' : '-'}${m.quantity}</td>
          <td>${detailsText}</td>
          <td><span style="font-size: 0.85rem; font-weight: 500;">${escapeHtml(m.user_name || 'Admin')}</span></td>
          <td>
            <div class="action-buttons">
              ${printButton}
            </div>
          </td>
        </tr>
      `;
    });
    lucide.createIcons();

    // Mostrar panel de inversión si hay un cliente o sede seleccionado y existen salidas
    const hasClientFilter = filterHistoryClientSelect.value !== '';
    if (hasClientFilter) {
      investmentReportSummary.style.display = 'flex';
      let totalInvestment = 0;
      filtered.forEach(m => {
        if (m.type === 'output' && m.price_buy) {
          totalInvestment += (m.quantity * parseFloat(m.price_buy));
        }
      });
      investmentTotalValue.textContent = `S/ ${totalInvestment.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      investmentReportSummary.style.display = 'none';
    }
  }

  // Exportar Historial Actual (filtrado) a CSV
  btnExportHistory.addEventListener('click', () => {
    const filtered = getFilteredHistory();
    if (filtered.length === 0) {
      alert('No hay movimientos que exportar en la lista actual.');
      return;
    }

    let csvContent = "\uFEFFFecha,Producto,SKU,Tipo,Cantidad,Cliente,Sede,Costo Unitario,Costo Total,Concepto,Usuario\n";
    filtered.forEach(m => {
      const costTotal = (m.type === 'output' && m.price_buy) ? (m.quantity * parseFloat(m.price_buy)).toFixed(2) : '0.00';
      const costUnit = m.price_buy ? parseFloat(m.price_buy).toFixed(2) : '0.00';
      const row = [
        m.date,
        m.product_name,
        m.product_sku || '',
        m.type === 'input' ? 'Entrada' : 'Salida',
        m.quantity,
        m.client_name || '',
        m.project_name || '',
        costUnit,
        costTotal,
        m.concept || '',
        m.user_name || ''
      ].map(text => `"${String(text).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    downloadCSV(csvContent, 'historial_movimientos.csv');
  });

  btnExportInvestment.addEventListener('click', () => {
    btnExportHistory.click();
  });

  // Imprimir Guía de Salida (Remisión) desde Historial
  window.printRemissionGuide = function(movementId) {
    const move = historyMovementsList.find(m => m.id === movementId);
    if (!move) return;

    // Rellenar la plantilla de impresión en HTML
    document.getElementById('print-guide-id').textContent = 'GR-' + String(move.id).padStart(6, '0');
    document.getElementById('print-guide-number').textContent = `N° GR-${String(move.id).padStart(6, '0')}`;
    document.getElementById('print-guide-date').textContent = formatDate(move.date);
    document.getElementById('print-guide-operator').textContent = move.user_name || 'Admin';
    document.getElementById('print-sig-operator').textContent = move.user_name || 'Admin';
    
    document.getElementById('print-guide-client').textContent = move.client_name || 'Particular / General';
    document.getElementById('print-guide-ruc').textContent = '-';
    document.getElementById('print-guide-address').textContent = move.project_name || '-';
    document.getElementById('print-guide-concept').textContent = move.concept || 'Salida de material';
    document.getElementById('print-guide-user').textContent = move.user_name || 'Admin';

    const tbody = document.getElementById('print-guide-items');
    tbody.innerHTML = `
      <tr>
        <td style="border-right: 1px solid #000; padding: 4px; text-align: center;">1</td>
        <td style="border-right: 1px solid #000; padding: 4px;">${escapeHtml(move.product_sku || '-')}</td>
        <td style="border-right: 1px solid #000; padding: 4px;">${escapeHtml(move.product_name)}</td>
        <td style="border-right: 1px solid #000; padding: 4px; text-align: center;">${move.quantity}</td>
        <td style="padding: 4px; text-align: center;">UNIDAD</td>
      </tr>
    `;
    
    document.getElementById('print-guide-weight').textContent = `${move.quantity}.00`;

    // Ejecutar Impresión
    const printContent = document.getElementById('print-guide').innerHTML;
    const originalContent = document.body.innerHTML;

    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    location.reload(); // Recargar para restaurar eventos
  };

  // --- CRUD DE PRODUCTOS (MODAL) ---

  // Abrir Modal Crear Producto
  btnAddProductQuick.addEventListener('click', () => {
    currentEditingProductId = null;
    productForm.reset();
    document.getElementById('modal-product-title').textContent = 'Nuevo Producto';
    document.getElementById('initial-stock-container').classList.remove('hidden');
    document.getElementById('product-id').value = '';
    
    imgPreview.src = '';
    imgPreview.classList.add('hidden');
    uploadIcon.classList.remove('hidden');
    uploadLabel.classList.remove('hidden');

    loadCategoriesList();
    openModal(modalProduct);
  });

  // Abrir Modal Editar Producto
  window.editProduct = async function(id) {
    currentEditingProductId = id;
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    await loadCategoriesList();

    document.getElementById('modal-product-title').textContent = 'Editar Producto';
    document.getElementById('initial-stock-container').classList.add('hidden');
    document.getElementById('product-id').value = prod.id;
    document.getElementById('prod-sku').value = prod.sku || '';
    document.getElementById('prod-name').value = prod.name;
    document.getElementById('prod-description').value = prod.description || '';
    document.getElementById('prod-category').value = prod.category_id || '';
    document.getElementById('prod-price-buy').value = prod.price_buy;
    document.getElementById('prod-price-sell').value = prod.price_sell;
    document.getElementById('prod-stock-min').value = prod.stock_min;

    if (prod.image_path) {
      imgPreview.src = prod.image_path;
      imgPreview.classList.remove('hidden');
      uploadIcon.classList.add('hidden');
      uploadLabel.classList.add('hidden');
    } else {
      imgPreview.src = '';
      imgPreview.classList.add('hidden');
      uploadIcon.classList.remove('hidden');
      uploadLabel.classList.remove('hidden');
    }

    openModal(modalProduct);
  };

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-product');
    const originalText = saveBtn.innerText;
    saveBtn.disabled = true;
    saveBtn.innerText = 'Guardando...';

    const formData = new FormData();
    formData.append('sku', document.getElementById('prod-sku').value);
    formData.append('name', document.getElementById('prod-name').value);
    formData.append('description', document.getElementById('prod-description').value);
    formData.append('category_id', document.getElementById('prod-category').value);
    formData.append('price_buy', document.getElementById('prod-price-buy').value);
    formData.append('price_sell', document.getElementById('prod-price-sell').value);
    formData.append('stock_min', document.getElementById('prod-stock-min').value);
    
    if (!currentEditingProductId) {
      formData.append('stock', document.getElementById('prod-stock').value);
    }

    const imageFile = prodImageFileInput.files[0];
    if (imageFile) {
      formData.append('image', imageFile);
    }

    const url = currentEditingProductId ? `/api/products/${currentEditingProductId}` : '/api/products';
    const method = currentEditingProductId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        closeModal(modalProduct);
        loadInventoryData();
      } else {
        alert(data.error || 'Error al guardar el producto');
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = originalText;
    }
  });

  window.deleteProduct = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este producto? Se borrarán de forma permanente todos sus registros de movimiento asociados.')) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadInventoryData();
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo eliminar el producto');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // --- REGISTRAR MOVIMIENTO LOTE (MODAL) ---

  // Abrir Modal de Movimiento
  btnQuickMovement.addEventListener('click', async () => {
    movementForm.reset();
    currentMoveList = [];
    renderMoveList();
    
    // Ocultar campo cliente y sede inicialmente (Entrada por defecto)
    moveClientContainer.classList.add('hidden');
    moveClientInput.removeAttribute('required');
    moveProjectContainer.classList.add('hidden');
    moveProjectInput.removeAttribute('required');
    moveProjectInput.innerHTML = '<option value="">Seleccione Sede</option>';
    // Asignar fecha actual por defecto
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    moveDateInput.value = now.toISOString().slice(0, 16);

    const productSelect = document.getElementById('move-product');
    productSelect.innerHTML = '<option value="">Seleccione Producto</option>';
    
    // Cargar productos y clientes en paralelo
    try {
      const [productsRes, clientsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/clients')
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        data.forEach(p => {
          productSelect.innerHTML += `<option value="${p.id}" data-name="${escapeHtml(p.name)}" data-stock="${p.stock}">${escapeHtml(p.name)} (Stock: ${p.stock})</option>`;
        });
      }

      if (clientsRes.ok) {
        clientsData = await clientsRes.json();
        populateClientsDropdowns();
      }

      openModal(modalMovement);
    } catch (err) {
      console.error('Error al abrir modal de movimiento:', err);
      alert('Error al cargar datos. Verifica la conexión con el servidor.');
    }
  });

  // Mostrar/ocultar cliente dinámicamente según Entrada/Salida
  document.querySelectorAll('input[name="move-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'output') {
        moveClientContainer.classList.remove('hidden');
        moveClientInput.setAttribute('required', 'true');
        moveProjectContainer.classList.remove('hidden');
        moveProjectInput.setAttribute('required', 'true');
      } else {
        moveClientContainer.classList.add('hidden');
        moveClientInput.removeAttribute('required');
        moveClientInput.value = '';
        moveProjectContainer.classList.add('hidden');
        moveProjectInput.removeAttribute('required');
        moveProjectInput.value = '';
      }
    });
  });

  // Poblar dropdown de clientes
  function populateClientsDropdowns() {
    moveClientInput.innerHTML = '<option value="">Seleccione Cliente</option>';
    clientsData.forEach(c => {
      moveClientInput.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
  }

  // Cargar sedes dinámicamente cuando se selecciona un cliente
  moveClientInput.addEventListener('change', async (e) => {
    const clientId = e.target.value;
    moveProjectInput.innerHTML = '<option value="">Cargando...</option>';
    if (!clientId) {
      moveProjectInput.innerHTML = '<option value="">Seleccione Sede</option>';
      return;
    }
    try {
      const res = await fetch(`/api/clients/${clientId}/projects`);
      const projects = await res.json();
      moveProjectInput.innerHTML = '<option value="">Seleccione Sede</option>';
      projects.forEach(p => {
        moveProjectInput.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
      });
    } catch (err) {
      console.error(err);
      moveProjectInput.innerHTML = '<option value="">Error al cargar</option>';
    }
  });

  // Añadir material a la lista temporal
  const btnAddToMoveList = document.getElementById('btn-add-to-move-list');
  btnAddToMoveList.addEventListener('click', () => {
    const productSelect = document.getElementById('move-product');
    const quantityInput = document.getElementById('move-quantity');
    const moveType = document.querySelector('input[name="move-type"]:checked').value;
    
    if (!productSelect.value) {
      alert('Por favor, seleccione un producto.');
      return;
    }
    
    const quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity <= 0) {
      alert('Por favor, ingrese una cantidad válida mayor a 0.');
      return;
    }
    
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const productId = productSelect.value;
    const productName = selectedOption.getAttribute('data-name');
    const currentStock = parseInt(selectedOption.getAttribute('data-stock'), 10);
    
    // Validar duplicados
    if (currentMoveList.some(item => item.product_id == productId)) {
      alert('Este producto ya fue añadido a la lista. Elimínelo si desea cambiar la cantidad.');
      return;
    }
    
    // Validar stock para salidas
    if (moveType === 'output' && quantity > currentStock) {
      alert(`Cantidad excede el stock disponible (${currentStock}).`);
      return;
    }
    
    currentMoveList.push({
      product_id: productId,
      name: productName,
      quantity: quantity
    });
    
    productSelect.value = '';
    quantityInput.value = '1';
    renderMoveList();
  });

  window.removeFromMoveList = function(index) {
    currentMoveList.splice(index, 1);
    renderMoveList();
  };

  function renderMoveList() {
    const tbody = document.getElementById('table-move-list-body');
    const helpText = document.getElementById('move-list-help');
    
    if (currentMoveList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No se han añadido materiales.</td></tr>';
      helpText.style.display = 'none';
      return;
    }
    
    helpText.style.display = 'none';
    tbody.innerHTML = '';
    currentMoveList.forEach((item, index) => {
      tbody.innerHTML += `
        <tr>
          <td style="padding: 10px; font-size: 0.85rem;"><strong>${item.name}</strong></td>
          <td style="padding: 10px; font-size: 0.85rem; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; text-align: right;">
            <button type="button" class="btn-icon delete" onclick="removeFromMoveList(${index})" style="width: 26px; height: 26px; margin: 0 auto; display: inline-flex;">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </td>
        </tr>
      `;
    });
    lucide.createIcons();
  }

  // Enviar Movimientos en Lote (Form submit)
  movementForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (currentMoveList.length === 0) {
      document.getElementById('move-list-help').style.display = 'block';
      return;
    }
    
    const type = document.querySelector('input[name="move-type"]:checked').value;
    const concept = document.getElementById('move-concept').value;
    const clientId = moveClientInput.value;
    const projectId = moveProjectInput.value;
    const date = moveDateInput.value;

    let clientName = null;
    let rucText = null;
    let addressText = null;

    if (type === 'output' && clientId) {
      const client = clientsData.find(c => c.id == clientId);
      clientName = client ? client.name : null;
      rucText = client ? (client.ruc || 'No especificado') : null;

      if (projectId) {
         // Buscamos el proyecto desde currentProjects u otra fuente.
         // Al enviar el lote, idealmente tenemos la data de currentProjects.
         const p = currentProjects.find(pr => pr.id == projectId);
         if (p) {
           addressText = p.address || '-';
           if (p.ruc) rucText = p.ruc; // override si sede tiene RUC
         }
      }
    }

    // Construir el payload del lote
    const payload = {
      movements: currentMoveList.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        sku: item.sku,
        name: item.name
      })),
      type: type,
      concept: concept,
      client_id: type === 'output' ? clientId : null,
      project_id: type === 'output' ? projectId : null,
      client_name: clientName,
      user_name: activeUser,
      date: date
    };

    try {
      const res = await fetch('/api/movements/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        closeModal(modalMovement);
        const activeTab = document.querySelector('.menu-item.active').getAttribute('data-target');
        navigateTo(activeTab);

        if (type === 'output') {
          // Guardar datos temporales para imprimir guía
          window.latestBulkDispatch = {
            id: 'GR-' + Math.floor(100000 + Math.random() * 900000),
            date: date,
            client_name: clientName,
            ruc: rucText,
            address: addressText,
            concept: concept,
            user_name: activeUser,
            items: payload.movements
          };
          openModal(document.getElementById('modal-guia-prompt'));
        }
      } else {
        alert(data.error || 'Error al registrar el lote de movimientos');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  });

  // Guía de Remisión Lógica
  document.getElementById('btn-skip-guia').addEventListener('click', () => {
    closeModal(document.getElementById('modal-guia-prompt'));
  });

  document.getElementById('btn-generate-guia').addEventListener('click', () => {
    closeModal(document.getElementById('modal-guia-prompt'));
    if (!window.latestBulkDispatch) return;

    const data = window.latestBulkDispatch;
    document.getElementById('print-guide-id').textContent = data.id;
    document.getElementById('print-guide-number').textContent = `N° ${data.id}`;
    document.getElementById('print-guide-date').textContent = formatDate(data.date);
    document.getElementById('print-guide-operator').textContent = data.user_name || 'Admin';
    document.getElementById('print-guide-client').textContent = data.client_name || '-';
    document.getElementById('print-guide-ruc').textContent = data.ruc || '-';
    document.getElementById('print-guide-address').textContent = data.address || '-';
    document.getElementById('print-guide-concept').textContent = data.concept || '-';
    document.getElementById('print-guide-user').textContent = data.user_name || 'Admin';
    document.getElementById('print-sig-operator').textContent = data.user_name || 'Admin';

    let weight = 0;
    const tbody = document.getElementById('print-guide-items');
    tbody.innerHTML = '';
    data.items.forEach((item, index) => {
      weight += item.quantity; // Estimación simple de peso
      tbody.innerHTML += `
        <tr>
          <td style="border-right: 1px solid #000; padding: 4px; text-align: center;">${index + 1}</td>
          <td style="border-right: 1px solid #000; padding: 4px;">${escapeHtml(item.sku || '-')}</td>
          <td style="border-right: 1px solid #000; padding: 4px;">${escapeHtml(item.name)}</td>
          <td style="border-right: 1px solid #000; padding: 4px; text-align: center;">${item.quantity}</td>
          <td style="padding: 4px; text-align: center;">UNIDAD</td>
        </tr>
      `;
    });
    
    document.getElementById('print-guide-weight').textContent = `${weight}.00`;

    // Ejecutar Impresión
    const printContent = document.getElementById('print-guide').innerHTML;
    const originalContent = document.body.innerHTML;

    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    location.reload(); // Recargar para restaurar eventos
  });
  // --- EVENTOS DE INTERFAZ Y EVENT LISTENERS COMPLEMENTARIOS ---

  // Búsquedas y filtros del Inventario
  searchProductInput.addEventListener('input', renderInventoryTable);
  filterCategorySelect.addEventListener('change', renderInventoryTable);

  // Búsquedas y filtros del Historial
  searchHistoryInput.addEventListener('input', renderHistoryTable);
  searchHistoryClientInput.addEventListener('input', renderHistoryTable);
  filterHistoryTypeSelect.addEventListener('change', renderHistoryTable);
  filterHistoryUserSelect.addEventListener('change', renderHistoryTable);
  filterHistoryDateStart.addEventListener('change', renderHistoryTable);
  filterHistoryDateEnd.addEventListener('change', renderHistoryTable);

  // Navegación Sidebar Click
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      window.location.hash = target;
      navigateTo(target);
    });
  });

  if (window.location.hash) {
    const target = window.location.hash.substring(1);
    if (['dashboard', 'inventory', 'categories', 'clients', 'history', 'suppliers', 'purchases', 'users', 'settings'].includes(target)) {
      if (isConfigured) {
        navigateTo(target);
      }
    }
  }

  // Zona de subida de imagen interactiva
  imgUploadZone.addEventListener('click', () => {
    prodImageFileInput.click();
  });

  prodImageFileInput.addEventListener('change', () => {
    const file = prodImageFileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imgPreview.src = e.target.result;
        imgPreview.classList.remove('hidden');
        uploadIcon.classList.add('hidden');
        uploadLabel.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  imgUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imgUploadZone.style.borderColor = 'var(--color-primary)';
  });

  imgUploadZone.addEventListener('dragleave', () => {
    imgUploadZone.style.borderColor = 'var(--border-color)';
  });

  imgUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    imgUploadZone.style.borderColor = 'var(--border-color)';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      prodImageFileInput.files = e.dataTransfer.files;
      const reader = new FileReader();
      reader.onload = (e) => {
        imgPreview.src = e.target.result;
        imgPreview.classList.remove('hidden');
        uploadIcon.classList.add('hidden');
        uploadLabel.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    }
  });


  // --- COMPONENTES AUXILIARES Y DE MODALES ---

  function openModal(modal) {
    if (!modal) return;
    modal.style.display = '';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.remove('open');
    }
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.close-modal, .close-modal-btn, .btn-close-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      closeModal(modal);
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal(e.target);
    }
  });

  function formatDate(dateStr) {
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- CRUD USUARIOS ---
  let usersList = [];
  const tableUsersBody = document.querySelector('#table-users tbody');
  const userForm = document.getElementById('user-form');
  const modalUserForm = document.getElementById('modal-user-form');

  window.openUserModal = function(id = null) {
    const title = document.getElementById('modal-user-title');
    document.getElementById('user-id').value = '';
    document.getElementById('user-name').value = '';
    document.getElementById('user-username').value = '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value = 'Administrador';

    if (id) {
      const user = usersList.find(u => u.id === id);
      if (user) {
        title.textContent = 'Editar Usuario';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-username').value = user.username;
        document.getElementById('user-role').value = user.role;
      }
    } else {
      title.textContent = 'Nuevo Usuario';
    }
    openModal(modalUserForm);
  };

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const name = document.getElementById('user-name').value;
    const username = document.getElementById('user-username').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    const payload = { name, username, role };
    if (password) payload.password = password;

    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/api/users/${id}` : '/api/users';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      closeModal(modalUserForm);
      loadUsers();
    } catch (err) {
      alert('Error al guardar usuario: ' + err.message);
    }
  });

  window.deleteUser = async function(id) {
    if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadUsers();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  async function loadUsers() {
    if (!currentUser || currentUser.role !== 'Administrador') return;
    try {
      const res = await fetch('/api/users');
      if (!res.ok) return;
      usersList = await res.json();
      renderUsersTable(usersList);
    } catch (err) {
      console.error(err);
    }
  }

  function renderUsersTable(users) {
    if (!tableUsersBody) return;
    tableUsersBody.innerHTML = '';
    users.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <i data-lucide="user"></i>
            <span>${escapeHtml(user.name)}</span>
          </div>
        </td>
        <td>${escapeHtml(user.username)}</td>
        <td><span class="badge ${user.role === 'Administrador' ? 'badge-primary' : (user.role === 'Supervisor' ? 'badge-success' : 'badge-warning')}">${escapeHtml(user.role)}</span></td>
        <td>
          <div class="actions">
            <button class="btn-icon" onclick="openUserModal(${user.id})" title="Editar"><i data-lucide="edit"></i></button>
            <button class="btn-icon text-danger" onclick="deleteUser(${user.id})" title="Eliminar"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      `;
      tableUsersBody.appendChild(tr);
    });
    lucide.createIcons();
  }

  // --- SETTINGS Y BRANDING ---
  async function loadPublicSettings() {
    try {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return;
      const data = await res.json();
      
      if (data.app_name) {
        document.querySelectorAll('.app-name-display').forEach(el => el.textContent = data.app_name);
        document.title = `${data.app_name} - Sistema de Gestión de Inventario`;
      }
      if (data.app_logo) {
        document.querySelectorAll('.app-logo-display').forEach(img => {
          img.src = data.app_logo;
          img.classList.remove('hidden');
        });
        document.querySelectorAll('.default-app-icon').forEach(icon => icon.classList.add('hidden'));
      } else {
        document.querySelectorAll('.app-logo-display').forEach(img => img.classList.add('hidden'));
        document.querySelectorAll('.default-app-icon').forEach(icon => icon.classList.remove('hidden'));
      }
    } catch (e) {
      console.error('Error cargando configuración pública:', e);
    }
  }

  async function loadSettingsData() {
    try {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return;
      const data = await res.json();

      const nameInput = document.getElementById('settings-app-name');
      if (nameInput) nameInput.value = data.app_name || 'IDEESE';

      const preview = document.getElementById('settings-logo-preview');
      if (preview) {
        if (data.app_logo) {
          preview.src = data.app_logo;
          preview.classList.remove('hidden');
        } else {
          preview.src = '';
          preview.classList.add('hidden');
        }
      }

      ['smtp-host', 'smtp-port', 'smtp-user', 'smtp-pass', 'alert-email'].forEach(id => {
        const key = id.replace('-', '_');
        const el = document.getElementById(`settings-${id}`);
        if (el && data[key]) el.value = data[key];
      });
    } catch (e) {
      console.error('Error cargando configuración:', e);
    }
  }

  let selectedLogoBase64 = null;
  const logoInput = document.getElementById('settings-app-logo');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        selectedLogoBase64 = ev.target.result;
        const preview = document.getElementById('settings-logo-preview');
        if (preview) {
          preview.src = selectedLogoBase64;
          preview.classList.remove('hidden');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const btnSaveSettings = document.getElementById('btn-save-settings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const name = document.getElementById('settings-app-name').value.trim();
      if (!name) return alert('El nombre de la aplicación no puede estar vacío');

      const payload = { app_name: name };
      if (selectedLogoBase64) {
        payload.app_logo = selectedLogoBase64;
      }
      const smtpFields = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'alert_email'];
      smtpFields.forEach(f => {
        const inputId = `settings-${f.replace('_', '-')}`;
        const inputEl = document.getElementById(inputId);
        if (inputEl) {
          const val = inputEl.value.trim();
          if (val) payload[f] = val;
        }
      });

      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Error al guardar configuración');
        alert('¡Configuración guardada exitosamente!');
        selectedLogoBase64 = null;
        await loadPublicSettings();
      } catch (e) {
        alert(e.message);
      }
    });
  }

  // --- PROVEEDORES ---
  let suppliersList = [];
  const tableSuppliersBody = document.querySelector('#table-suppliers tbody');
  const modalSupplier = document.getElementById('modal-supplier');
  const formSupplier = document.getElementById('form-supplier');
  const searchSupplierInput = document.getElementById('search-supplier');

  if (searchSupplierInput) {
    searchSupplierInput.addEventListener('input', () => {
      const query = searchSupplierInput.value.toLowerCase().trim();
      const filtered = suppliersList.filter(s =>
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.ruc && s.ruc.toLowerCase().includes(query)) ||
        (s.contact && s.contact.toLowerCase().includes(query)) ||
        (s.phone && s.phone.toLowerCase().includes(query))
      );
      renderSuppliersTable(filtered);
    });
  }

  const btnAddSupplier = document.getElementById('btn-add-supplier');
  if (btnAddSupplier) {
    btnAddSupplier.addEventListener('click', () => {
      if (formSupplier) formSupplier.reset();
      document.getElementById('supplier-id').value = '';
      document.getElementById('modal-supplier-title').textContent = 'Nuevo Proveedor';
      openModal(modalSupplier);
    });
  }

  if (formSupplier) {
    formSupplier.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('supplier-id').value;
      const payload = {
        name: document.getElementById('supplier-name').value.trim(),
        ruc: document.getElementById('supplier-ruc').value.trim(),
        contact: document.getElementById('supplier-contact').value.trim(),
        email: document.getElementById('supplier-email').value.trim(),
        phone: document.getElementById('supplier-phone').value.trim()
      };
      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/suppliers/${id}` : '/api/suppliers';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Error procesando solicitud' }));
          throw new Error(errData.error || 'Error al guardar proveedor');
        }
        closeModal(modalSupplier);
        loadSuppliers();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  async function loadSuppliers() {
    try {
      const res = await fetch('/api/suppliers');
      if (!res.ok) return;
      suppliersList = await res.json();
      renderSuppliersTable(suppliersList);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    }
  }

  function renderSuppliersTable(list = suppliersList) {
    if (!tableSuppliersBody) return;
    tableSuppliersBody.innerHTML = '';
    if (list.length === 0) {
      tableSuppliersBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px 0;">No se encontraron proveedores.</td></tr>`;
      return;
    }
    list.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.ruc || '-')}</td>
        <td>${escapeHtml(s.contact || '-')}</td>
        <td>${escapeHtml(s.email || '-')}</td>
        <td>${escapeHtml(s.phone || '-')}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon" onclick="editSupplier(${s.id})" title="Editar"><i data-lucide="edit-3"></i></button>
            <button class="btn-icon delete" onclick="deleteSupplier(${s.id})" title="Eliminar"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      `;
      tableSuppliersBody.appendChild(tr);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  window.editSupplier = function(id) {
    const s = suppliersList.find(x => x.id === id);
    if (!s) return;
    document.getElementById('supplier-id').value = s.id;
    document.getElementById('supplier-name').value = s.name;
    document.getElementById('supplier-ruc').value = s.ruc || '';
    document.getElementById('supplier-contact').value = s.contact || '';
    document.getElementById('supplier-email').value = s.email || '';
    document.getElementById('supplier-phone').value = s.phone || '';
    document.getElementById('modal-supplier-title').textContent = 'Editar Proveedor';
    openModal(modalSupplier);
  };

  window.deleteSupplier = async function(id) {
    if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      loadSuppliers();
    } catch (err) {
      alert('Error al eliminar proveedor');
    }
  };

  // --- ÓRDENES DE COMPRA ---
  let purchasesList = [];
  let currentPurchaseItems = [];
  const tablePurchasesBody = document.querySelector('#table-purchases tbody');
  const modalPurchase = document.getElementById('modal-purchase');
  const formPurchase = document.getElementById('form-purchase');
  const searchPurchaseInput = document.getElementById('search-purchase');

  if (searchPurchaseInput) {
    searchPurchaseInput.addEventListener('input', () => {
      const query = searchPurchaseInput.value.toLowerCase().trim();
      const filtered = purchasesList.filter(po =>
        String(po.id).includes(query) ||
        (po.supplier_name && po.supplier_name.toLowerCase().includes(query)) ||
        (po.status && po.status.toLowerCase().includes(query))
      );
      renderPurchasesTable(filtered);
    });
  }

  const btnAddPurchase = document.getElementById('btn-add-purchase');
  if (btnAddPurchase) {
    btnAddPurchase.addEventListener('click', async () => {
      if (formPurchase) formPurchase.reset();
      currentPurchaseItems = [];
      renderPurchaseItems();

      // Cargar proveedores actualizados
      await loadSuppliers();
      const selectS = document.getElementById('purchase-supplier');
      if (selectS) {
        selectS.innerHTML = '<option value="">Seleccionar Proveedor...</option>';
        suppliersList.forEach(s => {
          selectS.innerHTML += `<option value="${s.id}">${escapeHtml(s.name)}</option>`;
        });
      }

      // Cargar productos actualizados
      try {
        const res = await fetch('/api/products');
        if (res.ok) products = await res.json();
      } catch (e) {}

      const selectP = document.getElementById('purchase-product-select');
      if (selectP) {
        selectP.innerHTML = '<option value="">Seleccionar Producto...</option>';
        products.forEach(p => {
          selectP.innerHTML += `<option value="${p.id}" data-price="${p.price_buy}">${escapeHtml(p.name)} (P. Compra: S/ ${p.price_buy.toFixed(2)})</option>`;
        });
      }

      openModal(modalPurchase);
    });
  }

  // Al seleccionar producto en el modal de compras, autocompletar el precio de compra actual
  const purchaseProductSelect = document.getElementById('purchase-product-select');
  if (purchaseProductSelect) {
    purchaseProductSelect.addEventListener('change', (e) => {
      const opt = e.target.options[e.target.selectedIndex];
      const defaultPrice = opt ? opt.getAttribute('data-price') : null;
      if (defaultPrice) {
        document.getElementById('purchase-product-price').value = parseFloat(defaultPrice).toFixed(2);
      }
    });
  }

  const btnAddPurchaseItem = document.getElementById('btn-add-purchase-item');
  if (btnAddPurchaseItem) {
    btnAddPurchaseItem.addEventListener('click', () => {
      const pSelect = document.getElementById('purchase-product-select');
      const pId = pSelect.value;
      const qty = parseInt(document.getElementById('purchase-product-qty').value, 10);
      const price = parseFloat(document.getElementById('purchase-product-price').value);

      if (!pId || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
        return alert('Selecciona un producto, ingresa una cantidad válida mayor a 0 y un precio unitario.');
      }
      const product = products.find(x => x.id == pId);
      if (!product) return;

      const existing = currentPurchaseItems.find(x => x.product_id == pId);
      if (existing) {
        existing.quantity += qty;
        existing.price = price; // actualizar al precio ingresado
      } else {
        currentPurchaseItems.push({ product_id: product.id, product_name: product.name, quantity: qty, price: price });
      }

      pSelect.value = '';
      document.getElementById('purchase-product-qty').value = '1';
      document.getElementById('purchase-product-price').value = '';
      renderPurchaseItems();
    });
  }

  function renderPurchaseItems() {
    const tbody = document.getElementById('purchase-items-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let total = 0;

    if (currentPurchaseItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px 0;">No se han agregado productos a la orden.</td></tr>`;
    } else {
      currentPurchaseItems.forEach((item, i) => {
        const subtotal = item.quantity * item.price;
        total += subtotal;
        tbody.innerHTML += `
          <tr>
            <td><strong>${escapeHtml(item.product_name)}</strong></td>
            <td style="text-align: right;">${item.quantity}</td>
            <td style="text-align: right;">S/ ${item.price.toFixed(2)}</td>
            <td style="text-align: right; font-weight: 600;">S/ ${subtotal.toFixed(2)}</td>
            <td style="text-align: center;"><button type="button" class="btn-icon delete" onclick="removePurchaseItem(${i})"><i data-lucide="trash-2"></i></button></td>
          </tr>
        `;
      });
    }
    const totalDisplay = document.getElementById('purchase-total-display');
    if (totalDisplay) totalDisplay.textContent = 'S/ ' + total.toFixed(2);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  window.removePurchaseItem = function(index) {
    currentPurchaseItems.splice(index, 1);
    renderPurchaseItems();
  };

  if (formPurchase) {
    formPurchase.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (currentPurchaseItems.length === 0) return alert('Debes añadir al menos un producto a la órden.');
      const supplier_id = document.getElementById('purchase-supplier').value;
      if (!supplier_id) return alert('Por favor, selecciona un proveedor.');

      try {
        const res = await fetch('/api/purchase_orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplier_id, items: currentPurchaseItems })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Error procesando órden' }));
          throw new Error(errData.error || 'Error al generar la orden de compra');
        }
        closeModal(modalPurchase);
        alert('¡Órden de compra registrada exitosamente!');
        loadPurchases();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  async function loadPurchases() {
    try {
      const res = await fetch('/api/purchase_orders');
      if (!res.ok) return;
      purchasesList = await res.json();
      renderPurchasesTable(purchasesList);
    } catch (err) {
      console.error('Error al cargar órdenes de compra:', err);
    }
  }

  function renderPurchasesTable(list = purchasesList) {
    if (!tablePurchasesBody) return;
    tablePurchasesBody.innerHTML = '';
    if (list.length === 0) {
      tablePurchasesBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px 0;">No se encontraron órdenes de compra.</td></tr>`;
      return;
    }

    list.forEach(po => {
      const isReceived = po.status === 'Recibida' || po.status === 'received';
      const statusBadge = isReceived 
        ? '<span class="badge badge-success"><i data-lucide="check-circle" style="width:12px; height:12px; display:inline; margin-right:4px;"></i>Recibida</span>'
        : '<span class="badge badge-warning"><i data-lucide="clock" style="width:12px; height:12px; display:inline; margin-right:4px;"></i>Pendiente</span>';

      const receiveBtn = !isReceived
        ? `<button class="btn-primary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="receivePurchase(${po.id})"><i data-lucide="package-check"></i> Recibir Stock</button>`
        : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>#OC-${String(po.id).padStart(4, '0')}</code></td>
        <td><strong>${escapeHtml(po.supplier_name || 'Desconocido')}</strong></td>
        <td>${formatDate(po.date)}</td>
        <td style="font-weight: 600; color: var(--color-primary);">S/ ${parseFloat(po.total).toFixed(2)}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-buttons" style="gap: 6px;">
            <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="viewPurchaseDetail(${po.id})" title="Ver Detalle"><i data-lucide="eye"></i> Detalle</button>
            ${receiveBtn}
          </div>
        </td>
      `;
      tablePurchasesBody.appendChild(tr);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  window.viewPurchaseDetail = async function(id) {
    try {
      const res = await fetch(`/api/purchase_orders/${id}`);
      if (!res.ok) throw new Error('No se pudo obtener la información de la orden');
      const po = await res.json();

      document.getElementById('purchase-detail-title').textContent = `Órden de Compra #OC-${String(po.id).padStart(4, '0')}`;
      document.getElementById('purchase-detail-supplier').textContent = `Proveedor: ${po.supplier_name || 'N/A'}`;
      document.getElementById('purchase-detail-date').textContent = `Fecha: ${formatDate(po.date)}`;

      const isReceived = po.status === 'Recibida' || po.status === 'received';
      const statusEl = document.getElementById('purchase-detail-status');
      statusEl.className = `badge ${isReceived ? 'badge-success' : 'badge-warning'}`;
      statusEl.textContent = isReceived ? 'Recibida' : 'Pendiente';

      const tbody = document.getElementById('purchase-detail-items-body');
      tbody.innerHTML = '';
      let total = 0;
      (po.items || []).forEach(item => {
        const subtotal = item.quantity * item.price;
        total += subtotal;
        tbody.innerHTML += `
          <tr>
            <td><code>${escapeHtml(item.product_sku || '-')}</code></td>
            <td><strong>${escapeHtml(item.product_name)}</strong></td>
            <td style="text-align: right;">${item.quantity}</td>
            <td style="text-align: right;">S/ ${parseFloat(item.price).toFixed(2)}</td>
            <td style="text-align: right; font-weight: 600;">S/ ${subtotal.toFixed(2)}</td>
          </tr>
        `;
      });
      document.getElementById('purchase-detail-total').textContent = `S/ ${total.toFixed(2)}`;
      openModal(document.getElementById('modal-purchase-detail'));
    } catch (err) {
      alert(err.message);
    }
  };

  window.receivePurchase = async function(id) {
    if (!confirm('¿Confirmar recepción de todos los productos de esta orden? El stock del inventario se actualizará automáticamente.')) return;
    try {
      const res = await fetch(`/api/purchase_orders/${id}/receive`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al recepcionar la orden');
      alert('¡Órden recibida e inventario actualizado exitosamente!');
      loadPurchases();
      loadInventoryData();
      loadHistoryData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Cargar Proveedores y Compras cuando inicia la app
  const originalLoadInventoryData = loadInventoryData;
  loadInventoryData = async function() {
    await originalLoadInventoryData();
    loadSuppliers();
    loadPurchases();
  };

  // --- EXPORTAR EXCEL / PDF ---
  const btnExportInventoryPdf = document.getElementById('btn-export-inventory-pdf');
  if (btnExportInventoryPdf) {
    btnExportInventoryPdf.addEventListener('click', () => {
      if (typeof window.jspdf === 'undefined') return alert('La librería PDF no está cargada');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.text("Reporte General de Inventario", 14, 15);
      const filtered = getFilteredProducts();
      const tableData = filtered.map(p => [p.sku || '-', p.name, p.category_name || '-', `S/ ${p.price_buy.toFixed(2)}`, `S/ ${p.price_sell.toFixed(2)}`, p.stock]);
      doc.autoTable({ head: [['SKU', 'Nombre', 'Categoría', 'P. Compra', 'P. Venta', 'Stock']], body: tableData, startY: 20 });
      doc.save("Inventario_IDEESE.pdf");
    });
  }

  const btnExportHistoryPdf = document.getElementById('btn-export-history-pdf');
  if (btnExportHistoryPdf) {
    btnExportHistoryPdf.addEventListener('click', () => {
      if (typeof window.jspdf === 'undefined') return alert('La librería PDF no está cargada');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.text("Reporte de Movimientos de Stock", 14, 15);
      const filtered = getFilteredHistory();
      const tableData = filtered.map(m => [formatDate(m.date), m.product_name, m.type === 'input' ? 'Entrada' : 'Salida', m.quantity, m.client_name || '-', m.user_name || 'Admin']);
      doc.autoTable({ head: [['Fecha', 'Producto', 'Tipo', 'Cant.', 'Cliente/Detalle', 'Usuario']], body: tableData, startY: 20 });
      doc.save("Historial_Movimientos_IDEESE.pdf");
    });
  }

  // Cargar configuración pública al iniciar
  loadPublicSettings();

  checkSystemConfig();
});
