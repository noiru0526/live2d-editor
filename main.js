const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

// GPU初期化失敗対策
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

// クラッシュ時にダイアログでエラーを表示
process.on('uncaughtException', (err) => {
  dialog.showErrorBox('エラーが発生しました', err.stack || err.message);
});

app.on('render-process-gone', (event, webContents, details) => {
  dialog.showErrorBox('レンダラープロセスがクラッシュしました', JSON.stringify(details));
});

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 860,
    minWidth: 900, minHeight: 600,
    title: 'Live2D Editor — noiru',
    backgroundColor: '#1a1e2e',
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
        {
          label: 'モデルを保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => win.webContents.send('save-model')
        },
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
    }
  ]);
  Menu.setApplicationMenu(menu);
}

// IPC: save file
ipcMain.handle('write-file', async (e, filePath, data) => {
  fs.writeFileSync(filePath, data, 'utf8');
  return true;
});

ipcMain.handle('read-file-as-dataurl', async (e, filePath) => {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext==='jpg'||ext==='jpeg'?'image/jpeg':'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
});

ipcMain.handle('get-save-path', async (e, defaultName) => {
  const result = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  return result.canceled ? null : result.filePath;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
