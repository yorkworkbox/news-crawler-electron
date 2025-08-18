// --- renderer.js ---

let isSearching = false;
let searchResults = [];
let rawHtmlCache = {};
let currentWebsiteState = [];
let manualSearchState = [];
let searchResultIdCounter = 0;
let stopSearchRequested = false;
let searchBtnWidth = 0;

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }
    updateThemeIcon();
    loadAllLists().catch(console.error);
    
    document.getElementById('keyword').addEventListener('focus', () => clearInputError('keyword'));
    document.getElementById('tabContainer').addEventListener('change', () => clearInputError('website'));
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(tabName + 'TabBtn').classList.add('active');
    document.getElementById(tabName + 'TabPanel').classList.add('active');

    const searchBtn = document.getElementById('searchBtn');
    const openAllBtnMain = document.getElementById('openAllBtnMain');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    
    if (tabName === 'crawl') {
        searchBtn.classList.remove('hidden');
        clearResultsBtn.classList.remove('hidden');
        openAllBtnMain.classList.add('hidden');
    } else {
        searchBtn.classList.add('hidden');
        clearResultsBtn.classList.add('hidden');
        openAllBtnMain.classList.remove('hidden');
    }
}

async function loadAllLists() {
    try {
        const [crawlResult, manualResult] = await Promise.all([
            window.electronAPI.getDefaultWebsitesContent(),
            window.electronAPI.getManualSitesContent()
        ]);

        if (crawlResult.status === 'success') {
            currentWebsiteState = parseWebsitesFromText(crawlResult.content);
            renderCheckboxes();
        } else { throw new Error('無法載入可爬取網站清單'); }

        if (manualResult.status === 'success') {
            manualSearchState = parseWebsitesFromText(manualResult.content, false);
            renderManualSearchList();
        } else { throw new Error('無法載入手動搜尋清單'); }
        
        showStatus('所有網站清單已成功載入', 'success');

    } catch (error) {
        console.error('載入清單時發生錯誤:', error);
        showStatus(`載入清單失敗: ${error.message}`, 'error');
    }
}

function enterEditMode() {
    document.getElementById('viewModeContainer').classList.add('hidden');
    document.getElementById('editModeContainer').classList.remove('hidden');
    renderEditor();
    
    document.getElementById('manualLinksContainer').classList.add('hidden');
    document.getElementById('manualEditContainer').classList.remove('hidden');
    renderManualEditor();
    
    document.getElementById('editBtn').classList.add('hidden');
    document.getElementById('addNewRowBtnTop').classList.remove('hidden');
    document.getElementById('saveBtn').classList.remove('hidden');
    document.getElementById('cancelBtn').classList.remove('hidden');
    document.getElementById('saveAsDefaultBtn').classList.remove('hidden');
}

function exitEditMode(wasSaved = false) {
    renderCheckboxes();
    renderManualSearchList();
    document.getElementById('viewModeContainer').classList.remove('hidden');
    document.getElementById('editModeContainer').classList.add('hidden');
    
    document.getElementById('manualLinksContainer').classList.remove('hidden');
    document.getElementById('manualEditContainer').classList.add('hidden');

    document.getElementById('editBtn').classList.remove('hidden');
    document.getElementById('addNewRowBtnTop').classList.add('hidden');
    document.getElementById('saveBtn').classList.add('hidden');
    document.getElementById('cancelBtn').classList.add('hidden');
    document.getElementById('saveAsDefaultBtn').classList.add('hidden');
}

function getWebsiteStateFromEditor(containerId, originalState) {
    const newState = [];
    const editRows = document.querySelectorAll(`#${containerId} .website-edit-item`);
    editRows.forEach((row) => {
        const nameInput = row.querySelector('.name-input');
        const urlInput = row.querySelector('.url-input');
        if (nameInput.value.trim() && urlInput.value.trim()) {
            const originalUrl = urlInput.dataset.originalUrl;
            const originalEntry = originalState.find(s => s.url === originalUrl);
            newState.push({
                name: nameInput.value.trim(),
                url: urlInput.value.trim(),
                checked: originalEntry ? originalEntry.checked : true
            });
        }
    });
    return newState;
}

