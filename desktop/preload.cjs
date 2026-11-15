const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lbwDesktopSave', {
  read: () => ipcRenderer.invoke('lbw-save:read'),
  write: json => ipcRenderer.invoke('lbw-save:write', json),
  clear: () => ipcRenderer.invoke('lbw-save:clear'),
});
