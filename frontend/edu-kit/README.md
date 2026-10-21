# Edu-Kit

Edu-Kit is a React + Firebase + Express education management system.

## Stack
- React + Vite
- React Router
- Bootstrap 5 + Bootstrap Icons
- Firebase Authentication
- Cloud Firestore
- Express REST API

## No .env required
Firebase configuration is in `firebase.js`. The Express backend uses port 5000 directly.

## Run the backend
Open CMD in `Edu-kit/backend`:

```cmd
npm install
npm start
```

Backend: http://localhost:5000
Health: http://localhost:5000/api/health

## Run the frontend
Open another CMD in `Edu-kit/frontend/edu-kit`:

```cmd
npm install
npm run dev
```

Frontend: http://localhost:5173

## Roles
The login form does not have a role selector.

New accounts are created as `student`. To make an account a teacher or admin, edit the corresponding document in Firestore:

Collection: `users`
Document ID: Firebase Authentication UID
Field:

`role: "teacher"`

or

`role: "admin"`

After changing the role, sign out and sign in again.

## Firestore rules
`firestore.rules` is included. Deploy it with Firebase CLI if desired:

```cmd
firebase deploy --only firestore:rules
```
