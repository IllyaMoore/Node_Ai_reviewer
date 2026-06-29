export declare const VERSION = "0.1";
/** Loads .env file into process.env (no-op if file doesn't exist) */
export declare function loadEnv(): void;
/** Validates required environment tokens are set */
export declare function checkTokens(): {
    githubToken: string;
};
//# sourceMappingURL=config.d.ts.map