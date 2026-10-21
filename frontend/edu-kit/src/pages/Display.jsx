import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";

const API_URL = "http://localhost:8080";

export default function Display() {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [backendOnline, setBackendOnline] = useState(false);

  const [teacherForm, setTeacherForm] = useState({
    name: "",
    course: "",
    email: "",
  });

  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    studentId: "",
    course: "",
    subject: "",
    teacherId: "",
  });

  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkBackend();

    const unsubscribeTeachers = onSnapshot(
      collection(db, "teachers"),
      (snapshot) => {
        setTeachers(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (error) => console.error("Teachers Firebase error:", error)
    );

    const unsubscribeStudents = onSnapshot(
      collection(db, "students"),
      (snapshot) => {
        setStudents(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (error) => console.error("Students Firebase error:", error)
    );

    return () => {
      unsubscribeTeachers();
      unsubscribeStudents();
    };
  }, []);

  const checkBackend = async () => {
    try {
      setBackendStatus("Checking...");

      const response = await fetch(`${API_URL}/api/health`);

      if (!response.ok) {
        throw new Error("Backend returned an error.");
      }

      const data = await response.json();
      console.log("Express response:", data);

      setBackendOnline(true);
      setBackendStatus("Express Online");
    } catch (error) {
      console.error("Express backend error:", error);
      setBackendOnline(false);
      setBackendStatus("Express Offline");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to logout.");
    }
  };

  const handleTeacherChange = (event) => {
    const { name, value } = event.target;

    setTeacherForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleStudentChange = (event) => {
    const { name, value } = event.target;

    setStudentForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const saveTeacher = async (event) => {
    event.preventDefault();

    const name = teacherForm.name.trim();
    const course = teacherForm.course.trim();
    const email = teacherForm.email.trim().toLowerCase();

    if (!name || !course || !email) {
      alert("Please enter the teacher name, course, and email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid teacher email.");
      return;
    }

    setLoading(true);

    try {
      const duplicate = teachers.some(
        (teacher) =>
          teacher.email?.trim().toLowerCase() === email &&
          teacher.id !== editingTeacherId
      );

      if (duplicate) {
        alert("This email is already registered as a teacher.");
        return;
      }

      if (editingTeacherId) {
        await updateDoc(doc(db, "teachers", editingTeacherId), {
          name,
          course,
          email,
          updatedAt: serverTimestamp(),
        });

        alert("Teacher updated successfully.");
      } else {
        await addDoc(collection(db, "teachers"), {
          name,
          course,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        alert("Teacher added successfully.");
      }

      setTeacherForm({ name: "", course: "", email: "" });
      setEditingTeacherId(null);
    } catch (error) {
      console.error("Teacher save error:", error);
      alert("Failed to save teacher.");
    } finally {
      setLoading(false);
    }
  };

  const editTeacher = (teacher) => {
    setTeacherForm({
      name: teacher.name || "",
      course: teacher.course || "",
      email: teacher.email || "",
    });

    setEditingTeacherId(teacher.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteTeacher = async (teacher) => {
    if (!window.confirm(`Are you sure you want to delete ${teacher.name}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "teachers", teacher.id));

      const assignedStudents = students.filter(
        (student) => student.teacherId === teacher.id
      );

      for (const student of assignedStudents) {
        await updateDoc(doc(db, "students", student.id), {
          teacherId: "",
          teacherName: "",
          teacherEmail: "",
          updatedAt: serverTimestamp(),
        });
      }

      alert("Teacher deleted successfully.");
    } catch (error) {
      console.error("Teacher delete error:", error);
      alert("Failed to delete teacher.");
    }
  };

  const cancelTeacherEdit = () => {
    setTeacherForm({ name: "", course: "", email: "" });
    setEditingTeacherId(null);
  };

  const saveStudent = async (event) => {
    event.preventDefault();

    const name = studentForm.name.trim();
    const email = studentForm.email.trim().toLowerCase();
    const studentId = studentForm.studentId.trim();
    const course = studentForm.course.trim();
    const subject = studentForm.subject.trim();

    if (!name || !email || !studentId || !course || !subject) {
      alert("Please complete all student fields, including email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid student email.");
      return;
    }

    if (!studentForm.teacherId) {
      alert("Please select a teacher.");
      return;
    }

    const selectedTeacher = teachers.find(
      (teacher) => teacher.id === studentForm.teacherId
    );

    if (!selectedTeacher) {
      alert("Selected teacher was not found.");
      return;
    }

    setLoading(true);

    try {
      const duplicateEmail = students.some(
        (student) =>
          student.email?.trim().toLowerCase() === email &&
          student.id !== editingStudentId
      );

      if (duplicateEmail) {
        alert("This email is already registered as a student.");
        return;
      }

      const duplicateStudentId = students.some(
        (student) =>
          student.studentId?.trim().toLowerCase() ===
            studentId.toLowerCase() &&
          student.id !== editingStudentId
      );

      if (duplicateStudentId) {
        alert("This student ID is already registered.");
        return;
      }

      const studentData = {
        name,
        email,
        studentId,
        course,
        subject,
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.name || "",
        teacherEmail: selectedTeacher.email || "",
        updatedAt: serverTimestamp(),
      };

      if (editingStudentId) {
        await updateDoc(
          doc(db, "students", editingStudentId),
          studentData
        );

        alert("Student updated successfully.");
      } else {
        await addDoc(collection(db, "students"), {
          ...studentData,
          createdAt: serverTimestamp(),
        });

        alert("Student enrolled successfully.");
      }

      setStudentForm({
        name: "",
        email: "",
        studentId: "",
        course: "",
        subject: "",
        teacherId: "",
      });

      setEditingStudentId(null);
    } catch (error) {
      console.error("Student save error:", error);
      alert("Failed to save student.");
    } finally {
      setLoading(false);
    }
  };

  const editStudent = (student) => {
    setStudentForm({
      name: student.name || "",
      email: student.email || "",
      studentId: student.studentId || "",
      course: student.course || "",
      subject: student.subject || "",
      teacherId: student.teacherId || "",
    });

    setEditingStudentId(student.id);

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  };

  const deleteStudent = async (student) => {
    if (!window.confirm(`Are you sure you want to delete ${student.name}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "students", student.id));
      alert("Student deleted successfully.");
    } catch (error) {
      console.error("Student delete error:", error);
      alert("Failed to delete student.");
    }
  };

  const cancelStudentEdit = () => {
    setStudentForm({
      name: "",
      email: "",
      studentId: "",
      course: "",
      subject: "",
      teacherId: "",
    });

    setEditingStudentId(null);
  };

  const getTeacherStudentCount = (teacherId) =>
    students.filter((student) => student.teacherId === teacherId).length;

  return (
    <div className="bg-light min-vh-100">
      <div className="container-fluid py-4 px-3 px-md-4">
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: "52px", height: "52px" }}
                >
                  <i className="bi bi-shield-lock-fill fs-4"></i>
                </div>
                <div>
                  <h2 className="fw-bold text-primary mb-0">Admin Portal</h2>
                  <p className="text-muted mb-0">
                    Manage teachers, students, subjects, and enrollments
                  </p>
                </div>
              </div>

              <div className="d-flex align-items-center gap-3">
                <span className={`badge ${backendOnline ? "bg-success" : "bg-danger"}`}>
                  <i className={`bi ${backendOnline ? "bi-wifi" : "bi-wifi-off"} me-1`}></i>
                  {backendStatus}
                </span>

                <button type="button" className="btn btn-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Total Teachers</p>
                  <h2 className="fw-bold mb-0">{teachers.length}</h2>
                </div>
                <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-3">
                  <i className="bi bi-person-workspace fs-3"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Total Students</p>
                  <h2 className="fw-bold mb-0">{students.length}</h2>
                </div>
                <div className="bg-success bg-opacity-10 text-success rounded-circle p-3">
                  <i className="bi bi-people-fill fs-3"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Active Enrollments</p>
                  <h2 className="fw-bold mb-0">
                    {students.filter((student) => student.teacherId).length}
                  </h2>
                </div>
                <div className="bg-info bg-opacity-10 text-info rounded-circle p-3">
                  <i className="bi bi-journal-check fs-3"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-primary text-white py-3">
            <h4 className="mb-0 fw-bold">
              <i className="bi bi-person-workspace fs-4 me-2"></i>
              Teacher Section
            </h4>
          </div>

          <div className="card-body">
            <form onSubmit={saveTeacher} className="mb-4">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Teacher Name</label>
                  <input className="form-control" name="name" value={teacherForm.name} onChange={handleTeacherChange} placeholder="Enter teacher name" />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">Course</label>
                  <input className="form-control" name="course" value={teacherForm.course} onChange={handleTeacherChange} placeholder="Example: BSIT" />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">Email</label>
                  <input type="email" className="form-control" name="email" value={teacherForm.email} onChange={handleTeacherChange} placeholder="teacher@gmail.com" />
                </div>

                <div className="col-12">
                  <button type="submit" className="btn btn-primary me-2" disabled={loading}>
                    <i className={`bi ${editingTeacherId ? "bi-check-circle" : "bi-person-plus"} me-2`}></i>
                    {editingTeacherId ? "Update Teacher" : "Add Teacher"}
                  </button>

                  {editingTeacherId && (
                    <button type="button" className="btn btn-secondary" onClick={cancelTeacherEdit}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Teacher</th>
                    <th>Course</th>
                    <th>Email</th>
                    <th>Students</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No teachers added yet.
                      </td>
                    </tr>
                  ) : (
                    teachers.map((teacher, index) => (
                      <tr key={teacher.id}>
                        <td>{index + 1}</td>
                        <td><strong>{teacher.name || "-"}</strong></td>
                        <td>{teacher.course || "-"}</td>
                        <td>{teacher.email || "-"}</td>
                        <td>
                          <span className="badge bg-info">
                            {getTeacherStudentCount(teacher.id)}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex justify-content-center gap-2">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editTeacher(teacher)}>
                              <i className="bi bi-pencil-square"></i>
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteTeacher(teacher)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
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
          <div className="card-header bg-success text-white py-3">
            <h4 className="mb-0 fw-bold">
              <i className="bi bi-people-fill fs-4 me-2"></i>
              Student Section
            </h4>
          </div>

          <div className="card-body">
            <form onSubmit={saveStudent} className="mb-4">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Student Name</label>
                  <input className="form-control" name="name" value={studentForm.name} onChange={handleStudentChange} placeholder="Enter student name" />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Student Gmail</label>
                  <input type="email" className="form-control" name="email" value={studentForm.email} onChange={handleStudentChange} placeholder="student@gmail.com" />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">Student ID</label>
                  <input className="form-control" name="studentId" value={studentForm.studentId} onChange={handleStudentChange} placeholder="Example: 2026-0001" />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">Course</label>
                  <input className="form-control" name="course" value={studentForm.course} onChange={handleStudentChange} placeholder="Example: BSIT" />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">Subject</label>
                  <input className="form-control" name="subject" value={studentForm.subject} onChange={handleStudentChange} placeholder="Example: CC105" />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Assign Teacher</label>
                  <select className="form-select" name="teacherId" value={studentForm.teacherId} onChange={handleStudentChange}>
                    <option value="">Select teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name} - {teacher.course}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12">
                  <button type="submit" className="btn btn-success me-2" disabled={loading || teachers.length === 0}>
                    <i className={`bi ${editingStudentId ? "bi-check-circle" : "bi-person-plus"} me-2`}></i>
                    {editingStudentId ? "Update Student" : "Enroll Student"}
                  </button>

                  {editingStudentId && (
                    <button type="button" className="btn btn-secondary" onClick={cancelStudentEdit}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>

            {teachers.length === 0 && (
              <div className="alert alert-warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Add a teacher first before enrolling students.
              </div>
            )}

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Student ID</th>
                    <th>Course</th>
                    <th>Subject</th>
                    <th>Teacher</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center text-muted py-4">
                        No students enrolled yet.
                      </td>
                    </tr>
                  ) : (
                    students.map((student, index) => (
                      <tr key={student.id}>
                        <td>{index + 1}</td>
                        <td><strong>{student.name || "-"}</strong></td>
                        <td>{student.email || "-"}</td>
                        <td>{student.studentId || "-"}</td>
                        <td>{student.course || "-"}</td>
                        <td>
                          <span className="badge bg-primary">
                            {student.subject || "-"}
                          </span>
                        </td>
                        <td>
                          {student.teacherName ? (
                            <span className="fw-semibold">{student.teacherName}</span>
                          ) : (
                            <span className="text-danger">No teacher assigned</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex justify-content-center gap-2">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editStudent(student)}>
                              <i className="bi bi-pencil-square"></i>
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteStudent(student)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
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
            <h5 className="fw-bold mb-3">
              <i className="bi bi-server text-primary me-2"></i>
              System Connection
            </h5>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="border rounded p-3 d-flex justify-content-between">
                  <span><i className="bi bi-fire text-warning me-2"></i>Firebase / Firestore</span>
                  <span className="badge bg-success">Connected</span>
                </div>
              </div>

              <div className="col-md-6">
                <div className="border rounded p-3 d-flex justify-content-between">
                  <span><i className="bi bi-server text-primary me-2"></i>Express Server</span>
                  <span className={`badge ${backendOnline ? "bg-success" : "bg-danger"}`}>
                    {backendStatus}
                  </span>
                </div>
              </div>
            </div>

            <button type="button" className="btn btn-outline-primary mt-3" onClick={checkBackend}>
              <i className="bi bi-arrow-clockwise me-2"></i>
              Check Express Server
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}