import { NextResponse } from "next/server";
import { authenticateUser } from "@/services/auth/users";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = authenticateUser(email, password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = createSessionToken(user.id);
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
