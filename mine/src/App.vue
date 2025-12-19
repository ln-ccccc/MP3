<template>
  <div class="terminal-fullscreen">
    <!-- Map Background -->
    <div ref="mapEl" class="map-background" />

    <!-- Top Bar Overlay -->
    <header class="topbar-overlay">
      <div class="brand">
        <div class="brand-title">矿预测模型终端</div>
        <div class="brand-subtitle">Mine Prediction Model Console</div>
      </div>
      <div class="topbar-status">
        <div class="status-item">
          <span class="status-dot" :class="{ active: backend.connected }" />
          <span>后端 {{ backend.connected ? 'ONLINE' : 'OFFLINE' }}</span>
        </div>
        <div class="status-item">
          <span class="status-dot" :class="{ active: model.state === 'running' }" />
          <span>模型 {{ model.state.toUpperCase() }}</span>
        </div>
        <div class="datetime">{{ currentDate }} {{ currentTime }}</div>
      </div>
    </header>

    <!-- Global Loading & Error -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">系统初始化中...</div>
    </div>
    <div v-if="globalError" class="error-toast">
      <span class="error-icon">⚠️</span> {{ globalError }}
      <button class="close-toast" @click="globalError = ''">×</button>
    </div>

    <!-- Right Floating Stack -->
    <div class="floating-stack">
      <div 
        v-for="(itemId, index) in stackOrder" 
        :key="itemId"
        class="draggable-wrapper"
        draggable="true"
        @dragstart="onDragStart($event, index)"
        @dragover.prevent
        @dragenter.prevent
        @drop="onDrop($event, index)"
      >
        <!-- Core 1: Layer & Search -->
        <section v-if="itemId === 'mapCtrl'" class="glass-card">
          <div class="card-header">
            <div class="card-title">地图层级与定位</div>
          </div>
          <div class="card-body">
            <div class="layer-switch">
              <button 
                v-for="l in ['base', 'satellite', 'terrain']" 
                :key="l"
                class="layer-btn"
                :class="{ active: currentLayer === l }"
                @click="switchLayer(l)"
              >
                {{ l === 'base' ? '基础' : (l === 'satellite' ? '卫星' : '地形') }}
              </button>
            </div>
            <div class="search-box">
              <input 
                v-model="searchMineId" 
                type="text" 
                placeholder="输入矿山ID/名称..." 
                @keydown.enter="searchMineById"
              />
              <button class="icon-btn" @click="searchMineById">🔍</button>
            </div>
          </div>
        </section>

        <!-- Core 2: Operation Panel -->
        <section v-if="itemId === 'modelCtrl'" class="glass-card">
          <div class="card-header">
            <div class="card-title">模型控制</div>
            <div class="status-badge" :class="model.state">{{ model.state }}</div>
          </div>
          <div class="card-body compact-form">
            <div class="form-row">
              <label>模型</label>
              <select v-model="model.modelKey">
                <option value="linear">线性趋势</option>
                <option value="ema">指数平滑</option>
                <option value="hybrid">混合趋势</option>
              </select>
            </div>
            <div class="form-row">
              <label>窗口</label>
              <input type="range" v-model.number="model.horizonYears" min="2" max="12" />
              <span class="val">{{ model.horizonYears }}</span>
            </div>
            <div class="form-row">
              <label>频率</label>
              <input type="range" v-model.number="model.updateEverySec" min="1" max="6" />
              <span class="val">{{ model.updateEverySec }}s</span>
            </div>
            <div class="action-grid">
              <button class="btn primary" :disabled="model.state === 'running'" @click="startModel">启动</button>
              <button class="btn warning" :disabled="model.state !== 'running'" @click="pauseModel">暂停</button>
              <button class="btn danger" :disabled="model.state === 'idle'" @click="confirmStopModel">停止</button>
            </div>
          </div>
        </section>

        <!-- Core 3: Key Metrics -->
        <section v-if="itemId === 'metrics'" class="glass-card">
          <div class="card-header">
            <div class="card-title">关键指标 · {{ selectedMineLabel }}</div>
          </div>
          <div class="card-body metrics-grid">
            <div class="metric-item">
              <div class="m-label">预测指数</div>
              <div class="m-val blue">{{ metrics.endIndex }}</div>
            </div>
            <div class="metric-item">
              <div class="m-label">潜力评分</div>
              <div class="m-val orange">{{ metrics.potentialScore }}</div>
            </div>
            <div class="metric-item">
              <div class="m-label">异常风险</div>
              <div class="m-val">{{ metrics.riskLevel }}</div>
            </div>
            <div class="metric-item">
              <div class="m-label">NDVI趋势</div>
              <div class="m-val" :class="selectedMine.ndvi_trend > 0 ? 'good' : 'bad'">
                {{ (selectedMine.ndvi_trend * 100).toFixed(2) }}%
              </div>
            </div>
          </div>
        </section>

        <!-- Core 4: Prediction Chart -->
        <section v-if="itemId === 'chartPred'" class="glass-card">
          <div class="card-header">
            <div class="card-title">实时预测曲线</div>
          </div>
          <div class="card-body">
            <div v-show="selectedMine.mine_id" ref="predictionChartEl" class="chart-box" />
            <div v-if="!selectedMine.mine_id" class="empty-state">
              <span>请选择矿山查看预测</span>
            </div>
          </div>
        </section>

        <!-- Core 5: Heatmap -->
        <section v-if="itemId === 'chartHeat'" class="glass-card">
          <div class="card-header">
            <div class="card-title">矿藏分布热力</div>
          </div>
          <div class="card-body">
            <div v-show="selectedMine.mine_id" ref="heatmapChartEl" class="chart-box" />
            <div v-if="!selectedMine.mine_id" class="empty-state">
              <span>暂无分布数据</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Dialogs -->
    <Transition name="fade">
      <div v-if="confirm.open" class="modal-backdrop" @click="confirm.open = false">
        <div class="glass-card modal-card" @click.stop>
          <div class="card-header">
            <div class="card-title">{{ confirm.title }}</div>
          </div>
          <div class="card-body">
            <p>{{ confirm.message }}</p>
            <div class="modal-actions">
              <button class="btn ghost" @click="confirm.open = false">{{ confirm.cancelText }}</button>
              <button class="btn danger" @click="runConfirm">{{ confirm.confirmText }}</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    
    <Transition name="fade">
        <div v-if="mineDetail.open" class="modal-backdrop" @click="mineDetail.open = false">
            <div class="glass-card modal-card wide" @click.stop>
                <div class="card-header">
                    <div class="card-title">矿山详情 · {{ selectedMineLabel }}</div>
                    <button class="close-btn" @click="mineDetail.open = false">✕</button>
                </div>
                <div class="card-body split-body">
                    <div class="detail-list">
                        <div class="kv-row"><span>ID</span><span class="mono">{{ selectedMine.mine_id }}</span></div>
                        <div class="kv-row"><span>面积</span><span class="mono">{{ selectedMine.area }}</span></div>
                        <div class="kv-row"><span>坐标</span><span class="mono">{{ mineCenterText }}</span></div>
                        <div class="kv-row"><span>NDVI</span><span class="mono">{{ formatFixed(selectedMine.ndvi_mean, 3) }}</span></div>
                    </div>
                    <div class="detail-chart">
                        <div ref="ndviChartEl" class="chart-box-sm"></div>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as echarts from 'echarts'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const currentDate = ref('')
