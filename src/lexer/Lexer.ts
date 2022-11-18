/* eslint-disable camelcase */
import { createToken, Lexer } from 'chevrotain';
import { TokenType } from './TokenType';

enum LexerMode {
    Node = 'Node',
    NodeOpen = 'NodeOpen',
    NodeAttributes = 'NodeAttributes',
    NodeClose = 'NodeClose',
    DataBinding = 'DataBinding'
}

// Ignored tokens
const Whitespace = createToken({
    name: TokenType.Whitespace,
    pattern: /\s+/,
    group: Lexer.SKIPPED
});

// Regular tokens
const Equal = createToken({
    name: TokenType.Equal,
    pattern: /\=/
});

const NodeAttribute = createToken({
    name: TokenType.NodeAttribute,
    pattern: /[a-zA-Z_]*:?[a-zA-Z0-9_]+/
});

const StringLiteral = createToken({
    name: TokenType.StringLiteral,
    pattern: /"[^"]*"/
});

const DataBinding = createToken({
    name: TokenType.DataBinding,
    pattern: /\{[^}]*\}/
});

const Script = createToken({
    name: TokenType.Script,
    pattern: /<script>[\s\S]*?<\/script>/
});

// Tokens that enter a new mode
const Less = createToken({
    name: TokenType.Less,
    pattern: /</,
    push_mode: LexerMode.NodeOpen
});

const LessSlash = createToken({
    name: TokenType.LessSlash,
    pattern: /<\//,
    push_mode: LexerMode.NodeClose
});

const NodeName = createToken({
    name: TokenType.NodeName,
    pattern: /[A-Za-z_][A-Za-z0-9-_.]*/,
    push_mode: LexerMode.NodeAttributes
});

const Greater = createToken({
    name: TokenType.Greater,
    pattern: />/,
    push_mode: LexerMode.Node
});

const SlashGreater = createToken({
    name: TokenType.SlashGreater,
    pattern: /\/>/,
    push_mode: LexerMode.Node
});

export const HaikuLexer = new Lexer({
    modes: {
        [LexerMode.Node]: [
            Script,
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

