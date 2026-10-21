import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";

const DEFAULT_WEIGHTS = {
  quizzes: 5,
  activities: 10,
  homework: 5,
  projects: 25,
  exams: 30,
};

const getDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMonthName = (date) => {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const formatDisplayDate = (dateString) => {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function Teacher() {
  const [currentUser, setCurrentUser] = useState(null);
  const [teacher, setTeacher] = useState(null);

  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [scores, setScores] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState("");

  const [attendanceDate, setAttendanceDate] =
    useState(getDateString());

  const [calendarMonth, setCalendarMonth] =
    useState(new Date());

  const [showCalendar, setShowCalendar] =
    useState(false);

  const [loading, setLoading] = useState(true);

  const [assessmentForm, setAssessmentForm] = useState({
    title: "",
    type: "Quiz",
    semester: "1st",
    period: "Prelim",
    maxScore: 100,
    date: getDateString(),
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser?.email) {
      setTeacher(null);
      setLoading(false);
      return;
    }

    const teacherQuery = query(
      collection(db, "teachers"),
      where("email", "==", currentUser.email)
    );

    const unsubscribe = onSnapshot(
      teacherQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setTeacher(null);
          setLoading(false);
          return;
        }

        const teacherData = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        };

        setTeacher(teacherData);
        setLoading(false);
      },
      (error) => {
        console.error("Teacher error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!teacher?.id) return;

    const studentsQuery = query(
      collection(db, "students"),
      where("teacherId", "==", teacher.id)
    );

    const unsubscribe = onSnapshot(
      studentsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setStudents(data);

        if (data.length > 0 && !selectedSubject) {
          setSelectedSubject(data[0].subject || "");
        }
      },
      (error) => {
        console.error("Students error:", error);
      }
    );

    return () => unsubscribe();
  }, [teacher, selectedSubject]);

  useEffect(() => {
    if (!teacher?.id) return;

    const assessmentQuery = query(
      collection(db, "assessments"),
      where("teacherId", "==", teacher.id)
    );

    const unsubscribe = onSnapshot(
      assessmentQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setAssessments(data);
      },
      (error) => {
        console.error("Assessments error:", error);
      }
    );

    return () => unsubscribe();
  }, [teacher]);

  useEffect(() => {
    if (!teacher?.id) return;

    const scoreQuery = query(
      collection(db, "scores"),
      where("teacherId", "==", teacher.id)
    );

    const unsubscribe = onSnapshot(
      scoreQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setScores(data);
      },
      (error) => {
        console.error("Scores error:", error);
      }
    );

    return () => unsubscribe();
  }, [teacher]);

  useEffect(() => {
    if (!teacher?.id) return;

    const attendanceQuery = query(
      collection(db, "attendance"),
      where("teacherId", "==", teacher.id)
    );

    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setAttendance(data);
      },
      (error) => {
        console.error("Attendance error:", error);
      }
    );

    return () => unsubscribe();
  }, [teacher]);

  const subjects = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => student.subject)
          .filter(Boolean)
      ),
    ];
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!selectedSubject) return students;

    return students.filter(
      (student) =>
        student.subject === selectedSubject
    );
  }, [students, selectedSubject]);

  const filteredAssessments = useMemo(() => {
    if (!selectedSubject) return assessments;

    return assessments.filter(
      (assessment) =>
        !assessment.subject ||
        assessment.subject === selectedSubject
    );
  }, [assessments, selectedSubject]);

  const getStudentScores = (student) => {
    return scores.filter(
      (score) =>
        score.studentDocumentId === student.id &&
        score.teacherId === teacher?.id &&
        (!score.subject ||
          score.subject === student.subject)
    );
  };

  const getAcademicGrade = (student) => {
    const studentScores = getStudentScores(student);

    const totals = {
      quizzes: [],
      activities: [],
      homework: [],
      projects: [],
      exams: [],
    };

    studentScores.forEach((score) => {
      const type = String(
        score.type || ""
      ).toLowerCase();

      let key = "";

      if (
        type === "quiz" ||
        type === "quizzes"
      ) {
        key = "quizzes";
      } else if (
        type === "activity" ||
        type === "activities"
      ) {
        key = "activities";
      } else if (
        type === "homework" ||
        type === "homeworks"
      ) {
        key = "homework";
      } else if (
        type === "project" ||
        type === "projects"
      ) {
        key = "projects";
      } else if (
        type === "exam" ||
        type === "exams"
      ) {
        key = "exams";
      }

      if (key) {
        const percentage =
          score.percentage !== undefined
            ? Number(score.percentage)
            : Number(score.maxScore) > 0
            ? (Number(score.score) /
                Number(score.maxScore)) *
              100
            : 0;

        totals[key].push(percentage);
      }
    });

    let grade = 0;

    Object.keys(DEFAULT_WEIGHTS).forEach(
      (key) => {
        const values = totals[key];

        const average =
          values.length > 0
            ? values.reduce(
                (sum, value) => sum + value,
                0
              ) / values.length
            : 0;

        grade +=
          average *
          (DEFAULT_WEIGHTS[key] / 100);
      }
    );

    return grade;
  };

  const getStudentAttendance = (student) => {
    return attendance.filter(
      (record) =>
        record.studentDocumentId === student.id &&
        record.teacherId === teacher?.id &&
        (!record.subject ||
          record.subject === student.subject)
    );
  };

  const getAttendanceRate = (student) => {
    const records =
      getStudentAttendance(student);

    if (records.length === 0) {
      return 15;
    }

    const present = records.filter(
      (record) =>
        record.status === "Present"
    ).length;

    return (
      (present / records.length) *
      15
    );
  };

  const getFinalGrade = (student) => {
    const academicGrade =
      getAcademicGrade(student);

    const attendanceRate =
      getAttendanceRate(student);

    return (
      academicGrade * 0.9 +
      attendanceRate * 0.1
    );
  };

  const getAttendanceRecord = (
    student,
    dateString
  ) => {
    return attendance.find(
      (record) =>
        record.studentDocumentId ===
          student.id &&
        record.teacherId === teacher?.id &&
        record.date === dateString &&
        (!record.subject ||
          record.subject === student.subject)
    );
  };

  const saveAttendance = async (
    student,
    dateString,
    status
  ) => {
    if (!teacher?.id) return;

    const existing =
      getAttendanceRecord(
        student,
        dateString
      );

    const data = {
      studentId:
        student.studentId || "",
      studentDocumentId: student.id,
      studentName:
        student.name || "",
      studentNumber:
        student.studentId || "",
      subject:
        student.subject ||
        selectedSubject ||
        "",
      date: dateString,
      status,
      teacherId: teacher.id,
      teacherName:
        teacher.name || "",
      updatedAt:
        serverTimestamp(),
    };

    try {
      if (existing) {
        await updateDoc(
          doc(
            db,
            "attendance",
            existing.id
          ),
          data
        );
      } else {
        await addDoc(
          collection(
            db,
            "attendance"
          ),
          {
            ...data,
            createdAt:
              serverTimestamp(),
          }
        );
      }
    } catch (error) {
      console.error(
        "Attendance error:",
        error
      );

      alert(
        "Failed to save attendance."
      );
    }
  };

  const getAttendanceStatus = (
    student
  ) => {
    const record =
      getAttendanceRecord(
        student,
        attendanceDate
      );

    return record?.status || "";
  };

  const markAttendance = async (
    student,
    status
  ) => {
    await saveAttendance(
      student,
      attendanceDate,
      status
    );
  };

  const markAllPresent = async () => {
    if (filteredStudents.length === 0) {
      return;
    }

    for (const student of filteredStudents) {
      await saveAttendance(
        student,
        attendanceDate,
        "Present"
      );
    }
  };

  const markAllAbsent = async () => {
    if (filteredStudents.length === 0) {
      return;
    }

    for (const student of filteredStudents) {
      await saveAttendance(
        student,
        attendanceDate,
        "Absent"
      );
    }
  };

  const getSelectedDateAttendance = () => {
    return filteredStudents.map(
      (student) =>
        getAttendanceRecord(
          student,
          attendanceDate
        )
    );
  };

  const selectedDateRecords =
    getSelectedDateAttendance();

  const selectedDatePresent =
    selectedDateRecords.filter(
      (record) =>
        record?.status === "Present"
    ).length;

  const selectedDateAbsent =
    selectedDateRecords.filter(
      (record) =>
        record?.status === "Absent"
    ).length;

  const selectedDateUnmarked =
    filteredStudents.length -
    selectedDatePresent -
    selectedDateAbsent;

  const saveAssessment = async (
    event
  ) => {
    event.preventDefault();

    if (!teacher?.id) {
      alert(
        "Teacher account not found."
      );
      return;
    }

    if (!selectedSubject) {
      alert(
        "Please select a subject first."
      );
      return;
    }

    if (
      !assessmentForm.title.trim()
    ) {
      alert(
        "Please enter an assessment title."
      );
      return;
    }

    try {
      await addDoc(
        collection(db, "assessments"),
        {
          title:
            assessmentForm.title.trim(),
          type: assessmentForm.type,
          semester:
            assessmentForm.semester,
          period:
            assessmentForm.period,
          maxScore:
            Number(
              assessmentForm.maxScore
            ),
          date:
            assessmentForm.date,
          subject:
            selectedSubject,
          teacherId:
            teacher.id,
          teacherName:
            teacher.name ||
            currentUser?.displayName ||
            "",
          createdAt:
            serverTimestamp(),
        }
      );

      setAssessmentForm({
        title: "",
        type: "Quiz",
        semester: "1st",
        period: "Prelim",
        maxScore: 100,
        date: getDateString(),
      });

      alert(
        "Assessment added successfully."
      );
    } catch (error) {
      console.error(
        "Assessment error:",
        error
      );

      alert(
        "Failed to add assessment."
      );
    }
  };

  const deleteAssessment = async (
    assessmentId
  ) => {
    if (
      !window.confirm(
        "Delete this assessment?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(
        doc(
          db,
          "assessments",
          assessmentId
        )
      );
    } catch (error) {
      console.error(error);

      alert(
        "Failed to delete assessment."
      );
    }
  };

  const saveScore = async (
    student,
    assessment,
    value
  ) => {
    if (value === "") {
      return;
    }

    const scoreValue =
      Number(value);

    if (
      Number.isNaN(scoreValue)
    ) {
      return;
    }

    const maxScore =
      Number(
        assessment.maxScore
      ) || 100;

    const finalScore =
      Math.min(
        Math.max(
          scoreValue,
          0
        ),
        maxScore
      );

    const percentage =
      (finalScore /
        maxScore) *
      100;

    const existingScore =
      scores.find(
        (score) =>
          score.studentDocumentId ===
            student.id &&
          score.assessmentId ===
            assessment.id &&
          score.teacherId ===
            teacher.id
      );

    try {
      const scoreData = {
        studentId:
          student.studentId || "",
        studentDocumentId:
          student.id,
        studentName:
          student.name || "",
        studentNumber:
          student.studentId || "",
        subject:
          student.subject ||
          selectedSubject ||
          "",
        assessmentId:
          assessment.id,
        assessmentTitle:
          assessment.title,
        title:
          assessment.title,
        type:
          assessment.type,
        semester:
          assessment.semester,
        period:
          assessment.period,
        score:
          finalScore,
        maxScore:
          maxScore,
        percentage:
          percentage,
        teacherId:
          teacher.id,
        teacherName:
          teacher.name || "",
        updatedAt:
          serverTimestamp(),
      };

      if (existingScore) {
        await updateDoc(
          doc(
            db,
            "scores",
            existingScore.id
          ),
          scoreData
        );
      } else {
        await addDoc(
          collection(db, "scores"),
          {
            ...scoreData,
            createdAt:
              serverTimestamp(),
          }
        );
      }
    } catch (error) {
      console.error(
        "Save score error:",
        error
      );

      alert(
        "Failed to save score."
      );
    }
  };

  const getScoreValue = (
    student,
    assessment
  ) => {
    const score =
      scores.find(
        (item) =>
          item.studentDocumentId ===
            student.id &&
          item.assessmentId ===
            assessment.id &&
          item.teacherId ===
            teacher?.id
      );

    return score
      ? score.score
      : "";
  };

  const getCalendarDays = () => {
    const year =
      calendarMonth.getFullYear();

    const month =
      calendarMonth.getMonth();

    const firstDay =
      new Date(
        year,
        month,
        1
      ).getDay();

    const daysInMonth =
      new Date(
        year,
        month + 1,
        0
      ).getDate();

    const days = [];

    for (
      let i = 0;
      i < firstDay;
      i++
    ) {
      days.push(null);
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      days.push(
        new Date(
          year,
          month,
          day
        )
      );
    }

    return days;
  };

  const selectCalendarDate = (
    date
  ) => {
    const selected =
      getDateString(date);

    const today =
      getDateString();

    if (selected > today) {
      return;
    }

    setAttendanceDate(
      selected
    );

    setShowCalendar(false);
  };

  const previousMonth = () => {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      )
    );
  };

  const nextMonth = () => {
    const next =
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      );

    const current =
      new Date();

    if (
      next.getFullYear() >
        current.getFullYear() ||
      (next.getFullYear() ===
        current.getFullYear() &&
        next.getMonth() >
          current.getMonth())
    ) {
      return;
    }

    setCalendarMonth(next);
  };

  const goToToday = () => {
    const today =
      new Date();

    setCalendarMonth(
      today
    );

    setAttendanceDate(
      getDateString(today)
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href =
        "/login";
    } catch (error) {
      console.error(error);
      alert(
        "Logout failed."
      );
    }
  };

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex justify-content-center align-items-center bg-light">
        <div className="text-center">
          <div
            className="spinner-border text-primary mb-3"
            role="status"
          ></div>

          <h5>
            Loading Teacher Portal...
          </h5>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container-fluid min-vh-100 d-flex justify-content-center align-items-center bg-light">
        <div className="text-center">
          <h3>
            Please login first.
          </h3>

          <button
            className="btn btn-primary mt-3"
            onClick={() =>
              (window.location.href =
                "/login")
            }
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="container-fluid min-vh-100 bg-light">
        <nav className="navbar navbar-dark bg-primary px-4">
          <span className="navbar-brand fw-bold">
            Edu-Kit Teacher Portal
          </span>

          <button
            className="btn btn-danger"
            onClick={
              handleLogout
            }
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Logout
          </button>
        </nav>

        <div className="container py-5">
          <div className="alert alert-warning">
            <h4>
              Teacher profile not found
            </h4>

            <p className="mb-0">
              Your Firebase account
              is logged in, but there
              is no teacher record
              using this email:
            </p>

            <strong>
              {currentUser.email}
            </strong>
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
            <i className="bi bi-mortarboard-fill me-2"></i>
            Edu-Kit
          </span>

          <small className="text-white-50 d-block">
            Teacher Portal
          </small>
        </div>

        <div className="d-flex align-items-center gap-3">
          <div className="text-white text-end d-none d-md-block">
            <strong>
              {teacher.name ||
                currentUser.displayName ||
                "Teacher"}
            </strong>

            <br />

            <small>
              {teacher.course || ""}
            </small>
          </div>

          <button
            className="btn btn-danger"
            onClick={
              handleLogout
            }
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Logout
          </button>
        </div>
      </nav>

      <div className="container-fluid px-3 px-md-4 py-4">
        <div className="mb-4">
          <h2 className="fw-bold mb-1">
            Welcome,{" "}
            {teacher.name ||
              currentUser.displayName ||
              "Teacher"}
          </h2>

          <p className="text-muted mb-0">
            Manage your subjects,
            students, grades,
            assessments, and
            attendance.
          </p>
        </div>

        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h5 className="fw-bold mb-1">
                  Assigned Subjects
                </h5>

                <small className="text-muted">
                  Select a subject to
                  manage its students.
                </small>
              </div>

              <select
                className="form-select"
                style={{
                  maxWidth:
                    "300px",
                }}
                value={
                  selectedSubject
                }
                onChange={(event) =>
                  setSelectedSubject(
                    event.target.value
                  )
                }
              >
                <option value="">
                  All Subjects
                </option>

                {subjects.map(
                  (subject) => (
                    <option
                      key={subject}
                      value={
                        subject
                      }
                    >
                      {subject}
                    </option>
                  )
                )}
              </select>
            </div>

            {subjects.length ===
              0 && (
              <div className="alert alert-warning mt-3 mb-0">
                No subjects assigned
                yet. Ask the
                administrator to
                enroll students and
                assign them to your
                subject.
              </div>
            )}
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <small className="text-muted">
                  Students
                </small>

                <h2 className="fw-bold text-primary mb-0">
                  {
                    filteredStudents.length
                  }
                </h2>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <small className="text-muted">
                  Assessments
                </small>

                <h2 className="fw-bold text-success mb-0">
                  {
                    filteredAssessments.length
                  }
                </h2>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <small className="text-muted">
                  Attendance Records
                </small>

                <h2 className="fw-bold text-warning mb-0">
                  {
                    attendance.length
                  }
                </h2>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <small className="text-muted">
                  Teacher
                </small>

                <h5 className="fw-bold mt-2 mb-0">
                  {teacher.name}
                </h5>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-white py-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h4 className="fw-bold mb-1">
                  <i className="bi bi-calendar-check text-success me-2"></i>
                  Daily Attendance
                </h4>

                <div className="text-muted">
                  Mark attendance for
                  all students from one
                  table.
                </div>
              </div>

              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() =>
                    setAttendanceDate(
                      getDateString()
                    )
                  }
                >
                  <i className="bi bi-calendar-event me-2"></i>
                  Today
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    setShowCalendar(
                      !showCalendar
                    )
                  }
                >
                  <i className="bi bi-calendar3 me-2"></i>
                  Choose Date
                </button>
              </div>
            </div>
          </div>

          <div className="card-body">
            <div className="row g-3 mb-4">
              <div className="col-lg-4">
                <div className="card bg-primary-subtle border-0 h-100">
                  <div className="card-body">
                    <small className="text-muted">
                      Attendance Date
                    </small>

                    <h5 className="fw-bold text-primary mt-2 mb-0">
                      {formatDisplayDate(
                        attendanceDate
                      )}
                    </h5>
                  </div>
                </div>
              </div>

              <div className="col-lg-2 col-md-4">
                <div className="card bg-success-subtle border-0 h-100">
                  <div className="card-body">
                    <small className="text-muted">
                      Present
                    </small>

                    <h3 className="fw-bold text-success mb-0">
                      {
                        selectedDatePresent
                      }
                    </h3>
                  </div>
                </div>
              </div>

              <div className="col-lg-2 col-md-4">
                <div className="card bg-danger-subtle border-0 h-100">
                  <div className="card-body">
                    <small className="text-muted">
                      Absent
                    </small>

                    <h3 className="fw-bold text-danger mb-0">
                      {
                        selectedDateAbsent
                      }
                    </h3>
                  </div>
                </div>
              </div>

              <div className="col-lg-2 col-md-4">
                <div className="card bg-warning-subtle border-0 h-100">
                  <div className="card-body">
                    <small className="text-muted">
                      Not Marked
                    </small>

                    <h3 className="fw-bold text-warning mb-0">
                      {
                        selectedDateUnmarked
                      }
                    </h3>
                  </div>
                </div>
              </div>

              <div className="col-lg-2">
                <div className="card bg-info-subtle border-0 h-100">
                  <div className="card-body">
                    <small className="text-muted">
                      Total
                    </small>

                    <h3 className="fw-bold text-info mb-0">
                      {
                        filteredStudents.length
                      }
                    </h3>
                  </div>
                </div>
              </div>
            </div>

            {showCalendar && (
              <div className="card border mb-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={
                        previousMonth
                      }
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>

                    <div className="text-center">
                      <h5 className="fw-bold mb-2">
                        {getMonthName(
                          calendarMonth
                        )}
                      </h5>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={
                          goToToday
                        }
                      >
                        Today
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={
                        nextMonth
                      }
                    >
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(7, 1fr)",
                      gap: "4px",
                    }}
                  >
                    {[
                      "Sun",
                      "Mon",
                      "Tue",
                      "Wed",
                      "Thu",
                      "Fri",
                      "Sat",
                    ].map(
                      (day) => (
                        <div
                          key={day}
                          className="text-center fw-bold text-muted p-2"
                        >
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(7, minmax(0, 1fr))",
                      gap: "5px",
                    }}
                  >
                    {getCalendarDays().map(
                      (
                        date,
                        index
                      ) => {
                        if (!date) {
                          return (
                            <div
                              key={`empty-${index}`}
                              style={{
                                minHeight:
                                  "55px",
                              }}
                            ></div>
                          );
                        }

                        const dateString =
                          getDateString(
                            date
                          );

                        const todayString =
                          getDateString();

                        const isToday =
                          dateString ===
                          todayString;

                        const isFuture =
                          dateString >
                          todayString;

                        const isSelected =
                          dateString ===
                          attendanceDate;

                        return (
                          <button
                            key={
                              dateString
                            }
                            type="button"
                            disabled={
                              isFuture
                            }
                            onClick={() =>
                              selectCalendarDate(
                                date
                              )
                            }
                            className={`btn ${
                              isSelected
                                ? "btn-primary"
                                : isToday
                                ? "btn-outline-primary"
                                : "btn-outline-secondary"
                            }`}
                            style={{
                              minHeight:
                                "55px",
                              opacity:
                                isFuture
                                  ? 0.4
                                  : 1,
                            }}
                          >
                            <div className="fw-bold">
                              {date.getDate()}
                            </div>

                            {isToday && (
                              <small>
                                Today
                              </small>
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-1">
                  {formatDisplayDate(
                    attendanceDate
                  )}
                </h5>

                <small className="text-muted">
                  Click Present or
                  Absent for each
                  student.
                </small>
              </div>

              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={
                    markAllPresent
                  }
                >
                  <i className="bi bi-check-circle me-2"></i>
                  Mark All Present
                </button>

                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={
                    markAllAbsent
                  }
                >
                  <i className="bi bi-x-circle me-2"></i>
                  Mark All Absent
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>
                      #
                    </th>

                    <th>
                      Student ID
                    </th>

                    <th>
                      Student
                    </th>

                    <th>
                      Course
                    </th>

                    <th>
                      Subject
                    </th>

                    <th className="text-center">
                      Status
                    </th>

                    <th className="text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="text-center py-4 text-muted"
                      >
                        No students
                        available for
                        this subject.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(
                      (
                        student,
                        index
                      ) => {
                        const status =
                          getAttendanceStatus(
                            student
                          );

                        return (
                          <tr
                            key={
                              student.id
                            }
                          >
                            <td>
                              {index +
                                1}
                            </td>

                            <td>
                              {student.studentId ||
                                "-"}
                            </td>

                            <td className="fw-semibold">
                              {student.name ||
                                "-"}
                            </td>

                            <td>
                              {student.course ||
                                "-"}
                            </td>

                            <td>
                              {student.subject ||
                                "-"}
                            </td>

                            <td className="text-center">
                              {status ===
                                "Present" && (
                                <span className="badge bg-success fs-6">
                                  <i className="bi bi-check-circle me-1"></i>
                                  Present
                                </span>
                              )}

                              {status ===
                                "Absent" && (
                                <span className="badge bg-danger fs-6">
                                  <i className="bi bi-x-circle me-1"></i>
                                  Absent
                                </span>
                              )}

                              {!status && (
                                <span className="badge bg-secondary fs-6">
                                  Not Marked
                                </span>
                              )}
                            </td>

                            <td>
                              <div className="d-flex justify-content-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  className={`btn btn-sm ${
                                    status ===
                                    "Present"
                                      ? "btn-success"
                                      : "btn-outline-success"
                                  }`}
                                  onClick={() =>
                                    markAttendance(
                                      student,
                                      "Present"
                                    )
                                  }
                                >
                                  <i className="bi bi-check-lg me-1"></i>
                                  Present
                                </button>

                                <button
                                  type="button"
                                  className={`btn btn-sm ${
                                    status ===
                                    "Absent"
                                      ? "btn-danger"
                                      : "btn-outline-danger"
                                  }`}
                                  onClick={() =>
                                    markAttendance(
                                      student,
                                      "Absent"
                                    )
                                  }
                                >
                                  <i className="bi bi-x-lg me-1"></i>
                                  Absent
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="alert alert-info mt-3 mb-0">
              <i className="bi bi-info-circle me-2"></i>

              Attendance is saved by
              <strong>
                {" "}
                student + date + subject
              </strong>
              . Changing Present or
              Absent updates the existing
              record instead of creating
              unlimited records.
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">
              <i className="bi bi-people-fill text-primary me-2"></i>
              Students
            </h4>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>
                      Student ID
                    </th>

                    <th>
                      Name
                    </th>

                    <th>
                      Course
                    </th>

                    <th>
                      Subject
                    </th>

                    <th>
                      Academic
                    </th>

                    <th>
                      Attendance
                    </th>

                    <th>
                      Final Grade
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="text-center py-4 text-muted"
                      >
                        No students
                        found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(
                      (student) => (
                        <tr
                          key={
                            student.id
                          }
                        >
                          <td>
                            {student.studentId ||
                              "-"}
                          </td>

                          <td className="fw-semibold">
                            {student.name}
                          </td>

                          <td>
                            {student.course ||
                              "-"}
                          </td>

                          <td>
                            {student.subject ||
                              "-"}
                          </td>

                          <td>
                            {getAcademicGrade(
                              student
                            ).toFixed(
                              2
                            )}
                            %
                          </td>

                          <td>
                            <span className="badge bg-success">
                              {getAttendanceRate(
                                student
                              ).toFixed(
                                2
                              )}
                              %
                            </span>
                          </td>

                          <td>
                            <span className="badge bg-primary fs-6">
                              {getFinalGrade(
                                student
                              ).toFixed(
                                2
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">
              <i className="bi bi-clipboard-check text-primary me-2"></i>
              Add Assessment
            </h4>
          </div>

          <div className="card-body">
            <form
              onSubmit={
                saveAssessment
              }
              className="row g-3"
            >
              <div className="col-md-4">
                <label className="form-label">
                  Assessment Title
                </label>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Example: Quiz 1"
                  value={
                    assessmentForm.title
                  }
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      title:
                        event.target
                          .value,
                    })
                  }
                  required
                />
              </div>

              <div className="col-md-2">
                <label className="form-label">
                  Type
                </label>

                <select
                  className="form-select"
                  value={
                    assessmentForm.type
                  }
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      type:
                        event.target
                          .value,
                    })
                  }
                >
                  <option>
                    Quiz
                  </option>

                  <option>
                    Activity
                  </option>

                  <option>
                    Homework
                  </option>

                  <option>
                    Project
                  </option>

                  <option>
                    Exam
                  </option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">
                  Semester
                </label>

                <select
                  className="form-select"
                  value={
                    assessmentForm.semester
                  }
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      semester:
                        event.target
                          .value,
                    })
                  }
                >
                  <option>
                    1st
                  </option>

                  <option>
                    2nd
                  </option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">
                  Period
                </label>

                <select
                  className="form-select"
                  value={
                    assessmentForm.period
                  }
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      period:
                        event.target
                          .value,
                    })
                  }
                >
                  <option>
                    Prelim
                  </option>

                  <option>
                    Midterm
                  </option>

                  <option>
                    Finals
                  </option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">
                  Max Score
                </label>

                <input
                  type="number"
                  className="form-control"
                  min="1"
                  value={
                    assessmentForm.maxScore
                  }
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      maxScore:
                        event.target
                          .value,
                    })
                  }
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">
                  Date
                </label>

                <input
                  type="date"
                  className="form-control"
                  value={
                    assessmentForm.date
                  }
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      date:
                        event.target
                          .value,
                    })
                  }
                />
              </div>

              <div className="col-md-3 d-flex align-items-end">
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                >
                  <i className="bi bi-plus-circle me-2"></i>
                  Add Assessment
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-white py-3">
            <h4 className="fw-bold mb-0">
              <i className="bi bi-journal-text text-primary me-2"></i>
              Assessments & Scores
            </h4>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-bordered align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>
                      Student
                    </th>

                    {filteredAssessments.map(
                      (
                        assessment
                      ) => (
                        <th
                          key={
                            assessment.id
                          }
                          className="text-center"
                        >
                          <div>
                            {
                              assessment.title
                            }
                          </div>

                          <small className="text-muted">
                            {
                              assessment.type
                            }
                            {" • "}
                            Max{" "}
                            {
                              assessment.maxScore
                            }
                          </small>

                          <br />

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger mt-1"
                            onClick={() =>
                              deleteAssessment(
                                assessment.id
                              )
                            }
                          >
                            Delete
                          </button>
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map(
                    (student) => (
                      <tr
                        key={
                          student.id
                        }
                      >
                        <td className="fw-semibold">
                          {
                            student.name
                          }

                          <br />

                          <small className="text-muted">
                            {
                              student.studentId
                            }
                          </small>
                        </td>

                        {filteredAssessments.map(
                          (
                            assessment
                          ) => (
                            <td
                              key={
                                assessment.id
                              }
                              style={{
                                minWidth:
                                  "130px",
                              }}
                            >
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                min="0"
                                max={
                                  assessment.maxScore
                                }
                                value={getScoreValue(
                                  student,
                                  assessment
                                )}
                                onChange={(
                                  event
                                ) =>
                                  saveScore(
                                    student,
                                    assessment,
                                    event
                                      .target
                                      .value
                                  )
                                }
                              />
                            </td>
                          )
                        )}
                      </tr>
                    )
                  )}

                  {filteredStudents.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          filteredAssessments.length +
                          1
                        }
                        className="text-center text-muted py-4"
                      >
                        No students
                        available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h5 className="fw-bold">
              Grading Formula
            </h5>

            <p className="text-muted mb-2">
              Academic performance
              contributes{" "}
              <strong>
                60%
              </strong>{" "}
              of the final grade,
              while attendance
              contributes{" "}
              <strong>
                30%
              </strong>
              .
            </p>

            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-primary">
                Quizzes 5%
              </span>

              <span className="badge bg-primary">
                Activities 10%
              </span>

              <span className="badge bg-primary">
                Homework 5%
              </span>

              <span className="badge bg-primary">
                Projects 25%
              </span>

              <span className="badge bg-primary">
                Exams 30%
              </span>

              <span className="badge bg-success">
                Attendance 15%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}