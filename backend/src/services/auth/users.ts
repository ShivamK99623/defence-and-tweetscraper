import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AUTH_TABLE } from "@/config/db";
import { queryOne } from "@/lib/db/run-query";
import { toEpochMs } from "@/lib/db/timestamps";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: number;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: Date | string;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: toEpochMs(row.created_at) ?? Date.now(),
  };
}

export async function findUserByEmail(
  email: string
): Promise<(AuthUser & { passwordHash: string }) | null> {
  const row = await queryOne<UserRow>(
    `SELECT id, email, password_hash, name, created_at
     FROM "${AUTH_TABLE}"
     WHERE LOWER(email) = LOWER(?)`,
    [email.trim()]
  );

  if (!row) return null;

  return {
    ...toAuthUser(row),
    passwordHash: row.password_hash,
  };
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const row = await queryOne<Omit<UserRow, "password_hash">>(
    `SELECT id, email, name, created_at FROM "${AUTH_TABLE}" WHERE id = ?`,
    [id]
  );

  return row ? toAuthUser({ ...row, password_hash: "" }) : null;
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM "${AUTH_TABLE}" WHERE LOWER(email) = LOWER(?)`,
    [email]
  );

  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const inserted = await queryOne<UserRow>(
    `INSERT INTO "${AUTH_TABLE}" (id, email, password_hash, name, created_at)
     VALUES (gen_random_uuid()::text, ?, ?, ?, NOW())
     RETURNING id, email, password_hash, name, created_at`,
    [email, hashPassword(input.password), input.name?.trim() || null]
  );

  if (!inserted) {
    throw new Error("CREATE_FAILED");
  }

  return toAuthUser(inserted);
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const { passwordHash: _, ...authUser } = user;
  return authUser;
}
