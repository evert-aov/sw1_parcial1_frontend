const { app, BrowserWindow, Menu, dialog, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const http = require('http');

let mainWindow;
let backendProcess = null;
let logFileStream = null;

function logBackend(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  if (logFileStream) {
    try {
      logFileStream.write(line);
    } catch (_) {}
  }
}

function waitForBackend(primaryUrl, timeoutMs = 45000) {
  const urls = [
    primaryUrl.replace('localhost', '127.0.0.1'),
    primaryUrl,
  ];
  return new Promise((resolve) => {
    const start = Date.now();
    let urlIndex = 0;

    const check = () => {
      const currentUrl = urls[urlIndex % urls.length];
      urlIndex++;

      const req = http.get(currentUrl, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          logBackend(`[Electron] Backend listo y respondiendo en: ${currentUrl}`);
          resolve(true);
        } else {
          setTimeout(check, 250);
        }
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 250);
        }
      });

      req.setTimeout(1500, () => {
        req.destroy();
      });
    };

    check();
  });
}

function startBackendServer() {
  const isDev = process.argv.includes('--dev') || process.env.ELECTRON_DEV === 'true';

  // Si se pasa --external-backend no levantamos el proceso embebido
  if (process.argv.includes('--external-backend')) {
    logBackend('[Electron] Usando backend externo ya iniciado en el sistema.');
    return;
  }

  let backendEntry;
  let backendCwd;

  if (app.isPackaged) {
    backendEntry = path.join(process.resourcesPath, 'backend', 'dist', 'main.js');
    backendCwd = path.join(process.resourcesPath, 'backend');
  } else {
    backendEntry = path.join(__dirname, '..', 'backend', 'dist', 'main.js');
    backendCwd = path.join(__dirname, '..', 'backend');
  }

  const userDataPath = app.getPath('userData');
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    const logFilePath = path.join(userDataPath, 'backend.log');
    logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  } catch (err) {
    console.error('[Electron] Error inicializando logs en disco:', err);
  }

  const sqliteDbPath = path.join(userDataPath, 'uml_studio.sqlite');

  logBackend(`[Electron] Iniciando backend embebido: ${backendEntry}`);
  logBackend(`[Electron] Directorio de trabajo backend: ${backendCwd}`);
  logBackend(`[Electron] Base de datos SQLite: ${sqliteDbPath}`);

  const backendEnv = {
    ...process.env,
    PORT: '28475',
    DB_TYPE: 'sqljs',
    SQLITE_PATH: sqliteDbPath,
    NODE_PATH: path.join(backendCwd, 'node_modules'),
    JWT_SECRET: process.env.JWT_SECRET || 'desktop-local-secret-jwt-key-2026',
    NODE_ENV: 'production',
    AI_PROVIDER: 'none',
  };

  // 1. Intentar con utilityProcess.fork (API oficial de Electron para subprocesos)
  // NOTA: utilityProcess.fork NO debe tener ELECTRON_RUN_AS_NODE en su env,
  // ya que Chromium pasa flags internas (--type=utility) que Node rechazaría como opciones no válidas.
  if (utilityProcess && typeof utilityProcess.fork === 'function') {
    try {
      logBackend('[Electron] Lanzando backend mediante utilityProcess.fork...');
      backendProcess = utilityProcess.fork(backendEntry, [], {
        cwd: backendCwd,
        env: backendEnv,
        stdio: 'pipe',
        serviceName: 'backend-service',
      });

      if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (data) => {
          logBackend(`[Backend] ${data.toString().trimEnd()}`);
        });
      }

      if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (data) => {
          logBackend(`[Backend ERR] ${data.toString().trimEnd()}`);
        });
      }

      backendProcess.on('exit', (code) => {
        logBackend(`[Electron] Subproceso utilityProcess backend finalizado con código: ${code}`);
      });
    } catch (err) {
      logBackend(`[Electron] Falló utilityProcess.fork (${err.message}), intentando con child_process.fork...`);
      backendProcess = null;
    }
  }

  // 2. Fallback a child_process.fork si utilityProcess no está disponible o falló
  if (!backendProcess) {
    try {
      logBackend('[Electron] Lanzando backend mediante child_process.fork...');
      backendProcess = fork(backendEntry, [], {
        cwd: backendCwd,
        env: {
          ...backendEnv,
          ELECTRON_RUN_AS_NODE: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (data) => {
          logBackend(`[Backend] ${data.toString().trimEnd()}`);
        });
      }

      if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (data) => {
          logBackend(`[Backend ERR] ${data.toString().trimEnd()}`);
        });
      }

      backendProcess.on('error', (err) => {
        logBackend(`[Electron] Error en proceso backend: ${err.message}`);
      });

      backendProcess.on('exit', (code, signal) => {
        logBackend(`[Electron] Backend finalizado con código ${code} y señal ${signal}`);
      });
    } catch (err) {
      logBackend(`[Electron] No se pudo lanzar el subproceso backend: ${err.message}`);
    }
  }
}

function createWindow() {
  const possibleIcons = [
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(__dirname, 'public', 'favicon.ico'),
    path.join(__dirname, 'dist', 'frontend', 'browser', 'favicon.ico'),
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'public', 'logo.png'),
  ];
  const windowIcon = possibleIcons.find((p) => fs.existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'UML/ER Studio',
    icon: windowIcon,
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
        <title>UML/ER Studio - Conectando...</title>
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

app.whenReady().then(async () => {
  startBackendServer();

  // Esperar a que el backend responda en http://localhost:28475/api
  const isReady = await waitForBackend('http://localhost:28475/api', 45000);

  if (!isReady && !process.argv.includes('--external-backend')) {
    const userDataPath = app.getPath('userData');
    const logFilePath = path.join(userDataPath, 'backend.log');
    logBackend(`[Electron] ADVERTENCIA: Backend no respondió en el puerto 28475 tras 45s. Registro en: ${logFilePath}`);
    dialog.showErrorBox(
      'Aviso del Servidor Local',
      `El backend embebido no respondió en el puerto 28475 tras 45 segundos.\n\nPuedes revisar los detalles técnicos en el log:\n${logFilePath}`
    );
  }

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

app.on('will-quit', () => {
  if (backendProcess) {
    logBackend('[Electron] Terminando proceso backend embebido...');
    try {
      if (typeof backendProcess.kill === 'function') {
        backendProcess.kill();
      }
    } catch (_) {}
    backendProcess = null;
  }
});
