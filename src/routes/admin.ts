import { Request, Response } from "express";
import { config } from "../config.ts";
import {
    adminDeleteComment,
    adminDeletePost,
    adminSetPostNsfw,
    type AdminUser,
    createAdmin,
    createAdminCode,
    deleteCode,
    getAdmin,
    getModerationLogs,
    isValidCode,
    type ModerationLogResponse,
} from "../db/admin.ts";
import { getCommentById, logModerationAction, updatePostEditCode } from "../db/mod.ts";
import { adminCreateEdition } from "../db/editions.ts";
import { hash, verify } from "@bronti/argon2";
import { hashPostId, randIntInRange } from "../utils/mod.ts";
import { signinSchema, signupSchema } from "../schemas/admin.ts";
import { signToken } from "../utils/jwt.ts";
import { fromError } from "zod-validation-error/v4";
import {
    InvalidCode,
    InvalidCredentials,
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

interface AuthenticatedRequest extends Request {
    username?: string;
}

const getAdminUser = (req: AuthenticatedRequest) => {
    const username: string | undefined = req.username;
    if (!username) {
        throw new Error("Admin username not present! This is a bug");
    }
    return username;
};

export const deletePost = (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return errors.json(res, ...ValidationError("Invalid post ID"));
    adminDeletePost(id, getAdminUser(req));
    res.json({
        success: true,
        message: "Post deleted successfully",
    });
};

export const setPostNsfw = (req: Request, res: Response) => {
    const { id } = req.params;
    const { nsfw } = req.body;

    if (typeof nsfw !== "boolean") {
        return errors.json(res, ...ValidationError("NSFW must be a boolean value"));
    }

    if (!id) return errors.json(res, ...ValidationError("Invalid post ID"));

    adminSetPostNsfw(id, nsfw, getAdminUser(req));
    res.json({
        success: true,
        message: `Post ${nsfw ? "marked as" : "unmarked as"} NSFW`,
    });
};

export const getComment = (req: Request, res: Response) => {
    const { id } = req.params;
    const comment = getCommentById(id);

    if (!comment) return errors.json(res, ...ValidationError("Comment not found"));

    res.json({
        success: true,
        data: comment,
    });
};

export const deleteComment = (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return errors.json(res, ...ValidationError("Invalid post ID"));

    adminDeleteComment(id, getAdminUser(req));
    res.json({
        success: true,
        message: "Comment deleted successfully",
    });
};

export const createEdition = (req: Request, res: Response) => {
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
        message: "Edition created successfully! The server will restart in 15 seconds.",
        data: edition,
    });

    logModerationAction(
        getAdminUser(req),
        "create",
        "edition",
        edition.id.toString(),
        edition.name,
    );

    setTimeout(() => {
        console.warn("Going down for edition update!");
        Deno.exit(0);
    }, 15000);
};

export const whoami = (req: Request, res: Response) => {
    res.json({
        success: true,
        user: { username: getAdminUser(req) },
    });
};

export const resetPostEditCode = (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return errors.json(res, ...ValidationError("Invalid post ID"));

    const n = randIntInRange(100000, 1000000);
    const code = hashPostId(n);

    updatePostEditCode(id, code);
    logModerationAction(getAdminUser(req), "edit_code_reset", "post", id, undefined, undefined);

    res.json({
        success: true,
        message: "Post edit code reset successfully",
        data: {
            new_code: code,
        },
    });
};

export const getModerationLog = (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = Math.min(parseInt(req.query.page_size as string) || 20, 100);

        if (page < 1 || pageSize < 1) {
            return errors.json(
                res,
                ...ValidationError("Page and pageSize must be positive integers"),
            );
        }

        const result: ModerationLogResponse = getModerationLogs(page, pageSize);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Get moderation log error:", error);
        return errors.json(res, ...ValidationError("Failed to retrieve moderation log"));
    }
};
