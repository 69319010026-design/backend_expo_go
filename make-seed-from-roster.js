// สร้าง seed-users.json จากไฟล์รายชื่อของวิทยาลัย (รหัส, ชื่อ, กลุ่ม) พร้อมรหัสผ่านสุ่มรายคน
// ใช้: node make-seed-from-roster.js <รายชื่อ.csv> <ไฟล์รหัสสำหรับครู.csv>
// ถ้ามี seed-users.json อยู่แล้ว คนเดิมจะได้รหัสเดิม (สุ่มเฉพาะคนใหม่) — แจกรหัสซ้ำได้ไม่ต้องเปลี่ยน
const fs = require('fs');
const crypto = require('crypto');
const [rosterPath, slipPath] = process.argv.slice(2);
if (!rosterPath || !slipPath) { console.error('ใช้: node make-seed-from-roster.js <รายชื่อ.csv> <ไฟล์รหัสสำหรับครู.csv>'); process.exit(1); }

const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // ตัด 0 o 1 l i ที่อ่านสับสน
const randomPass = n => Array.from(crypto.randomBytes(n), b => CHARS[b % CHARS.length]).join('');

const old = fs.existsSync('seed-users.json') ? JSON.parse(fs.readFileSync('seed-users.json', 'utf8')) : [];
const oldPass = new Map(old.map(u => [u.username, u.password]));

const rows = fs.readFileSync(rosterPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
const users = rows.map(l => {
  const [id, name, group] = l.split(',').map(s => s.trim());
  if (!/^\d+$/.test(id)) throw new Error('รหัสไม่ถูกต้อง: ' + l);
  return { username: id, password: oldPass.get(id) || randomPass(6), name, role: 'student', group };
});
if (new Set(users.map(u => u.username)).size !== users.length) throw new Error('มีรหัสนักศึกษาซ้ำ');
users.push({ username: 'teacher', password: oldPass.get('teacher') || randomPass(10), name: 'ครูผู้สอน', role: 'teacher' });

fs.writeFileSync('seed-users.json', JSON.stringify(users, null, 2));
const csv = '﻿รหัสนักศึกษา(ชื่อผู้ใช้),รหัสผ่าน,ชื่อ-สกุล,กลุ่ม\n'
  + users.map(u => [u.username, u.password, u.name, u.group || ''].join(',')).join('\n') + '\n';
fs.writeFileSync(slipPath, csv);
console.log(`สร้าง ${users.length} บัญชี (นักเรียน ${users.length - 1} + teacher)`);
