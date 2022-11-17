import { DiagnosticSeverity } from 'vscode-languageserver';

/**
 * An object that keeps track of all possible error messages.
 */
export let DiagnosticMessages = {
    /**
     * Used in the lexer anytime we encounter an unsupported character
     */
    unexpectedCharacter: (text: string) => ({
        message: `Unexpected character '${text}' (char code ${text?.charCodeAt(0)})`,
        code: 1000,
        severity: DiagnosticSeverity.Error
    }),
    unterminatedStringAtEndOfLine: () => ({
        message: `Unterminated string at end of line`,
        code: 1001,
        severity: DiagnosticSeverity.Error
    }),
    unterminatedStringAtEndOfFile: () => ({
        message: `Unterminated string at end of file`,
        code: 1002,
        severity: DiagnosticSeverity.Error
    })
};
