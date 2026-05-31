const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  writeFile: (path, data) => ipcRenderer.invoke('write-file', path, data),
  readFileAsDataURL: (path) => ipcRenderer.invoke('read-file-as-dataurl', path),
  getSavePath: (name) => ipcRenderer.invoke('get-save-path', name),
  openRigger: () => ipcRenderer.invoke('open-rigger'),
  screenshot: (label) => ipcRenderer.invoke('screenshot', label),
  discordRpc: (details, state) => ipcRenderer.send('discord-rpc-update', { details, state }),
  on(channel, callback) {
    const valid = [
      'open-image','load-model','save-model','save-model-as',
      'export-html','undo','toggle-mesh','set-mode','reset-kf','reset-all'
    ];
    if (valid.includes(channel))
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
  },
});
