import express from "express";

const RENDER_ERROR_OPTS = {
  code: "Error",
  title: "Error",
  details: "An unknown error occurred.",
  name: "Unknown error",
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

export const die = (code: number, ...args: any[]): never => {
  console.log(...args);
  Deno.exit(code);
};

export const fatal = (...args: any[]) => die(1, "fatal:", ...args);
