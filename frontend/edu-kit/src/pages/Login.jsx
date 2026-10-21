import { useState } from "react";
import { Link } from "react-router-dom";

export default function Login({ onLogin, onGoogleLogin, onVerifyOtp }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("student");
    const [otp, setOtp] = useState("");
    const [otpStage, setOtpStage] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    const friendlyError = (err) => {
        const code = err?.code || "";

        if (
            code.includes("invalid-credential") ||
            code.includes("wrong-password") ||
            code.includes("user-not-found")
        ) {
            return "Invalid email or password.";
        }

        if (code.includes("too-many-requests")) {
            return "Too many attempts. Please wait and try again.";
        }

        return err?.message || "Login failed.";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setBusy(true);

        try {
            const normalizedEmail = email.trim().toLowerCase();

            await onLogin(normalizedEmail, password, role);

            setEmail(normalizedEmail);
            setOtp("");
            setOtpStage(true);
            setMessage("OTP sent. Check your Gmail inbox.");
        } catch (err) {
            setError(friendlyError(err));
        } finally {
            setBusy(false);
        }
    };

    const handleGoogle = async () => {
        setError("");
        setMessage("");
        setBusy(true);

        try {
            const googleEmail = await onGoogleLogin(role);

            if (!googleEmail) {
                throw new Error(
                    "Unable to get your Google email. Please try email login."
                );
            }

            setEmail(googleEmail.trim().toLowerCase());
            setOtp("");
            setOtpStage(true);
            setMessage("OTP sent. Check your Gmail inbox.");
        } catch (err) {
            setError(friendlyError(err));
        } finally {
            setBusy(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setBusy(true);

        try {
            if (!email.trim()) {
                throw new Error("Your login email is missing. Please sign in again.");
            }

            if (!/^\d{6}$/.test(otp)) {
                throw new Error("Enter the 6-digit OTP.");
            }

            await onVerifyOtp(email.trim().toLowerCase(), role, otp);
        } catch (err) {
            setError(friendlyError(err));
        } finally {
            setBusy(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setMessage("");
        setBusy(true);

        try {
            const response = await fetch(
                "http://localhost:8080/api/auth/send-otp",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: email.trim().toLowerCase(),
                        role
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to resend OTP.");
            }

            setOtp("");
            setMessage("A new OTP was sent to your Gmail.");
        } catch (err) {
            setError(err.message || "Unable to resend OTP.");
        } finally {
            setBusy(false);
        }
    };

    const handleBack = async () => {
        setOtpStage(false);
        setOtp("");
        setError("");
        setMessage("");
    };

    return (
        <main className="auth-page">
            <div className="container">
                <div className="row justify-content-center align-items-center min-vh-100 py-5">
                    <div className="col-sm-10 col-md-7 col-lg-5">
                        <div className="card border-0 shadow-lg rounded-5 overflow-hidden">
                            <div className="card-body p-4 p-md-5">
                                <div className="text-center mb-4">
                                    <div className="brand-icon">
                                        <i className="bi bi-mortarboard-fill" />
                                    </div>

                                    <h2 className="fw-bold mt-3">
                                        {otpStage ? "Verify your email" : "Welcome back"}
                                    </h2>

                                    <p className="text-secondary mb-0">
                                        {otpStage
                                            ? "Enter the 6-digit code sent to your Gmail."
                                            : "Sign in to your Edu-Kit account"}
                                    </p>
                                </div>

                                {error && (
                                    <div className="alert alert-danger">{error}</div>
                                )}

                                {message && (
                                    <div className="alert alert-info">{message}</div>
                                )}

                                {!otpStage ? (
                                    <>
                                        <form onSubmit={handleSubmit}>
                                            <label className="form-label fw-semibold">
                                                Account Role
                                            </label>

                                            <select
                                                className="form-select form-select-lg mb-3"
                                                value={role}
                                                onChange={(e) => setRole(e.target.value)}
                                                required
                                            >
                                                <option value="student">Student</option>
                                                <option value="teacher">Teacher</option>
                                                <option value="admin">Admin</option>
                                            </select>

                                            <label className="form-label fw-semibold">
                                                Email
                                            </label>

                                            <input
                                                className="form-control form-control-lg mb-3"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                autoComplete="email"
                                                required
                                            />

                                            <label className="form-label fw-semibold">
                                                Password
                                            </label>

                                            <input
                                                className="form-control form-control-lg mb-4"
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                autoComplete="current-password"
                                                required
                                            />

                                            <button
                                                type="submit"
                                                className="btn btn-primary btn-lg w-100"
                                                disabled={busy}
                                            >
                                                {busy ? "Please wait..." : "Sign In"}
                                            </button>
                                        </form>

                                        <div className="divider my-4">
                                            <span>OR</span>
                                        </div>

                                        <button
                                            type="button"
                                            className="btn btn-outline-dark btn-lg w-100"
                                            onClick={handleGoogle}
                                            disabled={busy}
                                        >
                                            <i className="bi bi-google me-2" />
                                            Continue with Google
                                        </button>

                                        <p className="text-center text-secondary mt-4 mb-0">
                                            Don't have an account?{" "}
                                            <Link to="/signup" className="fw-semibold">
                                                Create one
                                            </Link>
                                        </p>
                                    </>
                                ) : (
                                    <form onSubmit={handleVerify}>
                                        <div className="mb-4">
                                            <label className="form-label fw-semibold">
                                                6-digit OTP
                                            </label>

                                            <input
                                                className="form-control form-control-lg text-center"
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={6}
                                                placeholder="Enter OTP"
                                                value={otp}
                                                onChange={(e) =>
                                                    setOtp(
                                                        e.target.value
                                                            .replace(/\D/g, "")
                                                            .slice(0, 6)
                                                    )
                                                }
                                                required
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            className="btn btn-primary btn-lg w-100"
                                            disabled={busy || otp.length !== 6}
                                        >
                                            {busy ? "Verifying..." : "Verify OTP"}
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary w-100 mt-3"
                                            onClick={handleResend}
                                            disabled={busy}
                                        >
                                            Resend OTP
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-link w-100 mt-2"
                                            onClick={handleBack}
                                            disabled={busy}
                                        >
                                            Back to Login
                                        </button>
                                    </form>
                                )}

                                <Link
                                    to="/"
                                    className="d-block text-center mt-3 text-decoration-none"
                                >
                                    <i className="bi bi-arrow-left me-1" />
                                    Back home
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}