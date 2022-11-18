/* eslint-disable camelcase */
import { createToken, Lexer } from 'chevrotain';
import { TokenKind } from './TokenKind';

enum LexerMode {
    Node = 'Node',
    NodeOpen = 'NodeOpen',
    NodeAttributes = 'NodeAttributes',
    NodeClose = 'NodeClose',
    DataBinding = 'DataBinding'
}

// Ignored tokens
const Whitespace = createToken({
    name: TokenKind.Whitespace,
    pattern: /\s+/,
    group: Lexer.SKIPPED
});

// Regular tokens
const Equal = createToken({
    name: TokenKind.Equal,
    pattern: /\=/
});

const NodeAttribute = createToken({
    name: TokenKind.NodeAttribute,
    pattern: /[a-zA-Z_]*:?[a-zA-Z0-9_]+/
});

const StringLiteral = createToken({
    name: TokenKind.StringLiteral,
    pattern: /"[^"]*"/
});

const DataBinding = createToken({
    name: TokenKind.DataBinding,
    pattern: /\{[^}]*\}/
});

// Tokens that enter a new mode
const Less = createToken({
    name: TokenKind.Less,
    pattern: /</,
    push_mode: LexerMode.NodeOpen
});

const LessSlash = createToken({
    name: TokenKind.LessSlash,
    pattern: /<\//,
    push_mode: LexerMode.NodeClose
});

const NodeName = createToken({
    name: TokenKind.NodeName,
    pattern: /[A-Za-z_][A-Za-z0-9-_.]*/,
    push_mode: LexerMode.NodeAttributes
});

const Greater = createToken({
    name: TokenKind.Greater,
    pattern: />/,
    push_mode: LexerMode.Node
});

const SlashGreater = createToken({
    name: TokenKind.SlashGreater,
    pattern: /\/>/,
    push_mode: LexerMode.Node
});

export const HaikuLexer = new Lexer({
    modes: {
        [LexerMode.Node]: [
            // Enters NodeClose mode
            LessSlash,
            // Enters NodeOpen mode
            Less,
            Whitespace
        ],
        [LexerMode.NodeOpen]: [
            // Returns to Node mode
            SlashGreater, Greater,
            // Enters NodeAttributes mode
            NodeName,
            Whitespace
        ],
        [LexerMode.NodeAttributes]: [
            // Jumps to Node mode
            SlashGreater, Greater,
            StringLiteral,
            DataBinding,
            NodeAttribute,
            Equal,
            Whitespace
        ],
        [LexerMode.NodeClose]: [
            // Returns to Node mode
            Greater,
            NodeName,
            Whitespace
        ]
    },
    defaultMode: LexerMode.Node
});