function saveTemporaryChanges() {
    currentWebsiteState = getWebsiteStateFromEditor('websitesEditContainer', currentWebsiteState);
    manualSearchState = getWebsiteStateFromEditor('manualWebsitesEditContainer', manualSearchState);
    showStatus('變更已暫時套用', 'success');
    exitEditMode(true);
}

async function saveToDefaultFile() {
    const finalCrawlState = getWebsiteStateFromEditor('websitesEditContainer', currentWebsiteState);
    const finalManualState = getWebsiteStateFromEditor('manualWebsitesEditContainer', manualSearchState);

    const crawlContent = finalCrawlState.map(item => `${item.name}：${item.url}`).join('\n');
    const manualContent = finalManualState.map(item => `${item.name}：${item.url}`).join('\n');

    try {
        const [crawlSaveResult, manualSaveResult] = await Promise.all([
            window.electronAPI.saveDefaultWebsitesContent(crawlContent),
            window.electronAPI.saveManualSitesContent(manualContent)
        ]);

        if (crawlSaveResult.status !== 'success' || manualSaveResult.status !== 'success') {
            throw new Error('儲存一個或多個檔案失敗');
        }
        
        currentWebsiteState = finalCrawlState.map(item => ({ ...item, checked: true }));
        manualSearchState = finalManualState;
        showStatus('已成功將兩個清單儲存成預設值！', 'success');
        exitEditMode(true);

    } catch (error) {
        console.error('儲存預設清單失敗:', error);
        showStatus(`儲存失敗: ${error.message}`, 'error');
    }
}

function renderCheckboxes() {
    const container = document.getElementById('websitesContainer');
    let allItemsHtml = '';
    currentWebsiteState.forEach((website, index) => {
        allItemsHtml += `<div class="website-item"><input type="checkbox" id="website-${index}" onchange="updateCheckedState(${index}, this.checked)" ${website.checked ? 'checked' : ''}><label for="website-${index}">${website.name}</label></div>`;
    });
    container.innerHTML = allItemsHtml;
    syncSelectAllCheckbox();
}

function renderEditor() {
    const container = document.getElementById('websitesEditContainer');
    let allItemsHtml = '';
    currentWebsiteState.forEach(website => {
        allItemsHtml += `<div class="website-edit-item"><input type="text" class="name-input" value="${website.name}" placeholder="媒體名稱"><input type="text" class="url-input" value="${website.url}" data-original-url="${website.url}" placeholder="https://example.com"><button class="btn btn-delete-row" onclick="deleteEditRow(this)">刪除</button></div>`;
    });
    container.innerHTML = allItemsHtml;
}

function renderManualSearchList() {
    const container = document.getElementById('manualLinksList');
    if (manualSearchState.length === 0) {
         container.innerHTML = '<p style="color: var(--text-muted); padding: 8px;">沒有手動搜尋網站。</p>';
         return;
    }
    let allItemsHtml = '';
    manualSearchState.forEach(site => {
        allItemsHtml += `<div class="manual-link-item"><a href="#" onclick="event.preventDefault(); window.electronAPI.openExternalLink('${site.url}');">${site.name}</a></div>`;
    });
    container.innerHTML = allItemsHtml;
}

function renderManualEditor() {
    const container = document.getElementById('manualWebsitesEditContainer');
    let allItemsHtml = '';
    manualSearchState.forEach(website => {
        allItemsHtml += `<div class="website-edit-item"><input type="text" class="name-input" value="${website.name}" placeholder="媒體名稱"><input type="text" class="url-input" value="${website.url}" data-original-url="${website.url}" placeholder="https://example.com"><button class="btn btn-delete-row" onclick="deleteEditRow(this)">刪除</button></div>`;
    });
    container.innerHTML = allItemsHtml;
}

