import type {
    Statement as BrsStatement
} from 'brighterscript';
import {
    BrsFile,
    Lexer as BrsLexer,
    Parser as BrsParser,
    Program as BrsProgram
} from 'brighterscript';
import { BrsTranspileState } from 'brighterscript/dist/parser/BrsTranspileState';

import { TokenType } from './TokenType';
import type { HaikuAst, HaikuNodeAst } from './Visitor';
import { HaikuVisitor } from './Visitor';

function brsStatementToString(statement: BrsStatement, brsTranspileState: BrsTranspileState) {
    const transpiled = statement.transpile(brsTranspileState);
    return transpiled.map(t => t.toString()).join('');
}

export class Generator {
    ast: HaikuAst;

    static generate(program: string): { xml: string; brs: string } {
        const ast = HaikuVisitor.programToAst(program);
        return new Generator().generate(ast);
    }

    generate(ast: HaikuAst): { xml: string; brs: string } {
        this.ast = ast;
        return {
            xml: this.generateXml(),
            brs: this.generateBrs()
        };
    }

    generateXml(): string {
        return '';
    }

    generateBrs(): string {
        let brs = '';

        const { statements: scriptStatements, callables: scriptCallables } = this.scriptStatements();

        const initStatements = [
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            ...scriptStatements,
            ...this.createAndMountStatements()
        ];

        if (initStatements.length > 0) {
            brs += this.callable('sub', 'init', initStatements);
        }

        if (scriptCallables && scriptCallables.length > 0) {
            brs += '\n' + scriptCallables.join('\n');
        }

        return brs;
    }

    private callable(type: 'sub' | 'function', name: string, statements: string[]): string {
        return `${type} ${name}()\n${statements.map(s => `\t${s}`).join('\n')}\nend ${type}`;
    }

    private createObject(node: HaikuNodeAst): string[] {
        const attributes = node.attributes.filter(a => a.value && !a.name.startsWith('on:'));
        const observableAttributes = node.attributes.filter(a => a.value && a.name.startsWith('on:'));
        const identifier = observableAttributes.length > 0 ? `m.${node.name.toLowerCase()}` : node.name.toLowerCase();

        const result = [
            `${identifier} = CreateObject("roSGNode", "${node.name}")`
        ];

        // Handle regular attributes
        for (const attribute of attributes) {
            if (attribute.value) {
                let value = '';
                if (attribute.value.type === TokenType.StringLiteral) {
                    value = attribute.value.image;
                } else if (attribute.value.type === TokenType.DataBinding) {
                    value = attribute.value.image.substring(1, attribute.value.image.length - 1);
                }

                result.push(`${identifier}.${attribute.name} = ${value}`);
            }
        }

        // Handle observable attributes
        for (const observable of observableAttributes) {
            result.push(`${identifier}.observeField("${observable.name.replace('on:', '')}", ${observable.value?.image})`);
        }

        return result;
    }

    private createAndMountStatements(): string[] {
        const initStatements: string[] = [];
        for (const node of this.ast.nodes) {
            initStatements.push(...this.createObject(node));
            initStatements.push(`m.top.appendChild(${node.name.toLowerCase()})`);
        }
        return initStatements;
    }

    private scriptStatements(): { statements: string[]; callables: string[] } {
        const { tokens: brsTokens } = BrsLexer.scan(this.ast.script);
        const brsParser = BrsParser.parse(brsTokens);
        const brsTranspileState = new BrsTranspileState(
            new BrsFile('', '', new BrsProgram({}))
        );

        const statements = brsParser.statements
            .filter(s => s.constructor.name !== 'FunctionStatement')
            .map((s) => brsStatementToString(s, brsTranspileState));
        const callables = brsParser.statements
            .filter(s => s.constructor.name === 'FunctionStatement')
            .map((s) => brsStatementToString(s, brsTranspileState));
        return { statements: statements, callables: callables };
    }
}
