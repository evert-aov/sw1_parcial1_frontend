const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Diagramador UML',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Permite peticiones HTTP/WS a localhost/backend desde el protocolo file://
    },
  });

  // Quitar el menú por defecto del navegador
  Menu.setApplicationMenu(null);

  // Permitir abrir DevTools con F12 o Ctrl+Shift+I en cualquier entorno
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  const isDev = process.argv.includes('--dev') || process.env.ELECTRON_DEV === 'true';

  if (isDev) {
    const devUrl = 'http://localhost:4200';
    let isConnected = false;

    const waitingHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Diagramador UML - Conectando...</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #0b0f19 0%, #1e293b 100%);
            color: #f8fafc;
            text-align: center;
            padding: 24px;
          }
          .card {
            background: rgba(30, 41, 59, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            border-radius: 16px;
            padding: 36px 32px;
            max-width: 520px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(59, 130, 246, 0.2);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.9s cubic-bezier(0.6, 0.2, 0.4, 0.8) infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          h2 { margin: 0 0 10px; font-size: 20px; font-weight: 600; color: #ffffff; }
          p { margin: 0 0 18px; color: #94a3b8; font-size: 14px; line-height: 1.5; }
          .cmd-box {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 10px 18px;
            color: #38bdf8;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h2>Esperando servidor Angular...</h2>
          <p>Conectando con <code>http://localhost:4200</code>.<br>La aplicación cargará automáticamente en cuanto el servidor esté listo.</p>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Si aún no has iniciado el servidor web, ejecuta en otra terminal:</p>
          <div class="cmd-box">npm start</div>
        </div>
      </body>
      </html>
    `;

    const tryLoad = () => {
      if (isConnected) return;
      mainWindow.loadURL(devUrl).then(() => {
        isConnected = true;
      }).catch(() => {
        // En caso de fallo inicial de conexión
      });
    };

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (validatedURL.startsWith(devUrl)) {
        isConnected = false;
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(waitingHtml));
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed() && !isConnected) {
            tryLoad();
          }
        }, 1500);
      }
    });

    tryLoad();
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'frontend', 'browser', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
