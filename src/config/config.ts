import { z } from "zod";

const configSchema = z.object({
  PORT: z.number().default(5050),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DB_PATH: z.string().default("data/latency.db"),
  GRAFANA: z.object({
    USER_ID: z.string(),
    API_KEY: z.string(),
    PUSH_URL: z.string().url(),
  }),
  DEFAULT_INTERVAL: z.number().min(1000).default(30000),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const config = {
    PORT: process.env.PORT ? parseInt(process.env.PORT) : undefined,
    NODE_ENV: process.env.NODE_ENV,
    DB_PATH: process.env.DB_PATH,
    GRAFANA: {
      USER_ID: process.env.GRAFANA_USER_ID,
      API_KEY: process.env.GRAFANA_API_KEY,
      PUSH_URL: process.env.GRAFANA_PUSH_URL,
    },
    DEFAULT_INTERVAL: process.env.DEFAULT_INTERVAL
      ? parseInt(process.env.DEFAULT_INTERVAL)
      : undefined,
  };

  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Configuration validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
    }
    throw new Error("Invalid configuration");
  }
}

export const config = loadConfig();
