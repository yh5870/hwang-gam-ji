import { useCallback, useEffect, useRef, useState } from 'react'
import { PUBLIC_MAP_SPOTS, PUBLIC_MAP_DEFAULT_ZOOM, getPublicMapSpotsCenter } from '../data/publicMapSpots'
import { addLocalPin, getLocalPins, removeLocalPin, updateLocalPinPosition } from '../utils/localMapPins'
import './MapPage.css'

const MAP_CENTER = getPublicMapSpotsCenter()
const DEFAULT_ZOOM = PUBLIC_MAP_DEFAULT_ZOOM

function getNaverKeyId() {
  return (
    (import.meta.env.VITE_NAVER_MAP_KEY_ID || import.meta.env.VITE_NAVER_MAP_CLIENT_ID || '').trim()
  )
}

let scriptLoadPromise = null

function loadNaverMapsScript(keyId) {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.naver?.maps) return Promise.resolve()

  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const cbName = `__hwgjNaverInit_${Date.now()}`
    window[cbName] = () => {
      delete window[cbName]
      resolve()
    }

    const s = document.createElement('script')
    s.async = true
    s.dataset.hwgjNaverMaps = '1'
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(keyId)}&callback=${cbName}`
    s.onerror = () => {
      delete window[cbName]
      scriptLoadPromise = null
      reject(new Error('네이버 지도 스크립트 로드 실패'))
    }
    document.head.appendChild(s)
  })

  return scriptLoadPromise
}

function pinIconHtml(kind) {
  const bg = kind === 'public' ? '#22d3ee' : '#fbbf24'
  const border = kind === 'public' ? '#0e7490' : '#b45309'
  return `<div class="map-pin-icon" style="width:26px;height:26px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.45);border-bottom:2px solid ${border};"></div>`
}

export default function MapPage() {
  const keyId = getNaverKeyId()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const spotPanelRef = useRef(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [scriptError, setScriptError] = useState(null)
  const [authError, setAuthError] = useState(false)
  const [localPins, setLocalPinsState] = useState(() => getLocalPins())
  const [addMode, setAddMode] = useState(false)
  /** 지도 위 인포윈도우 대신 지도 아래 패널에 표시 */
  const [selectedPin, setSelectedPin] = useState(null)

  useEffect(() => {
    const sync = () => setLocalPinsState(getLocalPins())
    window.addEventListener('hwgj-local-pins-changed', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('hwgj-local-pins-changed', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    window.navermap_authFailure = () => setAuthError(true)
    return () => {
      delete window.navermap_authFailure
    }
  }, [])

  useEffect(() => {
    if (!keyId) {
      setScriptError(null)
      setScriptReady(false)
      return
    }
    let cancelled = false
    setScriptError(null)
    loadNaverMapsScript(keyId)
      .then(() => {
        if (!cancelled) setScriptReady(true)
      })
      .catch((e) => {
        scriptLoadPromise = null
        if (!cancelled) setScriptError(e?.message || '지도를 불러올 수 없습니다.')
      })
    return () => {
      cancelled = true
    }
  }, [keyId])

  useEffect(() => {
    if (!selectedPin || !spotPanelRef.current) return
    spotPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedPin])

  /** 내 핀 드래그 후 좌표가 바뀌면 패널 숫자도 맞춤 */
  useEffect(() => {
    setSelectedPin((cur) => {
      if (!cur || cur.kind !== 'local') return cur
      const p = localPins.find((x) => x.id === cur.id)
      if (!p) return null
      if (p.lat === cur.lat && p.lng === cur.lng) return cur
      return { ...cur, lat: p.lat, lng: p.lng }
    })
  }, [localPins])

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => {
      try {
        m.setMap(null)
      } catch {
        /* ignore */
      }
    })
    markersRef.current = []
  }, [])

  useEffect(() => {
    if (!scriptReady || !keyId || !containerRef.current || authError) return
    const naver = window.naver
    if (!naver?.maps) return

    const map = new naver.maps.Map(containerRef.current, {
      center: new naver.maps.LatLng(MAP_CENTER.lat, MAP_CENTER.lng),
      zoom: DEFAULT_ZOOM,
      mapTypeControl: true,
      zoomControl: true,
    })
    mapRef.current = map
    setMapReady(true)

    const onResize = () => {
      try {
        map.refresh?.()
        naver.maps.Event?.trigger?.(map, 'resize')
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('resize', onResize)
    requestAnimationFrame(onResize)
    setTimeout(onResize, 200)
    setTimeout(onResize, 600)

    return () => {
      window.removeEventListener('resize', onResize)
      setMapReady(false)
      clearMarkers()
      mapRef.current = null
      try {
        if (typeof map.destroy === 'function') map.destroy()
      } catch {
        /* ignore */
      }
    }
  }, [scriptReady, keyId, authError, clearMarkers])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    const naver = window.naver
    if (!map || !naver?.maps) return

    clearMarkers()

    PUBLIC_MAP_SPOTS.forEach((spot) => {
      const pos = new naver.maps.LatLng(spot.lat, spot.lng)
      const marker = new naver.maps.Marker({
        position: pos,
        map,
        title: spot.title,
        icon: {
          content: pinIconHtml('public'),
          anchor: new naver.maps.Point(13, 13),
        },
        zIndex: 100,
      })
      naver.maps.Event.addListener(marker, 'click', () => {
        setSelectedPin({
          kind: 'public',
          id: spot.id,
          title: spot.title,
          note: spot.note || '',
        })
      })
      markersRef.current.push(marker)
    })

    localPins.forEach((spot) => {
      const pos = new naver.maps.LatLng(spot.lat, spot.lng)
      const marker = new naver.maps.Marker({
        position: pos,
        map,
        title: spot.title,
        draggable: true,
        icon: {
          content: pinIconHtml('local'),
          anchor: new naver.maps.Point(13, 13),
        },
        zIndex: 200,
      })
      naver.maps.Event.addListener(marker, 'click', () => {
        setSelectedPin({
          kind: 'local',
          id: spot.id,
          title: spot.title,
          lat: spot.lat,
          lng: spot.lng,
        })
      })
      naver.maps.Event.addListener(marker, 'dragend', (e) => {
        const c = e.coord
        updateLocalPinPosition(spot.id, c.lat(), c.lng())
      })
      markersRef.current.push(marker)
    })
  }, [mapReady, localPins, clearMarkers])

  useEffect(() => {
    if (!mapReady || !addMode) return
    const map = mapRef.current
    const naver = window.naver
    if (!map || !naver?.maps) return

    const listener = naver.maps.Event.addListener(map, 'click', (e) => {
      const title = window.prompt('이 핀의 이름을 입력하세요', '내 촬영 스팟')
      setAddMode(false)
      if (title === null) return
      addLocalPin({
        lat: e.coord.lat(),
        lng: e.coord.lng(),
        title: title.trim() || '내 촬영 스팟',
      })
    })

    return () => {
      naver.maps.Event.removeListener(listener)
    }
  }, [mapReady, addMode])

  const handleRemove = (id) => {
    if (!window.confirm('이 핀을 삭제할까요? (이 기기에서만 삭제됩니다)')) return
    removeLocalPin(id)
  }

  if (!keyId) {
    return (
      <div className="map-page">
        <h1 className="page-title">촬영 스팟 지도</h1>
        <div className="map-page-panel glass map-page-error">
          <p>
            네이버 지도 API 키가 없습니다. 네이버 클라우드 플랫폼에서 <strong>Maps &gt; Web Dynamic Map</strong>용{' '}
            <strong>ncpKeyId</strong>를 발급한 뒤, 프로젝트 루트 <code>.env</code>에 다음을 넣어 주세요.
          </p>
          <pre className="map-env-hint">VITE_NAVER_MAP_KEY_ID=발급받은_키_ID</pre>
          <p className="map-page-muted">
            무료 한도는 콘솔 안내를 따릅니다. 배포 시 Vercel 등에도 동일 변수를 등록하고, 앱 설정에 사이트 도메인을
            등록해야 합니다.
          </p>
        </div>
      </div>
    )
  }

  if (scriptError || authError) {
    return (
      <div className="map-page">
        <h1 className="page-title">촬영 스팟 지도</h1>
        <div className="map-page-panel glass map-page-error">
          <p>{authError ? '네이버 지도 인증에 실패했습니다. 콘솔에서 키·도메인(로컬·배포 URL)을 확인해 주세요.' : scriptError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="map-page">
      <h1 className="page-title">촬영 스팟 지도</h1>
      <p className="map-page-lead">
        <span className="map-legend map-legend--public">●</span> 추천 스팟(모든 사용자){' '}
        <span className="map-legend map-legend--local">●</span> 내 핀(이 브라우저만){' '}
        — 노란 <strong>내 핀</strong>은 잡고 드래그하면 위치가 저장됩니다.
      </p>

      <div className="map-toolbar">
        <button
          type="button"
          className={`map-toolbar-btn glass ${addMode ? 'active' : ''}`}
          onClick={() => setAddMode((v) => !v)}
          disabled={!mapReady}
        >
          {addMode ? '취소' : '지도에서 내 핀 찍기'}
        </button>
        {addMode && <span className="map-toolbar-hint">지도를 한 번 탭하면 핀이 추가됩니다.</span>}
      </div>

      <div className={`map-canvas-wrap ${addMode ? 'map-canvas-wrap--add' : ''}`}>
        <div ref={containerRef} className="map-canvas" role="application" aria-label="황령산 일대 지도" />
        {!scriptReady && <div className="map-canvas-placeholder">지도 불러오는 중…</div>}
      </div>

      {selectedPin && (
        <section ref={spotPanelRef} className="map-spot-panel glass" aria-live="polite">
          <div className="map-spot-panel-top">
            <span className={`map-spot-kind ${selectedPin.kind === 'public' ? 'is-public' : 'is-local'}`}>
              {selectedPin.kind === 'public' ? '추천 스팟' : '내 핀'}
            </span>
            <button type="button" className="map-spot-close" onClick={() => setSelectedPin(null)} aria-label="설명 닫기">
              닫기
            </button>
          </div>
          <h2 className="map-spot-title">{selectedPin.title}</h2>
          {selectedPin.kind === 'public' && selectedPin.note && (
            <p className="map-spot-note">{selectedPin.note}</p>
          )}
          {selectedPin.kind === 'local' && (
            <>
              <p className="map-spot-hint">이 기기에만 저장됩니다. 핀을 드래그하면 위치를 바꿀 수 있어요.</p>
              <p className="map-spot-coords">
                {selectedPin.lat.toFixed(5)}, {selectedPin.lng.toFixed(5)}
              </p>
            </>
          )}
        </section>
      )}

      {localPins.length > 0 && (
        <section className="map-local-list glass" aria-label="내가 추가한 핀">
          <h2 className="map-local-title">내 핀</h2>
          <ul>
            {localPins.map((p) => (
              <li key={p.id} className="map-local-item">
                <span className="map-local-name">{p.title}</span>
                <span className="map-local-coord">
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </span>
                <button type="button" className="map-local-remove" onClick={() => handleRemove(p.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="map-page-footnote">
        공용 핀은 앱에 포함된 좌표이며, 내 핀은 이 기기에만 저장되고 드래그로 위치를 고칠 수 있습니다.
      </p>
    </div>
  )
}
