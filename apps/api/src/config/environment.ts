export type NodeEnvironment = "development" | "test" | "production"

export interface Environment {
  PORT: number
  DATABASE_URL: string
  COLLABORATION_PORT: number
  NODE_ENV: NodeEnvironment
  COS_SECRET_ID?: string
  COS_SECRET_KEY?: string
  COS_BUCKET?: string
  COS_REGION?: string
  COS_PUBLIC_BASE_URL?: string
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
}

function requireValue(
  source: NodeJS.ProcessEnv,
  key: keyof Environment
): string {
  const value = source[key]
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function requirePort(
  source: NodeJS.ProcessEnv,
  key: "PORT" | "COLLABORATION_PORT"
): number {
  const raw = requireValue(source, key)
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port for ${key}: ${raw}`)
  }
  return port
}

function requireNodeEnv(source: NodeJS.ProcessEnv): NodeEnvironment {
  const value = requireValue(source, "NODE_ENV")
  if (value !== "development" && value !== "test" && value !== "production") {
    throw new Error(
      `Invalid NODE_ENV: ${value}. Expected development, test, or production.`
    )
  }
  return value
}

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env
): Environment {
  return {
    PORT: requirePort(source, "PORT"),
    DATABASE_URL: requireValue(source, "DATABASE_URL"),
    COLLABORATION_PORT: requirePort(source, "COLLABORATION_PORT"),
    NODE_ENV: requireNodeEnv(source),
    COS_SECRET_ID: source.COS_SECRET_ID,
    COS_SECRET_KEY: source.COS_SECRET_KEY,
    COS_BUCKET: source.COS_BUCKET,
    COS_REGION: source.COS_REGION,
    COS_PUBLIC_BASE_URL: source.COS_PUBLIC_BASE_URL,
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    OPENAI_BASE_URL: source.OPENAI_BASE_URL,
    OPENAI_MODEL: source.OPENAI_MODEL,
  }
}
