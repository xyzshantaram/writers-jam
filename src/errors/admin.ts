import type { RenderErrorOpts } from "../error.ts";

// Admin authentication errors
export const MissingToken: [RenderErrorOpts, number] = [
    {
        code: "MissingToken",
        title: "Authentication Required",
        name: "No token provided",
        details: "Authentication token is required to access this resource.",
    },
    401
];

export const InvalidToken: [RenderErrorOpts, number] = [
    {
        code: "InvalidToken",
        title: "Invalid Token",
        name: "Authentication failed",
        details: "The provided token is invalid or has expired. Please sign in again.",
    },
    401
];

export const InvalidCredentials: [RenderErrorOpts, number] = [
    {
        code: "InvalidCredentials",
        title: "Invalid Credentials",
        name: "Authentication failed",
        details: "Invalid username or password.",
    },
    401
];

// Admin signup errors
export const UserExists: [RenderErrorOpts, number] = [
    {
        code: "UserExists",
        title: "Username Taken",
        name: "User already exists",
        details: "An admin with this username already exists. Please choose a different username.",
    },
    409
];

export const InvalidCode: [RenderErrorOpts, number] = [
    {
        code: "InvalidCode",
        title: "Invalid Signup Code",
        name: "Invalid code",
        details: "The signup code you provided is invalid or has expired.",
    },
    400
];

export const SignupError: [RenderErrorOpts, number] = [
    {
        code: "SignupError",
        title: "Signup Failed",
        name: "Signup error",
        details: "An error occurred during signup. Please try again.",
    },
    500
];

export const SigninError: [RenderErrorOpts, number] = [
    {
        code: "SigninError",
        title: "Sign In Failed",
        name: "Sign in error",
        details: "An error occurred during sign in. Please try again.",
    },
    500
];
