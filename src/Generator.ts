import type {
    AssignmentStatement as BrsAssignmentStatement,
    DottedSetStatement,
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

enum GeneratedScope {
    File = 'File',
    Init = 'Init'
}

interface GeneratedScopeInfo {
    identifierCount: Record<string, number>;
}

const ExpressionInStringLiteralPattern = /(?<!\\)\{[^}]+(?<!\\)\}/;
const ExpressionInStringLiteralPatternGlobal = /(?<!\\)\{([^}]+)(?<!\\)\}/g;

export class Generator {
    ast: HaikuAst;
    someNodeHasFocus: boolean;
    scopes: Record<string, GeneratedScopeInfo>;

    static generate(program: string): { xml: string; brs: string } {
        const ast = HaikuVisitor.programToAst(program);
        return new Generator().generate(ast);
    }

    generate(ast: HaikuAst): { xml: string; brs: string } {
        this.ast = ast;
        this.someNodeHasFocus = false;
        this.scopes = {};
        return {
            xml: this.generateXml(),
            brs: this.generateBrs()
        };
    }

    generateXml(): string {
        return '';
    }

    private addScope(scope: string) {
        this.scopes[scope] = { identifierCount: {} };
    }

    private addIndentifierToScope(scope: GeneratedScope, identifier: string): number {
        if (!this.scopes[scope]) {
            this.addScope(scope);
        }
        if (!this.scopes[scope]?.identifierCount.hasOwnProperty(identifier)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.scopes[scope]!.identifierCount[identifier] = 1;
            return 1;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.scopes[scope]!.identifierCount[identifier] += 1;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return this.scopes[scope]!.identifierCount[identifier]!;
        }
    }

    private getNextIdentifierInScope(scope: GeneratedScope, identifier: string): string {
        const identifierCount = this.addIndentifierToScope(scope, identifier);
        return identifierCount > 1 ? `${identifier}${identifierCount - 1}` : identifier;
    }

    generateBrs(): string {
        let brs = '';

        // The script statements should always be processed before the nodes
        // to ensure there are no name collisions between script variables
        // and node identifiers
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

    private cleanCurlysFromStringLiteral(str: string): string {
        return str.replaceAll('\\{', '{')
            .replaceAll('\\}', '}')
            .replaceAll('{}', '');
    }

    private handleStringLiteralAttribute(scope: GeneratedScope, identifier: string, attributeName: string, stringLiteralImage: string): string[] {
        const statements: string[] = [];
        const expressionMatches = Array.from(stringLiteralImage.matchAll(ExpressionInStringLiteralPatternGlobal));
        if (expressionMatches.length > 0) {
            // Remove `"` from the start and end of the string
            const trimmedImage = stringLiteralImage.substring(1, stringLiteralImage.length - 1);
            const literals = trimmedImage
                .split(ExpressionInStringLiteralPattern).map(l => `"${l}"`)
                .map(this.cleanCurlysFromStringLiteral);

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const expressions = expressionMatches.map(m => m[0]!).map(e => e.substring(1, e.length - 1));
            const assignments = alternateArrayValues(literals, expressions).filter(a => a !== '' && a !== '""');

            if (assignments.length > 1) {
                const attributeIdentifier = this.getNextIdentifierInScope(scope, attributeName);
                let assigned = false;
                for (const assignment of assignments) {
                    statements.push(`${attributeIdentifier} ${assigned ? '+=' : '='} ${assignment}`);
                    assigned = true;
                }
                statements.push(`${identifier}.${attributeName} = ${attributeIdentifier}`);
            } else {
                statements.push(`${identifier}.${attributeName} = ${assignments[0]}`);
            }
        } else {
            statements.push(
                `${identifier}.${attributeName} = ${this.cleanCurlysFromStringLiteral(stringLiteralImage)}`
            );
        }
        return statements;
    }

    private createObject(node: HaikuNodeAst, parentIdentifier: string): string[] {
        const attributes = node.attributes.filter(
            a => a.value && !a.name.startsWith('on:') && !a.name.startsWith(':')
        );
        const observableAttributes = node.attributes.filter(a => a.value && a.name.startsWith('on:'));
        const specialAttributes = node.attributes.filter(a => !a.value);

        const baseIdentifier = observableAttributes.length > 0 ? `m.${node.name.toLowerCase()}` : node.name.toLowerCase();

        const identifier = this.getNextIdentifierInScope(GeneratedScope.Init, baseIdentifier);

        const statements = [
            `${identifier} = CreateObject("roSGNode", "${node.name}")`
        ];

        // Handle regular attributes
        for (const attribute of attributes) {
            if (attribute.value) {
                let value = '';
                if (attribute.value.type === TokenType.StringLiteral) {
                    statements.push(...this.handleStringLiteralAttribute(GeneratedScope.Init, identifier, attribute.name, attribute.value.image));
                } else if (attribute.value.type === TokenType.DataBinding) {
                    value = attribute.value.image.substring(1, attribute.value.image.length - 1);
                    statements.push(`${identifier}.${attribute.name} = ${value}`);
                }
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

        const scriptIdentifiers = new Set<string>();

        const statements = brsParser.statements
            .filter(s => s.constructor.name !== 'FunctionStatement')
            .map((s) => {
                if (s.constructor.name === 'AssignmentStatement') {
                    scriptIdentifiers.add((s as BrsAssignmentStatement).name.text);
                } else if (s.constructor.name === 'DottedSetStatement') {
                    let fullIdentifier = (s as DottedSetStatement).name.text;
                    let statement: any = s;

                    // Climb the dotted set statement
                    while (statement.obj.constructor.name === 'DottedSetStatement') {
                        fullIdentifier = `${statement.object.text}.${fullIdentifier}`;
                        statement = statement.obj;
                    }
                    if (statement.obj.constructor.name === 'VariableExpression') {
                        fullIdentifier = `${statement.obj.name.text}.${fullIdentifier}`;
                    }

                    // Only add the beginning of the identifier (m.something).
                    // Longer identifiers (m.something.else) may appear when the base
                    // identifier (m.something) is in the parent component.
                    if (fullIdentifier.startsWith('m.') && !fullIdentifier.startsWith('m.top.')) {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        scriptIdentifiers.add(`m.${fullIdentifier.split('.')[1]!}`);
                    }
                }
                return brsStatementToString(s, brsTranspileState);
            });

        for (const identifier of scriptIdentifiers) {
            this.addIndentifierToScope(GeneratedScope.Init, identifier);
        }

        const callables = brsParser.statements
            .filter(s => s.constructor.name === 'FunctionStatement')
            .map((s) => brsStatementToString(s, brsTranspileState));
        return { statements: statements, callables: callables };
    }
}

// Helper method
function alternateArrayValues(arr1: string[], arr2: string[]): string[] {
    const result: string[] = [];
    for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
        if (arr1[i]) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            result.push(arr1[i]!);
        }
        if (arr2[i]) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            result.push(arr2[i]!);
        }
    }
    return result;
}
