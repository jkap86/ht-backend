export const log = (...args: any[]) => {
  console.log("[LOG]", ...args);
};

export const error = (...args: any[]) => {
  console.error("[ERROR]", ...args);
};
