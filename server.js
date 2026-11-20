// API เข้าสู่ระบบสำหรับใบงาน Expo: /api/login, /api/register, /api/me
// ไม่ตั้ง MONGODB_URI = ใช้บัญชีตัวอย่างในหน่วยความจำ (ทดสอบในเครื่อง)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./user');

const PROD = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (PROD ? null : 'dev-only-secret');
if (!JWT_SECRET) { console.error('ต้องตั้ง JWT_SECRET ก่อนรันแบบ production'); process.exit(1); }
const MONGODB_URI = process.env.MONGODB_URI;

// บัญชีตัวอย่างในหน่วยความจำ ใช้เมื่อไม่มีฐานข้อมูลเท่านั้น
let memUsers = null;
async function loadMemUsers() {
  const seed = require('./seed-users.example.json');
  memUsers = await Promise.all(seed.map(async u => ({ ...u, password: undefined, passwordHash: await bcrypt.hash(u.password, 10) })));
}
async function findUser(username) {
  if (memUsers) return memUsers.find(u => u.username === username) || null;
  return User.findOne({ username }).lean();
}
// คืน false ถ้าชื่อผู้ใช้ซ้ำ
async function createUser(u) {
  if (memUsers) {
    if (memUsers.some(x => x.username === u.username)) return false;
    memUsers.push(u);
    return true;
  }
  try { await User.create(u); return true; }
  catch (e) { if (e.code === 11000) return false; throw e; }
}
// ฐานข้อมูลใหม่ที่ยังไม่มีผู้ใช้ ใส่บัญชีตัวอย่างให้ (นักเรียนไม่ต้องรัน npm run seed เอง)
async function seedIfEmpty() {
  if (await User.estimatedDocumentCount() > 0) return;
  const seed = require('./seed-users.example.json');
  for (const u of seed)
    await User.create({ username: u.username, name: u.name, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) });
  console.log(`ฐานข้อมูลว่าง ใส่บัญชีตัวอย่าง ${seed.length} บัญชีแล้ว`);
}
const ALLOW_REGISTER = process.env.ALLOW_REGISTER !== 'false';
const publicUser = u => ({ username: u.username, name: u.name, role: u.role });

// จำกัดการเข้าสู่ระบบผิด: 10 ครั้งต่อ 15 นาที นับแยกตาม IP + ชื่อผู้ใช้
// (ทั้งห้องเรียนมักออกเน็ต IP เดียวกัน ถ้านับแค่ IP นักเรียนคนหนึ่งจะทำให้ทั้งห้องถูกบล็อก)
const WINDOW = 15 * 60 * 1000, MAX_FAIL = 10, fails = new Map();
function blocked(key) {
  const f = fails.get(key);
  if (!f || Date.now() - f.start > WINDOW) { fails.delete(key); return false; }
  return f.count >= MAX_FAIL;
}
function addFail(key) {
  if (fails.size > 10000) fails.clear(); // กันหน่วยความจำโตไม่จำกัด
  const f = fails.get(key);
  if (!f || Date.now() - f.start > WINDOW) fails.set(key, { start: Date.now(), count: 1 });
  else f.count++;
}

const app = express();
app.set('trust proxy', 1); // Render อยู่หลัง proxy ทำให้ req.ip เป็น IP จริงของผู้ใช้
app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.send('ok'));

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
    return res.status(400).json({ error: 'กรุณากรอกให้ครบ' });
  const uname = username.trim().toLowerCase(), key = req.ip + '|' + uname;
  if (blocked(key)) return res.status(429).json({ error: 'ลองผิดหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่' });
  try {
    const user = await findUser(uname);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      addFail(key);
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    fails.delete(key);
    const token = jwt.sign({ sub: user.username }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง' });
  }
});

app.post('/api/register', async (req, res) => {
  if (!ALLOW_REGISTER) return res.status(403).json({ error: 'ระบบนี้ปิดการสมัครสมาชิก' });
  const { username, password, name } = req.body || {};
  if ([username, password, name].some(v => typeof v !== 'string' || !v.trim()))
    return res.status(400).json({ error: 'กรุณากรอกให้ครบ' });
  const uname = username.trim().toLowerCase(), key = req.ip + '|register';
  if (!/^[a-z0-9]{3,30}$/.test(uname))
    return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องเป็น a-z หรือ 0-9 ยาว 3–30 ตัว' });
  if (password.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว' });
  if (name.trim().length > 60) return res.status(400).json({ error: 'ชื่อยาวเกิน 60 ตัว' });
  // กันการสมัครรัว ๆ: 10 บัญชีต่อ IP ใน 15 นาที
  if (blocked(key)) return res.status(429).json({ error: 'สมัครหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่' });
  try {
    const ok = await createUser({ username: uname, name: name.trim(), role: 'student', passwordHash: await bcrypt.hash(password, 10) });
    if (!ok) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' });
    addFail(key);
    res.status(201).json({ user: { username: uname, name: name.trim(), role: 'student' } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง' });
  }
});

app.get('/api/me', async (req, res) => {
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '');
  if (!m) return res.status(401).json({ error: 'ไม่ได้ส่ง token มา' });
  try {
    const { sub } = jwt.verify(m[1], JWT_SECRET);
    const user = await findUser(sub);
    if (!user) return res.status(401).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ user: publicUser(user) });
  } catch {
    res.status(401).json({ error: 'token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'ไม่พบเส้นทางนี้' }));

async function start() {
  if (MONGODB_URI) {
    await mongoose.connect(MONGODB_URI);
    console.log('เชื่อมต่อ MongoDB แล้ว');
    await seedIfEmpty();
  } else {
    if (PROD) console.warn('คำเตือน: ไม่ได้ตั้ง MONGODB_URI ใช้บัญชีตัวอย่างในหน่วยความจำ');
    else console.log('ไม่ได้ตั้ง MONGODB_URI ใช้บัญชีตัวอย่างในหน่วยความจำ');
    await loadMemUsers();
  }
  const port = process.env.PORT || 10000;
  app.listen(port, '0.0.0.0', () => console.log('Listening on ' + port));
}
start().catch(e => { console.error(e); process.exit(1); });
