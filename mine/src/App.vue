<template>
  <div class="dashboard">
    <div class="header">
      <div class="header-left">
        <div class="weather">
          <span class="weather-icon">{{ weatherIcon }}</span>
          <span class="temperature">{{ temperature }}°C</span>
          <span class="air-quality">空气{{ airQuality }}</span>
        </div>
      </div>
      <div class="header-title">
        <h1>云南矿山生态修复智能监测平台</h1>
      </div>
      <div class="header-right">
        <div class="date-time">{{ currentDate }} {{ currentTime }}</div>
        <div class="login-info">
          <span class="icon">👤</span>
          <span>管理员</span>
        </div>
        <button class="enter-system-btn" @click="goToGeoView">进入系统</button>
      </div>
    </div>

    <div class="main-content">
      <!-- 左侧面板移除，改为悬浮卡片 -->
      <div class="mine-type-card glass-card floating-card">
        <div class="panel-title fancy-title">矿山类型统计</div>
        <div class="chart-inner">
          <div class="pie-segments">
            <div class="segment segment-1"></div>
            <div class="segment segment-2"></div>
            <div class="segment segment-3"></div>
            <div class="segment segment-4"></div>
            <div class="segment segment-5"></div>
          </div>
          <div class="pie-center">
            <div class="pie-value gradient-number">{{ mineTotal }}</div>
            <div class="pie-label subtle-label">矿山</div>
          </div>
        </div>
        <div class="stats-container">
          <div class="stat-item">
            <div class="stat-value gradient-number">{{ monitorCount }}</div>
            <div class="stat-label subtle-label">监测点数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value gradient-number">{{ interventionCount }}</div>
            <div class="stat-label subtle-label">人工干预</div>
          </div>
        </div>
      </div>
      
      <div class="ranking-card glass-card floating-card">
        <div class="panel-title fancy-title">矿区干预等级排名</div>
        <div class="ranking-list">
          <div class="ranking-item" v-for="(item, index) in rankingList" :key="index">
            <div class="rank rank-pill">TOP{{ index + 1 }}</div>
            <div class="rank-name">{{ item.name }}</div>
          </div>
        </div>
      </div>

      <!-- 中间地图区域 -->
      <div class="center-panel">
        <div class="map-controls">
          <div class="layer-switch">
            <div class="layer-btn" :class="{ active: currentLayer === 'base' }" @click="switchLayer('base')">基础图层</div>
            <div class="layer-btn" :class="{ active: currentLayer === 'satellite' }" @click="switchLayer('satellite')">卫星图层</div>
            <div class="layer-btn" :class="{ active: currentLayer === 'terrain' }" @click="switchLayer('terrain')">地形图层</div>
            <div class="layer-btn" :class="{ active: currentLayer === 'ndvi' }" @click="switchLayer('ndvi')">NDVI图层</div>
          </div>
          <!-- 添加FID搜索功能 -->
          <div class="search-container">
            <input type="text" v-model="searchMineId" placeholder="输入矿山ID" class="search-input" />
            <button @click="searchMineById" class="search-btn">搜索</button>
          </div>
        </div>
        <div id="map"></div>
        
        <!-- 直接悬浮在地图上的卡片 -->
        <div class="data-overview glass-card floating-card">
          <div class="panel-title fancy-title">数据概览</div>
          <div class="overview-item">
            <div class="overview-value gradient-number">{{ overviewArea }}</div>
            <div class="overview-label subtle-label">监测面积(㎡)</div>
          </div>
          <div class="overview-item">
            <div class="overview-value gradient-number">{{ overviewSoilCover }}</div>
            <div class="overview-label subtle-label">土壤覆盖</div>
          </div>
          <div class="overview-item">
            <div class="overview-value gradient-number">{{ overviewVegCover }}</div>
            <div class="overview-label subtle-label">植被覆盖率(%)</div>
          </div>
        </div>
    
        <div class="env-indicators glass-card floating-card">
          <div class="panel-title fancy-title">环境指标</div>
          <div class="indicator-item">
            <div class="indicator-label subtle-label">空气湿度(%)</div>
            <div class="indicator-bar">
              <div class="bar-fill" :style="{ width: humidity + '%' }"></div>
              <div class="bar-value gradient-number">{{ humidity }}%</div>
            </div>
          </div>
          <div class="indicator-item">
            <div class="indicator-label subtle-label">空气温度(℃)</div>
            <div class="indicator-bar">
              <div class="bar-fill" :style="{ width: Math.min(100, Math.max(0, temperature)) + '%' }"></div>
              <div class="bar-value gradient-number">{{ temperature }}℃</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 矿山详情弹窗 - 居中显示 -->
      <div v-if="showMineDetail" class="mine-detail-popup centered-popup">
        <div class="popup-header">
          <div class="popup-title">矿山详情 - {{ selectedMine.name || ('矿山 ' + selectedMine.mine_id) }}</div>
          <div class="popup-close" @click="showMineDetail = false">✕</div>
        </div>
        <div class="popup-content">
          <div class="detail-item">
            <div class="detail-label">矿山ID</div>
            <div class="detail-value">{{ selectedMine.mine_id }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">监测面积(㎡)</div>
            <div class="detail-value">{{ selectedMine.area ?? '暂无' }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">位置坐标</div>
            <div class="detail-value">{{ (selectedMine.center_lat ?? 0).toFixed(6) }}, {{ (selectedMine.center_lng ?? 0).toFixed(6) }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">边界范围</div>
            <div class="detail-value">{{ selectedMine.bbox ?? '—' }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">NDVI均值</div>
            <div class="detail-value">{{ (selectedMine.ndvi_mean ?? 0).toFixed(3) }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">NDVI趋势</div>
            <div class="detail-value" :class="getTrendClass(selectedMine.ndvi_trend)">{{ formatTrend(selectedMine.ndvi_trend) }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">MK趋势</div>
            <div class="detail-value" :class="getMkTrendClass(selectedMine.mk_trend)">{{ selectedMine.mk_trend }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Sen's Slope</div>
            <div class="detail-value">{{ formatSensSlope(selectedMine.sens_slope) }}</div>
          </div>
          <div class="trend-chart">
            <div ref="ndviChart" class="chart-placeholder"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, ref, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as echarts from 'echarts';
import axios from 'axios';

export default {
  name: 'App',
  setup() {
    // 响应式状态
    const currentLayer = ref('base');
    const showMineDetail = ref(false);
    const selectedMine = ref({});
    const currentDate = ref('');
    const currentTime = ref('');

    // 天气与环境（温度/湿度/空气质量动态）
    const temperature = ref(25);
    const weatherIcon = ref('🌤️');
    const airQuality = ref('优');
    const humidity = ref(69);

    // 其他环境指标（本地模拟）
    const soilMoisture = ref(12);
    const rainfall = ref(23);
    const airTemp = ref(45);

    // 概览与人员数字动画用的响应式值
    const overviewArea = ref(0);
    const overviewSoilCover = ref(0);
    const overviewVegCover = ref(0);
    const donutTotal = ref(0);

    const searchMineId = ref('');
    const ndviChart = ref(null);
    let map = null;
    let baseMaps = {};
    let mineLayer = null;
    let minesData = [];

    // 排名列表数据
    const rankingList = ref([
      { name: '水平沟' },
      { name: '林区' },
      { name: '东盟区' },
      { name: '工业区' },
      { name: '西山区' }
    ]);

    // 人员数据
    const personnelData = ref([
      { type: '管理员', count: 145, percent: 16, color: '#4ecdc4' },
      { type: '专家组', count: 157, percent: 11, color: '#ff6b6b' },
      { type: '监测员', count: 119, percent: 9, color: '#ffe66d' },
      { type: '作业组', count: 295, percent: 7, color: '#1a535c' },
      { type: '管理组', count: 647, percent: 2, color: '#4281a4' }
    ]);

    // 动画辅助
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const animateNumber = (targetRef, targetValue, duration = 800) => {
      const start = Number(targetRef.value) || 0;
      const end = Number(targetValue) || 0;
      const startTime = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const val = Math.round(start + (end - start) * easeOutCubic(t));
        targetRef.value = val;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    // 格式化日期时间
    const updateDateTime = () => {
      const now = new Date();
      currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    // 本地模拟环境数据（不覆盖温度/湿度）
    const updateSimEnvironment = () => {
      const icons = ['🌤️', '⛅', '🌥️', '☀️', '🌦️'];
      weatherIcon.value = icons[Math.floor(Math.random() * icons.length)];
      soilMoisture.value = Math.floor(Math.random() * 20 + 5); // 5-25%
      rainfall.value = Math.floor(Math.random() * 40 + 10); // 10-50mm
      airTemp.value = Math.floor(Math.random() * 15 + 35); // 35-50℃
    };

    // 环境数据映射
    const formatAqiToText = (aqi) => {
      if (aqi == null) return '暂无';
      if (aqi <= 50) return '优';
      if (aqi <= 100) return '良';
      if (aqi <= 150) return '轻度污染';
      if (aqi <= 200) return '中度污染';
      if (aqi <= 300) return '重度污染';
      return '严重污染';
    };

    // 实时环境数据（根据坐标）
    let envFetchTimer = null;

    const fetchRealtimeEnvironmentAt = async (lat, lon) => {
      try {
        const weatherUrl = 'https://api.open-meteo.com/v1/forecast';
        const airUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality';
        const w = await axios.get(weatherUrl, {
          params: {
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,relative_humidity_2m',
            timezone: 'Asia/Shanghai'
          }
        });
        const curr = w?.data?.current || {};
        if (curr.temperature_2m != null) animateNumber(temperature, Math.round(curr.temperature_2m));
        if (curr.relative_humidity_2m != null) animateNumber(humidity, Math.round(curr.relative_humidity_2m));

        const aq = await axios.get(airUrl, {
          params: {
            latitude: lat,
            longitude: lon,
            hourly: 'us_aqi,pm2_5,pm10',
            timezone: 'Asia/Shanghai'
          }
        });
        const h = aq?.data?.hourly;
        let aqi = null;
        if (h?.us_aqi?.length) aqi = h.us_aqi[h.us_aqi.length - 1];
        airQuality.value = formatAqiToText(aqi);
      } catch (e) {
        console.warn('实时环境数据拉取失败:', e.message);
      }
    };

    const registerMapListeners = () => {
      if (!map) return;
      map.on('moveend', () => {
        const c = map.getCenter();
        if (envFetchTimer) clearTimeout(envFetchTimer);
        envFetchTimer = setTimeout(() => {
          fetchRealtimeEnvironmentAt(c.lat, c.lng);
        }, 350);
      });
      const c = map.getCenter();
      fetchRealtimeEnvironmentAt(c.lat, c.lng);
    };

    // 格式化趋势
    const formatTrend = (trend) => {
      if (!trend) return '无变化';
      return trend > 0 ? `上升 ${trend.toFixed(2)}` : `下降 ${Math.abs(trend).toFixed(2)}`;
    };

    // 获取趋势样式类
    const getTrendClass = (trend) => {
      if (!trend) return '';
      return trend > 0 ? 'trend-up' : 'trend-down';
    };

    // 获取MK趋势样式类
    const getMkTrendClass = (trend) => {
      if (!trend) return '';
      if (trend && trend.includes('上升')) return 'trend-up';
      if (trend && trend.includes('下降')) return 'trend-down';
      return '';
    };

    // 格式化Sen's Slope值
    const formatSensSlope = (slope) => {
      if (!slope && slope !== 0) return '暂无数据';
      return (Number(slope) || 0).toFixed(4) + ' / 年';
    };

    // 切换图层
    const switchLayer = (layer) => {
      currentLayer.value = layer;
      updateMapLayer();
    };

    // 更新地图图层
    const updateMapLayer = () => {
      if (!map) return;
      Object.values(baseMaps).forEach(layer => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      if (baseMaps[currentLayer.value]) {
        baseMaps[currentLayer.value].addTo(map);
      }
      if (mineLayer && !map.hasLayer(mineLayer)) {
        mineLayer.addTo(map);
      }
    };

    // 搜索矿山（支持按FID_1或名称）
    const searchMineById = async () => {
      if (!searchMineId.value) return;
      try {
        const { data: feature } = await axios.get(`http://localhost:8000/api/mines/search?q=${encodeURIComponent(searchMineId.value)}`);
        const bounds = L.geoJSON(feature).getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });

        mineLayer.resetStyle();
        const targetFid = feature.properties.FID_1;
        mineLayer.eachLayer(layer => {
          if (layer.feature && layer.feature.properties.FID_1 === targetFid) {
            layer.setStyle({ color: '#00d2d3', weight: 3, opacity: 1, fillColor: '#00d2d3', fillOpacity: 0.35 });
          }
        });

        // 定位后按中心刷新环境数据
        const c = map.getCenter();
        fetchRealtimeEnvironmentAt(c.lat, c.lng);

        // 拉取NDVI
        let ndviResp = null;
        try { ndviResp = await axios.get(`http://localhost:8000/api/mines/ndvi?fid=${targetFid}`); } catch {}
        const ndvi = ndviResp?.data || {};

        selectedMine.value = {
          mine_id: targetFid,
          name: feature.properties.mine_name || feature.properties.name || `矿山 ${targetFid}`,
          area: feature.properties.area,
          ndvi_mean: ndvi.ndvi_mean ?? 0.45,
          ndvi_trend: ndvi.ndvi_trend ?? 0.02,
          mk_trend: ndvi.mk_trend ?? '无趋势',
          sens_slope: ndvi.ndvi_trend ? ndvi.ndvi_trend / 10 : 0.002,
          ndvi_data: ndvi.ndvi_data?.length ? ndvi.ndvi_data : generateMockNdviData()
        };

        showMineDetail.value = true;
        nextTick(() => { renderNdviChart(); });
      } catch (err) {
        console.error('搜索矿山失败:', err);
        alert('未找到该矿山或后端接口异常');
      }
    };

    // 生成模拟NDVI数据
    const generateMockNdviData = (baseValue = 0.4, trend = 0.01) => {
      const data = [];
      const startYear = 2014;
      const endYear = 2024;
      let value = baseValue - (trend * 4);
      for (let year = startYear; year <= endYear; year += 2) {
        value += trend + (Math.random() * 0.06 - 0.02);
        value = Math.max(0.1, Math.min(0.9, value));
        data.push({ year, ndvi_value: value });
      }
      return data;
    };

    // 渲染NDVI趋势图表
    const renderNdviChart = () => {
      if (!selectedMine.value.ndvi_data || selectedMine.value.ndvi_data.length === 0) return;
      const chartDom = ndviChart.value;
      if (!chartDom) return;
      const myChart = echarts.init(chartDom);
      const raw = selectedMine.value.ndvi_data.map(d => ({ year: Number(d.year), ndvi_value: Number(d.ndvi_value) })).sort((a,b)=>a.year-b.year);
      const yearsAll = raw.map(d=>d.year);
      const diffs = [];
      for(let i=1;i<yearsAll.length;i++){ diffs.push(Math.abs(yearsAll[i]-yearsAll[i-1])); }
      const gcd = (a,b)=> b ? gcd(b,a%b) : a;
      let step = diffs.length ? diffs.reduce((acc,v)=>gcd(acc,v)) : 2;
      if (!step || step < 2) step = 2;
      const baseYear = yearsAll[0];
      const filtered = raw.filter(d => ((d.year - baseYear) % step) === 0);
      const years = filtered.map(d=>d.year);
      const values = filtered.map(d=>d.ndvi_value);

      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      const n = years.length;
      const xData = years.map((_, i) => i);
      for (let i = 0; i < n; i++) { sumX += xData[i]; sumY += values[i]; sumXY += xData[i] * values[i]; sumX2 += xData[i] * xData[i]; }
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      const trendData = xData.map(x => intercept + slope * x);

      const option = {
        backgroundColor: 'rgba(0,0,0,0)',
        grid: { left: '5%', right: '5%', top: '10%', bottom: '15%', containLabel: true },
        legend: { data: ['NDVI值', '趋势线'], textStyle: { color: '#bbb' }, right: 10, top: 0 },
        xAxis: { type: 'category', data: years, axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#bbb', fontSize: 10 } },
        yAxis: {
          type: 'value', name: 'NDVI', nameTextStyle: { color: '#bbb' },
          min: Math.max(0, Math.min(...values) - 0.1), max: Math.min(1, Math.max(...values) + 0.1),
          axisLine: { lineStyle: { color: '#666' } }, axisLabel: { color: '#bbb', fontSize: 10 },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        series: [
          { name: 'NDVI值', data: values, type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
            itemStyle: { color: '#4ecdc4' }, lineStyle: { width: 3, color: '#4ecdc4' },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [ { offset: 0, color: 'rgba(78, 205, 196, 0.5)' }, { offset: 1, color: 'rgba(78, 205, 196, 0.1)' } ]) }
          },
          { name: '趋势线', type: 'line', data: trendData, smooth: false, symbol: 'none',
            lineStyle: { width: 2, type: 'dashed', color: selectedMine.value.ndvi_trend > 0 ? '#4ecdc4' : '#ff6b6b' }
          }
        ],
        tooltip: {
          trigger: 'axis',
          formatter: function(params) {
            const ndviData = params[0];
            const trendData = params[1];
            return `${ndviData.name}年<br/>NDVI: ${Number(ndviData.value).toFixed(3)}<br/>趋势值: ${Number(trendData.value).toFixed(3)}`;
          },
          backgroundColor: 'rgba(0,21,41,0.9)', borderColor: '#1e3a5f', textStyle: { color: '#fff' }
        }
      };
      myChart.setOption(option);
      window.addEventListener('resize', () => { myChart.resize(); });
    };

    // 初始化地图
    const initMap = () => {
      map = L.map('map', { zoomControl: false, attributionControl: false }).setView([25.6, 100.2], 9);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      baseMaps = {
        base: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
        terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }),
        ndvi: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, opacity: 0.7 })
      };
      baseMaps[currentLayer.value].addTo(map);
      loadMinesData();
      // 绑定地图中心事件并初次获取环境数据
      registerMapListeners();
    };

    // 地图移动事件监听（旧版本，已不再使用）
    const registerMapListenersOld = () => {
      if (!map) return;
      map.on('moveend', () => {
        const c = map.getCenter();
        fetchRealtimeEnvironmentAt(c.lat, c.lng);
      });
      const c = map.getCenter();
      fetchRealtimeEnvironmentAt(c.lat, c.lng);
    };

    // 加载矿山数据（后端读取）
    const loadMinesData = async () => {
      try {
        const { data } = await axios.get('http://localhost:8000/api/geojson');
        if (!data || !data.features) throw new Error('后端未返回有效GeoJSON');
        const geojsonData = data;
        minesData = geojsonData.features;
        mineLayer = L.geoJSON(geojsonData, {
          style: { color: '#4ecdc4', weight: 2, opacity: 0.9, fillColor: '#4ecdc4', fillOpacity: 0.15 },
          onEachFeature: (feature, layer) => {
            layer.on('mouseover', (e) => { e.target.setStyle({ weight: 3, color: '#81ecec', fillOpacity: 0.25 }); e.target.bringToFront(); });
            layer.on('mouseout', (e) => { mineLayer.resetStyle(e.target); });
            layer.on('click', async () => {
              const fid = feature.properties.FID_1;
              const mineName = feature.properties.mine_name || feature.properties.name || `矿山 ${fid}`;
              const mineArea = feature.properties.area;
              mineLayer.resetStyle();
              layer.setStyle({ color: '#00d2d3', weight: 3, opacity: 1, fillColor: '#00d2d3', fillOpacity: 0.35 });
              const bounds = layer.getBounds();
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
              const center = bounds.getCenter();
              fetchRealtimeEnvironmentAt(center.lat, center.lng);
              try {
                const res = await axios.get(`http://localhost:8000/api/mines/ndvi?fid=${fid}`);
                const ndvi = res.data;
                selectedMine.value = {
                  mine_id: fid,
                  name: mineName,
                  area: mineArea,
                  center_lat: center.lat,
                  center_lng: center.lng,
                  bbox: bounds.toBBoxString && bounds.toBBoxString(),
                  ndvi_mean: ndvi.ndvi_mean,
                  ndvi_trend: ndvi.ndvi_trend,
                  mk_trend: ndvi.mk_trend,
                  sens_slope: ndvi.ndvi_trend ? ndvi.ndvi_trend / 10 : null,
                  ndvi_data: ndvi.ndvi_data?.length ? ndvi.ndvi_data : generateMockNdviData()
                };
              } catch (err) {
                console.warn('NDVI接口异常，使用模拟数据:', err.message);
                selectedMine.value = {
                  mine_id: fid,
                  name: mineName,
                  area: mineArea,
                  center_lat: center.lat,
                  center_lng: center.lng,
                  bbox: bounds.toBBoxString && bounds.toBBoxString(),
                  ndvi_mean: 0.45,
                  ndvi_trend: 0.02,
                  mk_trend: '无趋势',
                  sens_slope: 0.002,
                  ndvi_data: generateMockNdviData()
                };
              }
              showMineDetail.value = true;
              nextTick(() => { renderNdviChart(); });
            });
          }
        }).addTo(map);
        if (mineLayer.getBounds().isValid()) {
          map.fitBounds(mineLayer.getBounds(), { padding: [50, 50], maxZoom: 12 });
        }
      } catch (error) {
        console.error('加载矿山数据失败:', error);
        const geojsonData = {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: { FID_1: 1, mine_name: '示例矿山1', area: 12000 }, geometry: { type: 'Polygon', coordinates: [[[100.10,25.50],[100.20,25.50],[100.20,25.60],[100.10,25.60],[100.10,25.50]]] } },
            { type: 'Feature', properties: { FID_1: 2, mine_name: '示例矿山2', area: 9000 }, geometry: { type: 'Polygon', coordinates: [[[100.30,25.70],[100.40,25.70],[100.40,25.80],[100.30,25.80],[100.30,25.70]]] } },
            { type: 'Feature', properties: { FID_1: 3, mine_name: '示例矿山3', area: 15000 }, geometry: { type: 'Polygon', coordinates: [[[100.50,25.40],[100.60,25.40],[100.60,25.50],[100.50,25.50],[100.50,25.40]]] } },
            { type: 'Feature', properties: { FID_1: 4, mine_name: '示例矿山4', area: 21000 }, geometry: { type: 'Polygon', coordinates: [[[100.20,25.30],[100.30,25.30],[100.30,25.40],[100.20,25.40],[100.20,25.30]]] } },
            { type: 'Feature', properties: { FID_1: 5, mine_name: '示例矿山5', area: 18000 }, geometry: { type: 'Polygon', coordinates: [[[100.40,25.20],[100.50,25.20],[100.50,25.30],[100.40,25.30],[100.40,25.20]]] } }
          ]
        };
        minesData = geojsonData.features;
        mineLayer = L.geoJSON(geojsonData, {
          style: { color: '#4ecdc4', weight: 2, opacity: 0.9, fillColor: '#4ecdc4', fillOpacity: 0.15 },
          onEachFeature: (feature, layer) => {
            layer.on('mouseover', (e) => { e.target.setStyle({ weight: 3, color: '#81ecec', fillOpacity: 0.25 }); e.target.bringToFront(); });
            layer.on('mouseout', (e) => { mineLayer.resetStyle(e.target); });
            layer.on('click', async () => {
              const fid = feature.properties.FID_1;
              const mineName = feature.properties.mine_name;
              mineLayer.resetStyle();
              layer.setStyle({ color: '#00d2d3', weight: 3, opacity: 1, fillColor: '#00d2d3', fillOpacity: 0.35 });
              map.fitBounds(layer.getBounds(), { padding: [50, 50] });
              const center = layer.getBounds().getCenter();
              fetchRealtimeEnvironmentAt(center.lat, center.lng);
              selectedMine.value = {
                mine_id: fid,
                name: mineName,
                area: feature.properties.area,
                center_lat: center.lat,
                center_lng: center.lng,
                bbox: bounds.toBBoxString && bounds.toBBoxString(),
                ndvi_mean: 0.45,
                ndvi_trend: 0.02,
                mk_trend: '无趋势',
                sens_slope: 0.002,
                ndvi_data: generateMockNdviData()
              };
              showMineDetail.value = true;
              nextTick(() => { renderNdviChart(); });
            });
          }
        }).addTo(map);
        if (mineLayer.getBounds().isValid()) {
          map.fitBounds(mineLayer.getBounds(), { padding: [50, 50], maxZoom: 12 });
        }
      }
    };

    const mineTotal = ref(3821);
    const monitorCount = ref(1237);
    const interventionCount = ref(2584);
    const startMineStatsTicker = () => {
      const targets = [
        { ref: mineTotal, value: 3821 },
        { ref: monitorCount, value: 1237 },
        { ref: interventionCount, value: 2584 },
      ];
      let idx = 0;
      setInterval(() => {
        const t = targets[idx];
        t.ref.value = 0;
        animateNumber(t.ref, t.value, 900);
        idx = (idx + 1) % targets.length;
      }, 3500);
    };

    const goToGeoView = () => {
      let base = import.meta.env.VITE_GEOVIEW_URL || 'http://localhost:3000/'
      const hasHash = /#\//.test(base)
      const target = hasHash ? base : (base.endsWith('/') ? base + '#/detectchanges' : base + '/#/detectchanges')
      window.location.href = target
    }

    onMounted(() => {
      // 初始化日期时间
      updateDateTime();
      setInterval(updateDateTime, 1000);
      // 本地环境模拟（不覆盖温湿度）
      updateSimEnvironment();
      setInterval(updateSimEnvironment, 30000);
      // 数字动画：进入时滚动到目标值
      animateNumber(overviewArea, 11256);
      animateNumber(overviewSoilCover, 11256);
      animateNumber(overviewVegCover, 125);
      animateNumber(donutTotal, 1221);
      // 初始化地图
      nextTick(() => { initMap(); });
      startMineStatsTicker();
    });

    return {
      currentLayer,
      showMineDetail,
      selectedMine,
      currentDate,
      currentTime,
      temperature,
      weatherIcon,
      airQuality,
      humidity,
      soilMoisture,
      rainfall,
      airTemp,
      overviewArea,
      overviewSoilCover,
      overviewVegCover,
      donutTotal,
      searchMineId,
      ndviChart,
      rankingList,
      personnelData,
      switchLayer,
      searchMineById,
      formatTrend,
      getTrendClass,
      getMkTrendClass,
      formatSensSlope,
      mineTotal,
      monitorCount,
      interventionCount,
      goToGeoView
    };
  }
};

</script>

<style>
/* 全局样式 */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.dashboard {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background-color: #0a1929;
  color: #fff;
  font-family: 'Arial', sans-serif;
  background-image: linear-gradient(to bottom, #001529, #0a1929);
}

/* 顶部标题栏（半透明玻璃风格） */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  padding: 0 20px;
  background-color: rgba(10, 25, 41, 0.35);
  border-bottom: 1px solid rgba(78, 205, 196, 0.25);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
}

.header-left, .header-right { display: flex; align-items: center; }
.header-title h1 { margin: 0; font-size: 24px; font-weight: bold; color: #f0f0f0; text-shadow: 0 0 10px rgba(24, 144, 255, 0.5); letter-spacing: 2px; }
.weather { display: flex; align-items: center; gap: 10px; }
.weather-icon { font-size: 24px; }
.temperature { font-size: 16px; font-weight: bold; color: #ff9800; }
.air-quality { font-size: 14px; color: #4ecdc4; padding: 2px 6px; background-color: rgba(78, 205, 196, 0.2); border-radius: 4px; }
.date-time { font-size: 14px; color: #bbb; margin-right: 20px; }
.login-info { display: flex; align-items: center; gap: 5px; font-size: 14px; color: #bbb; padding: 5px 10px; background-color: rgba(255, 255, 255, 0.1); border-radius: 4px; }

/* 主内容区 */
.main-content { display: flex; flex: 1; width: 100%; height: calc(100vh - 60px); overflow: hidden; position: relative; }

/* 地图容器 */
#map { width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1; }

/* 左侧面板 */
.left-panel { width: 280px; padding: 15px; background-color: rgba(10, 25, 41, 0.25); border-right: 1px solid #1e3a5f; z-index: 10; backdrop-filter: blur(6px); overflow-y: auto; height: 100%; box-shadow: 5px 0 15px rgba(0, 0, 0, 0.2); }

/* 地图控件 */
.map-controls { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 1000; background-color: rgba(10, 25, 41, 0.5); border: 1px solid #1e3a5f; border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 10px; backdrop-filter: blur(8px); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25); }
.layer-switch { display: flex; gap: 5px; }
.layer-btn { padding: 5px 10px; font-size: 12px; cursor: pointer; border-radius: 3px; background-color: rgba(30, 58, 95, 0.5); transition: all 0.3s; }
.layer-btn:hover { background-color: rgba(78, 205, 196, 0.3); }
.layer-btn.active { background-color: #4ecdc4; color: #0a1929; }
.search-container { display: flex; gap: 5px; margin-top: 5px; }
.search-input { flex: 1; padding: 5px 10px; background-color: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; outline: none; }
.search-input::placeholder { color: rgba(255, 255, 255, 0.5); }
.search-btn { padding: 5px 10px; background-color: #4ecdc4; color: #0a1929; border: none; border-radius: 4px; cursor: pointer; transition: all 0.3s; }
.search-btn:hover { background-color: #3db9b0; }

/* 右侧覆盖栅格 */
.overlay-right { position: absolute; right: 20px; top: 70px; bottom: 20px; width: 48%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; z-index: 10; pointer-events: none; }
.overlay-right > * { pointer-events: auto; }
.data-overview { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }

/* 玻璃卡片 */
.glass-card { background-color: rgba(10, 25, 41, 0.45); backdrop-filter: blur(8px); border: 1px solid rgba(78, 205, 196, 0.25); border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25); padding: 10px; margin-bottom: 12px; }

/* 浮动卡片 */
.floating-card {
  position: absolute;
  z-index: 1000;
  width: 300px;
}

.data-overview {
   top: 80px;
   right: 24px;
 }
 
 .env-indicators {
   top: 360px;
   right: 24px;
 }

/* 居中弹窗 */
.centered-popup {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
}

/* 详情弹窗 */
.mine-detail-popup { position: absolute; bottom: 20px; right: 20px; width: 500px; max-width: 60vw; max-height: 70vh; overflow-y: auto; background-color: rgba(10, 25, 41, 0.9); border: 1px solid #1e3a5f; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); z-index: 1000; backdrop-filter: blur(8px); }
/* 隐藏弹窗滚动条，仅保留滚动行为 */
.mine-detail-popup::-webkit-scrollbar { width: 0; height: 0; }
.mine-detail-popup { scrollbar-width: none; -ms-overflow-style: none; }
.popup-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: rgba(30, 58, 95, 0.5); border-bottom: 1px solid #1e3a5f; position: sticky; top: 0; z-index: 2; }
.popup-title { font-size: 16px; font-weight: bold; color: #4ecdc4; }
.popup-close { cursor: pointer; font-size: 18px; color: #bbb; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.3s; }
.popup-close:hover { color: #ff6b6b; background-color: rgba(255, 255, 255, 0.1); }
.popup-content { padding: 20px; }
.detail-item { display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center; }
.detail-label { font-size: 14px; color: #bbb; }
.detail-value { font-size: 14px; font-weight: bold; padding: 4px 8px; border-radius: 4px; background-color: rgba(255, 255, 255, 0.05); }
.trend-up { color: #4ecdc4; background-color: rgba(78, 205, 196, 0.1); }
.trend-down { color: #ff6b6b; background-color: rgba(255, 107, 107, 0.1); }
.trend-chart { margin-top: 20px; height: 220px; background-color: rgba(30, 58, 95, 0.3); border: 1px solid #1e3a5f; border-radius: 8px; overflow: hidden; padding: 10px; }
.chart-placeholder { width: 100%; height: 100%; }

/* 响应式调整 */
@media (max-width: 1200px) { .left-panel { width: 240px; } }
@media (max-width: 992px) { .left-panel { width: 200px; } }

/* 悬浮卡片定位：左侧不贴边 */
.mine-type-card {
  left: 24px;
  top: 80px;
}
.ranking-card {
  left: 24px;
  top: 360px;
}

/* 强化标题与数字样式 */
.fancy-title {
  font-weight: 700;
  letter-spacing: 1px;
  color: #e0f7ff;
  border-bottom: 1px dashed rgba(78,205,196,0.35);
  padding-bottom: 6px;
  margin-bottom: 8px;
}
.gradient-number {
  font-size: 26px;
  font-weight: 800;
  background: linear-gradient(135deg, #4ecdc4 0%, #24c1ff 60%, #fefefe 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 12px rgba(36, 193, 255, 0.35);
}
.subtle-label {
  font-size: 12px;
  color: rgba(255,255,255,0.75);
}

/* 排名卡片样式 */
.ranking-list { display: flex; flex-direction: column; gap: 8px; }
.ranking-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 8px; background: rgba(30,58,95,0.35); border: 1px solid rgba(78,205,196,0.18); }
.rank-pill { font-size: 12px; color: #0a1929; background: linear-gradient(135deg, #4ecdc4, #24c1ff); padding: 4px 8px; border-radius: 999px; box-shadow: 0 2px 8px rgba(36,193,255,0.3); }
.rank-name { font-weight: 600; color: #f0f6ff; }
</style>





// 矿山类型统计数字（滚动轮播）
const mineTotal = ref(3821);
const monitorCount = ref(1237);
const interventionCount = ref(2584);
const startMineStatsTicker = () => {
  const targets = [
    { ref: mineTotal, value: 3821 },
    { ref: monitorCount, value: 1237 },
    { ref: interventionCount, value: 2584 },
  ];
  let idx = 0;
  setInterval(() => {
    const t = targets[idx];
    t.ref.value = 0;
    animateNumber(t.ref, t.value, 900);
    idx = (idx + 1) % targets.length;
  }, 3500);
};
}
.enter-system-btn { padding: 6px 12px; background-color: #4ecdc4; color: #0a1929; border: none; border-radius: 4px; cursor: pointer; }
.enter-system-btn:hover { background-color: #3db9b0; }
