type DeriveAesGcmKeyParams = {
  passphrase: string;
  salt: Uint8Array;
  iterations: number;
};

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  return globalThis.crypto;
}

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Uint8Array) {
    return (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  throw new Error('Invalid data type: expected ArrayBuffer or Uint8Array');
}

async function deriveAesGcmKey({
  passphrase,
  salt,
  iterations,
}: DeriveAesGcmKeyParams): Promise<CryptoKey> {
  const crypto = requireWebCrypto();

  const passphraseBytes = new TextEncoder().encode(passphrase);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passphraseBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export type AesGcmEncryptionResult = {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
  iterations: number;
  algorithm: "AES-GCM";
};

export async function encryptAesGcm(
  plaintext: ArrayBuffer | Uint8Array,
  passphrase: string,
  iterations = 100000,
): Promise<AesGcmEncryptionResult> {
  const crypto = requireWebCrypto();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveAesGcmKey({ passphrase, salt, iterations });

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    toArrayBuffer(plaintext),
  );

  return {
    ciphertext: new Uint8Array(ciphertextBuffer),
    iv,
    salt,
    iterations,
    algorithm: "AES-GCM",
  };
}

export type AesGcmDecryptionParams = {
  ciphertext: ArrayBuffer | Uint8Array;
  passphrase: string;
  iv: Uint8Array;
  salt: Uint8Array;
  iterations: number;
};

export async function decryptAesGcm({
  ciphertext,
  passphrase,
  iv,
  salt,
  iterations,
}: AesGcmDecryptionParams): Promise<ArrayBuffer> {
  const crypto = requireWebCrypto();

  const key = await deriveAesGcmKey({ passphrase, salt, iterations });

  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    toArrayBuffer(ciphertext),
  );
}
