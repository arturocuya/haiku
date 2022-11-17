
// Heavily inspired on BrighterScript's Lexer

import { TokenKind } from './TokenKind';
import bsUtil from 'brighterscript/dist/util';
import type { Diagnostic, Range } from 'vscode-languageserver';
import type { Token as BsToken } from 'brighterscript';
import { DiagnosticMessages } from '../DiagnosticMessages';

export interface Token extends Omit<BsToken, 'kind'> {
    /** The type of token this represents. */
    kind: TokenKind;
}

export class Lexer {
    /**
     * The zero-indexed position at which the token under consideration begins.
    */
    private start: number;

    /**
      * The zero-indexed position being examined for the token under consideration.
    */
    private current: number;

    /**
      * The zero-indexed begin line number being parsed.
    */
    private lineBegin: number;

    /**
      * The zero-indexed end line number being parsed
    */
    private lineEnd: number;

    /**
      * The zero-indexed begin column number being parsed.
    */
    private columnBegin: number;

    /**
      * The zero-indexed end column number being parsed
    */
    private columnEnd: number;

    /**
      * The BrightScript code being converted to an array of `Token`s.
    */
    public source: string;

    /**
      * The tokens produced from `source`.
    */
    public tokens: Token[];

    /**
      * The errors produced from `source.`
    */
    public diagnostics: Diagnostic[];

    /**
     * Contains all of the leading whitespace that has not yet been consumed by a token
    */
    private leadingWhitespace = '';

    /**
     * A convenience function, equivalent to `new Lexer().scan(toScan)`, that converts a string
     * containing Haiku code to an array of `Token` objects that will later be used to build
     * an abstract syntax tree.
     *
     * @param toScan the Haiku code to convert into tokens
     * @param options options used to customize the scan process
     * @returns an object containing an array of `errors` and an array of `tokens` to be passed to a parser.
    */
    static scan(toScan: string): Lexer {
        return new Lexer().scan(toScan);
    }

    /**
     * Converts a string containing BrightScript code to an array of `Token` objects that will
     * later be used to build an abstract syntax tree.
     *
     * @param toScan the BrightScript code to convert into tokens
     * @param options options used to customize the scan process
     * @returns an object containing an array of `errors` and an array of `tokens` to be passed to a parser.
    */
    public scan(toScan: string): this {
        this.source = toScan;
        this.start = 0;
        this.current = 0;
        this.lineBegin = 0;
        this.lineEnd = 0;
        this.columnBegin = 0;
        this.columnEnd = 0;
        this.tokens = [];
        this.diagnostics = [];
        while (!this.isAtEnd()) {
            this.scanToken();
        }

        this.tokens.push({
            kind: TokenKind.Eof,
            isReserved: false,
            text: '',
            range: bsUtil.createRange(this.lineBegin, this.columnBegin, this.lineEnd, this.columnEnd + 1),
            leadingWhitespace: this.leadingWhitespace
        });
        this.leadingWhitespace = '';
        return this;
    }

    /**
     * Reads a non-deterministic number of characters from `source`, produces a `Token`, and adds it to
     * the `tokens` array.
     *
     * Accepts and returns nothing, because it's side-effect driven.
    */
    public scanToken(): void {
        this.advance();
        let c = this.source.charAt(this.current - 1);

        let tokenKind: TokenKind | undefined;
        let tokenFunction: (lexer?: Lexer) => void | undefined;

        // eslint-disable-next-line no-cond-assign
        if (tokenKind = Lexer.tokenKindMap[c as keyof typeof Lexer.tokenKindMap]) {
            this.addToken(tokenKind);
        // eslint-disable-next-line no-cond-assign
        } else if (tokenFunction = Lexer.tokenFunctionMap[c as keyof typeof Lexer.tokenFunctionMap]) {
            tokenFunction.call(this, undefined);
        } else {
            this.diagnostics.push({
                ...DiagnosticMessages.unexpectedCharacter(c),
                range: this.rangeOf()
            });
        }
    }