const currentTime = ref('')
const currentLayer = ref('base')
const searchMineId = ref('')
const isLoading = ref(true)
const globalError = ref('')

const mapEl = ref(null)
let map = null
let mineLayer = null
let baseMaps = {}

const backend = reactive({ connected: false, latencyMs: null, lastCheckedAt: 0 })
const model = reactive({ state: 'idle', modelKey: 'linear', horizonYears: 6, updateEverySec: 2, alpha: 0.35, confidence: 0.86, lastUpdatedAt: 0 })
const selectedMine = reactive({ mine_id: null, name: null, area: null, center_lat: null, center_lng: null, ndvi_mean: null, ndvi_trend: 0, mk_trend: null, ndvi_data: [] })
const selectedMineLabel = computed(() => selectedMine.name || (selectedMine.mine_id != null ? `矿山 ${selectedMine.mine_id}` : '未选择'))
const mineCenterText = computed(() => (selectedMine.center_lat && selectedMine.center_lng) ? `${Number(selectedMine.center_lat).toFixed(4)}, ${Number(selectedMine.center_lng).toFixed(4)}` : '—')
const mineDetail = reactive({ open: false })
const confirm = reactive({ open: false, title: '', message: '', confirmText: '确认', cancelText: '取消', onConfirm: null })
const metrics = reactive({ endIndex: '—', potentialScore: '—', riskLevel: '—', dataFreshness: '—' })

