const MACHINE_LABELS = { washer: '세탁기', dryer: '건조기', both: '세탁+건조' };
const SESSION_KEY = 'admin_password';

// ─── 다크모드 ─────────────────────────────────────────────────────────────

(function initDarkMode() {
  const saved = localStorage.getItem('dark_mode');
  const isDark = saved === null ? true : saved === 'true';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('dark-toggle-btn');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
})();

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = !isDark;
  document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  localStorage.setItem('dark_mode', next);
  document.getElementById('dark-toggle-btn').textContent = next ? '☀️' : '🌙';
}

let editTarget = null;
let deleteTarget = null;

// ─── 세션 ─────────────────────────────────────────────────────────────────

function getPassword() { return sessionStorage.getItem(SESSION_KEY); }
function setPassword(pw) { sessionStorage.setItem(SESSION_KEY, pw); }
function clearPassword() { sessionStorage.removeItem(SESSION_KEY); }

function authHeader() {
  return { 'Content-Type': 'application/json', 'X-Admin-Password': getPassword() };
}

// ─── 초기화 ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (getPassword()) {
    showPanel();
  } else {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
  }
  setupTabBar();
  setupModals();
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('dark-toggle-btn').addEventListener('click', toggleDarkMode);
});

// ─── 로그인 / 로그아웃 ─────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  const pw = document.getElementById('admin-pw').value;
  if (!pw) return;

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = '확인 중...';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });

    if (!res.ok) {
      const json = await res.json();
      showToast(json.error, 'error');
      return;
    }

    setPassword(pw);
    showPanel();
  } catch {
    showToast('서버에 연결할 수 없습니다', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '로그인';
  }
}

function handleLogout() {
  clearPassword();
  location.reload();
}

function showPanel() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  loadUsers();
  loadReservations();
}

// ─── 탭 ────────────────────────────────────────────────────────────────────

function setupTabBar() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ─── 거주자 관리 ────────────────────────────────────────────────────────────

async function loadUsers() {
  try {
    const res = await fetch('/api/admin/users', { headers: authHeader() });
    if (!res.ok) { handleAuthError(res); return; }
    const users = await res.json();
    renderUsers(users);
    document.getElementById('user-count-badge').textContent = users.length;
  } catch {
    showToast('거주자 목록을 불러오지 못했습니다', 'error');
  }
}

