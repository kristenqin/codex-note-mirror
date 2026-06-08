export type Logger = {
  log: (message?: string) => void;
  error: (message?: string) => void;
};

export const consoleLogger: Logger = {
  log: (message = "") => console.log(message),
  error: (message = "") => console.error(message),
};

