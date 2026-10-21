import { useEffect, useState } from "react";
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
    useNavigate
} from "react-router-dom";

import {
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "firebase/auth";

import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from "firebase/firestore";

import { auth, db, googleProvider } from "./firebase.js";

import LandingPage from "./pages/LandingPage.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Display from "./pages/Display.jsx";
import StudentDashboard from "./pages/Student.jsx";
import Teacher from "./pages/Teacher.jsx";

const API_URL = "http://localhost:8080";

const ROLE_PATHS = {
    admin: "/admin",
    teacher: "/teacher",
    student: "/student"
};

function getStoredRole() {
    return sessionStorage.getItem("eduKitOtpRole") || "";
}

function hasValidOtpSession() {
    const token = sessionStorage.getItem("eduKitOtpToken");

    if (!token) {
        return false;
    }

    try {
        const payloadPart = token.split(".")[1];

        if (!payloadPart) {
            throw new Error("Invalid token.");
        }

        const base64 = payloadPart
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const payload = JSON.parse(atob(base64));

        if (!payload.exp || payload.exp * 1000 <= Date.now()) {
            throw new Error("Session expired.");
        }

        return true;
    } catch {
        sessionStorage.removeItem("eduKitOtpToken");
        sessionStorage.removeItem("eduKitOtpRole");
        return false;
    }
}

async function getUserProfile(firebaseUser) {
    const userRef = doc(db, "users", firebaseUser.uid);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
        return {
            uid: firebaseUser.uid,
            ...snapshot.data()
        };
    }

    const newProfile = {
        uid: firebaseUser.uid,
        displayName:
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            "Student",
        email: firebaseUser.email || "",
        role: "student",
        studentId: "",
        course: "",
        currentGrade: 0,
        predictedGrade: 0,
        attendanceRate: 0,
        quizzes: 0,
        assignments: 0,
        missingActivities: 0,
        remarks: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await setDoc(userRef, newProfile);

    return {
        uid: firebaseUser.uid,
        ...newProfile
    };
}

async function requestOtp(email, role) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = String(role || "").trim().toLowerCase();

    if (!normalizedEmail || !ROLE_PATHS[normalizedRole]) {
        throw new Error("Enter your Gmail and select a valid role.");
    }

    const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: normalizedEmail,
            role: normalizedRole
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Failed to send OTP.");
    }

    return data;
}

function ProtectedRoute({ user, otpVerified, role, allowedRole, children }) {
    if (!user || !otpVerified) {
        return <Navigate to="/login" replace />;
    }

    if (!ROLE_PATHS[role]) {
        return <Navigate to="/login" replace />;
    }

    if (role !== allowedRole) {
        return <Navigate to={ROLE_PATHS[role]} replace />;
    }

    return children;
}

