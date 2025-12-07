<template>
  <div>
    <Tabinfor>
      <template #left>
        <div id="sub-title">指数计算<i class="icon-click" /></div>
      </template>
      <template #mid>
        <el-radio-group v-model="indexType">
          <el-radio label="NDVI">NDVI</el-radio>
          <el-radio label="NDWI">NDWI</el-radio>
          <el-radio label="NDBI">NDBI</el-radio>
        </el-radio-group>
      </template>
      <template #right>
        <el-button type="primary" class="btn-animate2 btn-animate__surround" :loading="computing" :disabled="computing" @click="computeIndex">计算指数</el-button>
        <el-button type="success" style="margin-left:12px" :disabled="computing" @click="triggerPickDir">选择测试文件夹</el-button>
      </template>
    </Tabinfor>
    <el-divider />

    <el-card style="border: 4px dashed var(--el-border-color);position: relative">
      <div class="upload-box">
        <div class="upload-item" v-if="indexType==='NDVI'">
          <div class="upload-title"><i class="iconfont icon-upload-new" />红波段</div>
          <el-upload ref="uploadRed" v-model:file-list="fileListRed" drag :auto-upload="false" :limit="1" accept=".jp2">
            <i class="el-icon-upload" />
            <div class="el-upload__text">拖拽或点击上传红波段</div>
          </el-upload>
        </div>
        <div class="upload-item" v-if="indexType==='NDVI'">
          <div class="upload-title"><i class="iconfont icon-upload-new" />近红外波段</div>
          <el-upload ref="uploadNIR" v-model:file-list="fileListNIR_NDVI" drag :auto-upload="false" :limit="1" accept=".jp2">
            <i class="el-icon-upload" />
            <div class="el-upload__text">拖拽或点击上传近红外</div>
          </el-upload>
        </div>

        <div class="upload-item" v-if="indexType==='NDWI'">
          <div class="upload-title"><i class="iconfont icon-upload-new" />绿波段</div>
          <el-upload ref="uploadGreen" v-model:file-list="fileListGreen" drag :auto-upload="false" :limit="1" accept=".jp2">
            <i class="el-icon-upload" />
            <div class="el-upload__text">拖拽或点击上传绿波段</div>
          </el-upload>
        </div>
        <div class="upload-item" v-if="indexType==='NDWI'">
          <div class="upload-title"><i class="iconfont icon-upload-new" />近红外波段</div>
          <el-upload ref="uploadNIR2" v-model:file-list="fileListNIR_NDWI" drag :auto-upload="false" :limit="1" accept=".jp2">
            <i class="el-icon-upload" />
            <div class="el-upload__text">拖拽或点击上传近红外</div>
          </el-upload>
        </div>

        <div class="upload-item" v-if="indexType==='NDBI'">
          <div class="upload-title"><i class="iconfont icon-upload-new" />短波红外</div>
          <el-upload ref="uploadSWIR" v-model:file-list="fileListSWIR" drag :auto-upload="false" :limit="1" accept=".jp2">
            <i class="el-icon-upload" />
            <div class="el-upload__text">拖拽或点击上传短波红外</div>
          </el-upload>
        </div>
        <div class="upload-item" v-if="indexType==='NDBI'">
          <div class="upload-title"><i class="iconfont icon-upload-new" />近红外波段</div>
          <el-upload ref="uploadNIR3" v-model:file-list="fileListNIR_NDBI" drag :auto-upload="false" :limit="1" accept=".jp2">
            <i class="el-icon-upload" />
            <div class="el-upload__text">拖拽或点击上传近红外</div>
          </el-upload>
        </div>
      </div>
    </el-card>

    <Tabinfor>
      <template #left>
        <div id="sub-title" style="font-size: 25px">结果图预览<i class="iconfont icon-dianji" /></div>
      </template>
      <template #right>
        <el-button v-if="resultUrl" @click="downloadResult">下载结果</el-button>
      </template>
    </Tabinfor>
    <el-divider />
    <el-row justify="center">
      <el-col :xs="24" :sm="24" :md="12" :lg="10" :xl="8">
        <el-image v-if="resultUrl" :src="resultUrl" :preview-src-list="[resultUrl]" :preview-teleported="true" />
        <div v-else class="hint">请上传所需波段并点击计算</div>
      </el-col>
    </el-row>
  </div>
  <input ref="dirInput" type="file" webkitdirectory multiple style="display:none" @change="onDirPicked" />
  
