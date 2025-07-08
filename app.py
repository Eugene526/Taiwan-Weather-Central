from flask import Flask, render_template, jsonify
import requests
import os
from datetime import datetime
import logging
from datetime import datetime, timedelta
import pytz

app = Flask(__name__)
TAIWAN_TZ = pytz.timezone('Asia/Taipei')
CWA_API_KEY = 'YOUR_API_KEY' 
CWA_BASE_URL = "https://opendata.cwa.gov.tw/api/v1/rest/datastore"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s') 

PREFERRED_ORDER = [
    "臺北市", "基隆市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣", 
    "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "臺南市", 
    "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"
]

@app.route('/')
def index():
    now_taiwan = datetime.now(TAIWAN_TZ)
    
    radar_adjusted_time = now_taiwan - timedelta(minutes=10)
    radar_minutes_to_subtract = radar_adjusted_time.minute % 10
    final_radar_time = radar_adjusted_time - timedelta(minutes=radar_minutes_to_subtract)
    radar_timestamp = final_radar_time.strftime('%Y%m%d%H%M')
    radar_url = f"https://www.cwa.gov.tw/Data/radar/CV1_3600_{radar_timestamp}.png"

    satellite_adjusted_time = now_taiwan - timedelta(minutes=20)
    satellite_minutes_to_subtract = satellite_adjusted_time.minute % 10
    final_satellite_time = satellite_adjusted_time - timedelta(minutes=satellite_minutes_to_subtract)
    satellite_timestamp = final_satellite_time.strftime('%Y-%m-%d-%H-%M')
    satellite_url = f"https://www.cwa.gov.tw/Data/satellite/LCC_TRGB_2750/LCC_TRGB_2750-{satellite_timestamp}.jpg"
    
    alerts_to_display = []
    alerts_api_url = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0033-001?Authorization={CWA_API_KEY}&format=JSON"
    
    try:
        alerts_response = requests.get(alerts_api_url)
        alerts_response.raise_for_status() 
        alerts_json = alerts_response.json()
        
        if alerts_json and alerts_json.get('records') and alerts_json['records'].get('location'):
            for location_data in alerts_json['records']['location']:
                location_name = location_data.get('locationName')
                
                if location_data.get('hazardConditions') and \
                   location_data['hazardConditions'].get('hazards'):
                    
                    for hazard in location_data['hazardConditions']['hazards']:
                        info = hazard.get('info', {})
                        valid_time = hazard.get('validTime', {})
                        
                        phenomena = info.get('phenomena')
                        significance = info.get('significance')
                        start_time_str = valid_time.get('startTime')
                        end_time_str = valid_time.get('endTime')

                        if not all([location_name, phenomena, significance, start_time_str, end_time_str]):
                            continue 

                        try:
                            alert_start_dt = TAIWAN_TZ.localize(datetime.fromisoformat(start_time_str))
                            alert_end_dt = TAIWAN_TZ.localize(datetime.fromisoformat(end_time_str))
                            
                            if not (alert_start_dt <= now_taiwan < alert_end_dt):
                                continue 
                        except (ValueError, TypeError) as e:
                            print(f"處理特報時間格式錯誤或缺失: {e}, Data: {hazard}")
                            continue 

                        severity = "yellow" 
                        if significance == "特報":
                            if "豪雨" in phenomena or "陸上強風" in phenomena:
                                severity = "orange"
                        elif significance == "注意報":
                            severity = "yellow"

                        title_text = f"{location_name} - {phenomena}{significance}"
                        info_text = f"發布對象：{location_name}\n現象：{phenomena}\n等級：{significance}\n生效時間：{start_time_str}\n結束時間：{end_time_str}"
                        
                        alerts_to_display.append({
                            'issueTime': start_time_str, 
                            'title': title_text,
                            'info': info_text,
                            'severity': severity
                        })
        
        severity_order = {'red': 3, 'orange': 2, 'yellow': 1}
        alerts_to_display.sort(key=lambda x: (severity_order.get(x['severity'], 0), x['issueTime']), reverse=True)

    except requests.exceptions.RequestException as e:
        print(f"獲取天氣警特報資料失敗: {e}")
        alerts_to_display = [] 

    return render_template('index.html', 
                           radar_url=radar_url, 
                           satellite_url=satellite_url,
                           alerts=alerts_to_display)

