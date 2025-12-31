// Fix for: Cannot find type definition file for 'vite/client'.
// Fix for: Cannot redeclare block-scoped variable 'process'.

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    [key: string]: string;
  }
}
