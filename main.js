const { app, BrowserWindow, Menu, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const http = require('http');

let mainWindow = null;
let backendProcess = null;
let logFileStream = null;
let backendExitedEarly = false;
let backendExitError = null;

function logBackend(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  if (logFileStream) {
    try {
      logFileStream.write(line);
    } catch (_) {}
  }
}

function checkHttpReady(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 500) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForBackend(primaryUrl, timeoutMs = 20000) {
  const urls = [
    primaryUrl.replace('localhost', '127.0.0.1'),
    primaryUrl,
  ];
  return new Promise((resolve) => {
    const start = Date.now();
    let urlIndex = 0;

    const check = async () => {
      if (backendExitedEarly) {
        logBackend('[Electron] El proceso backend finalizó antes de responder.');
        return resolve(false);
      }

      const currentUrl = urls[urlIndex % urls.length];
      urlIndex++;

      const isUp = await checkHttpReady(currentUrl, 1000);
      if (isUp) {
        logBackend(`[Electron] Backend listo y respondiendo en: ${currentUrl}`);
        return resolve(true);
      }

      if (Date.now() - start > timeoutMs) {
        return resolve(false);
      }

      setTimeout(check, 300);
    };

    check();
  });
}

async function startBackendServer() {
  if (process.argv.includes('--external-backend')) {
    logBackend('[Electron] Usando backend externo ya iniciado en el sistema.');
    return;
  }

  // Si ya hay un backend respondiendo en 28475, reutilizarlo directamente
  const alreadyRunning = await checkHttpReady('http://127.0.0.1:28475/api', 800);
  if (alreadyRunning) {
    logBackend('[Electron] Detectada instancia activa de backend en el puerto 28475. Conectando directamente...');
    return;
  }

  backendExitedEarly = false;
  backendExitError = null;

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
          const str = data.toString().trimEnd();
          logBackend(`[Backend ERR] ${str}`);
          if (str.includes('EADDRINUSE')) {
            backendExitError = 'El puerto 28475 ya está en uso por otro proceso (por ejemplo, una prueba previa de Wine o terminal).';
          }
        });
      }

      backendProcess.on('exit', (code) => {
        logBackend(`[Electron] Subproceso utilityProcess backend finalizado con código: ${code}`);
        if (code !== 0) {
          backendExitedEarly = true;
        }
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
          const str = data.toString().trimEnd();
          logBackend(`[Backend ERR] ${str}`);
          if (str.includes('EADDRINUSE')) {
            backendExitError = 'El puerto 28475 ya está en uso por otro proceso (por ejemplo, una prueba previa de Wine o terminal).';
          }
        });
      }

      backendProcess.on('error', (err) => {
        logBackend(`[Electron] Error en proceso backend: ${err.message}`);
        backendExitedEarly = true;
      });

      backendProcess.on('exit', (code, signal) => {
        logBackend(`[Electron] Backend finalizado con código ${code} y señal ${signal}`);
        if (code !== 0) {
          backendExitedEarly = true;
        }
      });
    } catch (err) {
      logBackend(`[Electron] No se pudo lanzar el subproceso backend: ${err.message}`);
      backendExitedEarly = true;
    }
  }
}

