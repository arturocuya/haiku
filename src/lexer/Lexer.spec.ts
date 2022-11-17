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
});