function addNewRowToActiveTab() {
    if (document.getElementById('crawlTabPanel').classList.contains('active')) {
        addNewRow();
    } else {
        addNewManualRow();
    }
}

function addNewRow() {
    const container = document.getElementById('websitesEditContainer');
    const itemHtml = `<div class="website-edit-item"><input type="text" class="name-input" placeholder="媒體名稱"><input type="text" class="url-input" placeholder="https://example.com" data-original-url=""><button class="btn btn-delete-row" onclick="deleteEditRow(this)">刪除</button></div>`;
    container.insertAdjacentHTML('beforeend', itemHtml);
    container.closest('.tab-content').scrollTop = container.closest('.tab-content').scrollHeight;
}

function addNewManualRow() {
    const container = document.getElementById('manualWebsitesEditContainer');
    const itemHtml = `<div class="website-edit-item"><input type="text" class="name-input" placeholder="媒體名稱"><input type="text" class="url-input" placeholder="https://example.com" data-original-url=""><button class="btn btn-delete-row" onclick="deleteEditRow(this)">刪除</button></div>`;
    container.insertAdjacentHTML('beforeend', itemHtml);
    container.closest('.tab-content').scrollTop = container.closest('.tab-content').scrollHeight;
}

function deleteEditRow(button) {
    button.closest('.website-edit-item').remove();
}

async function openAllManualLinks() {
    if (manualSearchState.length === 0) return;
    const confirmed = await showConfirmation('確認操作', `即將在預設瀏覽器中開啟 ${manualSearchState.length} 個分頁，確定嗎？`);
    if (confirmed) {
        manualSearchState.forEach(site => {
            window.electronAPI.openExternalLink(site.url);
        });
    }
}

function parseWebsitesFromText(websitesText, defaultChecked = true) {
    const websites = [];
    const lines = websitesText.trim().split('\n');
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        const colonIndex = trimmedLine.indexOf('：');
        if (colonIndex > 0) {
            websites.push({ name: trimmedLine.substring(0, colonIndex).trim(), url: trimmedLine.substring(colonIndex + 1).trim(), checked: defaultChecked });
        } else if (trimmedLine.startsWith('http')) {
            try {
                const url = new URL(trimmedLine);
                websites.push({ name: url.hostname, url: trimmedLine, checked: defaultChecked });
            } catch(e) { console.error("無效的 URL:", trimmedLine); }
        }
    }
    return websites;
}

function updateCheckedState(index, isChecked) {
    if (currentWebsiteState[index]) currentWebsiteState[index].checked = isChecked;
    syncSelectAllCheckbox();
}

function toggleSelectAll(isChecked) {
    currentWebsiteState.forEach(website => website.checked = isChecked);
    renderCheckboxes();
}

function syncSelectAllCheckbox() {
    const allChecked = currentWebsiteState.length > 0 && currentWebsiteState.every(website => website.checked);
    document.getElementById('selectAllCheckbox').checked = allChecked;
}

function showStatus(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification-item status-${type}`;
    notification.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg> <span>${message}</span>`;
    
    container.appendChild(notification);

    if (duration !== null) {
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            notification.addEventListener('animationend', () => {
                notification.remove();
            });
        }, duration);
    }
}

function requestStopSearch() {
    const searchBtn = document.getElementById('searchBtn');
    stopSearchRequested = true;
    searchBtn.disabled = true;
    searchBtn.innerHTML = `<span>停止中...</span>`;
}

function clearInputError(type) {
    if (type === 'keyword') {
        document.getElementById('keyword').classList.remove('input-error');
        document.getElementById('keywordError').classList.remove('show');
    } else if (type === 'website') {
        document.getElementById('tabContainer').classList.remove('input-error');
        document.getElementById('websiteError').classList.remove('show');
    }
}

