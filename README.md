# StockVibe - Sistema de Gestión de Inventario Premium 📦✨

StockVibe es un sistema de control de inventario moderno, elegante, ligero y responsivo. Está construido con **Node.js (Express)** en el backend y **Vanilla HTML/CSS/JS** en el frontend para garantizar un rendimiento óptimo sin sobrecargas. Utiliza una base de datos relacional local **SQLite** dentro del directorio que elijas.

El sistema cuenta con un instalador/configurador dinámico que solicita la ruta de trabajo en su primer inicio, adaptándose perfectamente tanto a entornos de escritorio locales (Windows) como a despliegues persistentes en la nube (Render).

---

## Características Principales
*   **Diseño Premium (Modo Oscuro & Glassmorphism)**: Interfaz de usuario inspirada en tendencias modernas con colores vivos, desenfoque de fondo y micro-animaciones dinámicas.
*   **Configuración en Caliente**: En su primera ejecución, te pedirá la ruta absoluta de la carpeta de trabajo donde creará la base de datos (`inventario.sqlite`) y guardará los archivos subidos.
*   **Gestión de Productos Completa**: SKU único, control de stock, precio de compra/venta, alertas visuales de bajo stock mínimo y soporte para subir fotos.
*   **Gestión de Categorías**: Organiza tus productos fácilmente.
*   **Historial de Movimientos**: Registro automático de entradas (compras/inventario inicial) y salidas (ventas/mermas) con conceptos claros.
*   **Dashboard de Control**: Estadísticas en tiempo real del valor del inventario, stock crítico y actividad reciente.

---

## 🛠️ Ejecución Local (Windows)

Para ejecutarlo localmente en tu computadora, debes tener instalado **Node.js**:

1.  **Instala Node.js** (si aún no lo tienes):
    *   Descárgalo e instálalo desde [nodejs.org](https://nodejs.org/). Te recomendamos la versión **LTS**.
2.  **Iniciar el Sistema**:
    *   Simplemente haz doble clic en el archivo **`run.bat`** incluido en la raíz de este proyecto.
    *   El script instalará automáticamente las dependencias necesarias (`npm install`), iniciará el servidor web en el puerto `3000` y abrirá la aplicación en tu navegador web predeterminado (`http://localhost:3000`).
3.  **Configura tu Carpeta**:
    *   Introduce la ruta absoluta de la carpeta donde quieres almacenar tu base de datos y fotos (ejemplo: `C:\MisDatos\Inventario`).
    *   ¡Listo! El sistema creará todo automáticamente y se mantendrá funcionando.

---

## 🚀 Despliegue en la Nube (Siempre Online con Render)

Render permite alojar esta aplicación de forma gratuita y mantenerla siempre en línea. Para que la base de datos SQLite y las imágenes no se borren en cada reinicio del contenedor gratuito, hemos configurado un **Disco Persistente** usando el archivo `render.yaml`.

### Opción A: Despliegue Rápido con Render Blueprint (Recomendada)
1. Sube este código a un repositorio tuyo de **GitHub** o **GitLab**.
2. Entra a tu cuenta en [Render.com](https://render.com/).
3. Haz clic en **New +** y selecciona **Blueprint**.
4. Conecta tu repositorio de GitHub. Render detectará el archivo `render.yaml` automáticamente.
5. Haz clic en **Approve** (Aprobar). Render creará automáticamente:
   * El servicio web Node.js.
   * Un volumen de disco persistente (`stockvibe-data` montado en `/var/data`).
   * Las variables de entorno necesarias (`WORK_DIR=/var/data`).
6. Una vez desplegado, accede a la URL que te proporciona Render. La app ya estará autoconfigurada y lista para usarse de forma 100% persistente y siempre en línea.

### Opción B: Configuración Manual en Render
Si prefieres crear el servicio de forma manual paso a paso:
1. Crea un **Web Service** en Render apuntando a tu repositorio de GitHub.
2. Configura los siguientes parámetros:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
3. En la pestaña **Disk** (abajo en la configuración del servicio):
   * Añade un disco con nombre `inventario-disco`.
   * **Mount Path**: `/var/data`
   * **Size**: `1 GB` (la capa gratuita o mínima es suficiente).
4. En la pestaña **Environment**:
   * Añade una variable: `WORK_DIR` con el valor `/var/data`.
5. Haz clic en **Deploy**.

---

## 📁 Estructura del Proyecto

```text
├── public/                 # Interfaz Frontend (Archivos Estáticos)
│   ├── css/
│   │   └── styles.css      # Estilos premium, animaciones y glassmorphism
│   ├── js/
│   │   └── app.js          # Control de eventos, peticiones fetch y SPA
│   └── index.html          # Maquetación estructurada e interfaces
├── Dockerfile              # Configuración de contenedor Docker para producción
├── package.json            # Dependencias del proyecto
├── render.yaml             # Blueprint de Render (Volumen persistente + Web Service)
├── run.bat                 # Script ejecutable de Windows para arranque rápido
├── server.js               # Servidor Express, API REST y control de base de datos
└── README.md               # Este archivo de instrucciones
```
