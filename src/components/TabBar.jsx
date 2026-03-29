import { NavLink } from 'react-router-dom'
import './TabBar.css'

export default function TabBar() {
  const tabs = [
    { to: '/', label: '홈', icon: '◆' },
    { to: '/detail', label: '상세' },
    { to: '/forecast', label: '예측' },
    { to: '/map', label: '지도' },
  ]

  return (
    <nav className="tab-bar">
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
          end={to === '/'}
        >
          {icon && <span className="tab-icon">{icon}</span>}
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
