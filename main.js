const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win, riggerWin;

app.commandLine.appendSwitch('no-sandbox');

process.on('uncaughtException', (err) => {
  dialog.showErrorBox('エラーが発生しました', err.stack || err.message);
});
app.on('render-process-gone', (event, webContents, details) => {
  dialog.showErrorBox('レンダラープロセスがクラッシュしました', JSON.stringify(details));
});

// ===== ANIMATION EDITOR WINDOW =====
function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 860,
    minWidth: 900, minHeight: 600,
    title: 'Live2D Editor — noiru',
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  const menu = Menu.buildFromTemplate([
    {
      label: 'ファイル',
      submenu: [
        {
          label: '画像を開く...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(win, {
              title: '画像を選択',
              filters: [{ name: 'Image', extensions: ['png','jpg','jpeg','webp'] }],
              properties: ['openFile']
            });
            if (!result.canceled && result.filePaths[0]) {
              win.webContents.send('open-image', result.filePaths[0]);
            }
          }
        },
        {
          label: 'モデルを開く...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(win, {
              title: 'モデルファイルを選択',
              filters: [{ name: 'JSON', extensions: ['json'] }],
              properties: ['openFile']
            });
            if (!result.canceled && result.filePaths[0]) {
              const data = fs.readFileSync(result.filePaths[0], 'utf8');
              win.webContents.send('load-model', data, result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        { label: 'モデルを保存', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('save-model') },
        {
          label: 'モデルを別名保存...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            const result = await dialog.showSaveDialog(win, {
              title: 'モデルを保存',
              defaultPath: 'noiru-model.json',
              filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (!result.canceled) win.webContents.send('save-model-as', result.filePath);
          }
        },
        {
          label: 'アバターHTMLを出力...',
          accelerator: 'CmdOrCtrl+E',
          click: async () => {
            const result = await dialog.showSaveDialog(win, {
              title: 'アバターHTMLを保存',
              defaultPath: 'noiru-avatar.html',
              filters: [{ name: 'HTML', extensions: ['html'] }]
            });
            if (!result.canceled) win.webContents.send('export-html', result.filePath);
          }
        },
        { type: 'separator' },
        { label: '終了', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: '編集',
      submenu: [
        { label: '元に戻す', accelerator: 'CmdOrCtrl+Z', click: () => win.webContents.send('undo') },
        { type: 'separator' },
        { label: '現在のキーフレームをリセット', click: () => win.webContents.send('reset-kf') },
        { label: '全データをリセット', click: () => win.webContents.send('reset-all') }
      ]
    },
    {
      label: '表示',
      submenu: [
        { label: 'メッシュ表示切替', accelerator: 'M', click: () => win.webContents.send('toggle-mesh') },
        { label: '変形モード', accelerator: 'D', click: () => win.webContents.send('set-mode', 'deform') },
        { label: 'プレビューモード', accelerator: 'P', click: () => win.webContents.send('set-mode', 'preview') },
        { type: 'separator' },
        { label: '開発者ツール', accelerator: 'F12', click: () => win.webContents.toggleDevTools() }
      ]
    },
    {
      label: 'ツール',
      submenu: [
        {
          label: 'リギングエディタを開く',
          accelerator: 'CmdOrCtrl+R',
          click: () => createRiggerWindow()
        }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

// ===== RIGGING EDITOR WINDOW =====
function createRiggerWindow() {
  if (riggerWin && !riggerWin.isDestroyed()) {
    riggerWin.focus();
    return;
  }

  riggerWin = new BrowserWindow({
    width: 1600, height: 960,
    minWidth: 1100, minHeight: 650,
    title: 'Live2D Rigger — noiru',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-rigger.js')
    }
  });

  riggerWin.loadFile(path.join(__dirname, 'rigger.html'));

  const riggerMenu = Menu.buildFromTemplate([
    {
      label: 'ファイル',
      submenu: [
        {
          label: '画像を開く...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!riggerWin) return;
            const result = await dialog.showOpenDialog(riggerWin, {
              title: 'アバター画像を選択',
              filters: [{ name: '画像', extensions: ['png','jpg','jpeg','webp'] }],
              properties: ['openFile']
            });
            if (!result.canceled && result.filePaths[0]) {
              const buf = fs.readFileSync(result.filePaths[0]);
              const ext = path.extname(result.filePaths[0]).slice(1).toLowerCase();
              const mime = (ext==='jpg'||ext==='jpeg') ? 'image/jpeg' : 'image/png';
              const dataURL = `data:${mime};base64,${buf.toString('base64')}`;
              riggerWin.webContents.send('rigger-drop-image', dataURL);
            }
          }
        },
        {
          label: 'モデルを開く...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            if (!riggerWin) return;
            const result = await dialog.showOpenDialog(riggerWin, {
              title: 'モデルJSONを選択',
              filters: [{ name: 'JSON', extensions: ['json'] }],
              properties: ['openFile']
            });
            if (!result.canceled && result.filePaths[0]) {
              const json = fs.readFileSync(result.filePaths[0], 'utf8');
              riggerWin.webContents.executeJavaScript(`loadModelFromJSON(${JSON.stringify(json)})`);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'モデルを保存...',
          accelerator: 'CmdOrCtrl+S',
          click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript('exportAll()'); }
        },
        {
          label: 'アバターHTMLを出力...',
          accelerator: 'CmdOrCtrl+E',
          click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript('exportAvatarHTMLDirect()'); }
        },
        { type: 'separator' },
        { label: '閉じる', accelerator: 'CmdOrCtrl+W', click: () => { if (riggerWin) riggerWin.close(); } }
      ]
    },
    {
      label: 'パーツ',
      submenu: [
        { label: 'パーツを追加', accelerator: 'CmdOrCtrl+N', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript('addPartStart()'); } },
        { label: '選択パーツを削除', accelerator: 'Delete', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript('delPart()'); } },
        { type: 'separator' },
        { label: 'スマート変形を適用', accelerator: 'CmdOrCtrl+G', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript('smartDeform()'); } },
        { label: '現KFをリセット', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript('resetKF()'); } }
      ]
    },
    {
      label: 'モード',
      submenu: [
        { label: 'パーツ設定', accelerator: '1', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript("setMode('parts')"); } },
        { label: 'メッシュ編集', accelerator: '2', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript("setMode('mesh')"); } },
        { label: '変形リグ', accelerator: '3', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript("setMode('deform')"); } },
        { label: 'プレビュー', accelerator: '4', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript("setMode('preview')"); } }
      ]
    },
    {
      label: '表示',
      submenu: [
        { label: '画面にフィット', accelerator: 'F', click: () => { if (riggerWin) riggerWin.webContents.executeJavaScript('fitView()'); } },
        { type: 'separator' },
        { label: '開発者ツール', accelerator: 'F12', click: () => { if (riggerWin) riggerWin.webContents.toggleDevTools(); } }
      ]
    }
  ]);
  riggerWin.setMenu(riggerMenu);

  riggerWin.on('closed', () => { riggerWin = null; });
}

