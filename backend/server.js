
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

let serviceAccount;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        serviceAccount = require("./serviceAccountKey.json");
    }
} catch (error) {
    console.error("Firebase service account configuration error:", error.message);
    process.exit(1);
}

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

const app = express();
const PORT = process.env.PORT || 8080;

if (
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_APP_PASSWORD ||
    !process.env.ADMIN_EMAILS ||
    !process.env.JWT_SECRET
) {
    throw new Error("Missing required settings in backend .env");
}

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

const otpStore = new Map();

const OTP_EXPIRATION = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// HEALTH CHECK

app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        message: "Edu-Kit Express Server is running"
    });
});

// FIRESTORE COLLECTION LISTENERS

function watchCollection(name) {
    let firstLoad = true;

    db.collection(name).onSnapshot(
        snapshot => {
            if (firstLoad) {
                firstLoad = false;
                console.log(`[${name}] listening... (${snapshot.size} docs)`);
                return;
            }

            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();

                const labels = {
                    added: "ADDED",
                    modified: "UPDATED",
                    removed: "DELETED"
                };

                console.log(
                    `[${new Date().toLocaleTimeString()}] ` +
                    `${name.toUpperCase()} ${labels[change.type]}: ` +
                    `${data.name || change.doc.id}`
                );
            });
        },
        error => {
            console.error(`[${name}] listener error:`, error.message);
        }
    );
}

watchCollection("teachers");
watchCollection("students");

// ROLE AUTHORIZATION

async function isAuthorized(email, role) {
    const normalizedEmail = String(email || "")
        .trim()
        .toLowerCase();

    if (role === "admin") {
        return adminEmails.includes(normalizedEmail);
    }

    if (role !== "teacher" && role !== "student") {
        return false;
    }

    const collectionName =
        role === "teacher" ? "teachers" : "students";

    const snapshot = await db.collection(collectionName).get();

    return snapshot.docs.some(document => {
        const data = document.data();

        return (
            typeof data.email === "string" &&
            data.email.trim().toLowerCase() === normalizedEmail
        );
    });
}

// SEND OTP

