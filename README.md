# 황감지 (Hwang-Gam-Ji)

> 부산 황령산 조망 지수 앱 — 오늘 황령산에 가면 얼마나 잘 보일까?

[![Live](https://img.shields.io/badge/Live-Demo-22d3ee?style=flat-square)](https://hwang-gam-ji.vercel.app/)

부산 황령산 봉수대에서의 조망(야경) 상태를 **가시거리·습도·미세먼지** 기반으로 점수화해 알려주는 웹앱입니다.

---

## 주요 기능

- **황감 점수** — 0~99점 (잭팟 시 1,000~10,000점)
- **상세 지표** — 가시거리(km), 초미세먼지, 습도, 풍속, 기온
- **24시간 예측** — 현재 시각 기준 예보 기반 점수 흐름
- **옷차림 추천** — 기온·풍속·날씨 기반 한 줄 팁

### 점수 체계

| 가시거리 | 점수 대역 | 설명 |
|----------|-----------|------|
| 50km↑ | 90~99 | 최상 |
| 40km 전후 | 80~89 | 우수 |
| 30km 전후 | 70~79 | 양호 |
| 0~20km | 0~69 | 가시거리에 비례 분포 |

- **10의 자리** = 가시거리로 결정  
- **1의 자리** = 습도·미세먼지 보정 (0~9)  
- **잭팟** = 70km↑ + 좋은 조건 시 10,000점

---

## 기술 스택

- **React 18** + **Vite**
- **React Router**
- **공공데이터포털 API** — 기상청 ASOS(가시거리), 단기예보, 부산 대기질

---

## 실행 방법

```bash
git clone https://github.com/yh5870/hwang-gam-ji.git
cd hwang-gam-ji
npm install
npm run dev
```

브라우저에서 http://localhost:5173/ 접속

### API 키 설정

1. [공공데이터포털](https://www.data.go.kr)에서 **일반 인증키** 발급
2. **기상청_지상(ASOS) 시간자료**, **단기예보 동네예보**, **부산광역시_대기질 정보** 활용 신청
3. 프로젝트 루트에 `.env` 생성:

```
VITE_KMA_API_KEY=발급받은_인증키
```

`.env.example`을 복사해 사용해도 됩니다.

### (권장) 운영 배포 시 키 숨기기 (Vercel)

- 이 프로젝트는 운영에서 **`/api/*` 서버리스 프록시**를 통해 공공데이터포털을 호출합니다(CORS 회피).
- Vercel 프로젝트 환경변수에 `KMA_API_KEY`를 추가하면, 프론트 번들에 키를 넣지 않아도 됩니다.
  - **Vercel Env**: `KMA_API_KEY=발급받은_인증키(디코딩)`
  - 이 경우 `.env`의 `VITE_KMA_API_KEY`는 비워도 동작합니다.

---

## 프로젝트 구조

```
src/
├── components/     # Fireflies, TabBar 등
├── contexts/       # WeatherContext
├── pages/          # Home, Detail, Forecast, About
├── services/       # weatherApi.js (API 연동)
└── utils/          # hwangGamAnalysis.js (점수 알고리즘)
data/
└── routes/         # about.json (등급 가이드)
```

---

## 배포

- **Vercel** — https://hwang-gam-ji.vercel.app/
- GitHub push 시 자동 배포

---

## 라이선스

Private
