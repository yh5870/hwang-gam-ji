/**
 * 배포에 포함되는 공용 촬영 스팟. 모든 사용자에게 동일하게 표시됩니다.
 * 좌표는 네이버 지도 기준(WGS84) — 황령산 봉수대 일대 중심.
 *
 * 지도 첫 화면 중심은 아래 핀들의 평균 좌표를 씁니다. (getPublicMapSpotsCenter)
 */
export const PUBLIC_MAP_DEFAULT_ZOOM = 16

export const PUBLIC_MAP_SPOTS = [
  {
    id: 'pub-bongsudae',
    lat: 35.15723, 
    lng: 129.08191,
    title: '황령산 봉수대',
    note: '전망대와 포토 스팟이 유명해 여기 봉수대까지 안 올라 올 수 있는데, 진짜 봉수대는 여기입니다. 조금 더 높게 넓게 볼 수 있습니다.',
  },
  {
    id: 'pub-view-ridge',
    lat: 35.15731, 
    lng: 129.08161,
    title: '봉수대 앞 망원경 있는 전망대',
    note: '젤 유명한 전망대, 포토스팟. 앞에 가려지는 게 없어 탁 트인 전망을 볼 수 있습니다. 전포동/서면쪽 전망.',
  },
  {
    id: 'pub-approach',
    lat: 35.15790, 
    lng: 129.08281,
    title: '봉수대 접근 쪽',
    note: '봉수대 가기 전 나오는 전망대. 광안대교가 보이며 산에 가려 뷰가 탁 트여있진 않지만 멀리 보이는 광안대교가 이쁩니다. 내려가는 계단을 따라가면 카페도 있습니다. 여기는 그냥 들리는 곳. 봉수대까지 꼭 가셔야 돼요.',
  },
]

/** 공용 핀 위치의 평균 — 지도 초기 중심(디폴트 고정) */
export function getPublicMapSpotsCenter() {
  if (!PUBLIC_MAP_SPOTS.length) return { lat: 35.1575, lng: 129.082 }
  let lat = 0
  let lng = 0
  for (const p of PUBLIC_MAP_SPOTS) {
    lat += p.lat
    lng += p.lng
  }
  const n = PUBLIC_MAP_SPOTS.length
  return { lat: lat / n, lng: lng / n }
}
