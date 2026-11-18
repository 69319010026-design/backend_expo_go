// นำบัญชีเข้า MongoDB Atlas: MONGODB_URI=... npm run seed
// อ่าน seed-users.json (ถ้าไม่มี ใช้ seed-users.example.json) แล้วเก็บรหัสผ่านเป็น hash
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./user');

(async () => {
  if (!process.env.MONGODB_URI) { console.error('กรุณาตั้ง MONGODB_URI ก่อน'); process.exit(1); }
  const file = fs.existsSync('seed-users.json') ? 'seed-users.json' : 'seed-users.example.json';
  const users = JSON.parse(fs.readFileSync(file, 'utf8'));
  await mongoose.connect(process.env.MONGODB_URI);
  for (const u of users) {
    await User.updateOne(
      { username: u.username.toLowerCase() },
      { username: u.username, name: u.name, role: u.role || 'student', passwordHash: await bcrypt.hash(u.password, 10) },
      { upsert: true });
  }
  console.log(`นำเข้า ${users.length} บัญชีจาก ${file} แล้ว`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
