let map;
let mapPopup; 

document.addEventListener('DOMContentLoaded', () => {
    const allWeatherDisplay = document.getElementById('all-weather-display');
    const loadingWeatherMessage = document.getElementById('loading-weather-message');
    const weatherSectionTitle = document.querySelector('#current-weather h2'); 
    
    const typhoonDisplay = document.getElementById('typhoon-display');
    const loadingTyphoonMessage = document.getElementById('loading-typhoon-message');
    const typhoonSectionTitle = document.querySelector('#typhoon h2'); 

    initMapLibre();

    fetchAllLocationsWeather();

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

    typhoonSectionTitle.addEventListener('click', () => {
        if (mapPopup && mapPopup.isOpen()) {
            mapPopup.remove();
        }
        typhoonSectionTitle.classList.toggle('active');
    });

    function initMapLibre() {
        const taiwanCenter = [120.9, 23.6]; 

        map = new maplibregl.Map({
            container: 'typhoon-map',
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors'
                    }
                },
                layers: [
                    {
                        id: 'osm-layer',
                        type: 'raster',
                        source: 'osm'
                    }
                ]
            },
            center: taiwanCenter,
            zoom: 7,
            pitch: 0,
            bearing: 0
        });

        map.on('load', () => {
            fetchTyphoonWarning();
        });
        
        mapPopup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: false
        });
    }

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

    async function fetchTyphoonWarning() {
        if (!map) {
            console.error("MapLibre 地圖尚未初始化或 Key 載入失敗，無法獲取颱風資料。");
            return;
        }

        loadingTyphoonMessage.style.display = 'block'; 
        typhoonDisplay.innerHTML = ''; 
        clearMapLayers();

        try {
            const response = await fetch('/api/typhoon_warning');
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP 錯誤：${response.status}`);
            }

            const data = await response.json();
            
            loadingTyphoonMessage.style.display = 'none'; 
            drawTyphoonsOnMap(data); 

        } catch (error) {
            console.error('獲取颱風路徑潛勢預報資料失敗:', error);
            loadingTyphoonMessage.style.display = 'none'; 
            typhoonDisplay.innerHTML = `<p style="color: red;">無法獲取熱帶氣旋路徑潛勢預報資料: ${error.message}</p>`;
        }
    }

    function clearMapLayers() {
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

        if (mapPopup && mapPopup.isOpen()) {
            mapPopup.remove();
        }
    }

    function displayTyphoonWarning(data) {
    }

    function createCircularStormSurgeLine(centerLat, centerLng, radiusKm) {
        if (isNaN(radiusKm) || radiusKm <= 0) {
            return null;
        }

        const points = 64;
        const coordinates = [];
        const earthRadiusKm = 6371;

        for (let i = 0; i < points; i++) {
            const angle = (i / points) * 2 * Math.PI;
            const deltaLng = (radiusKm / (earthRadiusKm * Math.cos(centerLat * Math.PI / 180))) * (180 / Math.PI) * Math.cos(angle);
            const deltaLat = (radiusKm / earthRadiusKm) * (180 / Math.PI) * Math.sin(angle);
            coordinates.push([centerLng + deltaLng, centerLat + deltaLat]);
        }
        coordinates.push(coordinates[0]);

        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        };
    }

    function drawTyphoonsOnMap(typhoons) {
        if (!map) return; 

        const observedPathPoints = []; 
        const forecastFeatures = [];
        let observedPathCoordinates = [];
        let forecastPathCoordinates = [];
        const observedStormSurgeLines = []; 
        const forecastStormSurgeLines = []; 

        let allPointsLat = [];
        let allPointsLng = [];


        typhoons.forEach(typhoon => {
            observedPathCoordinates = []; 
            forecastPathCoordinates = []; 

            if (typhoon.analysisFixes && typhoon.analysisFixes.length > 0) {
                typhoon.analysisFixes.forEach((point, index) => {
                    const lat = parseFloat(point.latitude);
                    const lng = parseFloat(point.longitude);

                    if (isNaN(lat) || isNaN(lng)) {
                        console.warn(`無效的經緯度在颱風 ${typhoon.typhoonName} 的觀測點:`, point);
                        return;
                    }

                    const coordinates = [lng, lat]; 
                    observedPathCoordinates.push(coordinates);

                    allPointsLat.push(lat);
                    allPointsLng.push(lng);

                    let infoWindowContent = `
                        <div class="info-window-content">
                            <strong>${typhoon.typhoonName} - 歷史/觀測點</strong><br>
                            時間: ${new Date(point.time).toLocaleString('zh-TW', { hour12: false })}<br>
                            位置: 北緯 ${lat.toFixed(2)}° , 東經 ${lng.toFixed(2)}°<br>
                            風速: ${point.maxWindSpeed} m/s (陣風 ${point.maxGustSpeed} m/s)<br>
                            中心氣壓: ${point.pressure} hPa<br>
                            移動: ${point.movingDirection} ${point.movingSpeed} km/h<br>
                    `;
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
                            isCurrentObserved: (index === typhoon.analysisFixes.length - 1), 
                            isHistorical: (index !== typhoon.analysisFixes.length - 1) 
                        }
                    });

                    if (index === typhoon.analysisFixes.length - 1 && point.radius15Ms !== 'N/A' && !isNaN(point.radius15Ms) && parseFloat(point.radius15Ms) > 0) {
                        const stormSurgeLine = createCircularStormSurgeLine(lat, lng, parseFloat(point.radius15Ms));
                        if (stormSurgeLine) {
                            observedStormSurgeLines.push(stormSurgeLine);
                        }
                    }
                });
            }

            if (typhoon.forecastPoints && typhoon.forecastPoints.length > 0) {
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
                            isForecast: true 
                        }
                    });

                    if (point.radius15Ms !== 'N/A' && !isNaN(point.radius15Ms) && parseFloat(point.radius15Ms) > 0) {
                        const stormSurgeLine = createCircularStormSurgeLine(lat, lng, parseFloat(point.radius15Ms));
                        if (stormSurgeLine) {
                            forecastStormSurgeLines.push(stormSurgeLine);
                        }
                    }
                });
            }

            if (observedPathCoordinates.length > 1) {
                observedPathPoints.push({ 
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

        clearMapLayers();


        map.addSource('typhoon-observed-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: observedPathPoints
            }
        });

        map.addSource('typhoon-forecast-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: forecastFeatures
            }
        });

        map.addSource('typhoon-storm-surge-observed-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: observedStormSurgeLines
            }
        });

        map.addSource('typhoon-storm-surge-forecast-data', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: forecastStormSurgeLines
            }
        });


        map.addLayer({
            id: 'typhoon-path-observed',
            type: 'line',
            source: 'typhoon-observed-data',
            filter: ['==', '$type', 'LineString'],
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#FF0000',
                'line-width': 4,
                'line-opacity': 0.8
            }
        });

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
                'line-color': '#FF8080',
                'line-width': 4,
                'line-opacity': 0.8,
                'line-dasharray': [1, 2]
            }
        });

        map.addLayer({
            id: 'typhoon-points-observed',
            type: 'circle',
            source: 'typhoon-observed-data',
            filter: ['==', '$type', 'Point'],
            paint: {
                'circle-radius': 8,
                'circle-color': '#3498db',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        map.addLayer({
            id: 'typhoon-points-forecast',
            type: 'circle',
            source: 'typhoon-forecast-data',
            filter: ['==', '$type', 'Point'],
            paint: {
                'circle-radius': 7,
                'circle-color': '#e67e22',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        map.addLayer({
            id: 'typhoon-storm-surge-observed',
            type: 'line',
            source: 'typhoon-storm-surge-observed-data',
            paint: {
                'line-color': '#ffffff',
                'line-width': 2,
                'line-dasharray': [2, 2]
            }
        });

        map.addLayer({
            id: 'typhoon-storm-surge-forecast',
            type: 'line',
            source: 'typhoon-storm-surge-forecast-data',
            paint: {
                'line-color': '#ffffff',
                'line-width': 2,
                'line-dasharray': [2, 2]
            }
        });

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

        map.on('mouseenter', 'typhoon-points-observed', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'typhoon-points-observed', () => {
            map.getCanvas().style.cursor = '';
        });

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


        if (allPointsLat.length > 0) {
            const minLat = Math.min(...allPointsLat);
            const maxLat = Math.max(...allPointsLat);
            const minLng = Math.min(...allPointsLng);
            const maxLng = Math.max(...allPointsLng);

            const bbox = [[minLng, minLat], [maxLng, maxLat]];
            map.fitBounds(bbox, {
                padding: 50,
                maxZoom: 9
            });
        }
    }
});
