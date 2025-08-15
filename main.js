const { app, BrowserWindow, ipcMain, shell } = require('electron'); // 新增 shell 模組
const path = require('path');
const fs = require('fs').promises;

const defaultWebsitesContent = `Yahoo：https://tw.stock.yahoo.com/rss?q=sunmedia
Line：https://today.line.me/tw/v2/publisher/104464
蕃新聞：https://n.yam.com/RealTime/sunmedia?page=1
奧丁丁：https://news.owlting.com/vendor/77Google
PChome：https://news.pchome.com.tw/media/sunmedia
火報：https://firenews.com.tw/page/2/?s=%E5%95%86%E5%82%B3%E5%AA%92
Life生活網：https://m.life.tw/?app=author&act=detail&id=127133Pchome
記者爆料網：https://new-reporter.com/?s=%E5%95%86%E5%82%B3%E5%AA%92
台灣線報：https://twline365.com/feed/sunmedia/
獨家報導：https://www.scooptw.com/category/sunmedia/
YES新聞：https://www.yesmedia.com.tw/?s=%E5%95%86%E5%82%B3%E5%AA%92
樂聯網：https://leho.com.tw/author/sunmedia
台灣電報：https://enn.tw/author/enn009/
民生電子報：https://lifenews.com.tw/page/1/?s=%E5%95%86%E5%82%B3%E5%AA%92
警政時報：https://www.tcpttw.com/?s=%E5%95%86%E5%82%B3%E5%AA%92
墨新聞：https://more-news.tw/author/sunmedia/
商傳媒：https://sunmedia.tw/`;

// 手動搜尋清單的預設內容
const defaultManualSitesContent = `AMM新聞：https://ammtw.com/?s=%E5%95%86%E5%82%B3%E5%AA%92
台北郵報：https://taipeipost.org/?s=%E5%95%86%E5%82%B3%E5%AA%92#google_vignette`;

function getFilePath(fileName) {
    const basePath = app.isPackaged ? path.dirname(app.getAppPath()) : __dirname;
    return path.join(basePath, fileName);
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// 讀取可爬取網站清單
ipcMain.handle('get-default-websites-content', async () => {
    const filePath = getFilePath('default-websites.txt');
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return { status: 'success', content };
    } catch (error) {
        await fs.writeFile(filePath, defaultWebsitesContent, 'utf8');
        return { status: 'success', content: defaultWebsitesContent };
    }
});

// 寫入可爬取網站清單
ipcMain.handle('save-default-websites-content', async (event, content) => {
    const filePath = getFilePath('default-websites.txt');
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

// --- 新增：讀取手動搜尋網站清單 ---
ipcMain.handle('get-manual-sites-content', async () => {
    const filePath = getFilePath('manual-search-sites.txt');
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return { status: 'success', content };
    } catch (error) {
        // 如果檔案不存在，建立一個並寫入預設值
        await fs.writeFile(filePath, defaultManualSitesContent, 'utf8');
        return { status: 'success', content: defaultManualSitesContent };
    }
});

// --- 寫入手動搜尋網站清單 ---
ipcMain.handle('save-manual-sites-content', async (event, content) => {
    const filePath = getFilePath('manual-search-sites.txt');
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

// --- 安全地開啟外部連結 ---
ipcMain.handle('open-external-link', (event, url) => {
    shell.openExternal(url);
});