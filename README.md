<div align="center">

# 🧺 세탁실 예약 시스템

**단톡방 대신 웹으로. 공용 세탁기·건조기 예약을 한눈에.**

고시원·기숙사처럼 세탁실을 여럿이 나눠 쓰는 곳을 위한 가벼운 예약 웹앱입니다.

<a href="LICENSE"><img src="https://img.shields.io/github/license/DeVentory/laundry-reservation?color=blue" alt="license"></a>
<a href="https://github.com/DeVentory/laundry-reservation/commits/main"><img src="https://img.shields.io/github/last-commit/DeVentory/laundry-reservation" alt="last commit"></a>
<img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white" alt="node">

</div>

---

## 💡 왜 만들었나

세탁기 1대, 건조기 1대를 30명이 나눠 쓰는 고시원에서 예약을 카카오톡 단톡방으로 받고 있었습니다. 메시지가 쌓이면 누가 언제 예약했는지 찾기 어렵고, 시간이 겹치는 일도 잦았습니다. 이 앱은 **예약 현황을 타임라인 한 장으로 보여 주고, 겹치는 예약은 아예 받지 않습니다.**

## ⭐ 기능

### 거주자

- 🔑 **간단한 로그인**: 호실(601~630호) + 이름. 처음이면 자동 등록
- 📊 **타임라인**: 세탁기·건조기 예약을 시간 바로 표시. 현재 시각 선, 블록에 마우스를 올리면 툴팁
- ⚡ **3단계 예약**: 기기 선택 → 시작 시간 → 3시간/4시간. 종료 시간은 자동 계산
- 🚫 **예약 불가 시간 표시**: 이미 예약된 시간대와 오늘 지난 시간대는 선택 불가
- ✏️ **내 정보 관리**: 본인 예약 취소, 이름 변경 (기존 예약의 이름도 함께 변경)
- 🌙 **다크모드**: 기본값 다크, 설정은 브라우저에 저장
- 📢 **공지사항**: 세탁실 이용 수칙과 안내 링크

### 관리자 (`/admin`)

- 👥 **거주자 관리**: 목록 조회 · 이름 수정 · 삭제, 거주자별 예정/누적 예약 건수
- 🗓 **예약 관리**: 전체 예약을 예정 / 지난 예약으로 나눠 조회, 강제 삭제

### 자동 처리

- 🧹 서버가 시작될 때 **7일이 지난 예약을 자동 삭제**
- 🕛 자정이 지난 뒤 탭으로 돌아오면 날짜를 자동으로 오늘로 갱신

## 📏 예약 규칙

| 항목 | 규칙 |
|---|---|
| 이용 가능 시간 | **07:00 ~ 22:00** |
| 예약 가능 기간 | **오늘(D) ~ D+3일** |
| 이용 시간 단위 | **3시간 또는 4시간** |
| 기기 | 세탁기만 / 건조기만 / 세탁+건조 동시 |
| 겹침 | 같은 기기의 시간이 겹치는 예약 불가 |
| 지난 시간 | 오늘 날짜는 이미 지난 시간대 예약 불가 (서버·프론트 모두 검사) |

## 🛠 기술 스택

<p>
<img src="https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white" alt="Node.js">
<img src="https://img.shields.io/badge/Express-000000?logo=express&logoColor=white" alt="Express">
<img src="https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white" alt="Supabase">
<img src="https://img.shields.io/badge/Vanilla_JS-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=black" alt="Render">
</p>

- **Backend**: Node.js + Express
- **Frontend**: 프레임워크 없는 HTML / CSS / JavaScript
- **Database**: Supabase (PostgreSQL)
- **배포**: Render (GitHub 연동 자동 배포)
- **세션**: localStorage (사용자), sessionStorage (관리자)

## 🚀 시작하기

### 요구 사항

- **Node.js 22 이상**: Supabase 클라이언트가 Node 22의 내장 WebSocket을 사용합니다.
- **Supabase 프로젝트** (무료 플랜으로 충분)

### 1. 데이터베이스 준비

Supabase의 SQL Editor에서 테이블을 만듭니다.

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

> [!NOTE]
> DB에는 서버만 접근하는 구조라서, 두 테이블 모두 RLS를 끈 상태로 운영합니다. Supabase 키는 서버 환경 변수로만 두고 프론트엔드에 노출하지 마세요.

### 2. 설치와 실행

```bash
git clone https://github.com/DeVentory/laundry-reservation.git
cd laundry-reservation
npm install

SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_KEY=your-supabase-key \
ADMIN_PASSWORD=추측하기-어려운-비밀번호 \
npm start
```

브라우저에서 `http://localhost:3000`에 접속합니다. 관리자 페이지는 `http://localhost:3000/admin`입니다.

### 환경 변수

| 변수 | 필수 | 설명 |
|------|:---:|------|
| `SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `SUPABASE_KEY` | ✅ | Supabase API 키 |
| `ADMIN_PASSWORD` | ✅ | 관리자 로그인 비밀번호 |
| `PORT` | | 서버 포트. 기본값 `3000`, Render에서는 자동 지정 |

> [!IMPORTANT]
> 필수 변수가 하나라도 없으면 서버가 시작되지 않고, 빠진 변수를 출력한 뒤 종료합니다.
> ```
> ❌ 환경 변수가 설정되지 않았습니다: ADMIN_PASSWORD
> ```

## ☁️ 배포 (Render)

1. Render에서 **New → Web Service**로 이 저장소를 연결합니다.
2. Build Command는 `npm install`, Start Command는 `npm start`로 둡니다.
3. **Environment**에 `SUPABASE_URL`, `SUPABASE_KEY`, `ADMIN_PASSWORD`를 등록합니다.

> [!TIP]
> 무료 플랜은 한동안 요청이 없으면 잠들어서 첫 접속이 느릴 수 있습니다.

## 🆙 업데이트

Render를 쓰면 `main` 브랜치에 푸시할 때마다 자동으로 다시 배포됩니다. 직접 운영 중이라면:

```bash
git pull
npm install
npm start
```

## 📁 프로젝트 구조

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

## 🔐 프라이버시

- 타임라인과 예약 목록에는 이름을 숨기고 **호실만** 표시합니다.
- 예약이 겹칠 때 나오는 안내에도 다른 사람의 이름은 나오지 않습니다.

## 📚 문서

- [유스케이스 다이어그램](docs/usecase-diagram.md): 소프트웨어공학의 4단계 작성 절차를 이 서비스에 적용한 문서

## 📄 라이선스

[MIT](LICENSE)