</template>

<script>
import Tabinfor from '@/components/Tabinfor'
import { downloadimgWithWords } from '@/utils/download'
import { OpenJPEGWASM, OpenJPEGJS } from '@cornerstonejs/codec-openjpeg'

export default {
  name: 'Indexcalculator',
  components: { Tabinfor },
  data(){
    return {
      indexType: 'NDVI',
      fileListRed: [],
      fileListNIR_NDVI: [],
      fileListNIR_NDWI: [],
      fileListNIR_NDBI: [],
      fileListGreen: [],
      fileListSWIR: [],
      resultUrl: '',
      resultName: '',
      computing: false,
      jp2Decoder: null,
      jp2ScriptLoaded: false
    }
  },
  methods: {
    extractBandCode(file){
      const name = ((file?.name) || (file?.raw?.name) || '').toUpperCase()
      const m = name.match(/B(\d{2})(?=[_\.\-]|$)/)
      if(m) return `B${m[1]}`
      const m2 = name.match(/B(\d)A(?=[_\.\-]|$)/)
      return m2 ? `B${m2[1]}A` : null
    },
    validateBands(index){
      const isNir = (b) => b==='B08' || b==='B8A'
      if(index==='NDVI'){
        const bRed = this.extractBandCode(this.fileListRed[0])
        const bNir = this.extractBandCode(this.fileListNIR_NDVI[0])
        if(bRed!=='B04' || !isNir(bNir)){
          this.$message.error('NDVI需上传 B04(红) 与 B08/B8A(近红外)')
          return false
        }
      }else if(index==='NDWI'){
        const bGreen = this.extractBandCode(this.fileListGreen[0])
        const bNir = this.extractBandCode(this.fileListNIR_NDWI[0])
        if(bGreen!=='B03' || !isNir(bNir)){
          this.$message.error('NDWI需上传 B03(绿) 与 B08/B8A(近红外)')
          return false
        }
      }else if(index==='NDBI'){
        const bSwir = this.extractBandCode(this.fileListSWIR[0])
        const bNir = this.extractBandCode(this.fileListNIR_NDBI[0])
        if(!(['B11','B12'].includes(bSwir)) || !isNir(bNir)){
          this.$message.error('NDBI需上传 B11/B12(短波红外) 与 B08/B8A(近红外)')
          return false
        }
      }
      return true
    },
    triggerPickDir(){
      const el = this.$refs.dirInput
      if(el && el.click) el.click()
    },
    onDirPicked(e){
      const files = Array.from(e.target.files || [])
      const pick = (re) => files.find(f => re.test(f.name.toLowerCase()))
      const jp2 = (f) => f && f.name.toLowerCase().endsWith('.jp2')
      const red = pick(/b04.*\.jp2$/)
      let nir = pick(/b08.*\.jp2$/) || pick(/b8a.*\.jp2$/)
      const green = pick(/b03.*\.jp2$/)
      const swir = pick(/b1[12].*\.jp2$/)
      if(red && nir && jp2(red) && jp2(nir)){
        this.fileListRed = [{ name: red.name, raw: red }]
        this.fileListNIR_NDVI = [{ name: nir.name, raw: nir }]
        this.indexType='NDVI'
      }
      if(green && nir && jp2(green) && jp2(nir)){
        this.fileListGreen = [{ name: green.name, raw: green }]
        this.fileListNIR_NDWI = [{ name: nir.name, raw: nir }]
      }
      if(swir && nir && jp2(swir) && jp2(nir)){
        this.fileListSWIR = [{ name: swir.name, raw: swir }]
        this.fileListNIR_NDBI = [{ name: nir.name, raw: nir }]
      }
      if(this.fileListRed.length && this.fileListNIR_NDVI.length){ this.computeIndex() }
    },
    async ensureDecoder(){
      if(this.jp2Decoder) return true
      try{
        const lib = (await OpenJPEGWASM) || (await OpenJPEGJS)
        this.jp2Decoder = async (u8) => {
          const ab = u8 instanceof ArrayBuffer ? u8 : u8.buffer
          const encoded = new Uint8Array(ab)
          const dec = new lib.J2KDecoder()
          const encBuf = dec.getEncodedBuffer(encoded.length)
          encBuf.set(encoded)
          dec.decode()
          const fi = dec.getFrameInfo()
          const w = Number(fi?.width ?? fi?.frameWidth ?? fi?.W ?? 0)
          const h = Number(fi?.height ?? fi?.frameHeight ?? fi?.H ?? 0)
          const outBuf = dec.getDecodedBuffer()
          if(!w || !h || !outBuf) throw new Error('invalid_jp2')
          const len = w*h
          let arr
          if(outBuf.length===len){
            arr = new Float32Array(len)
            let maxv = 0; for(let i=0;i<len;i++){ const v = Number(outBuf[i]||0); if(v>maxv) maxv=v }
            const denom = maxv>0?maxv:65535
            for(let i=0;i<len;i++){ arr[i] = Number(outBuf[i]||0)/denom }
          }else if(outBuf.length>=len*3){
            arr = new Float32Array(len)
            let maxv = 0; for(let i=0;i<len;i++){ const v = Number(outBuf[i]||0); if(v>maxv) maxv=v }
            const denom = maxv>0?maxv:255
            for(let i=0;i<len;i++){ arr[i] = Number(outBuf[i]||0)/denom }
          }else{
            throw new Error('unsupported_components')
          }
          return { image: { size: [w,h], data: arr }, width: w, height: h, data: arr }
        }
        return true
      }catch(_e){ }
      try{
        const mod = await (new Function('m','return import(m)'))('openjpeg-wasm')
        const oj = mod?.default ?? mod
        this.jp2Decoder = async (u8) => {
          const ab = u8 instanceof ArrayBuffer ? u8 : u8.buffer
          const decoded = oj.decode(ab)
          const width = Number(decoded?.width || 0)
          const height = Number(decoded?.height || 0)
          const comp = decoded?.components?.[0]?.data
          if(!width || !height || !comp) throw new Error('invalid_jp2')
          const len = width*height
          const arr = new Float32Array(len)
          let maxv = 0
          for(let i=0;i<len;i++){ const v = Number(comp[i]||0); if(v>maxv) maxv=v }
          const denom = maxv>0 ? maxv : 65535
          for(let i=0;i<len;i++){ arr[i] = Number(comp[i]||0)/denom }
          return { image: { size: [width,height], data: arr }, width, height, data: arr }
        }
        return true
      }catch(_e){ }
      try{
        const mod = await (new Function('m','return import(m)'))('@abasb75/jpeg2000-decoder')
        this.jp2Decoder = mod.decode
        return true
      }catch(e){
        
        if(!this.jp2ScriptLoaded){
          await new Promise((resolve) => {
            const s = document.createElement('script')
            const base = (typeof process!=='undefined' && process.env && process.env.BASE_URL) ? process.env.BASE_URL : '/'
            s.src = base.replace(/\/$/,'') + '/libs/openjpeg.js'
            s.onload = () => { this.jp2ScriptLoaded = true; resolve(true) }
            s.onerror = () => resolve(false)
            document.head.appendChild(s)
          })
        }
        
        if(typeof window.openjpeg !== 'function'){
          await new Promise((resolve) => {
            const s2 = document.createElement('script')
            s2.src = 'https://cdn.jsdelivr.net/npm/openjpeg@0.2.3/openjpeg.min.js'
            s2.onload = () => { resolve(true) }
            s2.onerror = () => resolve(false)
            document.head.appendChild(s2)
          })
        }
        
        if(typeof window.openjpeg !== 'function'){
          await new Promise((resolve) => {
            const s3 = document.createElement('script')
            s3.src = 'https://unpkg.com/openjpeg@0.2.3/openjpeg.min.js'
            s3.onload = () => { resolve(true) }
            s3.onerror = () => resolve(false)
            document.head.appendChild(s3)
          })
        }
        if(typeof window.openjpeg === 'function'){
          this.jp2Decoder = async (u8) => {
            const out = window.openjpeg(Array.from(u8), 'jp2')
            
            const w = Number(out.width || out.W || 0)
            const h = Number(out.height || out.H || 0)
            const comp = out.data || out.components || out.component || out.raw
            if(!w || !h || !comp) throw new Error('invalid_jp2')
            const len = w*h
            let arr
            if(comp.length === len){
              arr = new Float32Array(len)
              let maxv = 0; for(let i=0;i<len;i++){ const v = Number(comp[i]||0); if(v>maxv) maxv=v }
              const denom = maxv>0?maxv:65535
              for(let i=0;i<len;i++){ arr[i] = Number(comp[i]||0)/denom }
            }else if(comp.length === len*3){
              
              arr = new Float32Array(len)
              let maxv = 0; for(let i=0;i<len;i++){ const v = Number(comp[i]||0); if(v>maxv) maxv=v }
              const denom = maxv>0?maxv:255
              for(let i=0;i<len;i++){ arr[i] = Number(comp[i]||0)/denom }
            }else{
              throw new Error('unsupported_components')
            }
            return { image: { size: [w,h], data: arr }, width: w, height: h, data: arr }
          }
          return true
        }
        this.$message.error('未能加载JP2解码器：请安装依赖或检查网络以从CDN加载 openjpeg.js')
        return false
      }
    },
    async readImage(file){
      return new Promise((resolve, reject) => {
        const name = (file.name || '')
        const isJP2 = name.toLowerCase().endsWith('.jp2') || (file.type || '').includes('jp2')
        if(isJP2){
          const fr = new FileReader()
          fr.onload = async () => {
            try{
              const buf = fr.result
              if(!(await this.ensureDecoder())){ reject(new Error('decoder_not_ready')); return }
              const decoded = await this.jp2Decoder(new Uint8Array(buf))
              const width = Number(decoded?.image?.size?.[0] ?? decoded?.width ?? decoded?.image?.width ?? 0)
              const height = Number(decoded?.image?.size?.[1] ?? decoded?.height ?? decoded?.image?.height ?? 0)
              let comp = decoded?.image?.data ?? decoded?.data ?? decoded?.components?.[0] ?? decoded?.component?.data
              if(!width || !height || !comp){ throw new Error('invalid_jp2') }
              if(comp && comp.buffer && !(comp instanceof Float32Array) && !(comp instanceof Uint16Array) && !(comp instanceof Uint8Array)) comp = new Uint32Array(comp)
              const len = width*height
              const arr = new Float32Array(len)
              let maxv = 0
              for(let i=0;i<len;i++){ const v = Number(comp[i]||0); if(v>maxv) maxv=v }
              const denom = maxv>0 ? maxv : 65535
              for(let i=0;i<len;i++){ arr[i] = Number(comp[i]||0)/denom }
              if(!(len>0) || arr.length!==len) throw new Error('invalid_size')
              resolve({ width, height, data: arr })
            }catch(e){ reject(e) }
          }
          fr.onerror = reject
          fr.readAsArrayBuffer(file.raw || file)
        }else{
          this.$message.error('仅支持遥感波段文件（.jp2）')
          reject(new Error('unsupported_format'))
        }
      })
    },
    resampleNearest(src, sw, sh, tw, th){
      if(sw===tw && sh===th) return src
      const out = new Float32Array(tw*th)
      for(let y=0;y<th;y++){
        const sy = Math.min(sh-1, Math.round(y*sh/th))
        for(let x=0;x<tw;x++){
          const sx = Math.min(sw-1, Math.round(x*sw/tw))
          out[y*tw + x] = src[sy*sw + sx]
        }
      }
      return out
    },
    toColor(val, palette){
      const v = Math.max(-1, Math.min(1, val))
      const t = (v+1)/2
      let r=0,g=0,b=0
      if(palette==='ndvi'){
        r = Math.floor(255*(1-t))
        g = Math.floor(255*t)
        b = Math.floor(80*(1-t))
      }else if(palette==='ndwi'){
        r = Math.floor(60*(1-t))
        g = Math.floor(180*t)
        b = Math.floor(255*t)
      }else if(palette==='ndbi'){
        r = Math.floor(255*t)
        g = Math.floor(160*(1-t))
        b = Math.floor(60*(1-t))
      }
      return [r,g,b,255]
    },
    async computeIndex(){
      if(this.computing) return
      this.computing = true
      try{
        let a=null,b=null,w=0,h=0,palette='ndvi'
        if(this.indexType==='NDVI'){
          if(!this.fileListRed.length||!this.fileListNIR_NDVI.length){ this.$message.error('请上传红波段与近红外'); this.computing=false; return }
          if(!this.validateBands('NDVI')){ this.computing=false; return }
          const rr = await this.readImage(this.fileListRed[0])
          const nn = await this.readImage(this.fileListNIR_NDVI[0])
          w = Math.min(rr.width, nn.width)
          h = Math.min(rr.height, nn.height)
          a = this.resampleNearest(rr.data, rr.width, rr.height, w, h)
          b = this.resampleNearest(nn.data, nn.width, nn.height, w, h)
          palette='ndvi'
        }else if(this.indexType==='NDWI'){
          if(!this.fileListGreen.length||!this.fileListNIR_NDWI.length){ this.$message.error('请上传绿波段与近红外'); this.computing=false; return }
          if(!this.validateBands('NDWI')){ this.computing=false; return }
          const gg = await this.readImage(this.fileListGreen[0])
          const nn = await this.readImage(this.fileListNIR_NDWI[0])
          w = Math.min(gg.width, nn.width)
          h = Math.min(gg.height, nn.height)
          a = this.resampleNearest(gg.data, gg.width, gg.height, w, h)
          b = this.resampleNearest(nn.data, nn.width, nn.height, w, h)
          palette='ndwi'
        }else{
          if(!this.fileListSWIR.length||!this.fileListNIR_NDBI.length){ this.$message.error('请上传短波红外与近红外'); this.computing=false; return }
          if(!this.validateBands('NDBI')){ this.computing=false; return }
          const ss = await this.readImage(this.fileListSWIR[0])
          const nn = await this.readImage(this.fileListNIR_NDBI[0])
          w = Math.min(ss.width, nn.width)
          h = Math.min(ss.height, nn.height)
          a = this.resampleNearest(ss.data, ss.width, ss.height, w, h)
          b = this.resampleNearest(nn.data, nn.width, nn.height, w, h)
          palette='ndbi'
        }
        if(!(w>0 && h>0)) throw new Error('invalid_size')
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        const imgData = ctx.createImageData(w,h)
        const eps = 1e-6
        for(let i=0;i<w*h;i++){
          const numer = (this.indexType==='NDVI'||this.indexType==='NDWI') ? (b[i]-a[i]) : (a[i]-b[i])
          const denom = (a[i]+b[i])+eps
          const val = numer/denom
          const [r,g,bb,alpha] = this.toColor(val, palette)
          imgData.data[i*4]=r
          imgData.data[i*4+1]=g
          imgData.data[i*4+2]=bb
          imgData.data[i*4+3]=alpha
        }
        ctx.putImageData(imgData,0,0)
        this.resultUrl = canvas.toDataURL('image/png')
        this.resultName = `${this.indexType}_result.png`
        this.$message.success('计算完成')
      }catch(e){
        this.$message.error('计算失败')
      }finally{
        this.computing = false
      }
    },
    downloadResult(){
      downloadimgWithWords(-1, this.resultUrl, this.resultName)
    }
  }
}
</script>

<style scoped>
.upload-box{ display:flex; gap:20px; flex-wrap:wrap }
.upload-item{ width: 360px }
.upload-title{ font-weight: 600; margin-bottom: 8px }
.hint{ color:#999; text-align:center; padding:40px 0 }
</style>