const stackOrder = ref(['mapCtrl', 'modelCtrl', 'metrics', 'chartPred', 'chartHeat'])
let draggedIndex = -1

const ndviChartEl = ref(null)
const predictionChartEl = ref(null)
const heatmapChartEl = ref(null)
let ndviChart = null
let predictionChart = null
let heatmapChart = null
let modelTimer = null

// Helper functions
const formatFixed = (v, d) => Number(v) ? Number(v).toFixed(d) : '—'
const updateDateTime = () => {
    const now = new Date()
    currentDate.value = now.toLocaleDateString('zh-CN')
    currentTime.value = now.toLocaleTimeString('zh-CN')
}

// Map Logic
const initMap = async () => {
  if (map) return
  map = L.map(mapEl.value, {
    zoomControl: false,
    attributionControl: false
  }).setView([24.48, 103.09], 12)

  baseMaps = {
    base: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
  }

  baseMaps.base.addTo(map)
  map.on('zoomend', onZoomEnd)
  
  // Try to load data
  await loadMinesData()
}

const onZoomEnd = () => {
    const z = map.getZoom()
    if (mineLayer) {
        const opacity = z < 10 ? 0.4 : 0.8
        const fillOpacity = z < 10 ? 0.05 : 0.2
        mineLayer.setStyle({ opacity, fillOpacity })
    }
}

const switchLayer = (key) => {
  if (currentLayer.value === key) return
  map.removeLayer(baseMaps[currentLayer.value])
  currentLayer.value = key
  baseMaps[key].addTo(map)
}

const loadMinesData = async () => {
    isLoading.value = true
    globalError.value = ''
    try {
        const res = await axios.get(`${API_BASE}/api/geojson`)
        if (mineLayer) map.removeLayer(mineLayer)
        
        mineLayer = L.geoJSON(res.data, {
            style: { color: '#0ea5e9', weight: 1, opacity: 0.6, fillOpacity: 0.1 },
            onEachFeature: (feature, layer) => {
                layer.on('click', () => setSelectedMineFromFeature(feature))
            }
        }).addTo(map)
        
        if (res.data.features.length > 0) map.fitBounds(mineLayer.getBounds())
        backend.connected = true
    } catch (e) {
        console.error("Failed to load mines", e)
        globalError.value = '无法连接到数据服务，请检查后端状态'
        backend.connected = false
    } finally {
        isLoading.value = false
    }
}

const setSelectedMineFromFeature = async (feature) => {
    const p = feature.properties
    selectedMine.mine_id = p.FID_1
    // 优先使用 name，否则尝试组合位置信息，最后兜底 ID
    selectedMine.name = p.name || p.mine_name || (p.XIAN ? `${p.XIAN}矿山 ${p.FID_1}` : `矿山 ${p.FID_1}`)
    // 优先使用 area，否则使用 dali.geojson 特有的 TBTYMJ (图斑投影面积)
    selectedMine.area = p.area || p.TBTYMJ || '—'
    
    // Mock Data for visualization
    selectedMine.ndvi_trend = (Math.random() * 0.1) - 0.05
    metrics.endIndex = (Math.random() * 100 + 100).toFixed(0)
    metrics.potentialScore = (Math.random() * 10).toFixed(1)
    metrics.riskLevel = Math.random() > 0.7 ? 'High' : 'Low'
    
    mineDetail.open = true
    await nextTick()
    renderNdviChart()
    // Re-render other charts to ensure they have data
    renderPredictionChart()
    renderHeatmapChart()
}

// Drag Handlers
const onDragStart = (e, index) => {
    draggedIndex = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.dropEffect = 'move'
    e.target.style.opacity = '0.4'
}

const onDrop = async (e, dropIndex) => {
    e.target.style.opacity = '1'
    if (draggedIndex === -1 || draggedIndex === dropIndex) return
    
    const item = stackOrder.value[draggedIndex]
    stackOrder.value.splice(draggedIndex, 1)
    stackOrder.value.splice(dropIndex, 0, item)
    draggedIndex = -1
    
    await nextTick()
    renderPredictionChart()
    renderHeatmapChart()
}

