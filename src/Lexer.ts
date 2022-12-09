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
    pattern: /[\s\t]+/,
    group: Lexer.SKIPPED
});

const Comment = createToken({
    name: TokenType.Comment,
    pattern: /'[^\n\r]+?(?:\*\)|[\n\r])/,
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
    pattern: /"([^"{]*(?:{[^{}]*}[^"{]*)*)"/
});

export const DataBindingPattern = /\{[^}]+\}/;
const DataBinding = createToken({
    name: TokenType.DataBinding,
    pattern: DataBindingPattern
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

export const Tokens = {
    [TokenType.Whitespace]: Whitespace,
    [TokenType.Comment]: Comment,
    [TokenType.Equal]: Equal,
    [TokenType.NodeAttribute]: NodeAttribute,
    [TokenType.StringLiteral]: StringLiteral,
    [TokenType.DataBinding]: DataBinding,
    [TokenType.Script]: Script,
    [TokenType.Less]: Less,
    [TokenType.LessSlash]: LessSlash,
    [TokenType.NodeName]: NodeName,
    [TokenType.Greater]: Greater,
    [TokenType.SlashGreater]: SlashGreater
};

export const HaikuLexer = new Lexer({
    modes: {
        [LexerMode.Node]: [
            Comment,
            Script,
            // Enters NodeClose mode
            LessSlash,
            // Enters NodeOpen mode
            Less,
            Whitespace
        ],
        [LexerMode.NodeOpen]: [
            Comment,
            // Returns to Node mode
            SlashGreater, Greater,
            // Enters NodeAttributes mode
            NodeName,
            Whitespace,
            Comment
        ],
        [LexerMode.NodeAttributes]: [
            Comment,
            // Jumps to Node mode
            SlashGreater, Greater,
            StringLiteral,
            DataBinding,
            NodeAttribute,
            Equal,
            Whitespace,
            Comment
        ],
        [LexerMode.NodeClose]: [
            Comment,
            // Returns to Node mode
            Greater,
            NodeName,
            Whitespace,
            Comment
        ]
    },
    defaultMode: LexerMode.Node
});
