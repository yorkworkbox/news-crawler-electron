const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 可爬取網站清單
    getDefaultWebsitesContent: () => ipcRenderer.invoke('get-default-websites-content'),
    saveDefaultWebsitesContent: (content) => ipcRenderer.invoke('save-default-websites-content', content),
    
    // --- 新增：手動搜尋清單的 API ---
    getManualSitesContent: () => ipcRenderer.invoke('get-manual-sites-content'),
    saveManualSitesContent: (content) => ipcRenderer.invoke('save-manual-sites-content', content),

    // --- 新增：開啟外部連結的 API ---
    openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url)
});