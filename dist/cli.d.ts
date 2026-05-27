type Prompt = (question: string) => Promise<string> | string;
export interface CliIo {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    fetch?: typeof fetch;
    stdout?: (line: string) => void;
    stderr?: (line: string) => void;
    prompt?: Prompt;
}
export declare function runCli(argv: readonly string[], io?: CliIo): Promise<number>;
export declare function isCliEntrypoint(importMetaUrl: string, argv1: string | undefined, realpath?: (path: string) => string): boolean;
export {};
