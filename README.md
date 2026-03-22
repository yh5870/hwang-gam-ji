# 황감지 (Hwang-Gam-Ji)

부산 황령산 조망 지수 시각화 목업 웹앱

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173/ 접속

## 기상청 API 연동

### 1. API 키 발급
- [공공데이터포털](https://www.data.go.kr) 접속
- **기상청_지상(종관, ASOS) 시간자료** + **단기예보 동네예보** 활용 신청
- **일반 인증키(디코딩)** 복사

### 2. 환경변수 설정
프로젝트 루트에 `.env` 파일 생성:

```
VITE_KMA_API_KEY=여기에_발급받은_인증키_붙여넣기
```

`.env.example`을 복사해 `.env`로 이름 변경 후 키 입력해도 됨.

### 3. 동작
- API 키가 있으면 **실시간 기상청 데이터** 자동 로드
- 부산(159) ASOS 시정 → 가시거리 km
- 황령산 격자(98, 75) 단기예보 → 습도, 하늘상태

## 빌드

```bash
npm run build
npm run preview  # 빌드 결과물 미리보기
```

## 프로젝트 구조

- `/data/routes/about.json` - 등급 가이드 등 정적 데이터
- `/src/contexts/WeatherContext.jsx` - 날씨 상태·API 호출
- `/src/services/weatherApi.js` - 기상청 API 연동
- `/src/utils/hwangGamAnalysis.js` - 황감 지수 알고리즘

## 라우트

| 경로 | 설명 |
|------|------|
| `/` | 메인 대시보드 (황감 점수, 잭팟) |
| `/detail` | 상세 지표 (가시거리, 미세먼지 등) |
| `/forecast` | 24시간 예측 |
| `/about` | 황감 지수 공식 및 등급 가이드 |