async function startSearch() {
    if (isSearching) return;
    clearInputError('keyword');
    clearInputError('website');

    const keyword = document.getElementById('keyword').value.trim();
    if (!keyword) {
        document.getElementById('keyword').classList.add('input-error');
        const errorEl = document.getElementById('keywordError');
        errorEl.textContent = '請輸入關鍵字';
        errorEl.classList.add('show');
        return;
    }
    const websitesToSearch = currentWebsiteState.filter(w => w.checked);
    if (websitesToSearch.length === 0) {
        document.getElementById('tabContainer').classList.add('input-error');
        const errorEl = document.getElementById('websiteError');
        errorEl.textContent = '請至少選擇一個網站進行搜尋';
        errorEl.classList.add('show');
        return;
    }

    isSearching = true;
    stopSearchRequested = false;
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchBtnWidth === 0) searchBtnWidth = searchBtn.offsetWidth;
    searchBtn.style.minWidth = `${searchBtnWidth}px`;
    
    searchBtn.classList.remove('btn-primary');
    searchBtn.classList.add('btn-danger');
    searchBtn.onclick = requestStopSearch;
    searchBtn.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z"/></svg> <span>停止搜尋</span>`;

    clearResults(true);
    document.getElementById('resultCount').textContent = '搜尋中...';
    
    try {
        const CONCURRENT_LIMIT = 4;
        const websitesQueue = [...websitesToSearch];
        const totalWebsites = websitesQueue.length;
        let completedCount = 0;

        updateProgress(0, totalWebsites, '準備搜尋');

        const worker = async () => {
            while (websitesQueue.length > 0) {
                if (stopSearchRequested) break;

                const website = websitesQueue.shift();
                if (!website) continue;

                const results = await searchWebsite(website, keyword);
                if (results) {
                    searchResults.push(...results);
                }
                
                completedCount++;
                updateProgress(completedCount, totalWebsites, `正在搜尋 ${website.name}`);
                displayResults();
                
                if (websitesQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
                }
            }
        };

        const workerPromises = [];
        for (let i = 0; i < CONCURRENT_LIMIT; i++) {
            workerPromises.push(worker());
        }

        await Promise.all(workerPromises);

    } catch (error) {
        console.error("搜尋過程中發生錯誤:", error);
        document.getElementById('resultCount').textContent = `搜尋失敗: ${error.message}`;
    } finally {
        isSearching = false;
        
        const successCount = searchResults.filter(r => r.status === 'success').length;
        const searchedCount = new Set(searchResults.map(r => r.website)).size;
        const resultCountEl = document.getElementById('resultCount');

        if (stopSearchRequested) {
            resultCountEl.textContent = `中斷 (找到 ${successCount} 筆，搜尋了 ${searchedCount} 個網站)`;
        } else {
            resultCountEl.textContent = `完成 (找到 ${successCount} 筆，搜尋了 ${searchedCount} 個網站)`;
        }
        
        searchBtn.disabled = false;
        searchBtn.classList.remove('btn-danger');
        searchBtn.classList.add('btn-primary');
        searchBtn.onclick = startSearch;
        searchBtn.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg> <span>開始搜尋</span>`;
        searchBtn.style.minWidth = '';
        
        updateProgress(0, 0, '');
        stopSearchRequested = false;
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    updateThemeIcon(isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function updateThemeIcon(isLight) {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    if (isLight === undefined) {
         isLight = document.body.classList.contains('light-mode');
    }
    if (isLight) {
        themeIcon.setAttribute('d', 'M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z');
        themeText.textContent = '深色模式';
    } else {
        themeIcon.setAttribute('d', 'M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z M8 4a4 4 0 0 0-4 4 .5.5 0 0 1-1 0 5 5 0 0 1 5-5 .5.5 0 0 1 0 1z');
        themeText.textContent = '淺色模式';
    }
}

async function clearResults(isFromSearch = false) {
    if (!isFromSearch && searchResults.length > 0) {
        const confirmed = await showConfirmation('確認清除', '確定要清除所有搜尋結果嗎？此操作無法復原。');
        if (!confirmed) return;
    }
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('resultsContainer').innerHTML = '';
    searchResults = [];
    searchResultIdCounter = 0;
    rawHtmlCache = {};
}

function updateProgress(current, total, text) {
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    if (total > 0) {
        const currentProgress = Math.min(current, total);
        const percentage = (currentProgress / total) * 100;
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${text} (${currentProgress}/${total})`;
        progressContainer.classList.remove('hidden');
    } else {
        progressContainer.classList.add('hidden');
    }
}

