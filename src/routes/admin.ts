import { Request, Response } from "express";
import { config } from "../config.ts";
import {
    type AdminUser,
    createAdmin,
    createAdminCode,
    deleteCode,
    getAdmin,
    isValidCode,
} from "../db/admin.ts";
import { adminDeleteComment, adminDeletePost, adminSetPostNsfw } from "../db/admin.ts";
import { adminCreateEdition } from "../db/editions.ts";
import { hash, verify } from "@bronti/argon2";
import { signinSchema, signupSchema } from "../schemas/admin.ts";
import { extractTokenFromHeader, signToken, verifyToken } from "../utils/jwt.ts";
import { fromError } from "zod-validation-error/v4";
import {
    InvalidCode,
    InvalidCredentials,
    InvalidToken,
    MissingToken,
    SigninError,
    SignupError,
    UserExists,
} from "../errors/admin.ts";
import { ValidationError } from "../errors/general.ts";
import { errors } from "../error.ts";

/*
GET /post/:ulid/edit
    - delete post
    - edit post contents
POST /post/:id/report (w/ reason). 3 reports to hide a post and present it to admin for review as flagged.
GET /admin/reports
GET /admin/reports/:id
POST /admin/post/:id/delete
POST /admin/post/:id/nsfw (body has param state: yes/no)
POST /admin/comment/:ulid/delete
POST /admin/edition
POST /admin/edition/delete
*/

export const index = (_: Request, res: Response) => {
    res.render("admin", {
        whatsappUrl: config.whatsappUrl,
    });
};

export const signup = (req: Request, res: Response) => {
    try {
        const result = signupSchema.safeParse(req.body);
        if (!result.success) {
            const err = ValidationError(
                `Invalid signup data: ${fromError(result.error).toString()}`,
            );
            return errors.json(res, ...err);
        }

        const { username, password, signupCode } = result.data;

        const existing = getAdmin(username);
        if (existing) return errors.json(res, ...UserExists);

        if (!isValidCode(signupCode)) return errors.json(res, ...InvalidCode);

        const hashed = hash(password);
        createAdmin(username, hashed);
        deleteCode(signupCode);

        const token = signToken({ username });

        res.json({
            success: true,
            message: "Admin account created successfully",
            token,
        });
    } catch (error) {
        console.error("Signup error:", error);
        return errors.json(res, ...SignupError);
    }
};

export const signin = (req: Request, res: Response) => {
    try {
        const result = signinSchema.safeParse(req.body);
        if (!result.success) {
            const formattedError = fromError(result.error);
            return errors.json(
                res,
                ...ValidationError(`Invalid signin data: ${formattedError.toString()}`),
            );
        }

        const { username, password } = result.data;

        // Get admin from database
        const admin: AdminUser | undefined = getAdmin(username);
        if (!admin) return errors.json(res, ...InvalidCredentials);

        if (!verify(password, admin.password)) return errors.json(res, ...InvalidCredentials);

        // Generate JWT token
        const token = signToken({ username });

        res.json({
            success: true,
            message: "Sign in successful",
            token,
        });
    } catch (error) {
        console.error("Signin error:", error);
        return errors.json(res, ...SigninError);
    }
};

export const createSignupCode = (_: Request, res: Response) => {
    try {
        const code = createAdminCode();
        res.json({
            success: true,
            data: { code },
        });
    } catch (error) {
        console.error("Create signup code error:", error);
        return errors.json(res, ...SignupError);
    }
};

export const deletePost = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        adminDeletePost(id);
        res.json({
            success: true,
            message: "Post deleted successfully",
        });
    } catch (error) {
        console.error("Delete post error:", error);
        return errors.json(res, ...SignupError);
    }
};

export const setPostNsfw = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nsfw } = req.body;

        if (typeof nsfw !== "boolean") {
            return errors.json(res, ...ValidationError("NSFW must be a boolean value"));
        }

        adminSetPostNsfw(id, nsfw);
        res.json({
            success: true,
            message: `Post ${nsfw ? "marked as" : "unmarked as"} NSFW`,
        });
    } catch (error) {
        console.error("Set post NSFW error:", error);
        return errors.json(res, ...SignupError);
    }
};

// Comment management routes
export const deleteComment = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        adminDeleteComment(id);
        res.json({
            success: true,
            message: "Comment deleted successfully",
        });
    } catch (error) {
        console.error("Delete comment error:", error);
        return errors.json(res, ...SignupError);
    }
};

export const createEdition = (req: Request, res: Response) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== "string") {
            return errors.json(
                res,
                ...ValidationError("Edition name is required and must be a string"),
            );
        }

        const edition = adminCreateEdition(name);
        res.json({
            success: true,
            message: "Please restart the server.",
            data: edition,
        });
    } catch (error) {
        console.error("Create edition error:", error);
        return errors.json(res, ...SignupError);
    }
};

export const whoami = (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);
        if (!token) return errors.json(res, ...MissingToken);

        const payload = verifyToken(token);

        const admin: AdminUser | undefined = getAdmin(payload.username);
        if (!admin) return errors.json(res, ...InvalidCredentials);

        res.json({
            success: true,
            user: { username: admin.username },
        });
    } catch (error) {
        console.error("Whoami error:", error);
        return errors.json(res, ...InvalidToken);
    }
};
