// server.js —— 康诊在线 · 后端服务
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- 中间件 ---------------- */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- 数据库 ---------------- */
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    })
  );

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error('[API ERROR]', err);
    res.status(500).json({ success: false, error: '服务异常，请稍后重试' });
  });

/* ---------------- 科室配置 ---------------- */
const DEPARTMENTS = [
  { name: '内科', icon: '🫀', desc: '感冒发热 · 高血压' },
  { name: '外科', icon: '🩹', desc: '外伤处理 · 术后护理' },
  { name: '儿科', icon: '🧒', desc: '小儿感冒 · 喂养指导' },
  { name: '妇产科', icon: '🤰', desc: '月经不调 · 孕期咨询' },
  { name: '皮肤科', icon: '🧴', desc: '湿疹 · 痤疮 · 过敏' },
  { name: '五官科', icon: '👂', desc: '咽痛 · 鼻炎 · 耳鸣' },
  { name: '骨科', icon: '🦴', desc: '颈肩腰腿痛' },
  { name: '心理科', icon: '🧠', desc: '焦虑 · 失眠 · 情绪' }
];

/* ---------------- 医生种子数据 ---------------- */
const SEED_DOCTORS = [
  ['张明远', '主任医师', '内科', '市第一人民医院', '👨‍⚕️', '高血压、糖尿病、慢性咳嗽、心脑血管疾病',
    '从事内科临床工作 30 余年，擅长心脑血管及呼吸系统常见病、多发病的诊治。', 4.9, 2864, 0, 1],
  ['李慧敏', '副主任医师', '内科', '市中心医院', '👩‍⚕️', '感冒发热、胃肠不适、慢性胃炎',
    '医学硕士，专注消化系统疾病诊疗 15 年，问诊耐心细致。', 4.8, 1932, 0, 1],
  ['王建国', '主任医师', '外科', '市人民医院', '👨‍⚕️', '外伤处理、术后护理、甲状腺结节',
    '普外科主任医师，手术经验丰富，擅长术后康复指导。', 4.9, 1521, 0, 1],
  ['陈晓婷', '主治医师', '儿科', '市儿童医院', '👩‍⚕️', '小儿感冒发热、腹泻、湿疹、喂养指导',
    '儿科临床 10 年，擅长新生儿及婴幼儿常见病诊疗，亲和力强。', 4.9, 3410, 0, 1],
  ['刘雅雯', '副主任医师', '妇产科', '市妇幼保健院', '👩‍⚕️', '月经不调、孕期保健、妇科炎症',
    '妇产科副主任医师，专注女性健康管理，累计问诊超过 5000 例。', 4.8, 2245, 0, 1],
  ['赵子轩', '主治医师', '皮肤科', '市第一人民医院', '👨‍⚕️', '湿疹、痤疮、荨麻疹、过敏性皮炎',
    '皮肤性病学硕士，擅长慢性皮肤病长期管理方案制定。', 4.7, 1786, 0, 1],
  ['孙丽', '主任医师', '五官科', '市中医医院', '👩‍⚕️', '慢性咽炎、过敏性鼻炎、中耳炎',
    '中西医结合治疗耳鼻喉疾病 20 余年。', 4.8, 1345, 0, 1],
  ['周振华', '副主任医师', '骨科', '市人民医院', '👨‍⚕️', '颈椎病、腰椎间盘突出、运动损伤',
    '骨科副主任医师，擅长保守治疗方案与康复训练指导。', 4.8, 1108, 0, 1],
  ['吴思远', '心理治疗师', '心理科', '市心理健康中心', '👨‍⚕️', '焦虑、失眠、压力管理、情绪调节',
    '国家二级心理咨询师，累计咨询时长 4000+ 小时。', 4.9, 896, 0, 1],
  ['郑佳怡', '主治医师', '内科', '社区卫生服务中心', '👩‍⚕️', '常见病初诊、慢病随访、健康咨询',
    '全科主治医师，擅长日常健康管理与就医指导。', 4.7, 652, 0, 1]
];

