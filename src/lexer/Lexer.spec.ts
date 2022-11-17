import { expect } from 'chai';
import { Lexer } from './Lexer';
import { TokenKind } from './TokenKind';

describe('Lexer tests', () => {
    it('scans string literals', () => {
        let { tokens } = Lexer.scan('"hello"');
        expect(tokens.map(t => t.kind)).to.eql([
            TokenKind.StringLiteral,
            TokenKind.Eof
        ]);
    });

    it('scans curly brackets', () => {
        let { tokens } = Lexer.scan('{}');
        expect(tokens.map(t => t.kind)).to.eql([
            TokenKind.CurlyOpen,
            TokenKind.CurlyClose,
            TokenKind.Eof
        ]);
    });

    it('scans nodes', () => {
        let { tokens } = Lexer.scan('<Group></Group><Group/>');
        expect(tokens.map(t => t.kind)).to.eql([
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.LessSlash,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.SlashGreater,
            TokenKind.Eof
        ]);
    });

    it('scans nested nodes', () => {
        let { tokens } = Lexer.scan('<Group><Child/></Group>');
        expect(tokens.map(t => t.kind)).to.eql([
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.SlashGreater,
            TokenKind.LessSlash,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.Eof
        ]);
    });

    it('ignores whitespace and newlines', () => {
        let { tokens } = Lexer.scan('\n  <Group>\t\t\t\n\n<Child/> \n \t  </Group> \t \t\n \t\t');
        expect(tokens.map(t => t.kind)).to.eql([
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.SlashGreater,
            TokenKind.LessSlash,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.Eof
        ]);
    });

    it('scans attributes', () => {
        const expectedTokens = [
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.NodeAttribute,
            TokenKind.Equal,
            TokenKind.StringLiteral,
            TokenKind.NodeAttribute,
            TokenKind.NodeAttribute,
            TokenKind.Equal,
            TokenKind.StringLiteral,
            TokenKind.NodeAttribute,
            TokenKind.Equal,
            TokenKind.StringLiteral,
            TokenKind.SlashGreater,
            TokenKind.Eof
        ];

        // TODO: make `:focus` work and expect 0 diagnostics

        let lexer = Lexer.scan('<Label text="hello" :focus on:visible="handleVisible" translation="[10,10]"/>');
        expect(lexer.tokens.map(t => t.kind)).to.eql(expectedTokens);
        // expect(lexer.diagnostics).to.be.empty;

        lexer = Lexer.scan('<Label\n\ttext="hello"\n\t:focus\n\ton:visible="handleVisible"\n\ttranslation="[10,10]"\n/>');
        expect(lexer.tokens.map(t => t.kind)).to.eql(expectedTokens);
        // expect(lexer.diagnostics).to.be.empty;
    });
});
