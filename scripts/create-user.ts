/**
 * Create an additional user from the command line.
 *
 * Usage:
 *   npx tsx scripts/create-user.ts user@example.com password123 "Display Name"
 */
import { createUser } from "../src/services/auth/users";
import { closeAuthDatabase } from "../src/services/auth/db";

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error(
      "Usage: npx tsx scripts/create-user.ts <email> <password> [name]"
    );
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  try {
    const user = createUser({ email, password, name });
    console.log(`Created user #${user.id}: ${user.email}`);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      console.error("A user with that email already exists.");
      process.exit(1);
    }
    throw error;
  } finally {
    closeAuthDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