function AppContent() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [otpVerified, setOtpVerified] = useState(
        () => hasValidOtpSession()
    );
    const [verifiedRole, setVerifiedRole] = useState(
        () => hasValidOtpSession() ? getStoredRole() : ""
    );

    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
            try {
                setUser(firebaseUser);

                if (!firebaseUser) {
                    setProfile(null);
                    setOtpVerified(false);
                    setVerifiedRole("");
                    sessionStorage.removeItem("eduKitOtpToken");
                    sessionStorage.removeItem("eduKitOtpRole");
                    return;
                }

                const userProfile = await getUserProfile(firebaseUser);
                setProfile(userProfile);

                const validSession = hasValidOtpSession();
                const role = getStoredRole();

                const verified =
                    validSession &&
                    Boolean(ROLE_PATHS[role]);

                setOtpVerified(verified);
                setVerifiedRole(verified ? role : "");

                if (!verified) {
                    sessionStorage.removeItem("eduKitOtpToken");
                    sessionStorage.removeItem("eduKitOtpRole");
                }
            } catch (error) {
                console.error("Authentication error:", error);
                setProfile(null);
                setOtpVerified(false);
                setVerifiedRole("");
            } finally {
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    async function handleLogin(email, password, selectedRole) {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedRole = String(selectedRole || "").trim().toLowerCase();

        if (!normalizedEmail || !ROLE_PATHS[normalizedRole]) {
            throw new Error("Enter your Gmail and select a valid role.");
        }

        sessionStorage.removeItem("eduKitOtpToken");
        sessionStorage.removeItem("eduKitOtpRole");
        setOtpVerified(false);
        setVerifiedRole("");

        const result = await signInWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
        );

        try {
            const actualEmail = String(result.user.email || "")
                .trim()
                .toLowerCase();

            if (!actualEmail || actualEmail !== normalizedEmail) {
                throw new Error("Your signed-in Gmail does not match.");
            }

            // Do not reject the user based on users/{uid}.role.
            // The backend checks enrollment in teachers/students.
            await requestOtp(actualEmail, normalizedRole);

            const userProfile = await getUserProfile(result.user);

            setUser(result.user);
            setProfile(userProfile);

            return actualEmail;
        } catch (error) {
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setOtpVerified(false);
            setVerifiedRole("");
            throw error;
        }
    }

    async function handleGoogleLogin(selectedRole = "student") {
        const normalizedRole = String(selectedRole || "student")
            .trim()
            .toLowerCase();

        if (!ROLE_PATHS[normalizedRole]) {
            throw new Error("Please select a valid account role.");
        }

        sessionStorage.removeItem("eduKitOtpToken");
        sessionStorage.removeItem("eduKitOtpRole");
        setOtpVerified(false);
        setVerifiedRole("");

        const provider = googleProvider || new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);

        try {
            const actualEmail = String(result.user.email || "")
                .trim()
                .toLowerCase();

            if (!actualEmail) {
                throw new Error("Your Google account has no Gmail address.");
            }

            // The backend verifies the selected role against enrollment.
            await requestOtp(actualEmail, normalizedRole);

            const userProfile = await getUserProfile(result.user);

            setUser(result.user);
            setProfile(userProfile);

            return actualEmail;
        } catch (error) {
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setOtpVerified(false);
            setVerifiedRole("");
            throw error;
        }
    }

    async function handleVerifyOtp(email, selectedRole, otp) {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedRole = String(selectedRole || "").trim().toLowerCase();
        const normalizedOtp = String(otp || "").trim();

        if (
            !normalizedEmail ||
            !ROLE_PATHS[normalizedRole] ||
            !/^\d{6}$/.test(normalizedOtp)
        ) {
            throw new Error("Enter the 6-digit OTP.");
        }

        const firebaseUser = auth.currentUser;

        if (!firebaseUser || !firebaseUser.email) {
            throw new Error("Your login session expired. Please sign in again.");
        }

        if (
            firebaseUser.email.trim().toLowerCase() !== normalizedEmail
        ) {
            throw new Error("Your login Gmail does not match. Please sign in again.");
        }

        const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: normalizedEmail,
                role: normalizedRole,
                otp: normalizedOtp
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "OTP verification failed.");
        }

        if (
            !data.token ||
            data.email?.trim().toLowerCase() !== normalizedEmail ||
            data.role !== normalizedRole ||
            data.redirectTo !== ROLE_PATHS[normalizedRole]
        ) {
            throw new Error("The server returned an invalid verification response.");
        }

        // The backend-verified role is authoritative for this OTP session.
        const userProfile = await getUserProfile(firebaseUser);

        const updatedProfile = {
            ...userProfile,
            role: data.role,
            email: normalizedEmail
        };

        sessionStorage.setItem("eduKitOtpToken", data.token);
        sessionStorage.setItem("eduKitOtpRole", data.role);

        setUser(firebaseUser);
        setProfile(updatedProfile);
        setVerifiedRole(data.role);
        setOtpVerified(true);

        navigate(data.redirectTo, { replace: true });
    }

    async function handleSignup(name, email, password) {
        const normalizedEmail = String(email || "").trim().toLowerCase();

        const result = await createUserWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
        );

        try {
            await updateProfile(result.user, {
                displayName: name
            });

            const newProfile = {
                uid: result.user.uid,
                displayName: name,
                email: normalizedEmail,
                role: "student",
                studentId: "",
                course: "",
                currentGrade: 0,
                predictedGrade: 0,
                attendanceRate: 0,
                quizzes: 0,
                assignments: 0,
                missingActivities: 0,
                remarks: "",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await setDoc(
                doc(db, "users", result.user.uid),
                newProfile,
                { merge: true }
            );

            sessionStorage.removeItem("eduKitOtpToken");
            sessionStorage.removeItem("eduKitOtpRole");

            setOtpVerified(false);
            setVerifiedRole("");

            await signOut(auth);

            setUser(null);
            setProfile(null);

            navigate("/login", { replace: true });
        } catch (error) {
            console.error("Signup error:", error);
            throw error;
        }
    }

    async function handleLogout() {
        sessionStorage.removeItem("eduKitOtpToken");
        sessionStorage.removeItem("eduKitOtpRole");

        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            setUser(null);
            setProfile(null);
            setOtpVerified(false);
            setVerifiedRole("");

            localStorage.removeItem("loggedIn");
            localStorage.removeItem("username");
            localStorage.removeItem("role");

            navigate("/login", { replace: true });
        }
    }

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status" />
                    <p className="mt-3 mb-0">Loading Edu-Kit...</p>
                </div>
            </div>
        );
    }

    const activeRole = verifiedRole;
    const authenticated = Boolean(user && profile && otpVerified && activeRole);

    return (
        <Routes>
            <Route
                path="/"
                element={
                    authenticated
                        ? <Navigate to={ROLE_PATHS[activeRole]} replace />
                        : <LandingPage />
                }
            />

            <Route
                path="/login"
                element={
                    authenticated
                        ? <Navigate to={ROLE_PATHS[activeRole]} replace />
                        : (
                            <Login
                                onLogin={handleLogin}
                                onGoogleLogin={handleGoogleLogin}
                                onVerifyOtp={handleVerifyOtp}
                            />
                        )
                }
            />

            <Route
                path="/signup"
                element={
                    authenticated
                        ? <Navigate to={ROLE_PATHS[activeRole]} replace />
                        : (
                            <Signup
                                onSignup={handleSignup}
                                onGoogleLogin={handleGoogleLogin}
                            />
                        )
                }
            />

            <Route
                path="/student"
                element={
                    <ProtectedRoute
                        user={user}
                        otpVerified={otpVerified}
                        role={activeRole}
                        allowedRole="student"
                    >
                        <StudentDashboard
                            user={profile}
                            onLogout={handleLogout}
                        />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/teacher"
                element={
                    <ProtectedRoute
                        user={user}
                        otpVerified={otpVerified}
                        role={activeRole}
                        allowedRole="teacher"
                    >
                        <Teacher
                            user={profile}
                            onLogout={handleLogout}
                        />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin"
                element={
                    <ProtectedRoute
                        user={user}
                        otpVerified={otpVerified}
                        role={activeRole}
                        allowedRole="admin"
                    >
                        <Display
                            user={profile}
                            onLogout={handleLogout}
                        />
                    </ProtectedRoute>
                }
            />

            <Route
                path="*"
                element={
                    <Navigate
                        to={
                            authenticated
                                ? ROLE_PATHS[activeRole]
                                : "/login"
                        }
                        replace
                    />
                }
            />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}