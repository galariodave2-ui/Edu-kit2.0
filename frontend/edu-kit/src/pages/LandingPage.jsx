
import { Link } from 'react-router-dom'

export default function LandingPage({ user, profile }) {
  const dashboard =
    profile?.role === 'teacher'
      ? '/teacher'
      : profile?.role === 'admin'
        ? '/admin'
        : '/student'

  return (
    <main className="landing-page">
      <nav className="navbar navbar-expand-lg border-bottom sticky-top landing-navbar">
        <div className="container py-2">
          <Link
            className="navbar-brand fw-bold text-primary d-flex align-items-center gap-2"
            to="/"
          >
            <i className="bi bi-mortarboard-fill fs-3" />
            Edu-Kit
          </Link>

          <div className="d-flex gap-2">
            {user ? (
              <Link className="btn btn-primary" to={dashboard}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link className="btn btn-outline-primary" to="/login">
                  Login
                </Link>
                <Link className="btn btn-primary" to="/signup">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="hero-section py-5">
        <div className="container py-5">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <span className="badge rounded-pill text-bg-primary px-3 py-2 mb-3">
                SMARTER LEARNING
              </span>

              <h1 className="display-4 fw-bold mb-3 landing-heading">
                Build a brighter academic future with{' '}
                <span className="text-primary">Edu-Kit.</span>
              </h1>

              <p className="lead mb-4 landing-description">
                Manage grades, attendance, activities, subjects, and student
                progress in one responsive education platform.
              </p>

              <div className="d-flex flex-wrap gap-2">
                <Link
                  to={user ? dashboard : '/login'}
                  className="btn btn-primary btn-lg px-4"
                >
                  {user ? 'Open Dashboard' : 'Start Learning'}
                  <i className="bi bi-arrow-right ms-2" />
                </Link>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="hero-card shadow-lg rounded-5 p-4 p-md-5">
                <div className="row g-3">
                  <div className="col-6">
                    <div className="stat-box">
                      <i className="bi bi-bar-chart-line-fill text-primary fs-2" />
                      <h3>Progress</h3>
                      <p>Track academic performance</p>
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="stat-box">
                      <i className="bi bi-calendar-check-fill text-success fs-2" />
                      <h3>Attendance</h3>
                      <p>Monitor daily attendance</p>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="performance-box">
                      <div className="d-flex justify-content-between">
                        <span>Student Performance</span>
                        <strong>91.2%</strong>
                      </div>

                      <div className="progress mt-3" style={{ height: 10 }}>
                        <div
                          className="progress-bar"
                          style={{ width: '91.2%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
