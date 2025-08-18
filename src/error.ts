import { fromError, isZodErrorLike } from "zod-validation-error/v4";

import type { NextFunction, Request, Response } from "express";

import express from "express";
import { config } from "./config.ts";
import { ValidationError } from "./errors/general.ts";

const RENDER_ERROR_OPTS = {
    code: "Error",
    title: "Oops! Something went wrong",
    details: "Something unexpected happened. Please try refreshing the page or come back later.",
    name: "Unexpected error",
    whatsappUrl: config.whatsappUrl,
};

export type RenderErrorOpts = Partial<
    Record<keyof typeof RENDER_ERROR_OPTS, string | number>
>;

const errorOpts = (opts: RenderErrorOpts): typeof RENDER_ERROR_OPTS => {
    return Object.assign(JSON.parse(JSON.stringify(RENDER_ERROR_OPTS)), opts);
};

export const errors = {
    json: (res: Response, opts: any, code = 400) =>
        res.status(code).json({
            success: false,
            error: {
                code: opts.code,
                title: opts.title,
                name: opts.name,
                details: opts.details,
            },
        }),
    render: (
        res: express.Response,
        opts: RenderErrorOpts,
        code = 400,
    ) => {
        return res.status(code).render("error", errorOpts(opts));
    },
};

export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    if (res.headersSent) return next(err);

    console.error(err);
    const errFn = req.originalUrl.startsWith("/api") ? errors.json : errors.render;

    if (isZodErrorLike(err)) {
        const formatted = fromError(err);

        return errFn(
            res,
            ...ValidationError(
                `There was an issue with the information you provided. Please check your input and try again. Details: ${formatted.toString()}`,
            ),
        );
    }

    const statusCode = err?.status || 500;
    const message = err?.message || "An unexpected error occurred. Please try again later.";

    return errFn(res, {
        code: "InternalError",
        title: "Something went wrong",
        name: err?.name || "Error",
        details: message,
    }, statusCode);
}
