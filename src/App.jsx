import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WeatherProvider } from './contexts/WeatherContext'
import './App.css'
import Home from './pages/Home'
import Detail from './pages/Detail'
import Forecast from './pages/Forecast'
import About from './pages/About'
import TabBar from './components/TabBar'

export default function App() {
  return (
    <WeatherProvider>
      <BrowserRouter>
        <div className="app">
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/detail" element={<Detail />} />
              <Route path="/forecast" element={<Forecast />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </BrowserRouter>
    </WeatherProvider>
  )
}
