import jwt from "jsonwebtoken";
import { config } from "../config.ts";
import { choose } from "./mod.ts";

export interface JWTPayload {
    username: string;
    iat?: number;
    exp?: number;
}

export const signToken = (payload: JWTPayload): string => {
    const [secret] = choose(config.secrets, 1); // Use the first secret for signing
    return jwt.sign(payload, secret, { expiresIn: "24h" });
};

export const verifyToken = (token: string): JWTPayload => {
    const [secret] = choose(config.secrets, 1);
    return jwt.verify(token, secret) as JWTPayload;
};

export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    return authHeader.replace("Bearer ", "");
};