// Charts
const renderPredictionChart = () => {
    if (!predictionChartEl.value || !selectedMine.mine_id) return
    if (!predictionChart) predictionChart = echarts.init(predictionChartEl.value)
    predictionChart.setOption({
        backgroundColor: 'transparent',
        grid: { top: 10, bottom: 20, left: 30, right: 10 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ['2021', '2022', '2023', '2024', '2025'], axisLine: { lineStyle: { color: '#555' } } },
        yAxis: { type: 'value', splitLine: { show: false }, axisLabel: { color: '#888' } },
        series: [{ type: 'line', data: [120, 132, 101, 134, 90], smooth: true, itemStyle: { color: '#0ea5e9' }, areaStyle: { opacity: 0.1 } }]
    })
    predictionChart.resize()
}

const renderHeatmapChart = () => {
    if (!heatmapChartEl.value || !selectedMine.mine_id) return
    if (!heatmapChart) heatmapChart = echarts.init(heatmapChartEl.value)
    heatmapChart.setOption({
        backgroundColor: 'transparent',
        grid: { top: 0, bottom: 0, left: 0, right: 0 },
        series: [{ type: 'treemap', data: [{name: 'Zone A', value: 40}, {name: 'Zone B', value: 20}, {name: 'Zone C', value: 15}], itemStyle: { borderColor: '#111' }, label: { show: true } }]
    })
    heatmapChart.resize()
}

const renderNdviChart = () => {
    if (!ndviChartEl.value) return
    if (!ndviChart) ndviChart = echarts.init(ndviChartEl.value)
    ndviChart.setOption({
        backgroundColor: 'transparent',
        grid: { top: 10, bottom: 20, left: 30, right: 10 },
        xAxis: { type: 'category', data: ['2018', '2020', '2022', '2024'], axisLine: { lineStyle: { color: '#555' } } },
        yAxis: { type: 'value', splitLine: { show: false } },
        series: [{ type: 'bar', data: [0.4, 0.5, 0.45, 0.6], itemStyle: { color: '#10b981' } }]
    })
    ndviChart.resize()
}

// Actions
const startModel = () => { 
    model.state = 'running'
    modelTimer = setInterval(() => { 
        model.lastUpdatedAt = Date.now()
        // Mock update
        if (predictionChart) {
            const opt = predictionChart.getOption()
            if (opt && opt.series && opt.series[0]) {
                const data = opt.series[0].data
                data.shift()
                data.push(Math.random() * 100 + 50)
                predictionChart.setOption({ series: [{ data }] })
            }
        }
    }, model.updateEverySec * 1000) 
}
const pauseModel = () => { model.state = 'paused'; clearInterval(modelTimer) }
const confirmStopModel = () => { confirm.open = true; confirm.title='停止模型'; confirm.message='确定要停止当前预测模型吗？'; confirm.onConfirm = () => { pauseModel(); model.state='idle'; confirm.open=false } }
const runConfirm = () => { if (confirm.onConfirm) confirm.onConfirm() }
const searchMineById = () => { 
    alert(`Searching for ${searchMineId.value}... (Ensure backend is connected)`)
}

onMounted(async () => {
    updateDateTime()
    setInterval(updateDateTime, 1000)
    await nextTick()
    await initMap()
    // Initial resize to ensure charts fit
    onResize()
    window.addEventListener('resize', onResize)
})

let resizeTimer = null
const onResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
        predictionChart?.resize()
        heatmapChart?.resize()
        ndviChart?.resize()
    }, 200)
}

onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    if (modelTimer) clearInterval(modelTimer)
    if (map) {
        map.remove()
        map = null
    }
    if (resizeTimer) clearTimeout(resizeTimer)
})
</script>

<style scoped>
/* Fullscreen Layout */
.terminal-fullscreen {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #000;
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
  color: #fff;
}

.map-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #111;
}

/* Header Overlay */
.topbar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.9), transparent);
  z-index: 20;
  pointer-events: none;
}
.topbar-overlay > * { pointer-events: auto; }

