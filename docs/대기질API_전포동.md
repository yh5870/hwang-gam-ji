# 부산광역시 대기질 API - 전포동 기준

## 개요

황령산 봉수대가 **전포동 쪽**에 위치하므로, 황감지 앱은 **전포동 측정소**의 대기질 데이터를 기준으로 사용합니다.

## API 정보

- **API명**: 부산광역시_대기질 정보 조회
- **공공데이터포털**: [15057173](https://www.data.go.kr/data/15057173/openapi.do)
- **엔드포인트**: `getAirQualityInfoClassifiedByStation`
- **Base URL**: `https://apis.data.go.kr/6260000/AirQualityInfoService`

## 파라미터

| 파라미터 | 필수 | 설명 |
|---------|-----|------|
| serviceKey | O | 공공데이터포털 인증키 (VITE_KMA_API_KEY와 동일) |
| pageNo | O | 1 |
| numOfRows | O | 100 |
| resultType | - | json |

## 전포동 측정소 필터

응답에서 `site`, `측정소명`, `stationName`, `areaName` 중 **전포, 전포동, 부산진구**를 포함하는 측정소를 우선 사용합니다. 없으면 첫 번째 측정소를 사용합니다.

## 활용신청

공공데이터포털에서 **부산광역시_대기질 정보 조회** API를 별도 활용신청해야 합니다. 기상청 API와 동일한 인증키를 사용할 수 있습니다.
