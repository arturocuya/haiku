import { expect } from 'chai';
import { HaikuLexer } from './Lexer';
import { TokenKind } from './TokenKind';

function assertTokens (input: string, expectedTokens: TokenKind[]) {
    const result = HaikuLexer.tokenize(input);
    expect(result.errors).to.be.empty;
    const actualTokens = result.tokens.map((token) => token.tokenType.name);
    expect(actualTokens).to.deep.equal(expectedTokens);
    return result;
}

describe('Lexer tests', () => {
    it('scans nodes', () => {
        const input = '<Group></Group><Group/>';
        const expectedTokens = [
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.LessSlash,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.SlashGreater
        ];
        assertTokens(input, expectedTokens);
    });

    it('scans nested nodes', () => {
        const input = '<Group><Child/></Group>';
        const expectedTokens = [
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.SlashGreater,
            TokenKind.LessSlash,
            TokenKind.NodeName,
            TokenKind.Greater
        ];
        assertTokens(input, expectedTokens);
    });

    it('ignores whitespace and newlines', () => {
        const input = '\n  <Group>\t\t\t\n\n<Child/> \n \t  </Group> \t \t\n \t\t';
        const expectedTokens = [
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.Greater,
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.SlashGreater,
            TokenKind.LessSlash,
            TokenKind.NodeName,
            TokenKind.Greater
        ];
        assertTokens(input, expectedTokens);
    });

    it('scans attributes', () => {
        const input = '<Label text="hello" :focus on:visible="handleVisible" translation="[10,10]"/>';
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
            TokenKind.SlashGreater
        ];
        const result = assertTokens(input, expectedTokens);
        expect(result.tokens[2]?.image).to.equal('text');
        expect(result.tokens[4]?.image).to.equal('"hello"');
        expect(result.tokens[5]?.image).to.equal(':focus');
        expect(result.tokens[6]?.image).to.equal('on:visible');
    });

    it('scans data bindings', () => {
        const handlerFunctionImage = `sub ()\n\t? "now visible"\nend sub`;
        const input = `<Label text={m.text} on:visible={${handlerFunctionImage}}/>`;
        const expectedTokens = [
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.NodeAttribute,
            TokenKind.Equal,
            TokenKind.DataBinding,
            TokenKind.NodeAttribute,
            TokenKind.Equal,
            TokenKind.DataBinding,
            TokenKind.SlashGreater
        ];
        const result = assertTokens(input, expectedTokens);
        expect(result.tokens[4]?.image).to.equal('{m.text}');
        expect(result.tokens[7]?.image).to.equal(`{${handlerFunctionImage}}`);
    });

    it('scans the script tag', () => {
        assertTokens('<script></script>', [TokenKind.Script]);
    });

    it('scans the contents of the <script> tag', () => {
        const scriptContentsImage = '\n\tmessage = "Hello from the console"\n\tprint message\n';
        const input = `<script>${scriptContentsImage}</script>\n<Label text="Hello from the screen" />`;
        const expectedTokens = [
            TokenKind.Script,
            TokenKind.Less,
            TokenKind.NodeName,
            TokenKind.NodeAttribute,
            TokenKind.Equal,
            TokenKind.StringLiteral,
            TokenKind.SlashGreater
        ];
        const result = assertTokens(input, expectedTokens);
        expect(result.tokens[0]?.image).to.equal(`<script>${scriptContentsImage}</script>`);
    });
});
