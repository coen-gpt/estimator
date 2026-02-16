const requiredServerVars = [
  "DATABASE_URL",
  "JOBBER_CLIENT_ID",
  "JOBBER_CLIENT_SECRET",
  "JOBBER_REDIRECT_URI",
  "OAUTH_STATE_SECRET",
  "APP_BASE_URL"
] as const;

type RequiredServerVar = (typeof requiredServerVars)[number];

function requireEnv(name: RequiredServerVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: () => requireEnv("DATABASE_URL"),
  JOBBER_CLIENT_ID: () => requireEnv("JOBBER_CLIENT_ID"),
  JOBBER_CLIENT_SECRET: () => requireEnv("JOBBER_CLIENT_SECRET"),
  JOBBER_REDIRECT_URI: () => requireEnv("JOBBER_REDIRECT_URI"),
  OAUTH_STATE_SECRET: () => requireEnv("OAUTH_STATE_SECRET"),
  APP_BASE_URL: () => requireEnv("APP_BASE_URL")
};