/* ---------------- 建表 & 初始化 ---------------- */
async function addColumnIfMissing(table, column, definition) {
  const cols = await all(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initDB() {
  await run(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT,
      department TEXT,
      hospital TEXT,
      avatar TEXT,
      good_at TEXT,
      intro TEXT,
      rating REAL DEFAULT 5.0,
      consult_count INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      online INTEGER DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      symptoms TEXT NOT NULL,
      duration TEXT,
      history TEXT,
      contact TEXT,
      reply TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      replied_at DATETIME
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consult_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await addColumnIfMissing('consultations', 'doctor_id', 'INTEGER');
  await addColumnIfMissing('consultations', 'status', "TEXT DEFAULT 'pending'");

  const cnt = await get('SELECT COUNT(*) AS n FROM doctors');
  if (!cnt || cnt.n === 0) {
    for (const d of SEED_DOCTORS) {
      await run(
        `INSERT INTO doctors (name, title, department, hospital, avatar, good_at, intro, rating, consult_count, price, online)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        d
      );
    }
    console.log('已写入示例医生数据');
  }
}

/* ==================== 接口 ==================== */

app.get('/api/departments', wrap(async (req, res) => {
  const rows = await all('SELECT department AS name, COUNT(*) AS n FROM doctors GROUP BY department');
  const map = Object.fromEntries(rows.map((r) => [r.name, r.n]));
  res.json(DEPARTMENTS.map((d) => ({ ...d, doctors: map[d.name] || 0 })));
}));

app.get('/api/stats', wrap(async (req, res) => {
  const d = await get('SELECT COUNT(*) AS n FROM doctors');
  const c = await get('SELECT COUNT(*) AS n FROM consultations');
  const p = await get("SELECT COUNT(*) AS n FROM consultations WHERE status = 'pending'");
  res.json({ doctors: d.n, consults: c.n, pending: p.n });
}));

app.get('/api/doctors', wrap(async (req, res) => {
  const { department, keyword } = req.query;
  let sql = 'SELECT * FROM doctors WHERE 1 = 1';
  const params = [];

  if (department) {
    sql += ' AND department = ?';
    params.push(department);
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR good_at LIKE ? OR hospital LIKE ? OR department LIKE ?)';
    const like = `%${keyword}%`;
    params.push(like, like, like, like);
  }

  sql += ' ORDER BY online DESC, rating DESC, consult_count DESC';
  res.json(await all(sql, params));
}));

app.get('/api/doctors/:id', wrap(async (req, res) => {
  const doctor = await get('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
  if (!doctor) return res.status(404).json({ success: false, error: '医生不存在' });
  res.json(doctor);
}));

app.post('/api/consultation', wrap(async (req, res) => {
  const { doctor_id, name, age, gender, symptoms, duration, history, contact } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: '请填写姓名' });
  }
  if (!symptoms || !String(symptoms).trim()) {
    return res.status(400).json({ success: false, error: '请填写主要症状' });
  }

  let doctor = doctor_id ? await get('SELECT * FROM doctors WHERE id = ?', [doctor_id]) : null;
  if (!doctor) {
    doctor = await get('SELECT * FROM doctors WHERE online = 1 ORDER BY RANDOM() LIMIT 1');
  }
  if (!doctor) doctor = await get('SELECT * FROM doctors ORDER BY RANDOM() LIMIT 1');

  const r = await run(
    `INSERT INTO consultations (doctor_id, name, age, gender, symptoms, duration, history, contact, status)
     VALUES (?,?,?,?,?,?,?,?, 'pending')`,
    [
      doctor ? doctor.id : null,
      String(name).trim(),
      age ? Number(age) : null,
      gender || '',
      String(symptoms).trim(),
      duration || '',
      history || '',
      contact || ''
    ]
  );

  let first = `【主诉】${String(symptoms).trim()}`;
  if (duration) first += `\n【持续时间】${duration}`;
  if (history) first += `\n【既往史】${history}`;
  await run(`INSERT INTO messages (consult_id, role, content) VALUES (?, 'patient', ?)`, [r.lastID, first]);
  await run(`INSERT INTO messages (consult_id, role, content) VALUES (?, 'system', ?)`,
    [r.lastID, '问诊已提交，医生正在查看，请稍候…']);

  res.json({ success: true, id: r.lastID, doctor_id: doctor ? doctor.id : null });
}));

app.get('/api/consult/:id', wrap(async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.json({ success: false, msg: '问诊编号格式不正确' });
  }

  const row = await get(
    `SELECT c.*, d.name AS doctor_name, d.title AS doctor_title, d.department AS doctor_department,
            d.hospital AS doctor_hospital, d.avatar AS doctor_avatar, d.good_at AS doctor_good_at
     FROM consultations c
     LEFT JOIN doctors d ON c.doctor_id = d.id
     WHERE c.id = ?`,
    [id]
  );

  if (!row) return res.json({ success: false, msg: '找不到这条问诊，请核对编号' });

  const messages = await all('SELECT * FROM messages WHERE consult_id = ? ORDER BY id ASC', [id]);
  res.json({ success: true, data: row, messages });
}));

app.post('/api/consult/:id/messages', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { content } = req.body || {};

  if (!content || !String(content).trim()) {
    return res.status(400).json({ success: false, msg: '内容不能为空' });
  }

  const row = await get('SELECT id, status FROM consultations WHERE id = ?', [id]);
  if (!row) return res.json({ success: false, msg: '问诊不存在' });

  await run('INSERT INTO messages (consult_id, role, content) VALUES (?, \'patient\', ?)',
    [id, String(content).trim()]);
  res.json({ success: true });
}));

app.post('/api/consultation/:id/reply', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { reply } = req.body || {};

  if (!reply || !String(reply).trim()) {
    return res.status(400).json({ success: false, error: '回复内容不能为空' });
  }

  const row = await get('SELECT id FROM consultations WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ success: false, error: '问诊不存在' });

  const text = String(reply).trim();
  await run(
    `UPDATE consultations SET reply = ?, status = 'answered', replied_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [text, id]
  );
  await run('INSERT INTO messages (consult_id, role, content) VALUES (?, \'doctor\', ?)', [id, text]);

  res.json({ success: true });
}));

app.post('/api/consultation/:id/close', wrap(async (req, res) => {
  await run("UPDATE consultations SET status = 'closed' WHERE id = ?", [req.params.id]);
  res.json({ success: true });
}));

app.get('/api/consultations', wrap(async (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT c.*, d.name AS doctor_name, d.department AS doctor_department
    FROM consultations c
    LEFT JOIN doctors d ON c.doctor_id = d.id
    WHERE 1 = 1`;
  const params = [];

  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }

  sql += " ORDER BY CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END, datetime(c.created_at) DESC";
  res.json(await all(sql, params));
}));

/* ---------------- 启动 ---------------- */
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ 康诊在线已启动：http://localhost:${PORT}`);
      console.log(`👨‍⚕️ 医生工作台：http://localhost:${PORT}/doctor.html`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败：', err);
    process.exit(1);
  });