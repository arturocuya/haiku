import { HaikuParser } from './Parser';
import { HaikuLexer } from './Lexer';
import { expect } from 'chai';
import { HaikuVisitor } from './Visitor';
import { TokenType } from './TokenType';

function assertVisitor(input: string, expectedAst: any) {
    const tokens = HaikuLexer.tokenize(input).tokens;
    HaikuParser.input = tokens;
    const cst = HaikuParser.ProgramStatement();
    expect(HaikuParser.errors).to.be.empty;
    const visitor = new HaikuVisitor();
    const ast = visitor.visit(cst);
    expect(ast).to.eql(expectedAst);
}

describe('Visitor tests', () => {
    it('parses empty program', () => {
        assertVisitor('', { script: '', nodes: [] });
    });

    it('parses program with script', () => {
        assertVisitor('<script>print "hello world"</script>', {
            script: 'print "hello world"',
            nodes: []
        });
    });

    it('parses node without attributes', () => {
        // With explicit closing tag
        assertVisitor('<Group></Group>', {
            script: '',
            nodes: [{ name: 'Group', children: [], attributes: [] }]
        });
        // With self closing tag
        assertVisitor('<Label/>', {
            script: '',
            nodes: [{ name: 'Label', children: [], attributes: [] }]
        });
    });

    it('parses node with attributes', () => {
        // String literal
        assertVisitor('<Label text="hello" />', {
            script: '',
            nodes: [{
                name: 'Label',
                children: [],
                attributes: [{ name: 'text', value: { type: TokenType.StringLiteral, image: '"hello"' } }]
            }]
        });
        // Data binding
        assertVisitor('<Label text={m.greet} />', {
            script: '',
            nodes: [{
                name: 'Label',
                children: [],
                attributes: [{ name: 'text', value: { type: TokenType.DataBinding, image: '{m.greet}' } }]
            }]
        });
        // Implicit attribute values
        assertVisitor('<Button :focus />', {
            script: '',
            nodes: [{
                name: 'Button',
                children: [],
                attributes: [{ name: ':focus', value: undefined }]
            }]
        });
        // Multiple attributes
        assertVisitor('<Label text="hello" :focus translation={m.translation} />', {
            script: '',
            nodes: [{
                name: 'Label',
                children: [],
                attributes: [
                    { name: 'text', value: { type: TokenType.StringLiteral, image: '"hello"' } },
                    { name: ':focus', value: undefined },
                    { name: 'translation', value: { type: TokenType.DataBinding, image: '{m.translation}' } }
                ]
            }]
        });
    });

    it('parses nodes with children', () => {
        assertVisitor('<Group><Label text="hello" /></Group>', {
            script: '',
            nodes: [{
                name: 'Group',
                attributes: [],
                children: [{
                    name: 'Label',
                    children: [],
                    attributes: [{ name: 'text', value: { type: TokenType.StringLiteral, image: '"hello"' } }]
                }]
            }]
        });
    });
});