@app.route('/api/all_locations_forecast')
def get_all_locations_forecast():
    dataset_id = "F-C0032-001" 
    
    params = {
        'Authorization': CWA_API_KEY,
        'elementName': 'Wx,PoP,MinT,MaxT', 
        'sort': 'time', 
        'format': 'JSON'
    }

    try:
        app.logger.info(f"正在請求 CWA API: {CWA_BASE_URL}/{dataset_id}...")
        response = requests.get(f"{CWA_BASE_URL}/{dataset_id}", params=params, timeout=10)
        response.raise_for_status() 

        data = response.json()
        
        parsed_all_locations_data = []

        if data and 'records' in data and 'location' in data['records']:
            for loc in data['records']['location']:
                location_name = loc['locationName']
                
                time_periods = {}
                for element in loc['weatherElement']:
                    element_name = element['elementName']
                    for time_data in element['time']:
                        start_time = time_data['startTime']
                        end_time = time_data['endTime']
                        period_key = f"{start_time}-{end_time}" 

                        if period_key not in time_periods:
                            time_periods[period_key] = {
                                'startTime': start_time,
                                'endTime': end_time,
                                'data': {}
                            }
                        
                        time_periods[period_key]['data'][element_name] = time_data['parameter']['parameterName']
                
                forecasts_for_location = []
                for key in sorted(time_periods.keys()):
                    if len(forecasts_for_location) < 3:
                        forecasts_for_location.append(time_periods[key])
                    else:
                        break 

                parsed_all_locations_data.append({
                    'locationName': location_name,
                    'forecasts': forecasts_for_location
                })
            
            order_map = {name: i for i, name in enumerate(PREFERRED_ORDER)}
            parsed_all_locations_data.sort(key=lambda x: (order_map.get(x['locationName'], len(PREFERRED_ORDER)), x['locationName']))
            
            app.logger.info(f"成功獲取並整理 {len(parsed_all_locations_data)} 個地點的預報資料。")
            return jsonify(parsed_all_locations_data)
        
        app.logger.warning("CWA API 回傳的資料結構不符合預期或無資料 (F-C0032-001)。")
        return jsonify({"error": "找不到預報資料或資料格式不正確。"}), 404

    except requests.exceptions.Timeout as e:
        app.logger.error(f"請求 CWA API (F-C0032-001) 超時: {e}")
        return jsonify({"error": f"連接氣象署 API 超時，請稍後再試。"}), 504
    except requests.exceptions.RequestException as e:
        app.logger.error(f"請求 CWA API (F-C0032-001) 失敗: {e}")
        return jsonify({"error": f"無法連接到氣象署 API 或請求失敗: {e}"}), 500
    except Exception as e:
        app.logger.error(f"處理天氣資料 (F-C0032-001) 時發生未知錯誤: {e}", exc_info=True)
        return jsonify({"error": f"資料處理發生未知錯誤: {e}"}), 500

