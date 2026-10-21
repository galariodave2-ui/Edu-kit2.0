
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase.js";

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTimestamp = (value) => {
  if (!value) return "-";

  const date = value.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const DEFAULT_WEIGHTS = {
  quizzes: 5,
  activities: 10,
  homework: 5,
  projects: 25,
  exams: 30,
};

const getCategory = (type) => {
  const value = String(type || "").toLowerCase();

  if (["quiz", "quizzes"].includes(value)) return "quizzes";
  if (["activity", "activities"].includes(value)) return "activities";
  if (["homework", "homeworks"].includes(value)) return "homework";
  if (["project", "projects"].includes(value)) return "projects";
  if (["exam", "exams"].includes(value)) return "exams";

  return "";
};

const getPercentage = (score) => {
  if (score.percentage !== undefined && score.percentage !== null) {
    return Number(score.percentage) || 0;
  }

  const maxScore = Number(score.maxScore) || 0;

  if (maxScore <= 0) return 0;

  return ((Number(score.score) || 0) / maxScore) * 100;
};

const getAcademicGrade = (studentScores) => {
  const totals = {
    quizzes: [],
    activities: [],
    homework: [],
    projects: [],
    exams: [],
  };

  studentScores.forEach((score) => {
    const category = getCategory(score.type);

    if (category) {
      totals[category].push(getPercentage(score));
    }
  });

  return Object.keys(DEFAULT_WEIGHTS).reduce((total, category) => {
    const values = totals[category];

    const average = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;

    return total + average * (DEFAULT_WEIGHTS[category] / 100);
  }, 0);
};

const getAttendanceGrade = (records) => {
  if (!records.length) return 15;

  const present = records.filter(
    (record) => record.status === "Present"
  ).length;

  return (present / records.length) * 15;
};

const getFinalGrade = (studentScores, attendanceRecords) => {
  const academicGrade = getAcademicGrade(studentScores);
  const attendanceGrade = getAttendanceGrade(attendanceRecords);

  return academicGrade * 0.9 + attendanceGrade * 0.1;
};

export default function Student({ user, onLogout }) {
  const [studentRecords, setStudentRecords] = useState([]);
  const [scores, setScores] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedSemester, setSelectedSemester] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState("All");

  const email = String(user?.email || "")
    .trim()
    .toLowerCase();

  useEffect(() => {
    if (!email) {
      setStudentRecords([]);
      setLoading(false);
      setError("Walang email sa naka-login na student profile.");
      return;
    }

    setLoading(true);
    setError("");

    const studentQuery = query(
      collection(db, "students"),
      where("email", "==", email)
    );

    const unsubscribe = onSnapshot(
      studentQuery,
      (snapshot) => {
        const records = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setStudentRecords(records);
        setLoading(false);

        if (!records.length) {
          setError(
            "Walang student record na tumutugma sa iyong login email. Ipa-check sa administrator ang email sa Student Section."
          );
        } else {
          setError("");
        }
      },
      (firebaseError) => {
        console.error("Student profile error:", firebaseError);
        setError(
          "Hindi mabasa ang student records. Tingnan ang Firestore permissions at internet connection."
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [email]);

  const studentDocumentIds = useMemo(
    () => [...new Set(studentRecords.map((student) => student.id))].slice(0, 30),
    [studentRecords]
  );

  const teacherIds = useMemo(
    () =>
      [
        ...new Set(
          studentRecords
            .map((student) => student.teacherId)
            .filter(Boolean)
        ),
      ].slice(0, 30),
    [studentRecords]
  );

  useEffect(() => {
    if (!studentDocumentIds.length) {
      setScores([]);
      setAttendance([]);
      return;
    }

    const scoresQuery = query(
      collection(db, "scores"),
      where("studentDocumentId", "in", studentDocumentIds)
    );

    const attendanceQuery = query(
      collection(db, "attendance"),
      where("studentDocumentId", "in", studentDocumentIds)
    );

    const unsubscribeScores = onSnapshot(
      scoresQuery,
      (snapshot) => {
        setScores(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (firebaseError) => {
        console.error("Student scores error:", firebaseError);
        setError(
          "Hindi mabasa ang grades. Tingnan ang Firestore permissions."
        );
      }
    );

    const unsubscribeAttendance = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        setAttendance(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (firebaseError) => {
        console.error("Student attendance error:", firebaseError);
        setError(
          "Hindi mabasa ang attendance records. Tingnan ang Firestore permissions."
        );
      }
    );

    return () => {
      unsubscribeScores();
      unsubscribeAttendance();
    };
  }, [studentDocumentIds]);

  useEffect(() => {
    if (!teacherIds.length) {
      setAssessments([]);
      return;
    }

    const assessmentsQuery = query(
      collection(db, "assessments"),
      where("teacherId", "in", teacherIds)
    );

    const unsubscribe = onSnapshot(
      assessmentsQuery,
      (snapshot) => {
        setAssessments(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (firebaseError) => {
        console.error("Student assessments error:", firebaseError);
        setError(
          "Hindi mabasa ang assessments. Tingnan ang Firestore permissions."
        );
      }
    );

    return () => unsubscribe();
  }, [teacherIds]);

  const subjects = useMemo(
    () => [
      ...new Set(
        studentRecords.map((student) => student.subject).filter(Boolean)
      ),
    ],
    [studentRecords]
  );

  const visibleStudents = useMemo(
    () =>
      selectedSubject === "All"
        ? studentRecords
        : studentRecords.filter(
            (student) => student.subject === selectedSubject
          ),
    [studentRecords, selectedSubject]
  );

  const visibleAssessments = useMemo(
    () =>
      assessments.filter((assessment) => {
        const subjectMatches =
          selectedSubject === "All" ||
          assessment.subject === selectedSubject;

        const semesterMatches =
          selectedSemester === "All" ||
          assessment.semester === selectedSemester;

        const periodMatches =
          selectedPeriod === "All" ||
          assessment.period === selectedPeriod;

        return subjectMatches && semesterMatches && periodMatches;
      }),
    [assessments, selectedSubject, selectedSemester, selectedPeriod]
  );

  const visibleAssessmentIds = useMemo(
    () => new Set(visibleAssessments.map((assessment) => assessment.id)),
    [visibleAssessments]
  );

  const visibleScores = useMemo(
    () =>
      scores.filter((score) => {
        const assessmentMatches =
          visibleAssessmentIds.has(score.assessmentId);

        const semesterMatches =
          selectedSemester === "All" ||
          score.semester === selectedSemester;

        const periodMatches =
          selectedPeriod === "All" ||
          score.period === selectedPeriod;

        const subjectMatches =
          selectedSubject === "All" ||
          !score.subject ||
          score.subject === selectedSubject;

        return (
          assessmentMatches &&
          semesterMatches &&
          periodMatches &&
          subjectMatches
        );
      }),
    [
      scores,
      visibleAssessmentIds,
      selectedSemester,
      selectedPeriod,
      selectedSubject,
    ]
  );

  const getStudentScores = (student) =>
    visibleScores.filter(
      (score) =>
        score.studentDocumentId === student.id &&
        (!score.subject || score.subject === student.subject)
    );

  const getStudentAttendance = (student) =>
    attendance.filter(
      (record) =>
        record.studentDocumentId === student.id &&
        (!record.subject || record.subject === student.subject)
    );

  const allMyScores = useMemo(
    () =>
      scores.filter((score) =>
        studentDocumentIds.includes(score.studentDocumentId)
      ),
    [scores, studentDocumentIds]
  );

  const allMyAttendance = useMemo(
    () =>
      attendance.filter((record) =>
        studentDocumentIds.includes(record.studentDocumentId)
      ),
    [attendance, studentDocumentIds]
  );

  const allPresent = allMyAttendance.filter(
    (record) => record.status === "Present"
  ).length;

  const attendancePercentage = allMyAttendance.length
    ? (allPresent / allMyAttendance.length) * 100
    : null;

  const overallAcademicGrade = getAcademicGrade(allMyScores);

  const overallFinalGrade = getFinalGrade(
    allMyScores,
    allMyAttendance
  );

  const assessmentById = useMemo(
    () => new Map(assessments.map((assessment) => [assessment.id, assessment])),
    [assessments]
  );

  if (loading) {
    return (
      <div className="container min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <h5>Loading Student Portal...</h5>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">
          Hindi makita ang email ng naka-login na account. Mag-log in ulit at subukan muli.
        </div>
      </div>
    );
  }

  if (!studentRecords.length) {
    return (
      <div className="min-vh-100 bg-light">
        <nav className="navbar navbar-dark bg-primary px-3 px-md-4">
          <span className="navbar-brand fw-bold">
            <i className="bi bi-mortarboard-fill me-2" />
            Edu-Kit Student Portal
          </span>

          <button
            type="button"
            className="btn btn-danger"
            onClick={onLogout}
          >
            Logout
          </button>
        </nav>

        <div className="container py-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h3 className="fw-bold">Student record not found</h3>
              <p className="text-muted">
                Naka-login ka bilang <strong>{email}</strong>, pero wala pang
                student record na may kaparehong email sa Firestore
                collection na <code>students</code>.
              </p>
              <div className="alert alert-warning mb-0">
                {error ||
                  "Ipa-check sa administrator kung tama ang Student Gmail na inilagay sa Student Section."}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-dark bg-primary shadow-sm px-3 px-md-4">
        <div>
          <span className="navbar-brand fw-bold">
            <i className="bi bi-mortarboard-fill me-2" />
            Edu-Kit
          </span>
          <small className="text-white-50 d-block">Student Portal</small>
        </div>

        <button
          type="button"
          className="btn btn-danger"
          onClick={onLogout}
        >
          <i className="bi bi-box-arrow-right me-2" />
          Logout
        </button>
      </nav>

      <main className="container-fluid px-3 px-md-4 py-4">
        <div className="mb-4">
          <h2 className="fw-bold mb-1">
            Welcome, {studentRecords[0]?.name || user?.displayName || "Student"}!
          </h2>
          <p className="text-muted mb-0">
            Tingnan ang iyong grades, assessments, subjects, at attendance.
          </p>
          <small className="text-muted">{email}</small>
        </div>

        {error && (
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2" />
            {error}
          </div>
        )}

        <div className="row g-3 mb-4">
          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted">Enrolled Subjects</div>
                <h2 className="fw-bold text-primary mb-0">
                  {studentRecords.length}
                </h2>
                <small className="text-muted">Student enrollment records</small>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted">Recorded Scores</div>
                <h2 className="fw-bold text-success mb-0">
                  {allMyScores.length}
                </h2>
                <small className="text-muted">Scores saved by your teacher</small>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted">Attendance Rate</div>
                <h2 className="fw-bold text-info mb-0">
                  {attendancePercentage === null
                    ? "—"
                    : `${attendancePercentage.toFixed(1)}%`}
                </h2>
                <small className="text-muted">
                  {allMyAttendance.length} recorded attendance days
                </small>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted">Academic Grade</div>
                <h2 className="fw-bold text-warning mb-0">
                  {overallAcademicGrade.toFixed(2)}%
                </h2>
                <small className="text-muted">Based on recorded assessment scores</small>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
              <div>
                <h4 className="fw-bold mb-1">My Academic Progress</h4>
                <p className="text-muted mb-0">
                  Filter your records by subject, semester, and grading period.
                </p>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <select
                  className="form-select"
                  value={selectedSubject}
                  onChange={(event) => setSelectedSubject(event.target.value)}
                  aria-label="Filter subject"
                >
                  <option value="All">All Subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>

                <select
                  className="form-select"
                  value={selectedSemester}
                  onChange={(event) => setSelectedSemester(event.target.value)}
                  aria-label="Filter semester"
                >
                  <option value="All">All Semesters</option>
                  <option value="1st">1st Semester</option>
                  <option value="2nd">2nd Semester</option>
                </select>

                <select
                  className="form-select"
                  value={selectedPeriod}
                  onChange={(event) => setSelectedPeriod(event.target.value)}
                  aria-label="Filter grading period"
                >
                  <option value="All">All Periods</option>
                  <option value="Prelim">Prelim</option>
                  <option value="Midterm">Midterm</option>
                  <option value="Finals">Finals</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-4">
          {visibleStudents.map((student) => {
            const studentScores = getStudentScores(student);
            const studentAttendance = getStudentAttendance(student);
            const academicGrade = getAcademicGrade(studentScores);
            const finalGrade = getFinalGrade(studentScores, studentAttendance);
            const present = studentAttendance.filter(
              (record) => record.status === "Present"
            ).length;
            const attendanceRate = studentAttendance.length
              ? (present / studentAttendance.length) * 100
              : null;

            return (
              <div className="col-md-6 col-xl-4" key={student.id}>
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <h5 className="fw-bold mb-1">
                          {student.subject || "Subject not specified"}
                        </h5>
                        <div className="text-muted small">
                          Teacher: {student.teacherName || "Not specified"}
                        </div>
                      </div>
                      <span className="badge bg-primary">
                        {student.studentId || "Student"}
                      </span>
                    </div>

                    <hr />

                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Academic Grade</span>
                      <strong>{academicGrade.toFixed(2)}%</strong>
                    </div>

                    <div className="progress mb-3" style={{ height: "8px" }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{
                          width: `${Math.min(100, Math.max(0, academicGrade))}%`,
                        }}
                        aria-valuenow={academicGrade}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>

                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Attendance</span>
                      <strong>
                        {attendanceRate === null
                          ? "No records"
                          : `${attendanceRate.toFixed(1)}%`}
                      </strong>
                    </div>

                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Final Grade</span>
                      <strong className="text-primary">
                        {finalGrade.toFixed(2)}
                      </strong>
                    </div>

                    <div className="small text-muted mt-3">
                      {studentScores.length} score(s) ·{" "}
                      {studentAttendance.length} attendance record(s)
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">
              <i className="bi bi-journal-check text-primary me-2" />
              My Assessments and Grades
            </h4>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Subject</th>
                    <th>Assessment</th>
                    <th>Type</th>
                    <th>Semester</th>
                    <th>Period</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAssessments.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center text-muted py-4">
                        No assessments found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    visibleAssessments.map((assessment) => {
                      const matchingScores = visibleStudents.flatMap((student) =>
                        scores
                          .filter(
                            (score) =>
                              score.studentDocumentId === student.id &&
                              score.assessmentId === assessment.id
                          )
                          .map((score) => ({ ...score, matchedStudent: student }))
                      );

                      return matchingScores.length ? (
                        matchingScores.map((score) => (
                          <tr key={score.id}>
                            <td>{score.subject || score.matchedStudent.subject || "-"}</td>
                            <td className="fw-semibold">
                              {assessment.title || score.assessmentTitle || score.title || "-"}
                            </td>
                            <td>{assessment.type || score.type || "-"}</td>
                            <td>{assessment.semester || score.semester || "-"}</td>
                            <td>{assessment.period || score.period || "-"}</td>
                            <td>{formatDate(assessment.date)}</td>
                            <td>
                              {Number(score.score)} / {Number(score.maxScore)}
                            </td>
                            <td>
                              <span className="badge bg-primary">
                                {getPercentage(score).toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : null;
                    })
                  )}
                  {visibleAssessments.length > 0 &&
                    !visibleAssessments.some((assessment) =>
                      visibleScores.some(
                        (score) =>
                          score.assessmentId === assessment.id &&
                          visibleStudents.some(
                            (student) => student.id === score.studentDocumentId
                          )
                      )
                    ) && (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          May assessments na, pero wala pang score na na-save ang teacher para sa iyo.
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">
              <i className="bi bi-calendar-check text-success me-2" />
              My Attendance Records
            </h4>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Subject</th>
                    <th>Teacher</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allMyAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">
                        Wala pang attendance na naitala ng teacher.
                      </td>
                    </tr>
                  ) : (
                    [...allMyAttendance]
                      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
                      .map((record) => (
                        <tr key={record.id}>
                          <td>{formatDate(record.date)}</td>
                          <td>{record.subject || "-"}</td>
                          <td>{record.teacherName || "-"}</td>
                          <td>
                            <span
                              className={`badge ${
                                record.status === "Present"
                                  ? "bg-success"
                                  : record.status === "Absent"
                                  ? "bg-danger"
                                  : "bg-secondary"
                              }`}
                            >
                              {record.status || "Not Marked"}
                            </span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h5 className="fw-bold">
              <i className="bi bi-info-circle justify-content text-primary me-2" />
              Your Future Start's Today, Not Tomorrow!
            </h5>
            <p className="text-muted align-items-center mb-0">
                 Keep Learning and Growing with Edu-Kit!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}