import { ZodError } from "zod/v4";
import { fromError } from "zod-validation-error/v4";

import type { NextFunction, Request, Response } from "express";

import express from "express";
import { config } from "./config.ts";

const RENDER_ERROR_OPTS = {
    code: "Error",
    title: "Error",
    details: "An unknown error occurred.",
    name: "Unknown error",
    whatsappUrl: config.whatsappUrl,
};

export type RenderErrorOpts = Partial<
    Record<keyof typeof RENDER_ERROR_OPTS, string | number>
>;

const errorOpts = (opts: RenderErrorOpts): typeof RENDER_ERROR_OPTS => {
    return Object.assign(JSON.parse(JSON.stringify(RENDER_ERROR_OPTS)), opts);
};

export const renderError = (
    res: express.Response,
    opts: RenderErrorOpts,
    code = 400,
) => {
    return res.status(code).render("error", errorOpts(opts));
};

export function errorHandler(
    err: any,
    _req: Request,
    res: Response,
    next: NextFunction,
): void {
    if (res.headersSent) return next(err);

    console.error(err);

    if (err instanceof ZodError) {
        const formatted = fromError(err);
        renderError(res, {
            code: "ValidationFailed",
            title: "Error",
            name: "Validation error",
            details: formatted.toString(),
        }, 400);
        return;
    }

    const statusCode = err?.status || 500;
    const message = err?.message || "An unexpected error occurred";

    renderError(res, {
        code: "InternalError",
        title: "Something went wrong",
        name: err?.name || "Error",
        details: message,
    }, statusCode);
}
