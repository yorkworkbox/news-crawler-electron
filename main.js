const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs').promises;

let mainWindow; // <<< 修改：將 mainWindow 宣告移到外面

const defaultWebsitesContent = `Yahoo：https://tw.stock.yahoo.com/rss?q=sunmedia
Line：https://today.line.me/tw/v2/publisher/104464
蕃新聞：https://search.yam.com/Search/News?q=%%KEYWORD%%
奧丁丁：https://news.owlting.com/articles/search/%%KEYWORD%%?locale=zh-TW
PChome：https://news.pchome.com.tw/media/sunmedia
火報：https://firenews.com.tw/?s=%%KEYWORD%%
Life生活網：https://life.tw/?app=author&act=detail&id=127133
記者爆料網：https://new-reporter.com/?s=%%KEYWORD%%
台灣線報：https://twline365.com/?s=%%KEYWORD%%
獨家報導：https://www.scooptw.com/?s=%%KEYWORD%%
YES新聞：https://www.yesmedia.com.tw/?s=%%KEYWORD%%
樂聯網：https://leho.com.tw/?s=%%KEYWORD%%
台灣電報：https://enn.tw/?s=%%KEYWORD%%
民生電子報：https://lifenews.com.tw/page/1/?s=%%KEYWORD%%
警政時報：https://www.tcpttw.com/?s=%%KEYWORD%%
墨新聞：https://more-news.tw/?s=%%KEYWORD%%
商傳媒RSS：https://sunmedia.tw/rss/sunmedia
福爾摩沙：https://formosalive.com/?s=%%KEYWORD%%
民聲新聞：https://91postnews.com/?s=%%KEYWORD%%`;

const defaultManualSitesContent = `AMM新聞：https://ammtw.com/?s=%E5%95%86%E5%82%B3%E5%AA%92
台北郵報：https://taipeipost.org/?s=%E5%95%86%E5%82%B3%E5%AA%92#google_vignette`;

function getFilePath(fileName) {
    const basePath = app.isPackaged ? path.dirname(app.getAppPath()) : __dirname;
    return path.join(basePath, fileName);
}

function createWindow() {
    mainWindow = new BrowserWindow({ // <<< 修改：移除 const
        width: 1200,
        height: 800,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);

    mainWindow.once('ready-to-show', () => {
      autoUpdater.checkForUpdatesAndNotify();
    });
}

app.whenReady().then(createWindow);
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

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

ipcMain.handle('save-default-websites-content', async (event, content) => {
    const filePath = getFilePath('default-websites.txt');
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('get-manual-sites-content', async () => {
    const filePath = getFilePath('manual-search-sites.txt');
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return { status: 'success', content };
    } catch (error) {
        await fs.writeFile(filePath, defaultManualSitesContent, 'utf8');
        return { status: 'success', content: defaultManualSitesContent };
    }
});

ipcMain.handle('save-manual-sites-content', async (event, content) => {
    const filePath = getFilePath('manual-search-sites.txt');
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('open-external-link', (event, url) => {
    shell.openExternal(url);
});

ipcMain.on('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title: title,
            body: body,
            silent: false
        });
        notification.show();
    }
});

// ▼▼▼ START: 新增區塊 ▼▼▼
// 監聽來自渲染程序的閃爍圖示請求
ipcMain.on('flash-frame', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.flashFrame(true); // 開始閃爍，直到視窗獲得焦點
    }
});
// ▲▲▲ END: 新增區塊 ▲▲▲