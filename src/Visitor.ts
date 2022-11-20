import { HaikuLexer } from './Lexer';
import { HaikuParser } from './Parser';
import { TokenType } from './TokenType';

const BaseVisitor = HaikuParser.getBaseCstVisitorConstructorWithDefaults();

export class HaikuVisitor extends BaseVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }

    public static programToAst(program: string) {
        const tokens = HaikuLexer.tokenize(program).tokens;
        HaikuParser.input = tokens;
        const cst = HaikuParser.ProgramStatement();
        const visitor = new HaikuVisitor();
        return visitor.visit(cst);
    }

    ProgramStatement(ctx: any) {
        return {
            script: ctx.ScriptStatement?.[0].children.Script[0].image.replace(/<script>|<\/script>/g, '') ?? '',
            nodes: ctx.NodeStatement?.map((node: any) => this.visit(node)) ?? []
        };
    }

    NodeStatement(ctx: any) {
        return {
            name: ctx[TokenType.NodeName][0].image,
            attributes: ctx.NodeAttributeStatement?.map((attribute: any) => this.visit(attribute)) ?? [],
            children: ctx.NodeStatement?.map((node: any) => this.visit(node)) ?? []
        };
    }

    NodeAttributeStatement(ctx: any) {
        let type: TokenType.DataBinding | TokenType.StringLiteral | 'none' = 'none';
        let image: string | undefined;

        if (ctx[TokenType.DataBinding]?.[0]) {
            type = TokenType.DataBinding;
            image = ctx[TokenType.DataBinding][0].image;
        } else if (ctx[TokenType.StringLiteral]?.[0]) {
            type = TokenType.StringLiteral;
            image = ctx[TokenType.StringLiteral][0].image;
        }

        return {
            name: ctx[TokenType.NodeAttribute][0].image,
            value: { type: type, image: image }
        };
    }
}

export interface HaikuNodeAst {
    name: string;
    attributes: {
        name: string;
        value: {
            type: TokenType.DataBinding | TokenType.StringLiteral | 'none';
            image: string | undefined;
        };
    }[];
    children: HaikuNodeAst[];
}

export interface HaikuAst {
    script: string;
    nodes: HaikuNodeAst[];
}
