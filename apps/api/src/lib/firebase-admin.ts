import admin from "firebase-admin";
import type { Auth } from "firebase-admin/auth";

const projectId = process.env["FIREBASE_PROJECT_ID"];
const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
// Replace literal \n sequences AND strip any stray \r characters introduced by
// Windows-style CRLF line endings in the Secret Manager value.
const privateKey = process.env["FIREBASE_PRIVATE_KEY"]
  ?.replace(/\\n/g, "\n")
  .replace(/\r/g, "");

if (!admin.apps.length) {
  const useExplicitCred = Boolean(projectId && clientEmail && privateKey);

  // Log initialization path so Cloud Run logs reveal which branch was taken.
  // Never log the private key or client email — only metadata.
  console.info(
    JSON.stringify({
      level: "info",
      msg: "Firebase Admin init",
      mode: useExplicitCred ? "service-account" : "adc",
      projectId: projectId ?? "(missing)",
      hasClientEmail: Boolean(clientEmail),
      privateKeyLength: privateKey?.length ?? 0,
      privateKeyStart: privateKey?.slice(0, 27) ?? "(missing)",
    })
  );

  if (useExplicitCred) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey: privateKey!,
      }),
    });
  } else {
    // ADC: on Cloud Run the default service account is used automatically.
    // projectId must be passed so verifyIdToken knows which project to validate against.
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
}

export const firebaseAdmin = admin;
export const firebaseAuth: Auth = admin.auth();