function renderUsers(users) {
  const container = document.getElementById('users-list');

  if (users.length === 0) {
    container.innerHTML = '<div class="empty-state">등록된 거주자가 없습니다</div>';
    return;
  }

  container.innerHTML = users.map(u => {
    const regDate = u.registered_at
      ? new Date(u.registered_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
      : '날짜 없음';
    const hasRes = u.reservation_count > 0;
    return `
      <div class="user-card">
        <div class="user-card-top">
          <div>
            <div class="user-room">${escHtml(u.room)}</div>
            <div class="user-name">${escHtml(u.name)}</div>
          </div>
          <span class="user-res-count ${hasRes ? 'has-res' : ''}">
            예약 ${u.reservation_count}건
          </span>
        </div>
        <div class="user-meta">등록일: ${regDate}</div>
        <div class="user-actions">
          <button class="btn-outline" onclick="openEditModal('${escAttr(u.room)}', '${escAttr(u.name)}')">이름 수정</button>
          <button class="btn-danger" onclick="openDeleteModal('${escAttr(u.room)}', '${escAttr(u.name)}', ${u.reservation_count})">삭제</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── 예약 관리 ──────────────────────────────────────────────────────────────

async function loadReservations() {
  try {
    const res = await fetch('/api/admin/reservations', { headers: authHeader() });
    if (!res.ok) { handleAuthError(res); return; }
    const reservations = await res.json();
    renderReservations(reservations);
    document.getElementById('res-count-badge').textContent = reservations.length;
  } catch {
    showToast('예약 목록을 불러오지 못했습니다', 'error');
  }
}

function renderReservations(reservations) {
  const container = document.getElementById('reservations-list');

  if (reservations.length === 0) {
    container.innerHTML = '<div class="empty-state">예약이 없습니다</div>';
    return;
  }

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const upcoming = reservations.filter(r => r.date >= todayStr);
  const past = reservations.filter(r => r.date < todayStr);

  function makeRows(list) {
    return list.map(r => {
      const isToday = r.date === todayStr;
      const dateLabel = formatDateLabel(r.date);
      const dateClass = isToday ? 'today' : '';
      return `
        <tr>
          <td><span class="date-badge ${dateClass}">${dateLabel}</span></td>
          <td><strong>${escHtml(r.room)}</strong></td>
          <td>${escHtml(r.name)}</td>
          <td>${r.start_time} ~ ${r.end_time}</td>
          <td><span class="machine-chip chip-${r.machine}">${MACHINE_LABELS[r.machine]}</span></td>
          <td><button class="btn-danger" onclick="deleteReservation(${r.id})">삭제</button></td>
        </tr>
      `;
    }).join('');
  }

  const thead = `
    <thead>
      <tr>
        <th>날짜</th><th>호실</th><th>이름</th><th>시간</th><th>기기</th><th></th>
      </tr>
    </thead>
  `;

  let html = '';

  if (upcoming.length > 0) {
    html += `
      <div class="res-section-label upcoming-label">🗓 예정된 예약 (${upcoming.length}건)</div>
      <table class="res-table">${thead}<tbody>${makeRows(upcoming)}</tbody></table>
    `;
  }

  if (past.length > 0) {
    html += `
      <div class="res-section-label past-label">🕘 지난 예약 (${past.length}건)</div>
      <div class="past-table-wrap">
        <table class="res-table past-table">${thead}<tbody>${makeRows(past)}</tbody></table>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ─── 이름 수정 모달 ─────────────────────────────────────────────────────────

function openEditModal(room, currentName) {
  editTarget = room;
  document.getElementById('edit-modal-desc').textContent = `${room} · 현재 이름: ${currentName}`;
  document.getElementById('edit-name-input').value = currentName;
  document.getElementById('edit-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('edit-name-input').select(), 50);
}

async function handleEditConfirm() {
  const name = document.getElementById('edit-name-input').value.trim();
  if (!name) { showToast('이름을 입력해주세요', 'error'); return; }

  const btn = document.getElementById('edit-confirm-btn');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(editTarget)}`, {
      method: 'PATCH',
      headers: authHeader(),
      body: JSON.stringify({ name })
    });

    if (!res.ok) {
      const json = await res.json();
      showToast(json.error, 'error');
      return;
    }

    closeModals();
    showToast('이름이 수정되었습니다', 'success');
    loadUsers();
    loadReservations();
  } catch {
    showToast('서버 오류가 발생했습니다', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─── 거주자 삭제 모달 ───────────────────────────────────────────────────────

function openDeleteModal(room, name, resCount) {
  deleteTarget = room;
  document.getElementById('delete-modal-desc').textContent =
    `${room} ${name}님을 삭제하시겠어요?${resCount > 0 ? ` (예약 ${resCount}건 있음)` : ''}`;
  document.getElementById('delete-reservations-check').checked = false;
  document.getElementById('delete-modal-overlay').classList.remove('hidden');
}

async function handleDeleteConfirm() {
  const deleteReservations = document.getElementById('delete-reservations-check').checked;

  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(deleteTarget)}`, {
      method: 'DELETE',
      headers: authHeader(),
      body: JSON.stringify({ deleteReservations })
    });

    if (!res.ok) {
      const json = await res.json();
      showToast(json.error, 'error');
      return;
    }

    closeModals();
    showToast('거주자가 삭제되었습니다', 'success');
    loadUsers();
    loadReservations();
  } catch {
    showToast('서버 오류가 발생했습니다', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─── 예약 삭제 ──────────────────────────────────────────────────────────────

async function deleteReservation(id) {
  if (!confirm('이 예약을 강제 삭제하시겠어요?')) return;

  try {
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: 'DELETE',
      headers: authHeader()
    });

    if (!res.ok) {
      const json = await res.json();
      showToast(json.error, 'error');
      return;
    }

    showToast('예약이 삭제되었습니다', 'success');
    loadReservations();
  } catch {
    showToast('서버 오류가 발생했습니다', 'error');
  }
}

// ─── 모달 공통 ──────────────────────────────────────────────────────────────

function setupModals() {
  document.getElementById('edit-modal-close').addEventListener('click', closeModals);
  document.getElementById('edit-cancel-btn').addEventListener('click', closeModals);
  document.getElementById('edit-confirm-btn').addEventListener('click', handleEditConfirm);

  document.getElementById('delete-modal-close').addEventListener('click', closeModals);
  document.getElementById('delete-cancel-btn').addEventListener('click', closeModals);
  document.getElementById('delete-confirm-btn').addEventListener('click', handleDeleteConfirm);

  [document.getElementById('edit-modal-overlay'), document.getElementById('delete-modal-overlay')]
    .forEach(overlay => {
      overlay.addEventListener('click', e => { if (e.target === overlay) closeModals(); });
    });
}

function closeModals() {
  document.getElementById('edit-modal-overlay').classList.add('hidden');
  document.getElementById('delete-modal-overlay').classList.add('hidden');
  editTarget = null;
  deleteTarget = null;
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────

function handleAuthError(res) {
  if (res.status === 401) {
    clearPassword();
    showToast('세션이 만료되었습니다. 다시 로그인해주세요', 'error');
    setTimeout(() => location.reload(), 1500);
  }
}

function formatDateLabel(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
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