// ===== IPC: ANIMATION EDITOR =====
ipcMain.handle('write-file', async (e, filePath, data) => {
  fs.writeFileSync(filePath, data, 'utf8');
  return true;
});
ipcMain.handle('read-file-as-dataurl', async (e, filePath) => {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext==='jpg'||ext==='jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
});
ipcMain.handle('get-save-path', async (e, defaultName) => {
  const result = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  return result.canceled ? null : result.filePath;
});

// ===== IPC: SCREENSHOT =====
ipcMain.handle('screenshot', async (e, label) => {
  try {
    const target = win && !win.isDestroyed() ? win : null;
    if (!target) return null;
    const img = await target.webContents.capturePage();
    const dir = '/app/screenshots';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const suffix = label ? `-${label}` : '';
    const filePath = path.join(dir, `screenshot${suffix}-${ts}.png`);
    fs.writeFileSync(filePath, img.toPNG());
    return filePath;
  } catch (err) {
    return null;
  }
});

// ===== IPC: RIGGING EDITOR =====
ipcMain.handle('open-rigger', async () => {
  createRiggerWindow();
  return true;
});

ipcMain.handle('rigger-open-image', async () => {
  if (!riggerWin) return null;
  const result = await dialog.showOpenDialog(riggerWin, {
    title: 'アバター画像を選択',
    filters: [{ name: '画像', extensions: ['png','jpg','jpeg','webp'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const buf = fs.readFileSync(result.filePaths[0]);
  const ext = path.extname(result.filePaths[0]).slice(1).toLowerCase();
  const mime = (ext==='jpg'||ext==='jpeg') ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
});

ipcMain.handle('rigger-open-model', async () => {
  if (!riggerWin) return null;
  const result = await dialog.showOpenDialog(riggerWin, {
    title: 'モデルJSONを選択',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return fs.readFileSync(result.filePaths[0], 'utf8');
});

ipcMain.handle('rigger-save-model', async (e, json) => {
  if (!riggerWin) return false;
  const result = await dialog.showSaveDialog(riggerWin, {
    title: 'モデルを保存',
    defaultPath: 'noiru-rig.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, json, 'utf8');
  return true;
});

ipcMain.handle('rigger-export-avatar', async (e, html) => {
  if (!riggerWin) return false;
  const result = await dialog.showSaveDialog(riggerWin, {
    title: 'アバターHTMLを保存',
    defaultPath: 'noiru-avatar.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, html, 'utf8');
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
