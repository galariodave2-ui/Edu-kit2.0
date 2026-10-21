import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'

function calculateGrade(quiz, assignment) {
  const values = [Number(quiz), Number(assignment)].filter(v => Number.isFinite(v) && v >= 0)
  if (!values.length) return 0
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

export default function TeacherDashboard({ user, onLogout }) {
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [quizScore, setQuizScore] = useState('')
  const [assignmentScore, setAssignmentScore] = useState('')
  const [attendance, setAttendance] = useState('')
  const [missingActivity, setMissingActivity] = useState('')
  const [remarks, setRemarks] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [backend, setBackend] = useState('checking')

  const loadStudents = async () => {
    const snapshot = await getDocs(collection(db, 'users'))
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.role === 'student')
    setStudents(list)
    if (!selectedId && list[0]) setSelectedId(list[0].id)
  }

  useEffect(() => { loadStudents().catch(err => setError(err.message)) }, [])
  useEffect(() => { fetch('/api/health').then(r => setBackend(r.ok ? 'online' : 'offline')).catch(() => setBackend('offline')) }, [])

  const selected = useMemo(() => students.find(s => s.id === selectedId), [students, selectedId])

  useEffect(() => {
    if (!selected) return
    setQuizScore(selected.quizScore ?? '')
    setAssignmentScore(selected.assignmentScore ?? '')
    setAttendance(selected.attendanceRate ?? '')
    setRemarks(selected.remarks ?? '')
  }, [selectedId, selected])

  const save = async e => {
    e.preventDefault(); setMessage(''); setError('')
    if (!selectedId) return setError('Select a student first.')
    const grade = calculateGrade(quizScore, assignmentScore)
    const predicted = Math.min(100, Math.round((grade * 0.7 + Number(attendance || 0) * 0.3) * 10) / 10)
    const missing = selected?.missingActivities ? [...selected.missingActivities] : []
    if (missingActivity.trim() && !missing.includes(missingActivity.trim())) missing.push(missingActivity.trim())
    await updateDoc(doc(db, 'users', selectedId), {
      quizScore: Number(quizScore) || 0,
      assignmentScore: Number(assignmentScore) || 0,
      currentGrade: grade,
      predictedGrade: predicted,
      attendanceRate: Number(attendance) || 0,
      missingActivities: missing,
      remarks: remarks.trim(),
      updatedAt: new Date(),
    })
    setMessage('Student record saved successfully.')
    setMissingActivity('')
    await loadStudents()
  }

  return <main className="dashboard-page"><nav className="navbar navbar-dark bg-dark sticky-top"><div className="container"><span className="navbar-brand fw-bold"><i className="bi bi-mortarboard-fill me-2" />Edu-Kit · Teacher</span><div className="d-flex align-items-center gap-2"><span className={`badge ${backend === 'online' ? 'text-bg-success' : 'text-bg-secondary'}`}>Express: {backend}</span><button className="btn btn-light btn-sm" onClick={onLogout}>Log out</button></div></div></nav><div className="container py-4 py-md-5"><div className="mb-4"><p className="text-primary fw-semibold mb-1">TEACHER DASHBOARD</p><h1 className="h2 fw-bold">Manage student performance</h1><p className="text-secondary">Update grades, attendance, missing activities and remarks. Changes are saved to Firestore.</p></div>{message && <div className="alert alert-success">{message}</div>}{error && <div className="alert alert-danger">{error}</div>}<div className="row g-4"><div className="col-lg-4"><div className="card border-0 shadow-sm rounded-4"><div className="card-body p-4"><h2 className="h5 fw-bold">Students ({students.length})</h2>{students.length ? <div className="list-group list-group-flush">{students.map(s => <button key={s.id} className={`list-group-item list-group-item-action px-0 ${selectedId === s.id ? 'active rounded-3' : ''}`} onClick={() => setSelectedId(s.id)}><div className="fw-semibold">{s.displayName || 'Unnamed student'}</div><small className={selectedId === s.id ? 'text-white-50' : 'text-secondary'}>{s.email}</small></button>)}</div> : <p className="text-secondary">No student accounts found. Create an account, then change its Firestore role to <code>student</code>.</p>}</div></div></div><div className="col-lg-8"><div className="card border-0 shadow-sm rounded-4"><div className="card-body p-4 p-md-5">{selected ? <><h2 className="h4 fw-bold">{selected.displayName || selected.email}</h2><p className="text-secondary">{selected.email}</p><form onSubmit={save}><div className="row g-3"><Field label="Quiz score (%)" value={quizScore} setValue={setQuizScore} /><Field label="Assignment score (%)" value={assignmentScore} setValue={setAssignmentScore} /><Field label="Attendance (%)" value={attendance} setValue={setAttendance} /><div className="col-12"><label className="form-label fw-semibold">Add missing activity</label><input className="form-control" value={missingActivity} onChange={e => setMissingActivity(e.target.value)} placeholder="e.g. Quiz 2" /></div><div className="col-12"><label className="form-label fw-semibold">Teacher remarks</label><textarea className="form-control" rows="4" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Write feedback..." /></div></div><div className="alert alert-primary mt-4 mb-4"><strong>Current grade:</strong> {calculateGrade(quizScore, assignmentScore).toFixed(1)}% &nbsp;·&nbsp; <strong>Predicted:</strong> {Math.min(100, calculateGrade(quizScore, assignmentScore) * 0.7 + Number(attendance || 0) * 0.3).toFixed(1)}%</div><button className="btn btn-primary btn-lg w-100">Save Student Record</button></form></> : <div className="text-center py-5 text-secondary">Select a student to begin.</div>}</div></div></div></div></div></main>
}

function Field({ label, value, setValue }) { return <div className="col-md-4"><label className="form-label fw-semibold">{label}</label><input className="form-control" type="number" min="0" max="100" step="0.1" value={value} onChange={e => setValue(e.target.value)} required /></div> }