function getSplashHtml(statusText = 'Iniciando servicios locales...') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>UML/ER Studio</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0A0D1A;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #F8FAFC;
          overflow: hidden;
          user-select: none;
        }
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 32px;
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .logo-box {
          width: 80px;
          height: 80px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo-box img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 8px 24px rgba(139, 92, 246, 0.35));
        }
        .title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
          color: #FFFFFF;
        }
        .subtitle {
          font-size: 12px;
          color: #64748B;
          margin-bottom: 26px;
        }
        .spinner {
          width: 26px;
          height: 26px;
          border: 3px solid rgba(139, 92, 246, 0.15);
          border-top-color: #8B5CF6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 12px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .status {
          font-size: 12.5px;
          color: #94A3B8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-box">
          <img src="logo.png" alt="UML/ER Studio Logo" onerror="this.style.display='none'">
        </div>
        <div class="title">UML/ER Studio</div>
        <div class="subtitle">Enterprise Architect Suite & Spring Boot Generator</div>
        <div class="spinner"></div>
        <div class="status">${statusText}</div>
      </div>
    </body>
    </html>
  `;
}

function getErrorHtml(errorMessage, logPath) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>UML/ER Studio - Aviso</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0A0D1A;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #F8FAFC;
          padding: 24px;
          user-select: none;
        }
        .card {
          background: #0F142A;
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 20px;
          padding: 32px;
          max-width: 500px;
          text-align: center;
          box-shadow: 0 24px 48px rgba(0,0,0,0.6);
        }
        .icon {
          font-size: 38px;
          margin-bottom: 14px;
        }
        h2 { margin: 0 0 10px; font-size: 18px; color: #F87171; font-weight: 600; }
        p { margin: 0 0 16px; color: #94A3B8; font-size: 13px; line-height: 1.5; }
        .log-box {
          background: #060914;
          border: 1px solid #1E293B;
          border-radius: 10px;
          padding: 12px 14px;
          color: #CBD5E1;
          font-family: monospace;
          font-size: 11.5px;
          word-break: break-all;
          margin-bottom: 22px;
          text-align: left;
        }
        .btn {
          background: #3B82F6;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn:hover { background: #2563EB; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">⚠️</div>
        <h2>No se pudo conectar con el servicio local</h2>
        <p>${errorMessage}</p>
        <p style="font-size: 12px; color: #64748B;">Puedes revisar los detalles técnicos en el log:</p>
        <div class="log-box">${logPath}</div>
        <button class="btn" onclick="location.reload()">Reintentar Conexión</button>
      </div>
    </body>
    </html>
  `;
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
    show: false, // Se muestra de inmediato al estar listo
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Permite peticiones HTTP/WS a localhost/backend desde file://
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Quitar el menú por defecto del navegador
  Menu.setApplicationMenu(null);

  // Permitir abrir DevTools con F12 o Ctrl+Shift+I
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

    const tryLoad = () => {
      if (isConnected) return;
      mainWindow.loadURL(devUrl).then(() => {
        isConnected = true;
      }).catch(() => {});
    };

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (validatedURL.startsWith(devUrl)) {
        isConnected = false;
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getSplashHtml('Esperando servidor de desarrollo Angular (http://localhost:4200)...')));
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed() && !isConnected) {
            tryLoad();
          }
        }, 1200);
      }
    });

    tryLoad();
    mainWindow.webContents.openDevTools();
  } else {
    // 1. Mostrar de inmediato la pantalla de carga elegante (tiempo de respuesta < 200ms)
    const splashUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(getSplashHtml('Iniciando base de datos y servicios locales...'));
    mainWindow.loadURL(splashUrl);

    // 2. Esperar a que el backend embebido responda en el puerto 28475
    waitForBackend('http://localhost:28475/api', 20000).then((isReady) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      if (isReady) {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'frontend', 'browser', 'index.html'));
      } else {
        const userDataPath = app.getPath('userData');
        const logFilePath = path.join(userDataPath, 'backend.log');
        const errorMsg = backendExitError
          ? backendExitError
          : 'El servidor local no respondió en el puerto 28475 tras 20s. Si ejecutaste una prueba anterior en Wine o terminal, asegúrate de que no haya quedado abierta en segundo plano.';
        const errUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(getErrorHtml(errorMsg, logFilePath));
        mainWindow.loadURL(errUrl);
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function terminateBackend() {
  if (backendProcess) {
    logBackend('[Electron] Terminando proceso backend embebido...');
    try {
      if (typeof backendProcess.kill === 'function') {
        backendProcess.kill();
      }
    } catch (_) {}
    backendProcess = null;
  }
}

app.whenReady().then(() => {
  createWindow();
  startBackendServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', terminateBackend);
app.on('will-quit', terminateBackend);

process.on('SIGINT', () => {
  terminateBackend();
  app.quit();
});

process.on('SIGTERM', () => {
  terminateBackend();
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
