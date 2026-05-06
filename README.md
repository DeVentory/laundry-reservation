# 🧺 세탁실 예약 시스템

고시원·기숙사 등 공용 세탁실의 세탁기·건조기 예약을 카카오톡 단톡방 대신 웹으로 관리하는 시스템입니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 호실 기반 로그인 | 601호 ~ 630호 중 선택 + 이름 입력으로 자동 등록 |
| 타임라인 시각화 | 세탁기·건조기 예약 현황을 시간 바 형태로 표시, 현재 시각 선 표시 |
| 간편 예약 | 기기 선택 → 시작 시간 선택 → 3시간 / 4시간 선택 → 종료 시간 자동 계산 |
| 내 예약 관리 | 본인 호실 예약만 취소 가능 |
| 이름 변경 | 로그인 후 내 이름 변경 가능 |
| 관리자 패널 | 거주자·예약 전체 조회 및 강제 삭제 |

---

## 기술 스택

- **Backend**: Node.js, Express
- **Frontend**: Vanilla HTML / CSS / JavaScript (프레임워크 없음)
- **저장소**: JSON 파일 (`data.json`) — 별도 DB 설치 불필요
- **세션**: localStorage (사용자), sessionStorage (관리자)

---

## 로컬 실행

```bash
# 1. 저장소 클론
git clone https://github.com/<your-username>/laundry-reservation.git
cd laundry-reservation

# 2. 패키지 설치
npm install

# 3. 서버 실행
node server.js
```

브라우저에서 `http://localhost:3000` 접속

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3000` | 서버 포트 |
| `ADMIN_PASSWORD` | `admin1234` | 관리자 로그인 비밀번호 |

운영 환경에서는 반드시 `ADMIN_PASSWORD`를 변경하세요.

```bash
ADMIN_PASSWORD=강한비밀번호 node server.js
```

---

## 관리자 페이지

메인 로그인 화면 하단의 **관리자** 링크 또는 `/admin` 경로로 접속합니다.

- 거주자 목록 조회 / 이름 수정 / 삭제
- 전체 예약 목록 조회 / 강제 삭제

---

## 예약 규칙

- 이용 가능 시간: **07:00 ~ 22:00**
- 예약 가능 기간: **오늘(D) ~ D+3일**
- 이용 시간 단위: **3시간 또는 4시간**
- 기기: **세탁기만 / 건조기만 / 세탁+건조 동시**

---

## 파일 구조

```
laundry-reservation/
├── server.js          # Express 서버 및 API
├── data.json          # 예약·사용자 데이터 (git 제외)
├── package.json
├── public/
│   ├── index.html     # 메인 앱
│   ├── app.js
│   ├── style.css
│   ├── admin.js
│   └── admin.css
└── views/
    └── admin.html     # 관리자 페이지 (직접 URL 접근 불가)
```

---

## 라이선스

MIT
