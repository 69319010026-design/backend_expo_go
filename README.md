# backend_expo_go — API เข้าสู่ระบบ (Express + MongoDB Atlas + Render)

API ตัวอย่างสำหรับแอป Expo: สมัครสมาชิก เข้าสู่ระบบ และดูข้อมูลของฉันด้วย token
นักเรียน **Fork** repo นี้ไปขึ้น Render ของตัวเองได้ ไม่ต้องติดตั้งอะไรในเครื่อง

| เส้นทาง | ส่งอะไร | ได้อะไรกลับ |
|---|---|---|
| `GET /health` | - | `ok` |
| `POST /api/register` | `{ "username", "password", "name" }` | 201 `{ user }` · ชื่อซ้ำ 409 · ข้อมูลไม่ถูกต้อง 400 |
| `POST /api/login` | `{ "username", "password" }` | 200 `{ token, user }` · รหัสผิด 401 · ผิดเกิน 10 ครั้ง/15 นาที 429 |
| `GET /api/me` | header `Authorization: Bearer <token>` | 200 `{ user }` · token หมดอายุ (2 ชม.) 401 |

- ชื่อผู้ใช้ต้องเป็น a-z หรือ 0-9 ยาว 3–30 ตัว รหัสผ่านต้องยาวอย่างน้อย 6 ตัว
- รหัสผ่านเก็บเป็น hash (bcrypt) ไม่มีใครอ่านรหัสจริงได้ แม้แต่เจ้าของฐานข้อมูล
- ครั้งแรกที่ฐานข้อมูลยังว่าง ระบบจะใส่บัญชีตัวอย่างให้: `student1` / `expo1234` (และ `student2`, `student3`)

## ไฟล์ในโปรเจกต์

| ไฟล์ | หน้าที่ |
|---|---|
| `server.js` | ตัว API ทั้งหมด (เส้นทาง, ตรวจรหัส, สร้าง token, จำกัดการลองผิด) |
| `user.js` | โครงสร้างข้อมูลผู้ใช้ใน MongoDB (Mongoose model) |
| `render.yaml` | **Blueprint** บอก Render ว่าจะสร้างเซอร์วิสแบบไหน (Docker, แผนฟรี, ตัวแปรที่ต้องใช้) |
| `Dockerfile` | วิธีสร้าง container ของ API |
| `seed-users.example.json` | บัญชีตัวอย่าง |
| `seed.js`, `make-seed-from-roster.js` | สำหรับครู: นำรายชื่อนักเรียนเข้าฐานข้อมูล |

## ขึ้นระบบของตัวเอง (นักเรียน)

1. **Fork:** กด **Fork** มุมขวาบนของ repo นี้
2. **MongoDB Atlas:**
   - สร้าง Cluster M0 (ฟรี) และ Database User
   - Network Access เพิ่ม `0.0.0.0/0`
   - Connect → Drivers → คัดลอก Connection String
   - แก้ `<db_password>` เป็นรหัสจริง และเติม `loginapi` หลัง `.mongodb.net/` เช่น
     `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/loginapi?retryWrites=true&w=majority`
3. **Render:**
   - New → **Blueprint** → เลือก repo ที่ fork ไว้
   - ใส่ `MONGODB_URI` → **Deploy Blueprint**
4. **ตรวจผล:**
   - เปิด `https://<ชื่อเซอร์วิส>.onrender.com/health` ต้องขึ้น `ok`
   - ใน Logs ต้องเห็น `เชื่อมต่อ MongoDB แล้ว`

ตัวอย่างแอปฝั่งมือถือที่ใช้คู่กับ API นี้ อยู่ใน repo **frontend_expo_go**

**ข้อควรรู้:** Render แผนฟรีจะหลับเมื่อไม่มีใครใช้ประมาณ 15 นาที คำขอแรกหลังจากนั้นต้องรอ 30–60 วินาที

## ตัวแปรที่ตั้งได้ (Render → Environment)

| ตัวแปร | ความหมาย |
|---|---|
| `MONGODB_URI` | Connection String ของ Atlas (จำเป็น) |
| `JWT_SECRET` | กุญแจลับสำหรับเซ็น token (Blueprint สร้างให้อัตโนมัติ) |
| `ALLOW_REGISTER` | ใส่ `false` เพื่อปิดการสมัครสมาชิก |

## ทดสอบในเครื่อง

```bash
npm install
npm start
```

ถ้าไม่ได้ตั้ง `MONGODB_URI` ระบบจะเก็บบัญชีไว้ในหน่วยความจำ (ข้อมูลหายเมื่อปิดเซิร์ฟเวอร์)

## สำหรับครู: นำรายชื่อนักเรียนเข้าระบบ

```bash
node make-seed-from-roster.js <รายชื่อ.csv> <ไฟล์รหัสสำหรับครู.csv>
MONGODB_URI="mongodb+srv://..." npm run seed
```

- ไฟล์รายชื่อของวิทยาลัยใช้รูปแบบ `รหัส, ชื่อ, กลุ่ม` สคริปต์จะสุ่มรหัสผ่านให้แต่ละคน
- ไฟล์ `seed-users.json` อยู่ใน `.gitignore` แล้ว จะไม่ขึ้น GitHub
- เซอร์วิสที่ใช้บัญชีนักเรียนจริงควรตั้ง `ALLOW_REGISTER=false`
