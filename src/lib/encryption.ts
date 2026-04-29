import "server-only";

import crypto from "node:crypto";

const KEY_BYTES = 32; // AES-256

function parseKeyFromEnv(raw: string): Buffer | null {
  const v = raw.trim();
  if (!v) return null;

  // Try base64/base64url first
  try {
    const normalized = v.replace(/-/g, "+").replace(/_/g, "/");
    const buf = Buffer.from(normalized, "base64");
    if (buf.length === KEY_BYTES) return buf;
  } catch {
    // ignore
  }

  // Try hex
  try {
    const buf = Buffer.from(v, "hex");
    if (buf.length === KEY_BYTES) return buf;
  } catch {
    // ignore
  }

  return null;
}

function getEncryptionKey(): Buffer {
  const fromEnv = process.env.DATA_ENCRYPTION_KEY;
  if (typeof fromEnv === "string") {
    const parsed = parseKeyFromEnv(fromEnv);
    if (parsed) return parsed;
  }

  // Dev fallback: per-process key so local setup doesn't crash.
  // IMPORTANT: secrets encrypted with this key won't be decryptable after restart.
  const g = globalThis as unknown as { __mailappEncKey?: Buffer };
  if (!g.__mailappEncKey) {
    g.__mailappEncKey = crypto.randomBytes(KEY_BYTES);
  }
  return g.__mailappEncKey;
}

export function encryptSecret(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plain, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Format: v1:<iv_b64url>.<tag_b64url>.<ct_b64url>
  const b64u = (buf: Buffer) =>
    buf
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  return `v1:${b64u(iv)}.${b64u(tag)}.${b64u(ciphertext)}`;
}

export function decryptSecret(payload: string): string {
  const key = getEncryptionKey();
  const raw = payload.trim();
  if (!raw.startsWith("v1:")) {
    throw new Error("Unknown secret format");
  }

  const parts = raw.slice(3).split(".");
  if (parts.length !== 3) throw new Error("Invalid secret payload");

  const fromB64u = (s: string) => {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    return Buffer.from(padded + "=".repeat(padLen), "base64");
  };

  const iv = fromB64u(parts[0]);
  const tag = fromB64u(parts[1]);
  const ct = fromB64u(parts[2]);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}
