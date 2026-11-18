# login-api

API เข้าสู่ระบบสำหรับ "ใบงาน Expo: Login ผ่าน API" (Express + MongoDB Atlas ทำงานบน Render แผนฟรี)

| เส้นทาง | ใช้ทำอะไร |
|---|---|
| `GET /health` | ตอบ `ok` (Render ใช้ตรวจว่าเซิร์ฟเวอร์ทำงานอยู่) |
| `POST /api/login` | รับ `{ "username", "password" }` ตอบ `{ token, user: { username, name, role } }` กรอกไม่ครบตอบ 400 รหัสผิดตอบ 401 กรอกผิดเกิน 10 ครั้งใน 15 นาที (นับแยกตามชื่อผู้ใช้) ตอบ 429 |
| `GET /api/me` | ส่ง header `Authorization: Bearer <token>` ตอบ `{ user }` ถ้า token หมดอายุ (2 ชั่วโมง) หรือไม่ถูกต้องตอบ 401 |

## ทดสอบในเครื่อง

```bash
npm install
npm start
```

ถ้ายังไม่ได้ตั้ง `MONGODB_URI` ระบบจะใช้บัญชีจาก `seed-users.example.json` ซึ่งเก็บอยู่ในหน่วยความจำ เช่น `student1` / `expo1234`

## ขึ้นระบบจริง (ครูทำครั้งเดียว)

1. **MongoDB Atlas**
   - สร้าง Cluster แบบ M0 (ฟรี) และ Database User
   - ที่ Network Access เพิ่ม `0.0.0.0/0` (Render ไม่มี IP คงที่)
   - คัดลอก Connection String โดยเติมชื่อฐานข้อมูลก่อนเครื่องหมาย `?` เช่น `.../loginapi?retryWrites=true&w=majority`
2. **GitHub**
   - สร้าง repo ใหม่ แล้ว push โฟลเดอร์นี้ขึ้นไป
   - `.gitignore` กันไม่ให้ `seed-users.json` และ `.env` ขึ้น repo แล้ว
3. **Render**
   - เลือก New → Blueprint → เลือก repo
   - `render.yaml` จะสร้างเว็บเซอร์วิส `login-api` และสร้าง `JWT_SECRET` ให้เอง
   - ใส่ `MONGODB_URI` ตามที่ระบบถาม
4. **ใส่รายชื่อผู้ใช้**
   - คัดลอก `seed-users.example.json` เป็น `seed-users.json` แล้วแก้เป็นบัญชีจริง ส่วนรหัสผ่านของ `teacher` ต้องเปลี่ยน
   - รันคำสั่งจากเครื่องครู:

     ```bash
     MONGODB_URI="mongodb+srv://..." npm run seed
     ```

   - รหัสผ่านจะถูกเก็บเป็น hash แบบ bcrypt
   - ถ้ารันซ้ำ ข้อมูลของผู้ใช้เดิมจะถูกอัปเดต
5. **ใส่ URL ในใบงาน**
   - นำ URL จาก Render (เช่น `https://login-api-xxxx.onrender.com`) ไปแทน `API_URL` ใน `expo_app_dev/worksheets/_source/login_api/steps/*.js`
   - build ใบงานใหม่

**ข้อควรรู้:** Render แผนฟรีจะหลับเมื่อไม่มีใครใช้ประมาณ 15 นาที คำขอแรกหลังจากนั้นจะรอ 30–60 วินาที ใบงานขั้นที่ 2 จึงตั้งเวลารอไว้ 60 วินาที ก่อนเริ่มคาบเรียนให้ครูเปิด `/health` ปลุกเซิร์ฟเวอร์ไว้ก่อน
