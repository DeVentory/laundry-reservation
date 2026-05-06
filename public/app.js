const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;

const MACHINE_LABELS = { washer: '세탁기', dryer: '건조기', both: '세탁+건조' };
const MACHINE_COLORS = { washer: '#4A90D9', dryer: '#E8834A', both: '#7C5CBF' };
const SESSION_KEY = 'laundry_session';

let state = {
  currentDate: todayISO(),
  reservations: [],
  cancelTargetId: null
};

// ─── 세션 관리 ─────────────────────────────────────────────────────────────

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function setSession(data) { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

// ─── 초기화 ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (session) {
    startApp(session);
  } else {
    showLoginScreen();
  }
});

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');

  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

function startApp(session) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // 헤더에 사용자 정보 표시
  document.getElementById('user-badge').textContent = `${session.room} ${session.name}`;

  buildDateTabs();
  buildTimeAxis();
  setupTimeSelects();
  setupEventListeners(session);
  loadReservations(state.currentDate);
}

function setupEventListeners(session) {
  document.getElementById('btn-reserve').addEventListener('click', () => openReservationModal(session));
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeAllModals();
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  document.getElementById('reservation-form').addEventListener('submit', e => handleSubmit(e, session));
  document.getElementById('cancel-confirm-btn').addEventListener('click', () => handleCancel(session));
  document.getElementById('cancel-close-btn').addEventListener('click', closeAllModals);

  document.querySelectorAll('#machine-group input[type=radio]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('#machine-group .radio-label').forEach(label => {
        label.classList.toggle('active', label.querySelector('input').checked);
      });
    });
  });
}

// ─── 로그인 / 로그아웃 ─────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  const room = document.getElementById('login-room').value.trim();
  const name = document.getElementById('login-name').value.trim();

  if (!room || !name) {
    showToast('호실과 이름을 입력해주세요', 'error');
    return;
  }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = '확인 중...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, name })
    });

    const json = await res.json();
    if (!res.ok) {
      showToast(json.error, 'error');
      return;
    }

    setSession(json);
    startApp(json);
    showToast(json.isNew ? `${room} 등록 완료! 환영합니다 😊` : `${name}님, 환영합니다!`, 'success');
  } catch {
    showToast('서버에 연결할 수 없습니다', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '시작하기';
  }
}

function handleLogout() {
  clearSession();
  // 탭, 이벤트 리스너 초기화를 위해 페이지 새로고침
  location.reload();
}

// ─── 날짜 탭 ───────────────────────────────────────────────────────────────

function buildDateTabs() {
  const container = document.getElementById('date-tabs');
  container.innerHTML = '';
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const labelNames = ['오늘', '내일', '모레', '글피'];

  for (let i = 0; i < 4; i++) {
    const date = addDays(state.currentDate, i);
    const d = new Date(date + 'T00:00:00');
    const tab = document.createElement('button');
    tab.className = 'date-tab' + (i === 0 ? ' active' : '');
    tab.innerHTML = `
      <span class="tab-name">${labelNames[i]}</span>
      <span class="tab-date">${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})</span>
    `;
    tab.addEventListener('click', () => {
      document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentDate = date;
      loadReservations(date);
    });
    container.appendChild(tab);
  }
}

// ─── 시간 축 ───────────────────────────────────────────────────────────────

function buildTimeAxis() {
  const axis = document.getElementById('axis-bar');
  const hours = [7, 10, 13, 16, 19, 22];

  hours.forEach((h, i) => {
    const tick = document.createElement('div');
    tick.className = 'axis-tick';
    tick.textContent = String(h).padStart(2, '0') + '시';

    if (i === 0) {
      tick.style.left = '0';
    } else if (i === hours.length - 1) {
      tick.style.right = '0';
    } else {
      tick.style.left = ((h - START_HOUR) / (END_HOUR - START_HOUR) * 100) + '%';
      tick.style.transform = 'translateX(-50%)';
    }
    axis.appendChild(tick);
  });
}

// ─── 시간 선택 셀렉트 ──────────────────────────────────────────────────────

function setupTimeSelects() {
  const startSel = document.getElementById('start-time');
  for (let m = START_HOUR * 60; m < END_HOUR * 60; m += 30) {
    const opt = document.createElement('option');
    opt.value = minToTime(m);
    opt.textContent = minToTime(m);
    startSel.appendChild(opt);
  }
  startSel.addEventListener('change', updateEndOptions);
  updateEndOptions();
}

function updateEndOptions() {
  const startSel = document.getElementById('start-time');
  const endSel = document.getElementById('end-time');
  const startMin = timeToMin(startSel.value);
  const prevEnd = endSel.value;

  endSel.innerHTML = '';
  for (let m = startMin + 30; m <= END_HOUR * 60; m += 30) {
    const opt = document.createElement('option');
    opt.value = minToTime(m);
    opt.textContent = minToTime(m);
    if (minToTime(m) === prevEnd) opt.selected = true;
    endSel.appendChild(opt);
  }
}

