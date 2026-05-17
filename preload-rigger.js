const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rigger', {
  openImage:    ()       => ipcRenderer.invoke('rigger-open-image'),
  openModel:    ()       => ipcRenderer.invoke('rigger-open-model'),
  saveModel:    (json)   => ipcRenderer.invoke('rigger-save-model', json),
  exportAvatar: (html)   => ipcRenderer.invoke('rigger-export-avatar', html),
  on(channel, cb) {
    const valid = ['rigger-drop-image'];
    if (valid.includes(channel))
      ipcRenderer.on(channel, (_, ...args) => cb(...args));
  }
});
