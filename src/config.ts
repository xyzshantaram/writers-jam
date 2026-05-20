import { z } from "zod";
import process from "node:process";
import * as fs from "@std/fs";
import { die, fatal } from "./utils/mod.ts";

const configSchema = z.object({
    hostname: z.string().default("0.0.0.0"),
    httpPort: z.number().default(8000),
    adminPass: z.string().nonempty(),
    secrets: z.string().array().nonempty(),
    whatsappUrl: z.url().nonempty(),
});

const loadConfigFromEnv = (): z.infer<typeof configSchema> | null => {
    const adminPass = Deno.env.get("WJ_ADMIN_PASS");
    const secretsRaw = Deno.env.get("WJ_SECRETS");
    const whatsappUrl = Deno.env.get("WJ_WHATSAPP_URL");

    if (!adminPass || !secretsRaw || !whatsappUrl) {
        return null;
    }

    const secrets = secretsRaw.split(",").map((s) => s.trim()).filter(Boolean);

    return configSchema.safeParse({
        adminPass,
        secrets,
        whatsappUrl,
        env: Deno.env.get("WJ_ENV") || "dev",
    }).data ?? null;
};

const loadConfigFromFile = (): z.infer<typeof configSchema> => {
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

export const loadConfig = (): z.infer<typeof configSchema> => {
    const envConfig = loadConfigFromEnv();
    if (envConfig) {
        return envConfig;
    }
    return loadConfigFromFile();
};

export const config = loadConfig();
