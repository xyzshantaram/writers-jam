export const die = (code: number, ...args: any[]): never => {
  console.log(...args);
  Deno.exit(code);
};

export const fatal = (...args: any[]) => die(1, "fatal:", ...args);