function deleteResult(resultId) {
    const indexToDelete = searchResults.findIndex(r => r.id === resultId);
    if (indexToDelete > -1) {
        searchResults.splice(indexToDelete, 1);
    }
    displayResults();
}

function deleteWebsiteResult(websiteName) {
    searchResults = searchResults.filter(r => r.website !== websiteName);
    displayResults();
}

const userAgents = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'];

function parseRSS(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = [];
    xmlDoc.querySelectorAll('item').forEach(item => {
        const title = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        if (title && link) items.push({ title: title.trim(), url: link.trim() });
    });
    return items;
}

function parseHTML(htmlText, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const items = [];
    const addedUrls = new Set();
    doc.querySelectorAll('a').forEach(linkElement => {
        const href = linkElement.getAttribute('href');
        if (!href || href.trim() === '#' || href.startsWith('javascript:')) return;
        let title = (linkElement.querySelector('h1, h2, h3, h4, [class*="title"], [class*="headline"]')?.textContent || linkElement.textContent).trim().replace(/\s{2,}/g, ' ');
        if (title && href) {
            try {
                const absoluteUrl = new URL(href, baseUrl).href;
                if (!addedUrls.has(absoluteUrl)) {
                    items.push({ title, url: absoluteUrl });
                    addedUrls.add(absoluteUrl);
                }
            } catch (e) {}
        }
    });
    return items;
}

