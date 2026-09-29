# 🧺 세탁실 예약 시스템

고시원·기숙사 등 공용 세탁실의 세탁기·건조기 예약을 카카오톡 단톡방 대신 웹으로 관리하는 시스템입니다.

---

## 주요 기능

### 거주자

| 기능 | 설명 |
|------|------|
| 호실 기반 로그인 | 601호 ~ 630호 중 선택 + 이름 입력, 처음이면 자동 등록 |
| 타임라인 시각화 | 세탁기·건조기 예약 현황을 시간 바로 표시, 현재 시각 선, 블록에 마우스를 올리면 툴팁 |
| 간편 예약 | 기기 선택 → 시작 시간 → 3시간 / 4시간 선택 → 종료 시간 자동 계산 |
| 예약 불가 시간 표시 | 이미 예약된 시간대와 오늘 이미 지난 시간대는 선택 불가 |
| 내 예약 관리 | 본인 호실 예약만 취소 가능 |
| 이름 변경 | 로그인 후 내 이름 변경 (기존 예약의 이름도 함께 변경) |
| 다크모드 | 기본값 다크, 설정은 브라우저에 저장 (관리자 페이지와 공유) |
| 공지사항 | 세탁실 이용 수칙·안내 링크 표시 |

### 관리자 (`/admin`)

| 기능 | 설명 |
|------|------|
| 거주자 관리 | 목록 조회 · 이름 수정 · 삭제, 거주자별 예정/누적 예약 건수 |
| 예약 관리 | 전체 예약을 예정 / 지난 예약으로 나눠 조회, 강제 삭제 |

### 자동 처리

- 서버가 시작될 때 **7일이 지난 예약을 자동 삭제**
- 자정이 지나 탭으로 돌아오면 날짜를 자동으로 오늘로 갱신

---

## 기술 스택

- **Backend**: Node.js, Express
- **Frontend**: Vanilla HTML / CSS / JavaScript (프레임워크 없음)
- **Database**: [Supabase](https://supabase.com) (PostgreSQL)
- **배포**: [Render](https://render.com) (GitHub 연동 자동 배포)
- **세션**: localStorage (사용자), sessionStorage (관리자)

---

## 로컬 실행

### 1. Supabase 준비

Supabase 프로젝트를 만들고 SQL Editor에서 테이블을 생성합니다.

```sql
create table users (
  room          text primary key,          -- 예: '601호'
  name          text not null,
  registered_at timestamptz default now()
);

create table reservations (
  id         serial primary key,
  room       text not null,
  name       text not null,
  date       date not null,                -- 'YYYY-MM-DD'
  start_time text not null,                -- 'HH:MM'
  end_time   text not null,
  machine    text not null,                -- 'washer' / 'dryer' / 'both'
  created_at timestamptz default now()
);
```

> 서버에서만 DB에 접근하는 구조라 두 테이블 모두 RLS를 끈 상태로 운영합니다. Supabase 키는 서버 환경 변수로만 두고 프론트엔드에 노출하지 마세요.

### 2. 실행

Node.js **22 이상**이 필요합니다. Supabase 클라이언트가 Node 22의 내장 WebSocket을 사용합니다.

```bash
git clone https://github.com/DeVentory/laundry-reservation.git
cd laundry-reservation
npm install

SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_KEY=your-supabase-key \
ADMIN_PASSWORD=강한비밀번호 \
npm start
```

브라우저에서 `http://localhost:3000` 접속

---

## 환경 변수

| 변수 | 필수 | 기본값 | 설명 |
|------|:---:|--------|------|
| `SUPABASE_URL` | ✅ | — | Supabase 프로젝트 URL |
| `SUPABASE_KEY` | ✅ | — | Supabase API 키 |
| `ADMIN_PASSWORD` | ✅ | — | 관리자 로그인 비밀번호. 추측하기 어려운 값으로 지정 |
| `PORT` | | `3000` | 서버 포트 (Render는 자동 지정) |

필수 변수 중 하나라도 없으면 서버가 시작되지 않고 어떤 변수가 빠졌는지 출력한 뒤 종료합니다.

---

## 배포 (Render)

1. Render에서 **New → Web Service**로 이 저장소를 연결합니다.
2. Build Command `npm install`, Start Command `npm start`
3. **Environment**에 `SUPABASE_URL`, `SUPABASE_KEY`, `ADMIN_PASSWORD`를 등록합니다.
4. 이후 `main` 브랜치에 푸시하면 자동으로 다시 배포됩니다.

> 무료 플랜은 일정 시간 요청이 없으면 잠들어서 첫 접속이 느릴 수 있습니다.

---

## 예약 규칙

- 이용 가능 시간: **07:00 ~ 22:00**
- 예약 가능 기간: **오늘(D) ~ D+3일**
- 오늘 날짜는 **이미 지난 시간대 예약 불가** (서버·프론트 모두 검사)
- 이용 시간 단위: **3시간 또는 4시간**
- 기기: **세탁기만 / 건조기만 / 세탁+건조 동시**
- 같은 기기의 시간이 겹치는 예약은 불가

---

## 파일 구조

```
laundry-reservation/
├── server.js          # Express 서버 · API · Supabase 쿼리
├── package.json
├── public/
│   ├── index.html     # 메인 앱
│   ├── app.js
│   ├── style.css      # CSS 변수 기반 다크모드
│   ├── admin.js
│   └── admin.css
├── views/
│   └── admin.html     # 관리자 페이지 (public/ 밖에 둬서 /admin.html 직접 접근 차단)
└── docs/
    └── usecase-diagram.md
```

---

## 문서

- [유스케이스 다이어그램](docs/usecase-diagram.md): 소프트웨어공학 4단계 작성 절차를 이 서비스에 적용

---

## 라이선스

[MIT](LICENSE)
