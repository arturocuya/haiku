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
    someNodeHasFocus: boolean;

    static generate(program: string): { xml: string; brs: string } {
        const ast = HaikuVisitor.programToAst(program);
        return new Generator().generate(ast);
    }

    generate(ast: HaikuAst): { xml: string; brs: string } {
        this.ast = ast;
        this.someNodeHasFocus = false;
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

    private createObject(node: HaikuNodeAst, parentIdentifier: string): string[] {
        const attributes = node.attributes.filter(
            a => a.value && !a.name.startsWith('on:') && !a.name.startsWith(':')
        );
        const observableAttributes = node.attributes.filter(a => a.value && a.name.startsWith('on:'));
        const specialAttributes = node.attributes.filter(a => !a.value);

        const identifier = observableAttributes.length > 0 ? `m.${node.name.toLowerCase()}` : node.name.toLowerCase();

        const statements = [
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
                statements.push(`${identifier}.${attribute.name} = ${value}`);
            }
        }

        // Handle observable attributes
        for (const observable of observableAttributes) {
            statements.push(`${identifier}.observeField("${observable.name.replace('on:', '')}", ${observable.value?.image})`);
        }

        // Handle special attributes
        for (const sAttribute of specialAttributes) {
            if (sAttribute.name === ':focus' && !this.someNodeHasFocus) {
                statements.push(`${identifier}.setFocus(true)`);
                this.someNodeHasFocus = true;
            }
        }

        // Handle children
        for (const child of node.children) {
            statements.push(...this.createObject(child, identifier));
        }

        // Mount the node
        statements.push(`${parentIdentifier}.appendChild(${identifier})`);

        return statements;
    }

    private createAndMountStatements(): string[] {
        const initStatements: string[] = [];
        for (const node of this.ast.nodes) {
            initStatements.push(...this.createObject(node, 'm.top'));
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