function parseOwlting(htmlText) {
    const items = [];
    try {
        const regex = /\{id:(\d+),fetch_url:".*?",title:"(.*?)",description:"(.*?)"/g;
        let match;
        while ((match = regex.exec(htmlText)) !== null) {
            const id = match[1];
            let title = match[2].replace(/\\u002F/g, '/');
            const description = match[3].replace(/\\u002F/g, '/');
            if (!title && description) {
                const sentenceEnd = description.search(/[。？！]/);
                title = sentenceEnd !== -1 ? description.substring(0, sentenceEnd + 1).trim() : description.substring(0, 50).trim() + '...';
            }
            if (id && title) {
                // --- vvv 修改重點 vvv ---
                // 移除了 content 欄位，這樣搜尋時就只會比對 title
                items.push({
                    title: title,
                    url: `https://news.owlting.com/articles/${id}`
                });
                // --- ^^^ 修改重點 ^^^ ---
            }
        }
    } catch (e) { console.error('奧丁丁專用解析器失敗:', e); }
    return items;
}

function parseLifeNews(htmlText, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const items = [];
    doc.querySelectorAll('.card-parent').forEach(card => {
        const title = card.querySelector('.card-title.list-title')?.textContent.trim();
        const href = card.querySelector('a.stretched-link')?.getAttribute('href');
        if (title && href) {
            try { items.push({ title, url: new URL(href, baseUrl).href }); } catch (e) {}
        }
    });
    return items;
}

async function searchWebsite(website, keyword) {
    const isDebugMode = document.getElementById('debugModeCheckbox').checked;
    try {
        const response = await fetch(website.url, {
            method: 'GET',
            headers: { 'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)], 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9' },
            timeout: 15000, redirect: 'follow'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (isDebugMode) {
            rawHtmlCache[website.name] = text;
        }
        let items = [];
        
        try {
            const url = new URL(website.url);
            if (url.hostname.includes('owlting.com')) {
                items = parseOwlting(text);
            } else if (url.hostname.includes('life.tw')) {
                items = parseLifeNews(text, website.url);
            } else if ((response.headers.get('content-type') || '').includes('xml')) {
                items = parseRSS(text);
            } else {
                items = parseHTML(text, website.url);
            }
        } catch (e) {
            // 如果 URL 無效，退回通用解析
            console.error(`解析 URL 時出錯: ${website.url}`, e);
            items = parseHTML(text, website.url);
        }

        const searchKeyword = keyword.toLowerCase();
        const matches = items.filter(item => item.title.toLowerCase().includes(searchKeyword) || (item.content && item.content.includes(searchKeyword)));
        if (matches.length > 0) {
            const filtered = matches.filter(match => !website.name.includes('PChome') || match.title.toLowerCase().trim() !== searchKeyword);
            if (filtered.length > 0) {
                return filtered.map(match => ({
                    id: searchResultIdCounter++,
                    website: website.name,
                    title: match.title,
                    url: match.url,
                    status: 'success'
                }));
            }
        }
        return [{ id: searchResultIdCounter++, website: website.name, title: '未找到相符的新聞', url: '', status: 'no_match' }];
    } catch (error) {
        console.error(`[偵錯] ${website.name} - 發生錯誤:`, error);
        let msg = `連線錯誤: ${error.message}`;
        if (error.message.includes('403')) msg = '網站拒絕存取 (403 Forbidden)';
        else if (error.cause?.code === 'ERR_HTTP2_PROTOCOL_ERROR') msg = 'HTTP/2 通訊協定錯誤';
        else if (error.name === 'TimeoutError' || error.name === 'AbortError') msg = '連線超時';
        if (isDebugMode) {
            rawHtmlCache[website.name] = `抓取失敗！\n\n錯誤: ${error.message}\n${error.stack || ''}`;
        }
        return [{ id: searchResultIdCounter++, website: website.name, title: '搜尋失敗', url: '', error: msg, status: 'error' }];
    }
}

// --- vvv MAJOR REFACTOR vvv ---
// --- vvv 顯示結果排序邏輯修正 vvv ---
function displayResults() {
    const isDebugMode = document.getElementById('debugModeCheckbox').checked;
    const resultsContainer = document.getElementById('resultsContainer');
    if (searchResults.length === 0) {
         document.getElementById('resultsSection').classList.add('hidden');
         return;
    }
    const groupedResults = {};
    searchResults.forEach(result => {
        if (!groupedResults[result.website]) groupedResults[result.website] = [];
        groupedResults[result.website].push(result);
    });

    // --- 排序修正的核心邏輯 ---
    // 1. 取得目前已經有結果的網站名稱列表 (此時是亂序的)
    const websitesWithResults = Object.keys(groupedResults);
    // 2. 參照 `currentWebsiteState` (它保有原始順序) 來過濾和排序
    const orderedWebsiteNames = currentWebsiteState
        .map(website => website.name) // 取出原始順序的名稱陣列
        .filter(name => websitesWithResults.includes(name)); // 只保留那些已經有結果的網站

    const successCount = searchResults.filter(r => r.status === 'success').length;
    if (!isSearching) {
        document.getElementById('resultCount').textContent = `(找到 ${successCount} 筆，搜尋了 ${orderedWebsiteNames.length} 個網站)`;
    }
    
    let html = '';
    // 3. 使用我們剛剛排序好的 `orderedWebsiteNames` 來產生畫面
    orderedWebsiteNames.forEach(website => {
        const results = groupedResults[website];
        const hasSuccess = results.some(r => r.status === 'success');
        let viewSourceButtonHtml = '';
        if (isDebugMode) {
            viewSourceButtonHtml = `<button class="btn btn-secondary btn-small" onclick="showRawHtml('${String(website).replace(/'/g, "\\'")}');">檢視原始碼</button>`;
        }

        let deleteButtonHtml = '';
        if (!hasSuccess) {
            deleteButtonHtml = `<button class="btn-delete" title="刪除此區塊" onclick="deleteWebsiteResult('${String(website).replace(/'/g, "\\'")}')">×</button>`;
        }

        html += `<div class="result-item"><div class="result-website-header"><div class="result-website" style="font-weight: 600; color: var(--accent-color); margin-bottom: 8px;">${website} ${hasSuccess?'<span style="color:var(--success-color);font-size:12px;">✓ 成功</span>':''} ${results.some(r=>r.status === 'error')?'<span style="color:var(--error-color);font-size:12px;">✗ 失敗</span>':''} ${results.every(r=>r.status === 'no_match')?'<span style="color:var(--text-muted);font-size:12px;">✓ 無相符結果</span>':''}</div><div class="actions">${viewSourceButtonHtml}${deleteButtonHtml}</div></div>`;
        
        results.forEach(result => {
            if (result.status === 'success') {
                html += `
                <div class="result-link-item">
                    <button class="btn-delete" title="刪除此連結" onclick="deleteResult(${result.id})">×</button>
                    <div style="font-weight: 500; margin-bottom: 8px;">${result.title}</div>
                    <div style="color: var(--text-secondary); font-size: 13px; word-break: break-all; margin-bottom: 8px;">${result.url}</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-small" onclick="copyToClipboard('${result.url.replace(/'/g, "\\'")}')">複製</button>
                        <button class="btn btn-secondary btn-small" onclick="window.open('${result.url}', '_blank')">開啟</button>
                    </div>
                </div>`;
            } else if (result.status === 'error') {
                html += `<div style="color:var(--error-color);font-size:13px;margin:8px 0;padding:8px;background:rgba(239,68,68,0.1);border-radius:4px;"><div style="font-weight:500;">搜尋失敗</div><div>${result.error}</div></div>`;
            }
        });
        if (results.every(r=>r.status === 'no_match')) {
            html += `<div style="color:var(--text-muted);font-size:13px;margin:8px 0;padding:8px;background:var(--bg-tertiary);border-radius:4px;">未在該網站上找到符合關鍵字的新聞</div>`;
        }
        html += `</div>`;
    });
    resultsContainer.innerHTML = html;
    document.getElementById('resultsSection').classList.remove('hidden');
}
// --- ^^^ 顯示結果排序邏輯修正 ^^^ ---
// --- ^^^ MAJOR REFACTOR ^^^ ---

function showConfirmation(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;

        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        };

        const onOk = () => {
            cleanup();
            modal.classList.add('hidden');
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            modal.classList.add('hidden');
            resolve(false);
        };

        okBtn.addEventListener('click', onOk, { once: true });
        cancelBtn.addEventListener('click', onCancel, { once: true });

        modal.classList.remove('hidden');
    });
}

