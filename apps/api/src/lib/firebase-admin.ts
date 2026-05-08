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
    // Use ADC — on Cloud Run the service account is used automatically.
    // projectId must be passed explicitly so token verification knows which project.
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
}

export const firebaseAdmin = admin;
export const firebaseAuth: Auth = admin.auth();
