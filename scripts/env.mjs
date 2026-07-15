import { readFileSync } from "node:fs";

export function loadEnv() {
  try {
    const text = readFileSync(".env", "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // Explicit environment variables are also supported.
  }
}

export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const placeholders = names.filter((name) => {
    const value = process.env[name] ?? "";
    return value.includes("your-") || value.includes("change-this");
  });

  if (placeholders.length) {
    throw new Error(`Replace placeholder environment variables: ${placeholders.join(", ")}`);
  }
}