    /**
     * Determines whether or not the lexer as reached the end of its input.
     * @returns `true` if the lexer has read to (or past) the end of its input, otherwise `false`.
    */
    private isAtEnd() {
        return this.current >= this.source.length;
    }

    /**
     * Reads and returns the next character from `string` while **moving the current position forward**.
    */
    private advance(): void {
        this.current++;
        this.columnEnd++;
    }

    /**
     * Map for looking up token kinds based solely on a single character.
     * Should be used in conjunction with `tokenFunctionMap`
    */
    private static tokenKindMap = {
        '{': TokenKind.CurlyOpen,
        '}': TokenKind.CurlyClose,
        ':': TokenKind.Colon
    };

    /**
     * Map for looking up token functions based solely upon a single character
     * Should be used in conjunction with `tokenKindMap`
     */
    private static tokenFunctionMap = {
        '"': Lexer.prototype.string
    };

    /**
     * Creates a `Token` and adds it to the `tokens` array.
     * @param kind the type of token to produce.
    */
    private addToken(kind: TokenKind) {
        let text = this.source.slice(this.start, this.current);
        let token: Token = {
            kind: kind,
            text: text,
            // isReserved: ReservedWords.has(text.toLowerCase()),
            range: this.rangeOf(),
            leadingWhitespace: this.leadingWhitespace
        };
        this.leadingWhitespace = '';
        this.tokens.push(token);
        this.sync();
        return token;
    }

    /**
     * Move all location and char pointers to current position. Normally called after adding a token.
    */
    private sync() {
        this.start = this.current;
        this.lineBegin = this.lineEnd;
        this.columnBegin = this.columnEnd;
    }

    /**
     * Creates a `TokenLocation` at the lexer's current position for the provided `text`.
     * @returns the range of `text` as a `TokenLocation`
    */
    private rangeOf(): Range {
        return bsUtil.createRange(this.lineBegin, this.columnBegin, this.lineEnd, this.columnEnd);
    }

    /**
     * Returns the character at position `current` or a null character if we've reached the end of
     * input.
     *
     * @returns the current character if we haven't reached the end of input, otherwise a null
     *          character.
     */
    private peek() {
        if (this.isAtEnd()) {
            return '\0';
        }
        return this.source.charAt(this.current);
    }

    /**
     * Returns the character after position `current`, or a null character if we've reached the end of
     * input.
     *
     * @returns the character after the current one if we haven't reached the end of input, otherwise a
     *          null character.
     */
    private peekNext() {
        if (this.current + 1 > this.source.length) {
            return '\0';
        }
        return this.source.charAt(this.current + 1);
    }

    /**
     * Reads characters within a string literal, advancing through escaped characters to the
     * terminating `"`, and adds the produced token to the `tokens` array. Creates a `BrsError` if the
     * string is terminated by a newline or the end of input.
     */
    private string() {
        let isUnterminated = false;
        while (!this.isAtEnd()) {
            if (this.peek() === '"') {
                if (this.peekNext() === '"') {
                    // skip over two consecutive `"` characters to handle escaped `"` literals
                    this.advance();
                } else {
                    // otherwise the string has ended
                    break;
                }
            }

            if (this.peekNext() === '\n' || this.peekNext() === '\r') {
                // BrightScript doesn't support multi-line strings
                this.diagnostics.push({
                    ...DiagnosticMessages.unterminatedStringAtEndOfLine(),
                    range: this.rangeOf()
                });
                isUnterminated = true;
                break;
            }

            this.advance();
        }

        if (this.isAtEnd()) {
            // terminating a string with EOF is also not allowed
            this.diagnostics.push({
                ...DiagnosticMessages.unterminatedStringAtEndOfFile(),
                range: this.rangeOf()
            });
            isUnterminated = true;
        }

        // move past the closing `"`
        this.advance();

        let endIndex = isUnterminated ? this.current : this.current - 1;

        //get the string text (and trim the leading and trailing quote)
        let value = this.source.slice(this.start + 1, endIndex);

        //replace escaped quotemarks "" with a single quote
        value = value.replace(/""/g, '"');
        this.addToken(TokenKind.StringLiteral);
    }
}