// ─── 데이터 로드 ───────────────────────────────────────────────────────────

async function loadReservations(date) {
  try {
    const res = await fetch(`/api/reservations?date=${date}`);
    if (!res.ok) throw new Error();
    state.reservations = await res.json();
    render();
  } catch {
    showToast('데이터를 불러오지 못했습니다', 'error');
  }
}

// ─── 렌더링 ────────────────────────────────────────────────────────────────

function render() {
  const session = getSession();
  renderBar('washer', 'washer-bar');
  renderBar('dryer', 'dryer-bar');
  renderList(session);
}

function renderBar(machine, barId) {
  const bar = document.getElementById(barId);
  bar.innerHTML = '';
  const relevant = state.reservations.filter(r => r.machine === machine || r.machine === 'both');

  relevant.forEach(r => {
    const startMin = timeToMin(r.start_time) - START_HOUR * 60;
    const endMin = timeToMin(r.end_time) - START_HOUR * 60;
    const left = (startMin / TOTAL_MIN) * 100;
    const width = ((endMin - startMin) / TOTAL_MIN) * 100;

    const block = document.createElement('div');
    block.className = 'timeline-block';
    block.style.cssText = `left:${left}%;width:${width}%;background:${MACHINE_COLORS[machine]}`;
    block.title = `${r.room} ${r.name}: ${r.start_time}~${r.end_time}`;

    const label = document.createElement('span');
    label.className = 'block-label';
    label.textContent = `${r.room} ${r.name}`;
    block.appendChild(label);
    bar.appendChild(block);
  });
}

function renderList(session) {
  const list = document.getElementById('reservation-list');

  if (state.reservations.length === 0) {
    list.innerHTML = '<div class="empty-state">예약이 없습니다</div>';
    return;
  }

  list.innerHTML = state.reservations.map(r => {
    const isOwn = session && r.room === session.room;
    return `
      <div class="reservation-card card-${r.machine}">
        <div class="card-info">
          <div class="card-top">
            <span class="card-room">${escHtml(r.room)}</span>
            <span class="card-name">${escHtml(r.name)}</span>
          </div>
          <div class="card-time">${r.start_time} ~ ${r.end_time}</div>
          <span class="card-machine badge-${r.machine}">${MACHINE_LABELS[r.machine]}</span>
        </div>
        ${isOwn ? `<button class="cancel-btn" onclick="openCancelModal(${r.id}, '${escHtml(r.start_time)}', '${escHtml(r.end_time)}', '${r.machine}')">취소</button>` : ''}
      </div>
    `;
  }).join('');
}

// ─── 모달 ──────────────────────────────────────────────────────────────────

function openReservationModal(session) {
  document.getElementById('reservation-form').reset();
  document.getElementById('modal-user-info').textContent = `${session.room} ${session.name}님으로 예약됩니다`;
  document.querySelectorAll('#machine-group .radio-label').forEach((label, i) => {
    label.classList.toggle('active', i === 0);
  });
  updateEndOptions();
  document.getElementById('reservation-modal').classList.add('active');
  document.getElementById('modal-overlay').classList.add('active');
}

function openCancelModal(id, startTime, endTime, machine) {
  state.cancelTargetId = id;
  const machineLabel = MACHINE_LABELS[machine];
  document.getElementById('cancel-desc').innerHTML =
    `<strong>${startTime} ~ ${endTime}</strong> ${machineLabel} 예약을<br>정말 취소하시겠어요?`;
  document.getElementById('cancel-modal').classList.add('active');
  document.getElementById('modal-overlay').classList.add('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById('modal-overlay').classList.remove('active');
  state.cancelTargetId = null;
}

// ─── API 처리 ──────────────────────────────────────────────────────────────

async function handleSubmit(e, session) {
  e.preventDefault();
  const form = e.target;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = '처리 중...';

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: session.room,
        name: session.name,
        date: state.currentDate,
        start_time: form.start_time.value,
        end_time: form.end_time.value,
        machine: form.machine.value
      })
    });

    const json = await res.json();
    if (!res.ok) {
      showToast(json.error, 'error');
      return;
    }

    closeAllModals();
    await loadReservations(state.currentDate);
    showToast('예약이 완료되었습니다!', 'success');
  } catch {
    showToast('서버 오류가 발생했습니다', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '예약하기';
  }
}

async function handleCancel(session) {
  const btn = document.getElementById('cancel-confirm-btn');
  btn.disabled = true;
  btn.textContent = '처리 중...';

  try {
    const res = await fetch(`/api/reservations/${state.cancelTargetId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: session.room })
    });

    const json = await res.json();
    if (!res.ok) {
      showToast(json.error, 'error');
      return;
    }

    closeAllModals();
    await loadReservations(state.currentDate);
    showToast('예약이 취소되었습니다', 'success');
  } catch {
    showToast('서버 오류가 발생했습니다', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '취소 확인';
  }
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
