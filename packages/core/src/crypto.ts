import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from "node:crypto";
import { canonicalStringify } from "./canonical";

export interface SigningIdentity {
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface EncryptedEnvelope {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function sha256Hex(value: unknown): string {
  const input =
    typeof value === "string" ? value : canonicalStringify(value);
  return createHash("sha256").update(input).digest("hex");
}

export function generateSigningIdentity(): SigningIdentity {
  const pair = generateKeyPairSync("ed25519");

  return {
    publicKeyPem: pair.publicKey.export({
      type: "spki",
      format: "pem",
    }).toString(),
    privateKeyPem: pair.privateKey.export({
      type: "pkcs8",
      format: "pem",
    }).toString(),
  };
}

export function signCanonical(
  value: unknown,
  privateKeyPem: string,
): string {
  return sign(
    null,
    Buffer.from(canonicalStringify(value)),
    privateKeyPem,
  ).toString("base64");
}

export function verifyCanonical(
  value: unknown,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  return verify(
    null,
    Buffer.from(canonicalStringify(value)),
    publicKeyPem,
    Buffer.from(signatureBase64, "base64"),
  );
}

export function createAesKeyBase64(): string {
  return randomBytes(32).toString("base64");
}

export function encryptJson(
  value: unknown,
  keyBase64: string,
): EncryptedEnvelope {
  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== 32) {
    throw new Error("AES key must contain exactly 32 bytes");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(canonicalStringify(value), "utf8"),
    cipher.final(),
  ]);

  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptJson<T>(
  envelope: EncryptedEnvelope,
  keyBase64: string,
): T {
  const key = Buffer.from(keyBase64, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as T;
}
