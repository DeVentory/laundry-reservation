const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '관리자 비밀번호가 올바르지 않습니다' });
  }
  next();
}

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────

function todayKST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
}

// ─── 오래된 예약 정리 (7일 이전) ──────────────────────────────────────────

async function cleanup() {
  const cutoff = addDays(todayKST(), -7);
  const { error } = await supabase.from('reservations').delete().lt('date', cutoff);
  if (!error) console.log(`🧹 cleanup: ${cutoff} 이전 예약 정리 완료`);
}

cleanup();

// ─── 미들웨어 ─────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// ─── API ──────────────────────────────────────────────────────────────────

// POST /api/login
app.post('/api/login', async (req, res) => {
  const room = req.body.room?.trim();
  const name = req.body.name?.trim();

  if (!room || !name) return res.status(400).json({ error: '호실과 이름을 입력해주세요' });

  const { data: existing, error } = await supabase
    .from('users')
    .select('*')
    .eq('room', room)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }

  if (!existing) {
    await supabase.from('users').insert({ room, name });
    return res.json({ room, name, isNew: true });
  }

  if (existing.name !== name) {
    return res.status(403).json({ error: '이미 등록된 호실입니다. 이름을 확인해주세요' });
  }

  res.json({ room: existing.room, name: existing.name, isNew: false });
});

// GET /api/reservations?date=YYYY-MM-DD
app.get('/api/reservations', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜를 입력해주세요' });

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', date)
    .order('start_time');

  if (error) return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  res.json(data);
});

// POST /api/reservations
app.post('/api/reservations', async (req, res) => {
  const { room, name, date, start_time, end_time, machine } = req.body;

  if (!room || !name || !date || !start_time || !end_time || !machine) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요' });
  }

  const today = todayKST();
  const maxDate = addDays(today, 3);
  if (date < today || date > maxDate) {
    return res.status(400).json({ error: '예약 가능 기간은 오늘부터 D+3일까지입니다' });
  }

  if (start_time < '07:00' || end_time > '22:00' || start_time >= end_time) {
    return res.status(400).json({ error: '시간을 올바르게 입력해주세요 (07:00~22:00)' });
  }

  const { data: dayReservations } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', date);

  const machinesToCheck = machine === 'both' ? ['washer', 'dryer'] : [machine];
  for (const m of machinesToCheck) {
    const conflict = (dayReservations || []).find(r =>
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

  const { data, error } = await supabase
    .from('reservations')
    .insert({ room: room.trim(), name: name.trim(), date, start_time, end_time, machine })
    .select()
    .single();

  if (error) return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  res.status(201).json(data);
});

// DELETE /api/reservations/:id
app.delete('/api/reservations/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { room } = req.body;

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (!reservation) return res.status(404).json({ error: '예약을 찾을 수 없습니다' });
  if (reservation.room !== room?.trim()) return res.status(403).json({ error: '호실 번호가 일치하지 않습니다' });

  await supabase.from('reservations').delete().eq('id', id);
  res.json({ success: true });
});

// PATCH /api/users/name
app.patch('/api/users/name', async (req, res) => {
  const { room, oldName, newName } = req.body;
  const trimmedNew = newName?.trim();

  if (!room || !oldName || !trimmedNew) {
    return res.status(400).json({ error: '정보를 올바르게 입력해주세요' });
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('room', room)
    .single();

  if (!user) return res.status(404).json({ error: '등록된 거주자를 찾을 수 없습니다' });
  if (user.name !== oldName) return res.status(403).json({ error: '현재 이름 정보가 일치하지 않습니다' });

  await supabase.from('users').update({ name: trimmedNew }).eq('room', room);
  await supabase.from('reservations').update({ name: trimmedNew }).eq('room', room);

  res.json({ success: true, name: trimmedNew });
});

// ─── 관리자 API ───────────────────────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다' });
  }
  res.json({ success: true });
});

// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const { data: users } = await supabase.from('users').select('*');
  const { data: reservations } = await supabase.from('reservations').select('room, date');

  const today = todayKST();
  const result = (users || []).map(u => {
    const userRes = (reservations || []).filter(r => r.room === u.room);
    return {
      ...u,
      total_count: userRes.length,
      upcoming_count: userRes.filter(r => r.date >= today).length
    };
  });

  res.json(result);
});

// PATCH /api/admin/users/:room
app.patch('/api/admin/users/:room', requireAdmin, async (req, res) => {
  const room = decodeURIComponent(req.params.room);
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: '이름을 입력해주세요' });

  const { data: user } = await supabase.from('users').select('*').eq('room', room).single();
  if (!user) return res.status(404).json({ error: '등록된 거주자를 찾을 수 없습니다' });

  await supabase.from('users').update({ name }).eq('room', room);
  await supabase.from('reservations').update({ name }).eq('room', room);

  res.json({ success: true });
});

// DELETE /api/admin/users/:room
app.delete('/api/admin/users/:room', requireAdmin, async (req, res) => {
  const room = decodeURIComponent(req.params.room);
  const { deleteReservations } = req.body;

  const { data: user } = await supabase.from('users').select('*').eq('room', room).single();
  if (!user) return res.status(404).json({ error: '등록된 거주자를 찾을 수 없습니다' });

  await supabase.from('users').delete().eq('room', room);
  if (deleteReservations) {
    await supabase.from('reservations').delete().eq('room', room);
  }

  res.json({ success: true });
});

// GET /api/admin/reservations
app.get('/api/admin/reservations', requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('reservations')
    .select('*')
    .order('date')
    .order('start_time');

  res.json(data || []);
});

// DELETE /api/admin/reservations/:id
app.delete('/api/admin/reservations/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const { data: reservation } = await supabase.from('reservations').select('*').eq('id', id).single();
  if (!reservation) return res.status(404).json({ error: '예약을 찾을 수 없습니다' });

  await supabase.from('reservations').delete().eq('id', id);
  res.json({ success: true });
});

// ─── 서버 시작 ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🧺 세탁실 예약 서버: http://localhost:${PORT}`);
});