app.post("/api/auth/send-otp", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const role = String(req.body.role || "")
            .trim()
            .toLowerCase();

        if (!email || !["admin", "teacher", "student"].includes(role)) {
            return res.status(400).json({
                message: "A valid email and role are required."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                message: "Enter a valid email address."
            });
        }

        const authorized = await isAuthorized(email, role);

        if (!authorized) {
            return res.status(403).json({
                message:
                    "This Gmail is not enrolled for the selected role. " +
                    "Check the email in the Admin Portal."
            });
        }

        const key = `${email}:${role}`;
        const now = Date.now();
        const previous = otpStore.get(key);

        if (previous && now - previous.lastSent < 60 * 1000) {
            return res.status(429).json({
                message:
                    "Please wait 60 seconds before requesting another OTP."
            });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();

        otpStore.set(key, {
            otp,
            expiresAt: now + OTP_EXPIRATION,
            attempts: 0,
            lastSent: now
        });

        try {
            await transporter.sendMail({
                from: `"Edu-Kit" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Your Edu-Kit verification code",
                text:
                    `Your Edu-Kit OTP is ${otp}. ` +
                    "It expires in 5 minutes. " +
                    "If you did not request this code, ignore this email."
            });
        } catch (emailError) {
            otpStore.delete(key);
            throw emailError;
        }

        return res.json({
            message: "OTP sent successfully. Check your email."
        });
    } catch (error) {
        console.error("Send OTP error:", error.message);

        return res.status(500).json({
            message: "Unable to send OTP. Check the backend terminal."
        });
    }
});

// VERIFY OTP

app.post("/api/auth/verify-otp", async (req, res) => {
    try {
        const email = String(req.body.email || "")
            .trim()
            .toLowerCase();

        const role = String(req.body.role || "")
            .trim()
            .toLowerCase();

        const otp = String(req.body.otp || "").trim();

        if (
            !email ||
            !/^\d{6}$/.test(otp) ||
            !["admin", "teacher", "student"].includes(role)
        ) {
            return res.status(400).json({
                message: "Enter your email, selected role, and 6-digit OTP."
            });
        }

        const key = `${email}:${role}`;
        const record = otpStore.get(key);

        if (!record) {
            return res.status(400).json({
                message: "OTP not found. Request a new code."
            });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(key);

            return res.status(400).json({
                message: "OTP expired. Request a new code."
            });
        }

        if (record.attempts >= MAX_ATTEMPTS) {
            otpStore.delete(key);

            return res.status(429).json({
                message: "Too many attempts. Request a new OTP."
            });
        }

        if (record.otp !== otp) {
            record.attempts += 1;

            if (record.attempts >= MAX_ATTEMPTS) {
                otpStore.delete(key);
            }

            return res.status(400).json({
                message: "Incorrect OTP."
            });
        }

        const authorized = await isAuthorized(email, role);

        if (!authorized) {
            otpStore.delete(key);

            return res.status(403).json({
                message:
                    "This Gmail is no longer enrolled for the selected role."
            });
        }

        otpStore.delete(key);

        const token = jwt.sign(
            { email, role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        const portalPaths = {
            admin: "/admin",
            teacher: "/teacher",
            student: "/student"
        };

        return res.json({
            message: "OTP verified successfully.",
            token,
            email,
            role,
            redirectTo: portalPaths[role]
        });
    } catch (error) {
        console.error("Verify OTP error:", error.message);

        return res.status(500).json({
            message: "Unable to verify OTP. Please try again."
        });
    }
});

// FIRESTORE CRUD HELPERS

function normalizeRecord(body, existing = {}) {
    const record = {
        ...existing,
        ...body
    };

    delete record.id;

    record.name = String(body.name ?? existing.name ?? "").trim();
    record.course = String(body.course ?? existing.course ?? "").trim();

    if (body.email !== undefined) {
        record.email = String(body.email).trim().toLowerCase();
    } else if (existing.email) {
        record.email = String(existing.email).trim().toLowerCase();
    }

    return record;
}

function publicRecord(document) {
    return {
        id: document.id,
        ...document.data()
    };
}

function createCrudRoutes(routeName, collectionName, label) {
    const collection = db.collection(collectionName);

    // GET ALL RECORDS

    app.get(`/api/${routeName}`, async (req, res) => {
        try {
            const snapshot = await collection.get();

            res.json(snapshot.docs.map(publicRecord));
        } catch (error) {
            console.error(`Get ${label} error:`, error.message);

            res.status(500).json({
                message: `Unable to load ${label} records.`
            });
        }
    });

    // ADD RECORD

    app.post(`/api/${routeName}`, async (req, res) => {
        try {
            const record = normalizeRecord(req.body);

            if (!record.name || !record.course || !record.email) {
                return res.status(400).json({
                    message:
                        `${label} name, course, and email are required.`
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
                return res.status(400).json({
                    message: "Enter a valid email address."
                });
            }

            const snapshot = await collection.get();

            const duplicate = snapshot.docs.some(document => {
                const data = document.data();

                return (
                    data.email &&
                    data.email.trim().toLowerCase() === record.email
                );
            });

            if (duplicate) {
                return res.status(409).json({
                    message:
                        `This email is already registered as a ${label}.`
                });
            }

            record.createdAt = new Date().toISOString();

            const documentRef = await collection.add(record);
            const savedDocument = await documentRef.get();

            console.log(`${label.toUpperCase()} ADDED:`, {
                id: documentRef.id,
                ...savedDocument.data()
            });

            res.status(201).json(publicRecord(savedDocument));
        } catch (error) {
            console.error(`Add ${label} error:`, error.message);

            res.status(500).json({
                message: `Unable to add ${label}.`
            });
        }
    });

    // UPDATE RECORD

    app.put(`/api/${routeName}/:id`, async (req, res) => {
        try {
            const documentRef = collection.doc(req.params.id);
            const oldDocument = await documentRef.get();

            if (!oldDocument.exists) {
                return res.status(404).json({
                    message: `${label} not found.`
                });
            }

            const oldData = oldDocument.data();
            const record = normalizeRecord(req.body, oldData);

            if (!record.name || !record.course || !record.email) {
                return res.status(400).json({
                    message:
                        `${label} name, course, and email are required.`
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
                return res.status(400).json({
                    message: "Enter a valid email address."
                });
            }

            const snapshot = await collection.get();

            const duplicate = snapshot.docs.some(document => {
                if (document.id === req.params.id) {
                    return false;
                }

                const data = document.data();

                return (
                    data.email &&
                    data.email.trim().toLowerCase() === record.email
                );
            });

            if (duplicate) {
                return res.status(409).json({
                    message:
                        `Another ${label} already uses this email.`
                });
            }

            record.updatedAt = new Date().toISOString();

            await documentRef.set(record);

            const updatedDocument = await documentRef.get();

            console.log(
                `${label.toUpperCase()} UPDATED:`,
                publicRecord(updatedDocument)
            );

            res.json(publicRecord(updatedDocument));
        } catch (error) {
            console.error(`Update ${label} error:`, error.message);

            res.status(500).json({
                message: `Unable to update ${label}.`
            });
        }
    });

    // DELETE RECORD

    app.delete(`/api/${routeName}/:id`, async (req, res) => {
        try {
            const documentRef = collection.doc(req.params.id);
            const document = await documentRef.get();

            if (!document.exists) {
                return res.status(404).json({
                    message: `${label} not found.`
                });
            }

            const deletedRecord = publicRecord(document);

            await documentRef.delete();

            console.log(
                `${label.toUpperCase()} DELETED:`,
                deletedRecord
            );

            res.json({
                message: `${label} deleted successfully.`,
                id: req.params.id
            });
        } catch (error) {
            console.error(`Delete ${label} error:`, error.message);

            res.status(500).json({
                message: `Unable to delete ${label}.`
            });
        }
    });
}

createCrudRoutes("teacher", "teachers", "Teacher");
createCrudRoutes("student", "students", "Student");

// START SERVER

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});