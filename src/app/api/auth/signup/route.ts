import { NextResponse } from "next/server";
import { createUser } from "@/services/auth/users";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = createUser({ email, password, name });
    const token = createSessionToken(user.id);
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    console.error("Signup API error:", error);
    return NextResponse.json(
      { success: false, error: "Signup failed" },
      { status: 500 }
    );
  }
}
