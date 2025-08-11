import type { RenderErrorOpts } from "../error.ts";

// Post-related errors
export const PostNotFound: [RenderErrorOpts, number] = [
    {
        code: "NotFound",
        details: "The post with the given ID was not found. It may have been deleted or you may have followed a broken link.",
        name: "Not found",
        title: "Post not found",
    },
    404
];

export const NoPostsAvailable: [RenderErrorOpts, number] = [
    {
        code: "NotFound",
        title: "No posts yet",
        name: "NotFound",
        details: "No posts are available yet. Be the first to create one!",
    },
    404
];

export const InvalidLink: [RenderErrorOpts, number] = [
    {
        code: "BadRequest",
        title: "Invalid link",
        name: "Bad request",
        details: "It looks like this post link is incomplete or broken. Please check the URL and try again.",
    },
    400
];

export const IncorrectPassword: [RenderErrorOpts, number] = [
    {
        code: "BadRequest",
        title: "Incorrect password",
        name: "Authentication failed",
        details: "The password you entered is incorrect. Please double-check and try again.",
    },
    401
];

export const SessionExpired: [RenderErrorOpts, number] = [
    {
        code: "BadRequest",
        title: "Editing session expired",
        name: "Session error",
        details: "Your editing session has expired or is invalid. Please refresh the page and try editing again.",
    },
    400
];

export const CaptchaError: [RenderErrorOpts, number] = [
    {
        details: "The captcha expired. Please try again.",
        title: "Invalid captcha.",
        name: "Captcha",
    },
    400
];
