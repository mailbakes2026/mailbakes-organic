function keyMaterial() {
  const dedicated = process.env.TOKEN_ENCRYPTION_KEY;
  if (dedicated && dedicated.length >= 32) return dedicated;
  const session = process.env.SESSION_SECRET;
  if (session && session.length >= 32) return session;
  return null;
}

export function encryptionReady() {
  return keyMaterial() != null;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function aesKey() {
  const material = keyMaterial();
  if (!material) throw new Error("Set TOKEN_ENCRYPTION_KEY or SESSION_SECRET before saving a login.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plain)),
  );
  return `${toBase64Url(iv)}.${toBase64Url(encrypted)}`;
}

export async function decryptSecret(packed: string) {
  const [ivPart, dataPart] = packed.split(".");
  if (!ivPart || !dataPart) throw new Error("Saved login is unreadable.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    await aesKey(),
    fromBase64Url(dataPart),
  );
  return new TextDecoder().decode(plain);
}
