const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, 'data.json');

// ─── 데이터 저장소 (JSON 파일) ──────────────────────────────────────────────

function readDB() {
  if (!fs.existsSync(DB_PATH)) return { reservations: [], nextId: 1 };
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return { reservations: [], nextId: 1 };
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

// ─── API ──────────────────────────────────────────────────────────────────

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
        error: `${label}가 ${conflict.start_time}~${conflict.end_time}에 이미 예약되어 있습니다 (${conflict.room} ${conflict.name}님)`
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

// ─── 서버 시작 ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🧺 세탁실 예약 서버: http://localhost:${PORT}`);
});
