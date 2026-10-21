import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Signup({ onSignup }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('student');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);

        try {
            await onSignup(name, email, password, role);
        } catch (err) {
            setError(
                err?.code === 'auth/email-already-in-use'
                    ? 'This email is already registered.'
                    : err?.message || 'Sign up failed.'
            );
        } finally {
            setBusy(false);
        }
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
                                        <i className="bi bi-person-plus-fill" />
                                    </div>

                                    <h2 className="fw-bold mt-3">
                                        Create account
                                    </h2>

                                    <p className="text-secondary">
                                        Create your Edu-Kit account.
                                    </p>
                                </div>

                                {error && (
                                    <div className="alert alert-danger">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit}>
                                    <label className="form-label fw-semibold">
                                        Full name
                                    </label>

                                    <input
                                        className="form-control form-control-lg mb-3"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        autoComplete="name"
                                    />

                                    <label className="form-label fw-semibold">
                                        Email
                                    </label>

                                    <input
                                        className="form-control form-control-lg mb-3"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                    />

                                    <label className="form-label fw-semibold">
                                        Password
                                    </label>

                                    <input
                                        className="form-control form-control-lg mb-3"
                                        type="password"
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                    />

                                    <label className="form-label fw-semibold">
                                        Account Role
                                    </label>

                                    <select
                                        className="form-select form-select-lg mb-4"
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        required
                                    >
                                        <option value="student">Student</option>
                                        <option value="teacher">Teacher</option>
                                        <option value="admin">Admin</option>
                                    </select>

                                    <button
                                        className="btn btn-primary btn-lg w-100"
                                        disabled={busy}
                                    >
                                        {busy ? 'Creating...' : 'Create Account'}
                                    </button>
                                </form>

                                <p className="text-center text-secondary mt-4 mb-0">
                                    Already registered?{' '}
                                    <Link to="/login" className="fw-semibold">
                                        Sign in
                                    </Link>
                                </p>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}