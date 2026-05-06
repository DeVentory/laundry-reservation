const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다' });
  }
  next();
}

// ─── 데이터 저장소 (JSON 파일) ──────────────────────────────────────────────

function readDB() {
  if (!fs.existsSync(DB_PATH)) return { reservations: [], users: [], nextId: 1 };
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!data.users) data.users = [];
    return data;
  } catch {
    return { reservations: [], users: [], nextId: 1 };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// 오래된 예약 정리 (7일 이전)
function cleanup() {
  const db = readDB();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  db.reservations = db.reservations.filter(r => r.date >= cutoffStr);
  writeDB(db);
}

cleanup();

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────

function todayKST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
}

// ─── 미들웨어 ─────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// ─── API ──────────────────────────────────────────────────────────────────

// POST /api/login
app.post('/api/login', (req, res) => {
  const room = req.body.room?.trim();
  const name = req.body.name?.trim();

  if (!room || !name) return res.status(400).json({ error: '호실과 이름을 입력해주세요' });

  const db = readDB();
  const existing = db.users.find(u => u.room === room);

  if (!existing) {
    db.users.push({ room, name, registered_at: new Date().toISOString() });
    writeDB(db);
    return res.json({ room, name, isNew: true });
  }

  if (existing.name !== name) {
    return res.status(403).json({ error: '이미 등록된 호실입니다. 이름을 확인해주세요' });
  }

  res.json({ room: existing.room, name: existing.name, isNew: false });
});

// GET /api/reservations?date=YYYY-MM-DD
app.get('/api/reservations', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜를 입력해주세요' });

  const { reservations } = readDB();
  const result = reservations
    .filter(r => r.date === date)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  res.json(result);
});

// POST /api/reservations
app.post('/api/reservations', (req, res) => {
  const { room, name, date, start_time, end_time, machine } = req.body;

  if (!room || !name || !date || !start_time || !end_time || !machine) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요' });
  }

  // 날짜 유효성: 오늘(D) ~ D+3
  const today = todayKST();
  const maxDate = addDays(today, 3);
  if (date < today || date > maxDate) {
    return res.status(400).json({ error: '예약 가능 기간은 오늘부터 D+3일까지입니다' });
  }

  // 시간 유효성
  if (start_time < '07:00' || end_time > '22:00' || start_time >= end_time) {
    return res.status(400).json({ error: '시간을 올바르게 입력해주세요 (07:00~22:00)' });
  }

  const db = readDB();
  const dayReservations = db.reservations.filter(r => r.date === date);

  // 중복 확인
  const machinesToCheck = machine === 'both' ? ['washer', 'dryer'] : [machine];
  for (const m of machinesToCheck) {
    const conflict = dayReservations.find(r =>
      (r.machine === m || r.machine === 'both') &&
      !(r.end_time <= start_time || r.start_time >= end_time)
    );
    if (conflict) {
      const label = m === 'washer' ? '세탁기' : '건조기';
      return res.status(409).json({
        error: `${label}가 ${conflict.start_time}~${conflict.end_time}에 이미 예약되어 있습니다 (${conflict.room})`
      });
    }
  }

  const newItem = {
    id: db.nextId++,
    room: room.trim(),
    name: name.trim(),
    date,
    start_time,
    end_time,
    machine,
    created_at: new Date().toISOString()
  };

  db.reservations.push(newItem);
  writeDB(db);
  res.status(201).json(newItem);
});

// DELETE /api/reservations/:id
app.delete('/api/reservations/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { room } = req.body;

  const db = readDB();
  const reservation = db.reservations.find(r => r.id === id);

  if (!reservation) return res.status(404).json({ error: '예약을 찾을 수 없습니다' });
  if (reservation.room !== room?.trim()) return res.status(403).json({ error: '호실 번호가 일치하지 않습니다' });

  db.reservations = db.reservations.filter(r => r.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// PATCH /api/users/name - 본인 이름 변경
app.patch('/api/users/name', (req, res) => {
  const { room, oldName, newName } = req.body;
  const trimmedNew = newName?.trim();

  if (!room || !oldName || !trimmedNew) {
    return res.status(400).json({ error: '정보를 올바르게 입력해주세요' });
  }

  const db = readDB();
  const user = db.users.find(u => u.room === room);
  if (!user) return res.status(404).json({ error: '등록된 거주자를 찾을 수 없습니다' });
  if (user.name !== oldName) return res.status(403).json({ error: '현재 이름 정보가 일치하지 않습니다' });

  user.name = trimmedNew;
  db.reservations.forEach(r => { if (r.room === room) r.name = trimmedNew; });
  writeDB(db);
  res.json({ success: true, name: trimmedNew });
});

// ─── 관리자 API ───────────────────────────────────────────────────────────

// POST /api/admin/login - 비밀번호 확인
app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다' });
  }
  res.json({ success: true });
});

// GET /api/admin/users - 전체 거주자 목록
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const db = readDB();
  const users = db.users.map(u => ({
    ...u,
    reservation_count: db.reservations.filter(r => r.room === u.room).length
  }));
  res.json(users);
});

// PATCH /api/admin/users/:room - 거주자 이름 수정
app.patch('/api/admin/users/:room', requireAdmin, (req, res) => {
  const room = decodeURIComponent(req.params.room);
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: '이름을 입력해주세요' });

  const db = readDB();
  const user = db.users.find(u => u.room === room);
  if (!user) return res.status(404).json({ error: '등록된 거주자를 찾을 수 없습니다' });

  user.name = name;
  db.reservations.forEach(r => { if (r.room === room) r.name = name; });
  writeDB(db);
  res.json({ success: true });
});

// DELETE /api/admin/users/:room - 거주자 삭제
app.delete('/api/admin/users/:room', requireAdmin, (req, res) => {
  const room = decodeURIComponent(req.params.room);
  const { deleteReservations } = req.body;

  const db = readDB();
  if (!db.users.find(u => u.room === room)) {
    return res.status(404).json({ error: '등록된 거주자를 찾을 수 없습니다' });
  }

  db.users = db.users.filter(u => u.room !== room);
  if (deleteReservations) {
    db.reservations = db.reservations.filter(r => r.room !== room);
  }
  writeDB(db);
  res.json({ success: true });
});

// GET /api/admin/reservations - 전체 예약 목록
app.get('/api/admin/reservations', requireAdmin, (req, res) => {
  const db = readDB();
  const sorted = [...db.reservations].sort((a, b) =>
    a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
  );
  res.json(sorted);
});

// DELETE /api/admin/reservations/:id - 예약 강제 삭제
app.delete('/api/admin/reservations/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = readDB();
  if (!db.reservations.find(r => r.id === id)) {
    return res.status(404).json({ error: '예약을 찾을 수 없습니다' });
  }
  db.reservations = db.reservations.filter(r => r.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// ─── 서버 시작 ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🧺 세탁실 예약 서버: http://localhost:${PORT}`);
});