.brand-title { font-size: 20px; font-weight: 700; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
.brand-subtitle { font-size: 10px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; }

.topbar-status { display: flex; gap: 20px; align-items: center; font-size: 12px; color: rgba(255,255,255,0.8); }
.status-item { display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 100px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #666; transition: all 0.3s; }
.status-dot.active { background: #00ff88; box-shadow: 0 0 8px #00ff88; }
.datetime { font-family: monospace; font-size: 14px; }

/* Loading & Error */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(5px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #0ea5e9;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 14px; color: #ccc; letter-spacing: 1px; }

.error-toast {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  backdrop-filter: blur(4px);
}
.close-toast { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; opacity: 0.8; }

/* Right Floating Stack */
.floating-stack {
  position: absolute;
  top: 70px;
  right: 15px;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 10;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  padding-bottom: 20px;
  scrollbar-width: none;
}
.floating-stack::-webkit-scrollbar { display: none; }

/* Glass Card */
.glass-card {
  width: 100%;
  background: rgba(18, 24, 38, 0.80);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  flex-shrink: 0;
}

.glass-card:hover { border-color: rgba(255,255,255,0.15); box-shadow: 0 8px 30px rgba(0,0,0,0.3); transform: translateY(-2px); }
.glass-card:active { transform: scale(0.99); }
.glass-card[draggable="true"] { cursor: grab; }
.glass-card[draggable="true"]:active { cursor: grabbing; }

.card-header { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); }
.card-title { font-size: 13px; font-weight: 600; color: #e2e8f0; letter-spacing: 0.5px; }
.card-body { padding: 18px; }

/* Components */
.layer-switch { display: flex; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 3px; margin-bottom: 14px; }
.layer-btn { flex: 1; background: transparent; border: none; color: #94a3b8; padding: 6px; font-size: 12px; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
.layer-btn.active { background: rgba(255,255,255,0.15); color: #fff; font-weight: 600; shadow: 0 2px 4px rgba(0,0,0,0.1); }

.search-box { display: flex; gap: 8px; }
.search-box input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 8px 12px; font-size: 12px; transition: border-color 0.2s; }
.search-box input:focus { outline: none; border-color: #0ea5e9; }
.icon-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; color: #fff; width: 34px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.icon-btn:hover { background: rgba(255,255,255,0.1); }

.compact-form { display: flex; flex-direction: column; gap: 14px; }
.form-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #cbd5e1; }
.form-row select, .form-row input[type="range"] { width: 60%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px; border-radius: 4px; }
.action-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px; }
.btn { border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: 0.2s; color: #fff; text-align: center; }
.btn.primary { background: linear-gradient(135deg, #0ea5e9, #0284c7); box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3); }
.btn.primary:hover { filter: brightness(1.1); }
.btn.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
.btn.danger { background: linear-gradient(135deg, #ef4444, #dc2626); }
.btn.ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }

.metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.metric-item { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); }
.m-label { font-size: 10px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.m-val { font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #f1f5f9; }
.m-val.blue { color: #38bdf8; text-shadow: 0 0 10px rgba(56, 189, 248, 0.3); }
.m-val.orange { color: #fb923c; text-shadow: 0 0 10px rgba(251, 146, 60, 0.3); }
.m-val.good { color: #34d399; }
.m-val.bad { color: #f87171; }

.chart-box { height: 140px; width: 100%; }
.chart-box-sm { height: 160px; width: 100%; }
.empty-state { height: 140px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 12px; background: rgba(0,0,0,0.2); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.1); }

.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: fade-in 0.2s ease; }
.modal-card { width: 420px; max-width: 90vw; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); }
.modal-card.wide { width: 640px; }
.split-body { display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; }
.kv-row { display: flex; justify-content: space-between; font-size: 13px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.mono { font-family: 'JetBrains Mono', monospace; color: #e2e8f0; }
.close-btn { background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; opacity: 0.6; transition: opacity 0.2s; }
.close-btn:hover { opacity: 1; }

.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Responsive Design */
@media (max-width: 980px) {
  .topbar-status { display: none; }
  .floating-stack {
    top: auto;
    bottom: 0;
    right: 0;
    left: 0;
    width: 100%;
    max-height: 45vh;
    padding: 15px;
    background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4));
    backdrop-filter: blur(5px);
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    align-items: flex-end;
    gap: 15px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  .draggable-wrapper {
    height: 100%;
    flex-shrink: 0;
  }
  .glass-card {
    width: 300px;
    height: 100%;
    max-height: 100%;
    overflow-y: auto;
  }
  .modal-card.wide { grid-template-columns: 1fr; width: 90vw; }
  .split-body { grid-template-columns: 1fr; }
}
</style>