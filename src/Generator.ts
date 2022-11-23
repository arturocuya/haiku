import type {
    AssignmentStatement as BrsAssignmentStatement,
    DottedSetStatement as BrsDottedSetStatement,
    FunctionStatement as BrsFunctionStatement,
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

enum GeneratedScope {
    File = 'File',
    Init = 'Init'
}

interface GeneratedScopeInfo {
    identifierCount: Record<string, number>;
}

interface GeneratorResult {
    statements: string[];
    callables: string[];
}

const ExpressionInStringLiteralPattern = /(?<!\\)\{[^}]+(?<!\\)\}/;
const ExpressionInStringLiteralPatternGlobal = /(?<!\\)\{([^}]+)(?<!\\)\}/g;

export class Generator {
    ast: HaikuAst;
    someNodeHasFocus: boolean;
    scopes: Record<string, GeneratedScopeInfo>;
    brsTranspileState: BrsTranspileState;
    publicFunctions: Set<string>;

    static generate(program: string, componentName = 'HaikuComponent'): { xml: string; brs: string } {
        const ast = HaikuVisitor.programToAst(program);
        return new Generator().generate(ast, componentName);
    }

    generate(ast: HaikuAst, componentName: string): { xml: string; brs: string } {
        this.ast = ast;
        this.someNodeHasFocus = false;
        this.scopes = {};
        this.brsTranspileState = new BrsTranspileState(
            new BrsFile('', '', new BrsProgram({}))
        );
        this.publicFunctions = new Set<string>();

        // brs must always be generated first
        const brs = this.generateBrs();
        const xml = this.generateXml(componentName);

        return { xml: xml, brs: brs };
    }

