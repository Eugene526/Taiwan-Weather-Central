# 全面天氣觀測網 (Weather Dashboard)

## 專案簡介
全面天氣觀測網是一個綜合性的天氣資訊平台，旨在提供用戶即時、詳細且易於理解的氣象數據。本專案整合了中央氣象署的開放資料，提供台灣各地的天氣預報、即時雷達與衛星影像，以及重要的災害警特報資訊，並具備互動式的颱風路徑追蹤功能。

## 特色

* **各地天氣概況：** 提供台灣各縣市的詳細天氣預報，包括天氣現象、最高溫、最低溫及降雨機率，並以可展開的摺疊面板呈現，方便用戶瀏覽。
* **即時觀測圖：** 顯示最新的雷達回波圖和衛星雲圖，幫助用戶掌握當前天氣動態。這些圖資約每10分鐘更新一次。
* **災害示警與特報：** 實時顯示中央氣象署發布的災害警特報，並根據警報等級（例如：注意報、特報）以不同顏色標示其嚴重性，提供詳細的警報內容和生效時間。
* **颱風追蹤中心：**
    * 整合 [MapLibre GL JS](https://maplibre.org/) 互動式地圖，展示熱帶氣旋的歷史路徑和潛勢預報路徑。
    * 地圖上的點擊事件會顯示颱風當前位置、風速、氣壓、移動方向及七級風暴風半徑等詳細資訊。
    * 支援在多個颱風同時存在時顯示所有相關資訊。
* **響應式設計：** 介面設計考量不同螢幕尺寸，從桌面到行動裝置都能提供良好的用戶體驗。

## 技術棧

* **後端：**
    * Python
    * Flask：輕量級的 Web 框架，用於處理後端路由和 API 請求。
    * `requests`：用於呼叫中央氣象署 (CWA) 的開放資料 API。
    * `pytz`：處理時區相關的日期時間轉換，確保時間顯示正確。
    * `logging`：用於記錄應用程式的運行狀態和錯誤。
* **前端：**
    * HTML5 (`index.html`)：頁面結構。
    * CSS3 (`static/css/style.css`)：負責頁面樣式和響應式佈局。
    * JavaScript (`static/js/script.js`)：實現前端互動邏輯，包括天氣資料的動態載入、摺疊面板功能、以及地圖互動。
    * [MapLibre GL JS](https://maplibre.org/)：用於在網頁上渲染互動式地圖，特別是颱風路徑的視覺化。
    * [Stadia Maps](https://stadiamaps.com/)：地圖底圖服務供應商（MapLibre 預設樣式中可能包含其瓦片服務）。

## 資料來源

本專案的所有天氣資料均來自於 [中央氣象署開放資料平台](https://opendata.cwa.gov.tw/)：
* **各地天氣預報：** `F-C0032-001` 資料集。
* **災害警特報：** `W-C0033-001` 資料集。
* **熱帶氣旋路徑潛勢預報：** `W-C0034-005` 資料集。
* **雷達回波圖與衛星雲圖：** 直接從中央氣象署的資料連結抓取。

## 安裝與運行 (本地)

### 環境要求
* Python 3.x
* `pip` (Python 包管理器)

### 步驟

1.  **複製專案：**
    ```bash
    git clone https://github.com/Eugene526/Weather-Dashboard.git
    cd Weather-Dashboard
    ```
2.  **建立並啟用虛擬環境 (推薦)：**
    ```bash
    python -m venv venv
    # Windows
    .\venv\Scripts\activate
    # macOS/Linux
    source venv/bin/activate
    ```
3.  **安裝依賴：**
    ```bash
    pip install -r requirements.txt
    ```
    (請確保您的 `requirements.txt` 檔案包含：`Flask`, `requests`, `pytz`。如果您的 Flask 應用有處理 CORS，可能還需要 `Flask-Cors`。)

4.  **設定中央氣象署 API 金鑰：**
    根據您提供的 `app.py`，中央氣象署的 API 金鑰 (`CWA-DD381EBA-F7A1-41B2-8E5E-4657D957BBAA`) 已經硬編碼在檔案中。如果該金鑰失效或您想使用自己的金鑰，請修改 `app.py` 中的 `CWA_API_KEY` 變數：
    ```python
    CWA_API_KEY = "您的中央氣象署API金鑰"
    ```
    **注意：** 如果您使用的是 Stadia Maps 的付費服務或需要 API Key 的底圖，請確保該 Key 已在 Vercel 環境變數中設定，或透過 Flask 後端安全地傳遞到前端。如果本地測試時 MapLibre 瓦片載入正常，但在 Vercel 上遇到 401 錯誤，則需在 Vercel 環境變數中設定 `STADIA_API_KEY` 並在前端 JavaScript 中使用它。

5.  **運行應用程式：**
    ```bash
    python app.py
    ```
6.  在您的瀏覽器中打開 `http://127.0.0.1:4000` (或控制台顯示的地址)。

## 部署到 Vercel
本專案已針對 Vercel 部署進行配置。

1.  確保您的專案所有更改都已提交並推送到 GitHub。
2.  登入 [Vercel 官網](https://vercel.com/)。
3.  導入您的 GitHub 專案。
4.  在部署設定中，如果您的專案使用到 API 金鑰或其他敏感資訊（例如 `STADIA_API_KEY`），請在 **Environment Variables (環境變數)** 區塊中新增這些變數。
5.  點擊部署。Vercel 將自動檢測您的 Flask 應用程式並進行部署。

## 專案結構
```
Weather-Dashboard/
├── app.py              # Flask 主應用程式，處理後端邏輯和 API 路由
├── requirements.txt    # Python 依賴包列表
├── static/             # 存放靜態檔案 (CSS, JS)
│   ├── css/
│   │   └── style.css   # 專案的樣式表
│   └── js/
│       └── script.js   # 前端 JavaScript 邏輯，包括地圖初始化和資料顯示
└── templates/
└── index.html      # 網頁主頁面 HTML
```
## 貢獻
歡迎任何形式的貢獻！如果您有任何建議、功能請求或 Bug 報告，請透過 GitHub Issue 提出。

## 許可證
本專案基於開源原則發布。
