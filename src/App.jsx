import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WeatherProvider } from './contexts/WeatherContext'
import ThemeByTime from './components/ThemeByTime'
import './App.css'
import Fireflies from './components/Fireflies'
import AuroraSweep from './components/AuroraSweep'
import Home from './pages/Home'
import Detail from './pages/Detail'
import Forecast from './pages/Forecast'
import MapPage from './pages/MapPage'
import TabBar from './components/TabBar'

export default function App() {
  return (
    <WeatherProvider>
      <ThemeByTime />
      <BrowserRouter>
        <div className="app">
          {/* 배경 레이어 (z-index 0, 콘텐츠 뒤) */}
          <Fireflies />

          {/* 전환 효과 (z-index 20, 일시적으로 최상위) */}
          <AuroraSweep />

          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/detail" element={<Detail />} />
              <Route path="/forecast" element={<Forecast />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/about" element={<Navigate to="/map" replace />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </BrowserRouter>
    </WeatherProvider>
  )
}