@app.route('/api/typhoon_warning')
def get_typhoon_warning():
    dataset_id = "W-C0034-005" 
    
    params = {
        'Authorization': CWA_API_KEY,
        'format': 'JSON'
    }

    try:
        app.logger.info(f"正在請求 CWA API: {CWA_BASE_URL}/{dataset_id} (熱帶氣旋路徑潛勢預報)...")
        response = requests.get(f"{CWA_BASE_URL}/{dataset_id}", params=params, timeout=15)
        response.raise_for_status() 

        data = response.json()
        
        parsed_typhoons_data = []

        if data and 'records' in data and 'tropicalCyclones' in data['records'] and 'tropicalCyclone' in data['records']['tropicalCyclones']:
            tropical_cyclones_list = data['records']['tropicalCyclones']['tropicalCyclone']
            app.logger.info(f"成功獲取 {len(tropical_cyclones_list)} 筆熱帶氣旋路徑潛勢預報資料。")

            for tc_data in tropical_cyclones_list:
                typhoon_name = tc_data.get('typhoonName', '未知熱帶氣旋')
                typhoon_year = tc_data.get('year', 'N/A') 
                
                typhoon_info = {
                    'typhoonName': typhoon_name,
                    'year': typhoon_year,
                    'analysisFixes': [], 
                    'forecastPoints': [] 
                }

                if 'analysisData' in tc_data and 'fix' in tc_data['analysisData']:
                    for fix_point in tc_data['analysisData']['fix']:
                        try:
                            coord_str = fix_point.get('coordinate', '0,0') 
                            lon_str, lat_str = coord_str.split(',')
                            latitude = float(lat_str.strip())
                            longitude = float(lon_str.strip())

                            quadrant_radii = {}
                            if 'circleOf15Ms' in fix_point and 'quadrantRadii' in fix_point['circleOf15Ms'] and 'radius' in fix_point['circleOf15Ms']['quadrantRadii']:
                                for qr in fix_point['circleOf15Ms']['quadrantRadii']['radius']:
                                    dir_val = qr.get('dir')
                                    radius_val = qr.get('value')
                                    if dir_val and radius_val and radius_val != 'N/A':
                                        quadrant_radii[dir_val] = int(radius_val)

                            wind_speed = int(fix_point.get('maxWindSpeed', 0)) if fix_point.get('maxWindSpeed') != 'N/A' else 'N/A'
                            gust_speed = int(fix_point.get('maxGustSpeed', 0)) if fix_point.get('maxGustSpeed') != 'N/A' else 'N/A'
                            pressure = int(fix_point.get('pressure', 0)) if fix_point.get('pressure') != 'N/A' else 'N/A'
                            move_speed = int(fix_point.get('movingSpeed', 0)) if fix_point.get('movingSpeed') != 'N/A' else 'N/A'
                            radius15Ms = int(fix_point.get('circleOf15Ms', {}).get('radius', 0)) if fix_point.get('circleOf15Ms', {}).get('radius') != 'N/A' else 'N/A'
                            
                            typhoon_info['analysisFixes'].append({
                                'time': fix_point.get('fixTime', ''),
                                'latitude': latitude,
                                'longitude': longitude,
                                'maxWindSpeed': wind_speed,
                                'maxGustSpeed': gust_speed,
                                'pressure': pressure,
                                'movingSpeed': move_speed,
                                'movingDirection': fix_point.get('movingDirection', 'N/A'),
                                'radius15Ms': radius15Ms,
                                'quadrantRadii15Ms': quadrant_radii 
                            })
                        except (ValueError, KeyError, AttributeError) as e:
                            app.logger.error(f"解析觀測點 {fix_point.get('fixTime', '')} 時發生錯誤: {e}")
                            continue 

                if 'forecastData' in tc_data and 'fix' in tc_data['forecastData']:
                    for forecast_point in tc_data['forecastData']['fix']:
                        try:
                            coord_str = forecast_point.get('coordinate', '0,0')
                            lon_str, lat_str = coord_str.split(',')
                            latitude = float(lat_str.strip())
                            longitude = float(lon_str.strip())

                            radius15Ms = int(forecast_point.get('circleOf15Ms', {}).get('radius', 0)) if forecast_point.get('circleOf15Ms', {}).get('radius') != 'N/A' else 'N/A'
                            wind_speed = int(forecast_point.get('maxWindSpeed', 0)) if forecast_point.get('maxWindSpeed') != 'N/A' else 'N/A'
                            pressure = int(forecast_point.get('pressure', 0)) if forecast_point.get('pressure') != 'N/A' else 'N/A'

                            typhoon_info['forecastPoints'].append({
                                'forecastTime': forecast_point.get('fixTime', ''), 
                                'latitude': latitude,
                                'longitude': longitude,
                                'maxWindSpeed': wind_speed,
                                'pressure': pressure,
                                'radius15Ms': radius15Ms
                            })
                        except (ValueError, KeyError, AttributeError) as e:
                            app.logger.error(f"解析預測點 {forecast_point.get('fixTime', '')} 時發生錯誤: {e}")
                            continue 

                parsed_typhoons_data.append(typhoon_info)
            
            return jsonify(parsed_typhoons_data)
        
        app.logger.info("CWA API 回傳的熱帶氣旋路徑潛勢預報無資料或格式不符合預期 (W-C0034-005)。")
        return jsonify([]), 200 

    except requests.exceptions.Timeout as e:
        app.logger.error(f"請求 CWA 熱帶氣旋 API (W-C0034-005) 超時: {e}")
        return jsonify({"error": f"連接氣象署熱帶氣旋 API 超時，請稍後再試。"}), 504
    except requests.exceptions.RequestException as e:
        app.logger.error(f"請求 CWA 熱帶氣旋 API (W-C0034-005) 失敗: {e}")
        return jsonify({"error": f"無法連接到氣象署熱帶氣旋 API 或請求失敗: {e}"}), 500
    except Exception as e:
        app.logger.error(f"處理熱帶氣旋資料 (W-C0034-005) 時發生未知錯誤: {e}", exc_info=True)
        return jsonify({"error": f"資料處理發生未知錯誤: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=4000)
