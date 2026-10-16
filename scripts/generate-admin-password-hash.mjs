import { randomBytes, scryptSync } from "node:crypto";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  throw new Error("Run this script in a private interactive terminal.");
}

const chunks = [];
process.stdout.write("Admin password (input hidden, minimum 12 characters): ");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  for (const byte of chunk) {
    if (byte === 3) {
      process.stdout.write("\nCancelled.\n");
      process.exit(1);
    }
    if (byte === 13 || byte === 10) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      const password = Buffer.concat(chunks).toString("utf8");
      process.stdout.write("\n");
      if (password.length < 12) {
        process.stderr.write("Password must contain at least 12 characters.\n");
        process.exitCode = 1;
        return;
      }
      const salt = randomBytes(16);
      const hash = scryptSync(password, salt, 64);
      process.stdout.write(
        `Set ADMIN_PASSWORD_HASH to: scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}\n`,
      );
      return;
    }
    if (byte === 8 || byte === 127) {
      const last = chunks.pop();
      if (last) {
        const text = last.toString("utf8");
        if (text.length > 1 && text.charCodeAt(text.length - 1) >= 0xdc00) {
          chunks.pop();
        }
      }
      continue;
    }
    chunks.push(Buffer.from([byte]));
  }
});
