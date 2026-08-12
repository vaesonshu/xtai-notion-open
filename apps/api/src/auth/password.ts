import { randomBytes, scrypt as _scrypt } from "crypto"
import { promisify } from "util"

const scrypt = promisify(_scrypt)

// Utility functions for password hashing. We use Node's built-in scrypt to avoid
// adding external native dependencies. The output format is: salt:derivedHex
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString("hex")}`
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, derivedHex] = stored.split(":" )
  if (!salt || !derivedHex) return false
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return derived.toString("hex") === derivedHex
}
