// 全局變數用於儲存 MapLibre 地圖實例
let map;
let mapPopup; // 用於MapLibre的資訊彈窗

// DOMContentLoaded 事件確保在 DOM 完全載入後才執行 JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // 獲取 DOM 元素
    const allWeatherDisplay = document.getElementById('all-weather-display');
    const loadingWeatherMessage = document.getElementById('loading-weather-message');
    const weatherSectionTitle = document.querySelector('#current-weather h2'); 
    
    const typhoonDisplay = document.getElementById('typhoon-display');
    const loadingTyphoonMessage = document.getElementById('loading-typhoon-message');
    const typhoonSectionTitle = document.querySelector('#typhoon h2'); 

    // 初始化 MapLibre 地圖
    initMapLibre(); // 呼叫 MapLibre 地圖初始化函數

    // 頁面載入後立即獲取所有地點的天氣預報
    fetchAllLocationsWeather();

    // 點擊「各地天氣概況」主標題展開/收合所有縣市項目
    weatherSectionTitle.addEventListener('click', () => {
        const allAccordionItems = allWeatherDisplay.querySelectorAll('.accordion-item');
        let anyActive = false; 

        allAccordionItems.forEach(item => {
            if (item.classList.contains('active')) {
                anyActive = true;
            }
        });

        allAccordionItems.forEach(item => {
            if (anyActive) {
                item.classList.remove('active'); 
            } else {
                item.classList.add('active'); 
            }
        });
        weatherSectionTitle.classList.toggle('active');
    });

    // 點擊「颱風追蹤中心」主標題展開/收合所有颱風項目
    typhoonSectionTitle.addEventListener('click', () => {
        // 因為手風琴內容已移除，這裡主要用於關閉地圖上的任何彈窗
        if (mapPopup && mapPopup.isOpen()) {
            mapPopup.remove();
        }
        typhoonSectionTitle.classList.toggle('active');
    });

    /**
     * 初始化 MapLibre 地圖。
     */
    function initMapLibre() {
        // 台灣中心點座標 [經度, 緯度]
        const taiwanCenter = [120.9, 23.6]; 

        map = new maplibregl.Map({
            container: 'typhoon-map', // 地圖容器的 ID
            style: 'https://tiles.stadiamaps.com/styles/osm_bright.json', // Stadia Maps OSM Bright style
            center: taiwanCenter, // 地圖中心點
            zoom: 7, // 預設縮放級別
            pitch: 0, // 地圖傾斜角度
            bearing: 0 // 地圖旋轉角度
        });

        // 當地圖載入完成後，才獲取颱風數據並繪製
        map.on('load', () => {
            fetchTyphoonWarning();
        });
        
        // 為了資訊視窗，初始化一個 MapLibre Popup 實例
        mapPopup = new maplibregl.Popup({
            closeButton: true, // 顯示關閉按鈕
            closeOnClick: false // 點擊地圖其他地方不會自動關閉
        });
    }

    /**
     * 獲取所有地點的天氣預報並顯示。
     * 負責呼叫後端 API，獲取 F-C0032-001 資料集。
     */
    async function fetchAllLocationsWeather() {
        loadingWeatherMessage.style.display = 'block'; 
        allWeatherDisplay.innerHTML = ''; 

        try {
            const response = await fetch('/api/all_locations_forecast');
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP 錯誤：${response.status}`);
            }

            const data = await response.json();
            
            loadingWeatherMessage.style.display = 'none'; 
            displayAllLocationsWeather(data); 

        } catch (error) {
            console.error('獲取所有地點天氣資料失敗:', error);
            loadingWeatherMessage.style.display = 'none'; 
            allWeatherDisplay.innerHTML = `<p style="color: red;">無法獲取各地天氣資料: ${error.message}</p>`;
        }
    }

    /**
     * 將所有地點的天氣預報資料渲染到網頁上，以可展開形式顯示。
     * @param {Array} data - 從後端獲取的天氣預報資料陣列。
     */
    function displayAllLocationsWeather(data) {
        if (!data || data.length === 0) {
            allWeatherDisplay.innerHTML = '<p style="color: red;">無可顯示的天氣預報資料。</p>';
            return;
        }

        data.forEach(locationData => {
            const locationName = locationData.locationName;
            const forecasts = locationData.forecasts; 

            const accordionItem = document.createElement('div');
            accordionItem.classList.add('accordion-item');

            const accordionHeader = document.createElement('div');
            accordionHeader.classList.add('accordion-header');
            accordionHeader.innerHTML = `<h4>${locationName}</h4>`;
            accordionItem.appendChild(accordionHeader);

            const accordionContent = document.createElement('div');
            accordionContent.classList.add('accordion-content'); 
            
            let detailHtml = '';
            if (forecasts.length > 0) {
                forecasts.forEach(period => {
                    const startTime = new Date(period.startTime).toLocaleString('zh-TW', {
                        year: 'numeric', month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: false
                    });
                    const endTime = new Date(period.endTime).toLocaleString('zh-TW', {
                        hour: '2-digit', minute: '2-digit', hour12: false
                    });
                    
                    const weatherDesc = period.data.Wx || 'N/A';
                    const minTemp = period.data.MinT || 'N/A';
                    const maxTemp = period.data.MaxT || 'N/A';
                    const pop = period.data.PoP || 'N/A';

                    detailHtml += `
                        <div class="forecast-detail-card">
                            <h5>${startTime} ~ ${endTime}</h5>
                            <p>天氣現象: <strong>${weatherDesc}</strong></p>
                            <p>溫度: <strong>${minTemp}°C ~ ${maxTemp}°C</strong></p>
                            <p>降雨機率: <strong>${pop}%</strong></p>
                        </div>
                    `;
                });
            } else {
                detailHtml = '<p>無詳細預報資料。</p>';
            }

            accordionContent.innerHTML = detailHtml;
            accordionItem.appendChild(accordionContent);

            allWeatherDisplay.appendChild(accordionItem);

            accordionHeader.addEventListener('click', (event) => {
                accordionItem.classList.toggle('active'); 
            });
        });
    }

    /**
     * 獲取颱風路徑潛勢預報資訊並顯示。
     * 負責呼叫後端 API，獲取 W-C0034-005 資料集。
     */
    async function fetchTyphoonWarning() {
        if (!map) {
            console.log("MapLibre 地圖尚未初始化，等待載入...");
            return;
        }

        loadingTyphoonMessage.style.display = 'block'; 
        typhoonDisplay.innerHTML = ''; // 清空颱風顯示區塊
        clearMapLayers(); // 清除地圖上所有舊的圖層

        try {
            const response = await fetch('/api/typhoon_warning');
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP 錯誤：${response.status}`);
            }

            const data = await response.json();
            
            loadingTyphoonMessage.style.display = 'none'; 
            drawTyphoonsOnMap(data); // 在 MapLibre 地圖上繪製颱風

        } catch (error) {
            console.error('獲取颱風路徑潛勢預報資料失敗:', error);
            loadingTyphoonMessage.style.display = 'none'; 
            typhoonDisplay.innerHTML = `<p style="color: red;">無法獲取熱帶氣旋路徑潛勢預報資料: ${error.message}</p>`;
        }
    }

    /**
     * 清除 MapLibre 地圖上所有之前繪製的數據層。
     */
    function clearMapLayers() {
        // MapLibre 清除數據層的方法是移除 source 和 layer
        const layerIds = [
            'typhoon-path-observed', 'typhoon-path-forecast', 
            'typhoon-points-observed', 'typhoon-points-forecast',
            'typhoon-storm-surge-observed', 'typhoon-storm-surge-forecast'
        ]; 

        layerIds.forEach(id => {
            if (map.getLayer(id)) {
                map.removeLayer(id);
            }
            if (map.getSource(id)) {
                map.removeSource(id);
            }
        });

        // 關閉任何打開的 popup
        if (mapPopup && mapPopup.isOpen()) {
            mapPopup.remove();
        }
    }

    /**
     * 這個函數現在不會生成任何颱風手風琴項目。
     */
    function displayTyphoonWarning(data) {
        // 不再生成任何 HTML 內容到 typhoonDisplay
    }

    /**
     * 根據颱風中心點和單一暴風圈半徑，建立一個圓形暴風圈的 GeoJSON Feature。
     * @param {number} centerLat - 颱風中心緯度。
     * @param {number} centerLng - 颱風中心經度。
     * @param {number} radiusKm - 暴風圈半徑 (公里)。
     * @returns {object|null} GeoJSON Feature (LineString) 或 null。
     */
    function createCircularStormSurgeLine(centerLat, centerLng, radiusKm) {
        if (isNaN(radiusKm) || radiusKm <= 0) {
            return null; // 無效半徑
        }

        const points = 64; // 圓形上的點數，越多越平滑
        const coordinates = [];
        const earthRadiusKm = 6371;

        for (let i = 0; i < points; i++) {
            const angle = (i / points) * 2 * Math.PI;
            const deltaLng = (radiusKm / (earthRadiusKm * Math.cos(centerLat * Math.PI / 180))) * (180 / Math.PI) * Math.cos(angle);
            const deltaLat = (radiusKm / earthRadiusKm) * (180 / Math.PI) * Math.sin(angle);
            coordinates.push([centerLng + deltaLng, centerLat + deltaLat]);
        }
        // 閉合線條
        coordinates.push(coordinates[0]);

        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        };
    }

    /**
     * 在 MapLibre 地圖上繪製颱風路徑、標記和暴風圈。
     * MapLibre 使用 GeoJSON 數據格式和 Source/Layer 的概念來繪圖。
     * @param {Array} typhoons - 從後端獲取的颱風資料陣列。
     */
    function drawTyphoonsOnMap(typhoons) {
        if (!map) return; 

        // 分別儲存觀測點和預報點的 features
        const observedPathPoints = []; // 用於歷史點和當前點
        const forecastFeatures = [];
        let observedPathCoordinates = [];
        let forecastPathCoordinates = [];
        const observedStormSurgeLines = []; // 觀測到的暴風圈線 (僅限當前點)
        const forecastStormSurgeLines = []; // 預測的暴風圈線

        let allPointsLat = [];
        let allPointsLng = [];


        typhoons.forEach(typhoon => {
            observedPathCoordinates = []; // 重置每個颱風的觀測路徑線坐標
            forecastPathCoordinates = []; // 重置每個颱風的預測路徑線坐標

            // 處理觀測/分析點
            if (typhoon.analysisFixes && typhoon.analysisFixes.length > 0) {
                typhoon.analysisFixes.forEach((point, index) => {
                    const lat = parseFloat(point.latitude);
                    const lng = parseFloat(point.longitude);

                    if (isNaN(lat) || isNaN(lng)) {
                        console.warn(`無效的經緯度在颱風 ${typhoon.typhoonName} 的觀測點:`, point);
                        return;
                    }

                    const coordinates = [lng, lat]; // MapLibre 使用 [lng, lat]
                    observedPathCoordinates.push(coordinates);

                    allPointsLat.push(lat);
                    allPointsLng.push(lng);

                    // 為每個觀測點（包括歷史點）創建一個 GeoJSON Point Feature
                    // 但彈窗資訊和暴風圈只為最後一個點（當前位置）準備
                    let infoWindowContent = `
                        <div class="info-window-content">
                            <strong>${typhoon.typhoonName} - 歷史/觀測點</strong><br>
                            時間: ${new Date(point.time).toLocaleString('zh-TW', { hour12: false })}<br>
                            位置: 北緯 ${lat.toFixed(2)}° , 東經 ${lng.toFixed(2)}°<br>
                            風速: ${point.maxWindSpeed} m/s (陣風 ${point.maxGustSpeed} m/s)<br>
                            中心氣壓: ${point.pressure} hPa<br>
                            移動: ${point.movingDirection} ${point.movingSpeed} km/h<br>
                    `;
                    // 只有最新的觀測點才顯示暴風半徑
                    if (index === typhoon.analysisFixes.length - 1 && point.radius15Ms !== 'N/A' && !isNaN(point.radius15Ms)) {
                        infoWindowContent += `七級風暴風半徑: ${point.radius15Ms} 公里<br>`;
                    }
                    infoWindowContent += `</div>`;


                    observedPathPoints.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: coordinates
                        },
                        properties: {
                            description: infoWindowContent,
                            typhoonName: typhoon.typhoonName,
                            isCurrentObserved: (index === typhoon.analysisFixes.length - 1), // 標示為當前觀測點
                            isHistorical: (index !== typhoon.analysisFixes.length - 1) // 標示為歷史點
                        }
                    });

                    // **只為最後一個觀測點（即當前位置）繪製暴風圈**
                    if (index === typhoon.analysisFixes.length - 1 && point.radius15Ms !== 'N/A' && !isNaN(point.radius15Ms) && parseFloat(point.radius15Ms) > 0) {
                        const stormSurgeLine = createCircularStormSurgeLine(lat, lng, parseFloat(point.radius15Ms));
                        if (stormSurgeLine) {
                            observedStormSurgeLines.push(stormSurgeLine);
                        }
                    }
                });
            }

            // 處理未來潛勢預報點
            if (typhoon.forecastPoints && typhoon.forecastPoints.length > 0) {
                // 將最後一個觀測點（如果存在）作為預測路徑的起點
                if (observedPathCoordinates.length > 0) {
                    forecastPathCoordinates.push(observedPathCoordinates[observedPathCoordinates.length - 1]);
                }

                typhoon.forecastPoints.forEach(point => {
                    const lat = parseFloat(point.latitude);
                    const lng = parseFloat(point.longitude);

                    if (isNaN(lat) || isNaN(lng)) {
                        console.warn(`無效的經緯度在颱風 ${typhoon.typhoonName} 的預報點:`, point);
                        return;
                    }

                    const coordinates = [lng, lat];
                    forecastPathCoordinates.push(coordinates);

                    allPointsLat.push(lat);
                    allPointsLng.push(lng);

                    // 創建預報點的資訊彈窗內容
                    let infoWindowContent = `
                        <div class="info-window-content">
                            <strong>${typhoon.typhoonName} - 預報點</strong><br>
                            時間: ${new Date(point.forecastTime).toLocaleString('zh-TW', { hour12: false })}<br>
                            位置: 北緯 ${lat.toFixed(2)}° , 東經 ${lng.toFixed(2)}°<br>
                            風速: ${point.maxWindSpeed} m/s<br>
                            中心氣壓: ${point.pressure} hPa<br>
                    `;
                    if (point.radius15Ms !== 'N/A' && !isNaN(point.radius15Ms) && parseFloat(point.radius15Ms) > 0) {
                        infoWindowContent += `七級風暴風半徑: ${point.radius15Ms} 公里<br>`;
                    }
                    infoWindowContent += `</div>`;


                    forecastFeatures.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: coordinates
                        },
                        properties: {
                            description: infoWindowContent,
                            typhoonName: typhoon.typhoonName,
                            isForecast: true // 標示為預報點
                        }
                    });

                    // 繪製預測的圓形暴風圈 (白色虛線)
                    if (point.radius15Ms !== 'N/A' && !isNaN(point.radius15Ms) && parseFloat(point.radius15Ms) > 0) {
                        const stormSurgeLine = createCircularStormSurgeLine(lat, lng, parseFloat(point.radius15Ms));
                        if (stormSurgeLine) {
                            forecastStormSurgeLines.push(stormSurgeLine);
                        }
                    }
                });
            }

            // 繪製觀測路徑線
            if (observedPathCoordinates.length > 1) {
                observedPathPoints.push({ // 將路徑本身也作為一個 feature 
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: observedPathCoordinates
                    },
                    properties: {
                        typhoonName: typhoon.typhoonName,
                        isForecast: false,
                        isPath: true
                    }
                });
            }

            // 繪製預測路徑線 (虛線)
            if (forecastPathCoordinates.length > 1) {
                forecastFeatures.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: forecastPathCoordinates
                    },
                    properties: {
                        typhoonName: typhoon.typhoonName,
                        isForecast: true,
                        isPath: true
                    }
                });
            }
        });

        // 確保在添加 Source 和 Layer 之前先移除舊的，以防萬一
        clearMapLayers();


        // 添加觀測數據 GeoJSON Source (現在包含所有歷史點和當前點)
        map.addSource('typhoon-observed-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: observedPathPoints // 使用 observedPathPoints 來包含所有觀測點
            }
        });

        // 添加預測數據 GeoJSON Source
        map.addSource('typhoon-forecast-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: forecastFeatures
            }
        });

        // 添加觀測暴風圈數據 GeoJSON Source
        map.addSource('typhoon-storm-surge-observed-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: observedStormSurgeLines
            }
        });

        // 添加預測暴風圈數據 GeoJSON Source
        map.addSource('typhoon-storm-surge-forecast-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: forecastStormSurgeLines
            }
        });


        // 添加觀測路徑線 Layer (實線)
        map.addLayer({
            id: 'typhoon-path-observed',
            type: 'line',
            source: 'typhoon-observed-data',
            filter: ['==', '$type', 'LineString'], // 只顯示 LineString 類型的 Feature
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#FF0000', // 紅色實線
                'line-width': 4,
                'line-opacity': 0.8
            }
        });

        // 添加預測路徑線 Layer (虛線)
        map.addLayer({
            id: 'typhoon-path-forecast',
            type: 'line',
            source: 'typhoon-forecast-data',
            filter: ['==', '$type', 'LineString'],
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#FF8080', // 淡淡的紅色虛線
                'line-width': 4,
                'line-opacity': 0.8,
                'line-dasharray': [1, 2] // 虛線效果
            }
        });

        // 添加觀測點位 Layer (藍色圓點) - 現在包含所有歷史點
        map.addLayer({
            id: 'typhoon-points-observed',
            type: 'circle',
            source: 'typhoon-observed-data',
            filter: ['==', '$type', 'Point'], // 只顯示 Point 類型的 Feature
            paint: {
                'circle-radius': 8,
                'circle-color': '#3498db', // 藍色
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        // 添加預測點位 Layer (橘色圓點)
        map.addLayer({
            id: 'typhoon-points-forecast',
            type: 'circle',
            source: 'typhoon-forecast-data',
            filter: ['==', '$type', 'Point'],
            paint: {
                'circle-radius': 7,
                'circle-color': '#e67e22', // 橘色
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        // 添加觀測暴風圈 Layer (白色虛線) - 僅限於當前觀測點
        map.addLayer({
            id: 'typhoon-storm-surge-observed',
            type: 'line',
            source: 'typhoon-storm-surge-observed-data',
            paint: {
                'line-color': '#ffffff', // 白色
                'line-width': 2,
                'line-dasharray': [2, 2] // 虛線效果
            }
        });

        // 添加預測暴風圈 Layer (白色虛線)
        map.addLayer({
            id: 'typhoon-storm-surge-forecast',
            type: 'line',
            source: 'typhoon-storm-surge-forecast-data',
            paint: {
                'line-color': '#ffffff', // 白色
                'line-width': 2,
                'line-dasharray': [2, 2] // 虛線效果
            }
        });

        // 為觀測點添加點擊事件 (Popup) - 現在會作用於所有觀測點
        map.on('click', 'typhoon-points-observed', (e) => {
            if (mapPopup.isOpen()) { 
                mapPopup.remove();
            }
            const coordinates = e.features[0].geometry.coordinates.slice();
            const description = e.features[0].properties.description;

            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            mapPopup.setLngLat(coordinates).setHTML(description).addTo(map);
        });

        // 為觀測點改變鼠標樣式
        map.on('mouseenter', 'typhoon-points-observed', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'typhoon-points-observed', () => {
            map.getCanvas().style.cursor = '';
        });

        // 為預測點添加點擊事件
        map.on('click', 'typhoon-points-forecast', (e) => {
            if (mapPopup.isOpen()) {
                mapPopup.remove();
            }
            const coordinates = e.features[0].geometry.coordinates.slice();
            const description = e.features[0].properties.description;

            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            mapPopup.setLngLat(coordinates).setHTML(description).addTo(map);
        });

        map.on('mouseenter', 'typhoon-points-forecast', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'typhoon-points-forecast', () => {
            map.getCanvas().style.cursor = '';
        });


        // 調整地圖視角以包含所有數據點
        if (allPointsLat.length > 0) {
            const minLat = Math.min(...allPointsLat);
            const maxLat = Math.max(...allPointsLat);
            const minLng = Math.min(...allPointsLng);
            const maxLng = Math.max(...allPointsLng);

            const bbox = [[minLng, minLat], [maxLng, maxLat]];
            map.fitBounds(bbox, {
                padding: 50, // 邊距
                maxZoom: 9 // 最大縮放級別，避免過度放大
            });
        }
    }
}); // DOMContentLoaded end