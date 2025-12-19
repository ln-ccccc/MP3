import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8000;

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json());

// 数据库连接配置（从.env读取，提供默认值）
const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD ?? '',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : (process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const dbName = process.env.DB_NAME || process.env.MYSQL_DB || process.env.MYSQL_DATABASE || 'mine_db';

let pool;

// 初始化数据库：创建库、表并导入GeoJSON
async function initDatabase() {
  // 1. 先连接到 MySQL Server (不指定数据库) 创建数据库
  const tempConnection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    port: dbConfig.port
  });
  
  try {
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`数据库 ${dbName} 检查/创建完成`);
  } finally {
    await tempConnection.end();
  }

  // 2. 创建连接池 (连接到具体数据库)
  pool = mysql.createPool({ ...dbConfig, database: dbName });
  console.log('MySQL 连接池已创建:', { host: dbConfig.host, user: dbConfig.user, database: dbName });

  // 3. 创建表
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS mines_geojson (
      fid_1 INT PRIMARY KEY,
      mine_name VARCHAR(255),
      geometry LONGTEXT NOT NULL,
      properties LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await pool.query(createTableSQL);
  
  // 4. 创建NDVI数据表 (如果不存在) - 简单结构示例
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ndvi_data (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fid INT NOT NULL,
      year INT NOT NULL,
      ndvi_value FLOAT,
      INDEX idx_fid (fid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 5. 如果表为空则尝试导入本地GeoJSON
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM mines_geojson');
  if (rows[0].count === 0) {
    const filePath = path.resolve(process.cwd(), process.env.GEOJSON_PATH || 'dali.geojson');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const collection = JSON.parse(raw);
      if (collection && collection.features && Array.isArray(collection.features)) {
        let successCount = 0;
        for (const feat of collection.features) {
          const fid = feat.properties?.FID_1;
          const name = feat.properties?.mine_name || feat.properties?.name || `FID_${fid}`;
          if (!fid) continue; // 必须有FID_1
          
          try {
             await pool.query(
              'INSERT INTO mines_geojson (fid_1, mine_name, geometry, properties) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE mine_name = VALUES(mine_name), geometry = VALUES(geometry), properties = VALUES(properties)',
              [fid, name, JSON.stringify(feat.geometry), JSON.stringify(feat.properties || {})]
            );
            successCount++;
          } catch (err) {
            console.error(`导入 FID ${fid} 失败:`, err.message);
          }
        }
        console.log(`导入GeoJSON完成，成功 ${successCount}/${collection.features.length} 条。`);
      }
    } else {
      console.warn('未找到GeoJSON文件，跳过导入：', filePath);
    }
  }
}

// 测试并初始化
(async () => {
  try {
    await initDatabase();
    console.log('数据库初始化全部完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
})();

// 返回完整GeoJSON集合
app.get('/api/geojson', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT fid_1, mine_name, geometry, properties FROM mines_geojson');
    console.log('mines_geojson rows:', rows.length);
    const features = [];
    for (const r of rows) {
      try {
        const props = r.properties ? JSON.parse(r.properties) : {};
        const geom = JSON.parse(r.geometry);
        features.push({
          type: 'Feature',
          properties: { FID_1: r.fid_1, mine_name: r.mine_name, ...props },
          geometry: geom
        });
      } catch (rowErr) {
        console.warn('跳过无效记录 fid_1=', r.fid_1, rowErr.message);
        continue;
      }
    }
    console.log('features built:', features.length);
    res.json({ type: 'FeatureCollection', features });
  } catch (error) {
    console.error('获取GeoJSON失败:', error?.message || error);
    res.status(500).json({ error: '获取GeoJSON失败' });
  }
});

// 根据FID_1或名称搜索矿山
app.get('/api/mines/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: '缺少查询参数q' });
    const fid = parseInt(q, 10);
    let rows;
    if (!isNaN(fid)) {
      [rows] = await pool.query('SELECT fid_1, mine_name, geometry, properties FROM mines_geojson WHERE fid_1 = ?', [fid]);
    } else {
      [rows] = await pool.query('SELECT fid_1, mine_name, geometry, properties FROM mines_geojson WHERE mine_name LIKE ?', [`%${q}%`]);
    }
    if (rows.length === 0) return res.status(404).json({ error: '未找到矿山' });
    const r = rows[0];
    res.json({
      type: 'Feature',
      properties: { FID_1: r.fid_1, mine_name: r.mine_name, ...(r.properties ? JSON.parse(r.properties) : {}) },
      geometry: JSON.parse(r.geometry)
    });
  } catch (error) {
    console.error('搜索矿山失败:', error);
    res.status(500).json({ error: '搜索矿山失败' });
  }
});

// NDVI与趋势分析（沿用现有ndvi_data结构）
app.get('/api/mines/ndvi', async (req, res) => {
  const { fid } = req.query;
  if (!fid) return res.status(400).json({ error: '缺少FID参数' });
  try {
    const [rows] = await pool.query(
      'SELECT year, ndvi_value FROM ndvi_data WHERE fid = ? ORDER BY year',
      [fid]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: '该FID无NDVI数据' });
    }

    const values = rows.map(r => Number(r.ndvi_value)).filter(v => Number.isFinite(v));
    const years = rows.map(r => Number(r.year));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    // 简单线性回归斜率（year vs ndvi_value）
    const n = values.length;
    const sumX = years.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = years.reduce((acc, x, i) => acc + x * values[i], 0);
    const sumXX = years.reduce((acc, x) => acc + x * x, 0);
    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const mkTrend = slope > 0.0005 ? '上升趋势' : (slope < -0.0005 ? '下降趋势' : '无趋势');

    res.json({
      fid: parseInt(fid, 10),
      ndvi_data: rows,
      ndvi_mean: Number(mean.toFixed(3)),
      ndvi_trend: Number(slope.toFixed(5)),
      mk_trend: mkTrend
    });
  } catch (error) {
    console.error('获取NDVI数据失败:', error);
    res.status(500).json({ error: '获取NDVI数据失败' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
