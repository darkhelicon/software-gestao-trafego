import admin from "firebase-admin";
import type { Auth } from "firebase-admin/auth";

const projectId = process.env["FIREBASE_PROJECT_ID"];
const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    // Credentials not configured — Firebase auth will be unavailable
    admin.initializeApp();
  }
}

export const firebaseAdmin = admin;
export const firebaseAuth: Auth = admin.auth();
