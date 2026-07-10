import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { createUser, findUserById } from "@/services/auth/users";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = findUserById(userId);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.json({ success: true, user });
}

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
    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      return NextResponse.json(
        { success: false, error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    console.error("Create user API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
}
