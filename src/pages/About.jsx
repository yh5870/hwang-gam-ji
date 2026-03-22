import aboutData from '../../data/routes/about.json'
import './About.css'

export default function About() {
  return (
    <div className="about-page">
      <h1 className="page-title">황감 지수 가이드</h1>

      <section className="glass formula-section">
        <h2>산출 공식</h2>
        <p className="formula">{aboutData.formula}</p>
        <p className="formula-desc">
          {aboutData.formula_note}
        </p>
      </section>

      <section className="grade-section">
        <h2>등급 가이드</h2>
        <div className="grade-list">
          {aboutData.grade_guide.map((g, i) => (
            <div key={i} className="grade-card glass">
              <div className="grade-header">
                <span className="grade-label">{g.label}</span>
                <span className="grade-range">{g.score_range}점</span>
              </div>
              <p className="grade-desc">{g.desc}</p>
              <p className="grade-km">
                {g.max_km >= 999 ? `${g.min_km}km 이상` : g.min_km === 0 ? `~${g.max_km}km` : `${g.min_km}~${g.max_km}km`}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
