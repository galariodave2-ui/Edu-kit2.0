import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";

const formatGrade = (value) =>
  Number.isFinite(value) ? value.toFixed(2) : "0.00";

export default function StudentDashboard({ student: profileStudent }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [studentRecord, setStudentRecord] = useState(null);
  const [scores, setScores] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const email = (
    currentUser?.email ||
    profileStudent?.email ||
    ""
  ).trim().toLowerCase();

  useEffect(() => {
    if (!email) {
      setStudentRecord(null);
      setLoading(false);
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
        if (snapshot.empty) {
          setStudentRecord(null);
          setError(
            "Your Gmail is not linked to a student record. Ask the administrator to add your Gmail in the Student Section."
          );
          setLoading(false);
          return;
        }

        const matchingStudent = snapshot.docs[0];

        setStudentRecord({
          id: matchingStudent.id,
          ...matchingStudent.data(),
        });

        setError("");
        setLoading(false);
      },
      (err) => {
        console.error("Student profile error:", err);
        setError("Unable to load your student profile. Check your Firestore permissions and connection.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [email]);

  useEffect(() => {
    if (!studentRecord?.id) {
      setScores([]);
      setAssessments([]);
      setAttendance([]);
      return;
    }

    const scoreQuery = query(
      collection(db, "scores"),
      where("studentDocumentId", "==", studentRecord.id)
    );

    const unsubscribeScores = onSnapshot(
      scoreQuery,
      (snapshot) => {
        setScores(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (err) => {
        console.error("Student scores error:", err);
        setError("Unable to load your scores. Check your Firestore permissions.");
      }
    );

    const attendanceQuery = query(
      collection(db, "attendance"),
      where("studentDocumentId", "==", studentRecord.id)
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
      (err) => {
        console.error("Student attendance error:", err);
      }
    );

    let unsubscribeAssessments = () => {};

    if (studentRecord.teacherId) {
      const assessmentQuery = query(
        collection(db, "assessments"),
        where("teacherId", "==", studentRecord.teacherId)
      );

      unsubscribeAssessments = onSnapshot(
        assessmentQuery,
        (snapshot) => {
          const data = snapshot.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            }))
            .filter(
              (assessment) =>
                !assessment.subject ||
                !studentRecord.subject ||
                assessment.subject === studentRecord.subject
            );

          setAssessments(data);
        },
        (err) => {
          console.error("Student assessments error:", err);
          setError("Unable to load your assessments. Check your Firestore permissions.");
        }
      );
    } else {
      setAssessments([]);
    }

    return () => {
      unsubscribeScores();
      unsubscribeAttendance();
      unsubscribeAssessments();
    };
  }, [
    studentRecord?.id,
    studentRecord?.teacherId,
    studentRecord?.subject,
  ]);

  const scoreByAssessment = useMemo(() => {
    const result = new Map();

    scores.forEach((score) => {
      if (score.assessmentId) {
        result.set(score.assessmentId, score);
      }
    });

    return result;
  }, [scores]);

  const assessmentResults = useMemo(() => {
    return assessments.map((assessment) => {
      const savedScore = scoreByAssessment.get(assessment.id);
      const maxScore = Number(assessment.maxScore) || 100;
      const scoreValue =
        savedScore && savedScore.score !== undefined
          ? Number(savedScore.score)
          : null;

      const percentage =
        savedScore && savedScore.percentage !== undefined
          ? Number(savedScore.percentage)
          : scoreValue !== null && maxScore > 0
          ? (scoreValue / maxScore) * 100
          : null;

      return {
        ...assessment,
        scoreValue,
        maxScore,
        percentage,
        completed: scoreValue !== null,
      };
    });
  }, [assessments, scoreByAssessment]);

  const gradedResults = assessmentResults.filter(
    (item) =>
      item.completed &&
      Number.isFinite(item.percentage)
  );

  const currentGrade =
    gradedResults.length > 0
      ? gradedResults.reduce(
          (total, item) => total + item.percentage,
          0
        ) / gradedResults.length
      : 0;

  const attendanceRate =
    attendance.length > 0
      ? (attendance.filter(
          (record) => record.status === "Present"
        ).length /
          attendance.length) *
        100
      : 0;

  const missingAssessments = assessmentResults.filter(
    (item) => !item.completed
  );

  const periods = ["Prelim", "Midterm", "Finals"];

  const periodGrades = periods.map((period) => {
    const periodResults = gradedResults.filter(
      (item) => item.period === period
    );

    const average =
      periodResults.length > 0
        ? periodResults.reduce(
            (total, item) => total + item.percentage,
            0
          ) / periodResults.length
        : null;

    return {
      period,
      average,
      count: periodResults.length,
    };
  });

  if (!currentUser) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">
          Please log in to view your student portal.
          <div className="mt-3">
            <button
              className="btn btn-primary"
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" />
          <h5>Loading your grades...</h5>
        </div>
      </div>
    );
  }

  if (!studentRecord) {
    return (
      <div className="container py-5">
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <h3 className="fw-bold">Student Profile Not Found</h3>
            <p className="text-muted">
              Signed-in Gmail: {email || "No email available"}
            </p>
            <div className="alert alert-warning">
              {error ||
                "Ask your administrator to add this Gmail to the Student Section."}
            </div>
            <button
              className="btn btn-outline-primary"
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Back to Login
            </button>
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
          <small className="text-white-50 d-block">
            Student Portal
          </small>
        </div>

        <button
          className="btn btn-outline-light"
          onClick={() => {
            window.location.href = "/login";
          }}
        >
          <i className="bi bi-box-arrow-right me-2" />
          Back to Login
        </button>
      </nav>

      <main className="container-fluid px-3 px-md-4 py-4">
        <div className="mb-4">
          <h2 className="fw-bold">
            Welcome, {studentRecord.name || currentUser.displayName || "Student"}!
          </h2>
          <p className="text-muted mb-1">
            View your grades, assessments, and attendance progress.
          </p>
          <small className="text-muted">{email}</small>
        </div>

        {error && (
          <div className="alert alert-warning">
            {error}
          </div>
        )}

        <div className="row g-3 mb-4">
          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted">Current Average</div>
                <h2 className="fw-bold text-primary mt-2">
                  {formatGrade(currentGrade)}%
                </h2>
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${Math.min(100, Math.max(0, currentGrade))}%`,
                    }}
                  />
                </div>
                <small className="text-muted">
                  Average of assessments with scores
                </small>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted">Attendance Rate</div>
                <h2 className="fw-bold text-success mt-2">
                  {formatGrade(attendanceRate)}%
                </h2>
                <small className="text-muted">
                  {attendance.filter(
                    (record) => record.status === "Present"
                  ).length}{" "}
                  present out of {attendance.length} recorded attendance entries
                </small>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted">Graded Assessments</div>
                <h2 className="fw-bold text-success mt-2">
                  {gradedResults.length}
                </h2>
                <small className="text-muted">
                  Out of {assessmentResults.length} assessments
                </small>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="text-muted">Pending Scores</div>
                <h2 className="fw-bold text-danger mt-2">
                  {missingAssessments.length}
                </h2>
                <small className="text-muted">
                  Assessments without a saved score
                </small>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">My Student Information</h4>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <small className="text-muted">Student Name</small>
                <div className="fw-semibold">
                  {studentRecord.name || "-"}
                </div>
              </div>
              <div className="col-md-4">
                <small className="text-muted">Student ID</small>
                <div className="fw-semibold">
                  {studentRecord.studentId || "-"}
                </div>
              </div>
              <div className="col-md-4">
                <small className="text-muted">Course</small>
                <div className="fw-semibold">
                  {studentRecord.course || "-"}
                </div>
              </div>
              <div className="col-md-4">
                <small className="text-muted">Subject</small>
                <div className="fw-semibold">
                  {studentRecord.subject || "-"}
                </div>
              </div>
              <div className="col-md-4">
                <small className="text-muted">Assigned Teacher</small>
                <div className="fw-semibold">
                  {studentRecord.teacherName || "-"}
                </div>
              </div>
              <div className="col-md-4">
                <small className="text-muted">Enrolled Gmail</small>
                <div className="fw-semibold text-break">
                  {studentRecord.email || "-"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">Grades by Period</h4>
          </div>
          <div className="card-body">
            <div className="row g-3">
              {periodGrades.map((item) => (
                <div className="col-md-4" key={item.period}>
                  <div className="border rounded p-3 h-100">
                    <h5 className="fw-bold">{item.period}</h5>
                    <h3 className="text-primary">
                      {item.average === null
                        ? "No grades yet"
                        : `${formatGrade(item.average)}%`}
                    </h3>
                    <div className="progress mb-2">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, item.average || 0)
                          )}%`,
                        }}
                      />
                    </div>
                    <small className="text-muted">
                      {item.count} graded assessment(s)
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">My Assessments and Scores</h4>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Assessment</th>
                    <th>Type</th>
                    <th>Semester</th>
                    <th>Period</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assessmentResults.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        No assessments found for your assigned teacher and subject.
                      </td>
                    </tr>
                  ) : (
                    assessmentResults.map((item) => (
                      <tr key={item.id}>
                        <td className="fw-semibold">{item.title || "-"}</td>
                        <td>{item.type || "-"}</td>
                        <td>{item.semester || "-"}</td>
                        <td>{item.period || "-"}</td>
                        <td>
                          {item.completed
                            ? `${item.scoreValue} / ${item.maxScore}`
                            : `— / ${item.maxScore}`}
                        </td>
                        <td>
                          {item.percentage === null
                            ? "-"
                            : `${formatGrade(item.percentage)}%`}
                        </td>
                        <td>
                          {item.completed ? (
                            <span className="badge bg-success">Graded</span>
                          ) : (
                            <span className="badge bg-warning text-dark">
                              Awaiting Score
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">My Attendance</h4>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Subject</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center text-muted py-4">
                        No attendance records yet.
                      </td>
                    </tr>
                  ) : (
                    [...attendance]
                      .sort((a, b) =>
                        String(b.date || "").localeCompare(String(a.date || ""))
                      )
                      .map((record) => (
                        <tr key={record.id}>
                          <td>{record.date || "-"}</td>
                          <td>{record.subject || "-"}</td>
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

        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2" />
          Your dashboard updates automatically when your teacher saves an assessment score or attendance record. Your current average is the simple average of your graded assessment percentages; it is not a weighted final grade.
        </div>
      </main>
    </div>
  );
}