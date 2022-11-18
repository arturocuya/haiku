import { expect } from 'chai';
import { HaikuLexer } from './Lexer';
import { TokenType } from './TokenType';

function assertTokens (input: string, expectedTokens: TokenType[]) {
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
            TokenType.Less,
            TokenType.NodeName,
            TokenType.Greater,
            TokenType.LessSlash,
            TokenType.NodeName,
            TokenType.Greater,
            TokenType.Less,
            TokenType.NodeName,
            TokenType.SlashGreater
        ];
        assertTokens(input, expectedTokens);
    });

    it('scans nested nodes', () => {
        const input = '<Group><Child/></Group>';
        const expectedTokens = [
            TokenType.Less,
            TokenType.NodeName,
            TokenType.Greater,
            TokenType.Less,
            TokenType.NodeName,
            TokenType.SlashGreater,
            TokenType.LessSlash,
            TokenType.NodeName,
            TokenType.Greater
        ];
        assertTokens(input, expectedTokens);
    });

    it('ignores whitespace and newlines', () => {
        const input = '\n  <Group>\t\t\t\n\n<Child/> \n \t  </Group> \t \t\n \t\t';
        const expectedTokens = [
            TokenType.Less,
            TokenType.NodeName,
            TokenType.Greater,
            TokenType.Less,
            TokenType.NodeName,
            TokenType.SlashGreater,
            TokenType.LessSlash,
            TokenType.NodeName,
            TokenType.Greater
        ];
        assertTokens(input, expectedTokens);
    });

    it('scans attributes', () => {
        const input = '<Label text="hello" :focus on:visible="handleVisible" translation="[10,10]"/>';
        const expectedTokens = [
            TokenType.Less,
            TokenType.NodeName,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.StringLiteral,
            TokenType.NodeAttribute,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.StringLiteral,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.StringLiteral,
            TokenType.SlashGreater
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
            TokenType.Less,
            TokenType.NodeName,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.DataBinding,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.DataBinding,
            TokenType.SlashGreater
        ];
        const result = assertTokens(input, expectedTokens);
        expect(result.tokens[4]?.image).to.equal('{m.text}');
        expect(result.tokens[7]?.image).to.equal(`{${handlerFunctionImage}}`);
    });

    it('scans the script tag', () => {
        assertTokens('<script></script>', [TokenType.Script]);
    });

    it('scans the contents of the <script> tag', () => {
        const scriptContentsImage = '\n\tmessage = "Hello from the console"\n\tprint message\n';
        const input = `<script>${scriptContentsImage}</script>\n<Label text="Hello from the screen" />`;
        const expectedTokens = [
            TokenType.Script,
            TokenType.Less,
            TokenType.NodeName,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.StringLiteral,
            TokenType.SlashGreater
        ];
        const result = assertTokens(input, expectedTokens);
        expect(result.tokens[0]?.image).to.equal(`<script>${scriptContentsImage}</script>`);
    });

    it('ignores comments', () => {
        const scriptImage = `
            ' this comment should not be ignored because it's part of the script
            ? "hello world"
        `;
        const input = `
        ' this is a comment
        ' comment ' inside a comment
        '''''''''''''''''' aaaaaaaaa
        <Label text="hello"/> ' inline comment
        ' another comment
        ' <Label text="non"/> ' this node should not be lexed
        <script>${scriptImage}</script>
        <Label
            text="hello"
            ' the following attribute should not be included
            ' visible="false"
            :focus
        />
        `;

        const expectedTokens = [
            TokenType.Less,
            TokenType.NodeName,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.StringLiteral,
            TokenType.SlashGreater,
            TokenType.Script,
            TokenType.Less,
            TokenType.NodeName,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.StringLiteral,
            TokenType.NodeAttribute,
            TokenType.SlashGreater
        ];
        const result = assertTokens(input, expectedTokens);
        expect(result.tokens[6]?.image).to.equal(`<script>${scriptImage}</script>`);
    });

    it('scans example from readme', () => {
        const input = `'App.haiku
        <script>
            m.haiku = [
                "The west wind whispered",
                "And touched the eyelids of spring:",
                "Her eyes, Primroses."
            ]
            m.index = 0
        </script>
        <Button
            :focus="true"
            text={m.haiku[m.index]}
            on:buttonSelected={sub ()
                m.index = m.index < m.haiku.count() - 1 ? m.index + 1 : 0
            end sub}
        />`;
        const expectedTokens = [
            TokenType.Script,
            TokenType.Less,
            TokenType.NodeName,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.StringLiteral,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.DataBinding,
            TokenType.NodeAttribute,
            TokenType.Equal,
            TokenType.DataBinding,
            TokenType.SlashGreater
        ];
        assertTokens(input, expectedTokens);
    });
});
