const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const APP_ID = 'com.littlebatchworks.game';
const SAVE_NAME = 'little-batch-works-save.json';

app.setAppUserModelId(APP_ID);

function savePath() {
  return path.join(app.getPath('userData'), SAVE_NAME);
}

ipcMain.handle('lbw-save:read', async () => {
  try { return await fs.readFile(savePath(), 'utf8'); }
  catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
});

ipcMain.handle('lbw-save:write', async (_event, json) => {
  if (typeof json !== 'string' || json.length > 10_000_000) throw new Error('Invalid save mirror');
  const target = savePath();
  const temporary = `${target}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(temporary, json, 'utf8');
  await fs.rename(temporary, target);
  return true;
});

ipcMain.handle('lbw-save:clear', async () => {
  try { await fs.unlink(savePath()); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  return true;
});

async function createWindow() {
  const window = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#fff6e7',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