    generateXml(componentName: string): string {
        const publicFunctions = Array.from(this.publicFunctions);
        const _interface = publicFunctions.length > 0
            ? `\n\t<interface>\n${publicFunctions.map(f => `\t\t<function name="${f}" />`).join('\n')}\n\t</interface>`
            : '';

        return `<?xml version="1.0" encoding="UTF-8"?>
<component name="${componentName}" extends="Group">
\t<script type="text/brightscript" uri="${componentName}.brs"/>${_interface}\n</component>`;
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
        const {
            statements: scriptStatements,
            callables: scriptCallables
        } = this.scriptStatements();

        const {
            statements: cmStatements,
            callables: cmCallables
        } = this.createAndMountStatements();

        const initStatements = [
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            ...scriptStatements,
            ...cmStatements
        ];

        if (initStatements.length > 0) {
            brs += this.callable('sub', 'init', initStatements);
        }

        if (scriptCallables && scriptCallables.length > 0) {
            brs += '\n' + scriptCallables.join('\n');
        }

        if (cmCallables && cmCallables.length > 0) {
            brs += '\n' + cmCallables.join('\n');
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

    private handleStringLiteralAttribute(
        scope: GeneratedScope,
        identifier: string,
        attributeName: string,
        stringLiteralImage: string
    ): string[] {
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

    private createObject(node: HaikuNodeAst, parentIdentifier: string): GeneratorResult {
        const attributes = node.attributes.filter(
            a => a.value && !a.name.startsWith('on:') && !a.name.startsWith(':')
        );
        const observableAttributes = node.attributes.filter(a => a.value && a.name.startsWith('on:'));
        const specialAttributes = node.attributes.filter(a => !a.value);

        const identifier = this.getNextIdentifierInScope(GeneratedScope.Init, node.name.toLowerCase());

        const statements = [
            `${identifier} = CreateObject("roSGNode", "${node.name}")`
        ];

        const callables: string[] = [];

        let nodeIdImage: string | undefined;

        // Handle regular attributes
        for (const attribute of attributes) {
            if (attribute.value) {
                if (attribute.value.type === TokenType.StringLiteral) {
                    if (attribute.name === 'id') {
                        nodeIdImage = attribute.value.image;
                        statements.push(`${identifier}.${attribute.name} = ${attribute.value.image}`);
                    } else {
                        statements.push(...this.handleStringLiteralAttribute(GeneratedScope.Init, identifier, attribute.name, attribute.value.image));
                    }
                } else if (attribute.value.type === TokenType.DataBinding) {
                    const value = attribute.value.image.substring(1, attribute.value.image.length - 1);
                    statements.push(`${identifier}.${attribute.name} = ${value}`);
                }
            }
        }

        // Handle observable attributes
        for (const observable of observableAttributes) {
            const observedField = observable.name.replace('on:', '');
            if (observable.value) {
                if (observable.value.type === TokenType.StringLiteral) {
                    // For string literals, create observeField statements with image as-is
                    statements.push(`${identifier}.observeField("${observedField}", ${observable.value?.image})`);
                } else if (observable.value.type === TokenType.DataBinding) {
                    // For data bindings, we need to create a function to be inserted into the file,
                    // then use the function identifier as the observeField callback.

                    // Parse the data binding to get the inner statements
                    const source = observable.value.image
                        .substring(1, observable.value.image.length - 1);
                    const brsParseResult = this.brsParse(source);

                    // Create the callback identifier
                    const baseHandlerIdentifier = `__handle_${identifier.replace('m.', '')}_${observedField}`;
                    const handlerIdentifier = this.getNextIdentifierInScope(GeneratedScope.File, baseHandlerIdentifier);

                    const callableStatement = this.callable(
                        source.trim().startsWith('sub') ? 'sub' : 'function',
                        handlerIdentifier,
                        brsParseResult.rawStatements.map((s) => this.brsStatementToString(s))
                    );

                    statements.push(`${identifier}.observeField("${observedField}", "${handlerIdentifier}")`);
                    callables.push(callableStatement);
                }
            }
        }

        // Handle special attributes
        for (const sAttribute of specialAttributes) {
            if (sAttribute.name === ':focus' && !this.someNodeHasFocus) {
                const setFocusSubIdentifier = '__set_initial_focus__';
                if (identifier.startsWith('m.')) {
                    callables.push(this.callable('sub', setFocusSubIdentifier, [`${identifier}.setFocus(true)`]));
                } else if (nodeIdImage !== undefined) {
                    callables.push(this.callable('sub', setFocusSubIdentifier, [
                        `m.top.findNode(${nodeIdImage}).setFocus(true)`
                    ]));
                } else {
                    statements.push(`${identifier}.id = "__initial_focus__"`);
                    callables.push(this.callable('sub', setFocusSubIdentifier, [
                        'node = m.top.findNode("__initial_focus__")',
                        'node.id = invalid',
                        'node.setFocus(true)'
                    ]));
                }
                this.publicFunctions.add(setFocusSubIdentifier);
                this.someNodeHasFocus = true;
            }
        }

        // Handle children
        for (const child of node.children) {
            const { statements: childStatements, callables: childCallables } = this.createObject(child, identifier);
            statements.push(...childStatements);
            callables.push(...childCallables);
        }

        // Mount the node
        statements.push(`${parentIdentifier}.appendChild(${identifier})`);

        return { statements: statements, callables: callables };
    }

    private createAndMountStatements(): GeneratorResult {
        const statements: string[] = [];
        const callables: string[] = [];

        for (const node of this.ast.nodes) {
            const {
                statements: objStatements,
                callables: objCallables
            } = this.createObject(node, 'm.top');

            statements.push(...objStatements);
            callables.push(...objCallables);
        }
        return { statements: statements, callables: callables };
    }

    private scriptStatements(): GeneratorResult {
        const brsParseResult = this.brsParse(this.ast.script);

        for (const identifier of brsParseResult.statementIdentifiers) {
            this.addIndentifierToScope(GeneratedScope.Init, identifier);
        }

        for (const identifier of brsParseResult.callableIdentifiers) {
            this.addIndentifierToScope(GeneratedScope.Init, identifier);
        }

        return {
            statements: brsParseResult.statements,
            callables: brsParseResult.callables
        };
    }

    private brsStatementToString(statement: BrsStatement) {
        const transpiled = statement.transpile(this.brsTranspileState);
        return transpiled.map(t => t.toString()).join('');
    }

    private brsParse(source: string):
    GeneratorResult & { statementIdentifiers: Set<string>; callableIdentifiers: Set<string>; rawStatements: BrsStatement[] } {
        const statementIdentifiers = new Set<string>();
        const callableIdentifiers = new Set<string>();

        const { tokens: brsTokens } = BrsLexer.scan(source);
        const brsParser = BrsParser.parse(brsTokens);

        const statements = brsParser.statements
            .filter(s => s.constructor.name !== 'FunctionStatement')
            .map((s) => {
                if (s.constructor.name === 'AssignmentStatement') {
                    statementIdentifiers.add((s as BrsAssignmentStatement).name.text);
                } else if (s.constructor.name === 'DottedSetStatement') {
                    let fullIdentifier = (s as BrsDottedSetStatement).name.text;
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
                        statementIdentifiers.add(`m.${fullIdentifier.split('.')[1]!}`);
                    }
                }
                return this.brsStatementToString(s);
            });

        const callables = brsParser.statements
            .filter(s => s.constructor.name === 'FunctionStatement')
            .map((s): string => {
                callableIdentifiers.add((s as BrsFunctionStatement).name.text);
                return this.brsStatementToString(s);
            });

        return {
            statements: statements,
            callables: callables,
            statementIdentifiers: statementIdentifiers,
            callableIdentifiers: callableIdentifiers,
            rawStatements: brsParser.statements
        };
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
