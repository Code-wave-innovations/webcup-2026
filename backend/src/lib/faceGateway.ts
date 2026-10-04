import { HttpError } from "./errors";

// D03 / F34: the face engine (face-recognitions/) is only ever reached from here. The browser sends the
// picture to the API, the API asks the engine whether it is the claimed person (`/verify`) and opens
// the session itself. Enrolling a face goes through the API too, for the signed-in person only. The
// engine's key (FACE_API_KEY) stays on the server: with it in the browser, anyone could enrol their own
// face under somebody else's name.

const TIMEOUT_MS = 15_000;

export type FaceVerdict = "match" | "mismatch" | "unusable" | "not_enrolled";

const config = () => {
  const url = process.env.FACE_API_URL?.trim().replace(/\/+$/, "");
  if (!url) throw new HttpError(503, "FACE_UNAVAILABLE", "Face sign-in is not configured on this server");
  const key = process.env.FACE_API_KEY?.trim();
  return { url, headers: key ? { "X-API-Key": key } : undefined };
};

/** The engine's gallery name for an account: the e-mail with "@" → ".at." (as `sanitize_identity_name` wants) */
export const faceIdentityOf = (email: string) => email.trim().toLowerCase().replace(/@/g, ".at.").slice(0, 64);

const call = async (path: string, form: FormData) => {
  const { url, headers } = config();
  try {
    return await fetch(`${url}${path}`, { method: "POST", body: form, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new HttpError(503, "FACE_UNAVAILABLE", "The face engine does not answer");
  }
};

const blobOf = (data: Buffer, mimetype: string) => new Blob([new Uint8Array(data)], { type: mimetype || "image/jpeg" });

/** Is this picture the person enrolled as `email`? Liveness is checked by the engine. */
export const verifyFace = async (email: string, image: { data: Buffer; mimetype: string }): Promise<FaceVerdict> => {
  const form = new FormData();
  form.append("name", faceIdentityOf(email));
  form.append("img", blobOf(image.data, image.mimetype), "frame.jpg");
  const response = await call("/verify", form);
  if (response.ok) {
    const body = (await response.json().catch(() => ({}))) as { verified?: boolean };
    return body.verified ? "match" : "mismatch";
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string; score?: number };
  // 401: another face. The engine answers it with a score of exactly 0 when nobody is enrolled under
  // the name (`FaceStore.verify`), which a real comparison never gives.
  if (response.status === 401) return body.score === 0 ? "not_enrolled" : "mismatch";
  // a failed liveness check (a photo held up to the camera) is refused like another face
  if (body.error === "liveness_failed") return "mismatch";
  // 400: no usable face in the frame
  if (response.status === 400) return "unusable";
  throw new HttpError(503, "FACE_UNAVAILABLE", "The face engine refused the request");
};

/** Adds the frames to the signed-in person's face; `committed` once the engine has enough samples. */
export const enrollFace = async (email: string, frames: { data: Buffer; mimetype: string }[]) => {
  const form = new FormData();
  form.append("name", faceIdentityOf(email));
  frames.forEach((frame, i) => form.append(`img${i}`, blobOf(frame.data, frame.mimetype), `frame${i}.jpg`));
  const response = await call("/enroll", form);
  const body = (await response.json().catch(() => ({}))) as { committed?: boolean; error?: string };
  if (!response.ok) throw new HttpError(response.status === 400 ? 400 : 503, response.status === 400 ? "FACE_UNUSABLE" : "FACE_UNAVAILABLE", body.error ?? "Enrolment failed");
  return { committed: Boolean(body.committed) };
};
