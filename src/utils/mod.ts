export const die = (code: number, ...args: any[]): never => {
  console.log(...args);
  Deno.exit(code);
};

export const fatal = (...args: any[]) => die(1, "fatal:", ...args);

export const choose = (arr: any[]) => {
  return arr[Math.floor(Math.random() * arr.length)];
};
