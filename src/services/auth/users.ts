import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getAuthDatabase } from "./db";

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function findUserByEmail(email: string): (AuthUser & { passwordHash: string }) | null {
  const database = getAuthDatabase();
  const row = database
    .prepare(
      "SELECT id, email, password_hash, name, created_at FROM user WHERE email = ? COLLATE NOCASE"
    )
    .get(email.trim()) as UserRow | undefined;

  if (!row) return null;

  return {
    ...toAuthUser(row),
    passwordHash: row.password_hash,
  };
}

export function findUserById(id: number): AuthUser | null {
  const database = getAuthDatabase();
  const row = database
    .prepare("SELECT id, email, name, created_at FROM user WHERE id = ?")
    .get(id) as Omit<UserRow, "password_hash"> | undefined;

  return row ? toAuthUser({ ...row, password_hash: "" }) : null;
}

export function createUser(input: {
  email: string;
  password: string;
  name?: string;
}): AuthUser {
  const email = input.email.trim().toLowerCase();
  const database = getAuthDatabase();

  const existing = database
    .prepare("SELECT id FROM user WHERE email = ? COLLATE NOCASE")
    .get(email) as { id: number } | undefined;

  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const result = database
    .prepare(
      "INSERT INTO user (email, password_hash, name) VALUES (?, ?, ?)"
    )
    .run(email, hashPassword(input.password), input.name?.trim() || null);

  const user = findUserById(Number(result.lastInsertRowid));
  if (!user) {
    throw new Error("CREATE_FAILED");
  }

  return user;
}

export function authenticateUser(
  email: string,
  password: string
): AuthUser | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const { passwordHash: _, ...authUser } = user;
  return authUser;
}