function showRawHtml(websiteName) {
    document.getElementById('modalTitle').textContent = `抓取到的 ${websiteName} 原始碼`;
    document.getElementById('modalContent').value = rawHtmlCache[websiteName] || '沒有快取到此網站的原始碼。請確認搜尋時已啟用除錯模式。';
    document.getElementById('htmlModal').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showStatus('連結已複製到剪貼簿', 'success');
    }).catch(err => { showStatus('複製失敗', 'error'); });
}

function copyAllResults() {
    const grouped = searchResults.filter(r => r.status === 'success').reduce((acc, r) => {
        if (!acc[r.website]) acc[r.website] = [];
        acc[r.website].push(r.url);
        return acc;
    }, {});
    if (Object.keys(grouped).length === 0) { showStatus('沒有可複製的連結', 'error'); return; }
    let output = '';
    const orderedWebsiteNames = [];
    for (const result of searchResults) {
        if (result.status === 'success' && !orderedWebsiteNames.includes(result.website)) {
            orderedWebsiteNames.push(result.website);
        }
    }
    orderedWebsiteNames.forEach(website => {
        output += `${website}\n${grouped[website].join('\n')}\n\n`;
    });
    copyToClipboard(output.trim());
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter' && !isSearching) { e.preventDefault(); startSearch(); }
        if (e.key === 'd') { e.preventDefault(); toggleTheme(); }
        if (e.key === 'l') { e.preventDefault(); loadAllLists(); }
    }
});