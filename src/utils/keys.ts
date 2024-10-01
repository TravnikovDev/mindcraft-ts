import { readFileSync } from "fs";

const keys: Record<string, string> = {};

try {
  const data = readFileSync("./keys.json", "utf8");
  Object.assign(keys, JSON.parse(data));
} catch (err) {
  console.warn("keys.json not found. Defaulting to environment variables.");
}

export function getKey(name: string): string {
  let key = keys[name] || process.env[name];
  if (!key) {
    throw new Error(
      `API key "${name}" not found in keys.json or environment variables!`
    );
  }
  return key;
}

export function hasKey(name: string): boolean {
  return Boolean(keys[name] || process.env[name]);
}
