const mongoose = require('mongoose');

// เก็บเฉพาะ hash ของรหัสผ่าน ไม่เก็บรหัสผ่านจริง
module.exports = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  passwordHash: { type: String, required: true },
}, { timestamps: true }));
