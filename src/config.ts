import { z } from "zod/v4";
import process from "node:process";
import * as fs from "@std/fs";
import { die, fatal } from "./utils/mod.ts";

const configSchema = z.object({
  hostname: z.string().default("0.0.0.0"),
  httpPort: z.number().default(8000),
  adminPass: z.string().nonempty(),
  secrets: z.string().array().nonempty(),
});

export const loadConfig = (): z.infer<typeof configSchema> => {
  const configPath = process.env.WJ_CONFIG || "./config.json";
  if (!fs.existsSync(configPath)) {
    return fatal("Supplied config path did not exist!");
  }

  const config = JSON.parse(Deno.readTextFileSync(configPath));
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    return die(1, parsed.error.message);
  }

  return parsed.data;
};

export const config = loadConfig();
