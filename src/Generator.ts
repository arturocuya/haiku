import type { AssignmentStatement as BrsAssignmentStatement,
    AstNode,
    Body,
    DottedSetStatement as BrsDottedSetStatement,
    DottedSetStatement,
    Expression as BrsExpression,
    Statement as BrsStatement } from 'brighterscript';
import type { FunctionStatement as BrsFunctionStatement } from 'brighterscript';
import brsUtil from 'brighterscript/dist/util';
import {
    BrsFile,
    Lexer as BrsLexer,
    Parser as BrsParser,
    Program as BrsProgram,
    WalkMode,
    createVisitor
} from 'brighterscript';
import { BrsTranspileState } from 'brighterscript/dist/parser/BrsTranspileState';

import { TokenType } from './TokenType';
import type { HaikuAst, HaikuNodeAst } from './Visitor';
import { HaikuVisitor } from './Visitor';
import { SourceNode } from 'source-map';

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

interface DGNode {
    identifier: string;
    shouldBeScoped: boolean;
    attributes: DGAttribute[];
}

interface DGAttribute {
    name: string;
    setStatements: string[];
    scopedVariableNames: Set<string>;
}


export class Generator {
    ast: HaikuAst;
    someNodeHasFocus: boolean;
    scopes: Record<string, GeneratedScopeInfo>;
    brsTranspileState: BrsTranspileState;
    publicFunctions: Set<string>;
    imports: Set<string>;
    dependencyGraphs: DGNode[];

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
        this.imports = new Set<string>();
        this.dependencyGraphs = [];

        this.imports.add(`${componentName}.brs`);

        // brs must always be generated first
        const brs = this.generateBrs();
        const xml = this.generateXml(componentName);

        const reactiveBrs = this.makeBrsReactive(brs);

        return { xml: xml, brs: reactiveBrs };
    }

    generateXml(componentName: string): string {
        const publicFunctions = Array.from(this.publicFunctions);
        const _interface = publicFunctions.length > 0
            ? `\n\t<interface>\n${publicFunctions.map(f => `\t\t<function name="${f}" />`).join('\n')}\n\t</interface>`
            : '';

        const imports = Array.from(this.imports);
        const scripts = imports.length > 0
            ? imports.map(i => `\t<script type="text/brightscript" uri="${i}" />`).join('\n')
            : '';

        return `<?xml version="1.0" encoding="UTF-8"?>
<component name="${componentName}" extends="Group">${_interface}\n${scripts}\n</component>`;
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
    ): { statements: string[]; rawExpressions: BrsExpression[] } {
        const statements: string[] = [];
        const rawExpressions: BrsExpression[] = [];
        const expressionMatches = Array.from(
            stringLiteralImage.matchAll(ExpressionInStringLiteralPatternGlobal)
        );
        if (expressionMatches.length > 0) {
            // Remove `"` from the start and end of the string
            const trimmedImage = stringLiteralImage.substring(1, stringLiteralImage.length - 1);
            const literals = trimmedImage
                .split(ExpressionInStringLiteralPattern).map(l => `"${l}"`)
                .map(this.cleanCurlysFromStringLiteral);

            const expressions = expressionMatches
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                .map(m => m[0]!)
                .map(e => e.substring(1, e.length - 1))
                .map(e => {
                    // To parse expressions, let's pretend they are assignments (as they will be)
                    // and then extract the right hand side of the assignment
                    const fakeAssignmentStatement = `x = ${e}`;
                    const parsedFakeAssignmentValue = (this.brsParse(fakeAssignmentStatement).rawStatements[0] as BrsAssignmentStatement)?.value;

                    rawExpressions.push(parsedFakeAssignmentValue);

                    this.imports.add('pkg:/source/bslib.brs');

                    if (parsedFakeAssignmentValue) {
                        return `bslib_toString(${this.brsStatementToString(parsedFakeAssignmentValue)})`;
                    }

                    return `bslib_toString(${e})`;
                });

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
        return { statements: statements, rawExpressions: rawExpressions };
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

        const dgNode: DGNode = {
            identifier: identifier,
            attributes: [],
            shouldBeScoped: false
        };

        const callables: string[] = [];

        let nodeIdImage: string | undefined;

        // Handle regular attributes
        for (const attribute of attributes) {
            const dgAttribute: DGAttribute = {
                name: attribute.name,
                setStatements: [],
                scopedVariableNames: new Set<string>()
            };

            if (attribute.value) {
                if (attribute.value.type === TokenType.StringLiteral) {
                    if (attribute.name === 'id') {
                        nodeIdImage = attribute.value.image;
                        const setStatement = `${identifier}.${attribute.name} = ${attribute.value.image}`;
                        dgAttribute.setStatements.push(setStatement);
                        statements.push(setStatement);
                    } else {
                        const {
                            statements: stringLiteralStatements,
                            rawExpressions
                        } = this.handleStringLiteralAttribute(
                            GeneratedScope.Init, identifier, attribute.name, attribute.value.image
                        );

                        // get all expressions from the string literal
                        // and walk them to check for m.variables
                        for (const expression of rawExpressions) {
                            expression.walk(createVisitor({
                                DottedGetExpression: (expression) => {
                                    const name = expression.name.text;
                                    const dottedGetParts = brsUtil.getAllDottedGetParts(expression);
                                    if (dottedGetParts?.[0]?.text === 'm') {
                                        dgAttribute.scopedVariableNames.add(name);
                                    }
                                }
                            }), { walkMode: WalkMode.visitExpressionsRecursive });
                        }

                        dgAttribute.setStatements.push(...stringLiteralStatements);
                        statements.push(...stringLiteralStatements);
                    }
                } else if (attribute.value.type === TokenType.DataBinding) {
                    const value = attribute.value.image.substring(1, attribute.value.image.length - 1);
                    const statement = `${identifier}.${attribute.name} = ${value}`;
                    const transpiledStatement = this.brsParse(statement).rawStatements[0] as DottedSetStatement;

                    transpiledStatement.walk(createVisitor({
                        DottedGetExpression: (expression) => {
                            const name = expression.name.text;
                            const dottedGetParts = brsUtil.getAllDottedGetParts(expression);
                            if (dottedGetParts?.[0]?.text === 'm') {
                                dgAttribute.scopedVariableNames.add(name);
                            }
                        }
                    }), { walkMode: WalkMode.visitExpressionsRecursive });

                    const setStatement = transpiledStatement ? this.brsStatementToString(transpiledStatement) : statement;
                    dgAttribute.setStatements.push(setStatement);
                    statements.push(setStatement);
                }
            }
            dgNode.attributes.push(dgAttribute);
        }

        this.dependencyGraphs.push(dgNode);

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

        if (brsParseResult.ast.transpile(this.brsTranspileState).map(s => s.toString()).join('\n').includes('bslib_')) {
            this.imports.add('pkg:/source/bslib.brs');
        }

        return {
            statements: brsParseResult.statements,
            callables: brsParseResult.callables
        };
    }

    private brsStatementToString(statement: BrsStatement | BrsExpression) {
        const transpiled = statement.transpile(this.brsTranspileState);
        return transpiled.map(t => t.toString()).join('');
    }

    private brsParse(source: string):
    GeneratorResult & { statementIdentifiers: Set<string>; callableIdentifiers: Set<string>; rawStatements: BrsStatement[]; ast: AstNode } {
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
            rawStatements: brsParser.statements,
            ast: brsParser.ast
        };
    }

    private makeBrsReactive(brs: string): string {
        // Get the list of unique scoped variables bounded to a node
        let boundScopedVariables = this.dependencyGraphs.map(dg => {
            return dg.attributes
                .map(a => Array.from(a.scopedVariableNames))
                .flat();
        }).flat();
        boundScopedVariables = Array.from(new Set(boundScopedVariables));

        const reactiveBoundScopedVariables: string[] = [];

        // Get all the parsed functions in the .brs except the init function
        const brsParseResult = this.brsParse(brs);

        const ast = brsParseResult.ast;
        let needsDirty = false;

        ast.walk(createVisitor({
            // @ts-expect-error aaa
            DottedSetStatement: (statement: BrsDottedSetStatement, parent, a, index) => {
                let parentStatement = parent;
                while (parentStatement) {
                    if (parentStatement.name?.text === 'init') {
                        return;
                    }
                    parentStatement = parentStatement.parent;
                }

                const identifier = statement.name.text;
                if (boundScopedVariables.includes(identifier)) {
                    needsDirty = true;
                    reactiveBoundScopedVariables.push(identifier);

                    if (parent.constructor.name === 'Block') {
                        const newStatements = (this.brsParse(`m.__dirty__["${identifier}"] = true\n__update__()`).ast as Body).statements;
                        parent.statements.splice(index + 1, 0, ...newStatements);
                    } else {
                        throw `Not function expression, instead ${parent.constructor.name}`;
                    }

                }
            }
        }), { walkMode: WalkMode.visitAllRecursive });

        if (needsDirty) {
            ast.walk(createVisitor({
                FunctionStatement: (statement: BrsFunctionStatement, parent, a, b) => {
                    if (statement.name.text === 'init') {
                        const newStatements = (this.brsParse(`m.__dirty__ = {}`).ast as Body).statements;
                        statement.func.body.statements.unshift(...newStatements);
                    }
                }
            }), { walkMode: WalkMode.visitStatements });
        }

        if (reactiveBoundScopedVariables.length === 0) {
            return brs;
        }

        // In the dependency graph, mark nodes as scoped if their bounded
        // variables are reactive. Otherwise, remove the variables.
        // This will prepare the dependecy graph so that it can be used to build
        // the __update__ callable.
        for (const dg of this.dependencyGraphs) {
            for (const attribute of dg.attributes) {
                for (const scopedVariableName of attribute.scopedVariableNames) {
                    if (reactiveBoundScopedVariables.includes(scopedVariableName)) {
                        dg.shouldBeScoped = true;
                    } else {
                        attribute.scopedVariableNames.delete(scopedVariableName);
                    }
                }
            }
        }

        const scopedVariables = this.dependencyGraphs.filter(dg => dg.shouldBeScoped).map(dg => dg.identifier);

        const walkFunction = (statement: any) => {
            if (scopedVariables.includes(statement.name.text)) {
                statement.name.text = `m.${statement.name.text}`;
            }
            return statement;
        };

        ast.walk(createVisitor({
            AssignmentStatement: walkFunction,
            VariableExpression: walkFunction
        }), { walkMode: WalkMode.visitAllRecursive });

        const recursiveStringify = (obj: string | SourceNode | Array<string|SourceNode>): string => {
            if (Array.isArray(obj)) {
                return obj.map(recursiveStringify).join('');
            }

            return obj.toString();
        }

        const reactiveBrs = ast.transpile(this.brsTranspileState).map(recursiveStringify).join('').replaceAll('    ', '\t');

        // Add the __update__ callable to the .brs file
        const variableUpdateStatements: Record<string, string[]> = {};
        const updateStatements = [];

        for (const dg of this.dependencyGraphs.filter(dg => dg.shouldBeScoped)) {
            for (const attribute of dg.attributes) {
                for (const scopedVariableName of attribute.scopedVariableNames) {
                    if (variableUpdateStatements[scopedVariableName] === undefined) {
                        variableUpdateStatements[scopedVariableName] = attribute.setStatements;
                    } else {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        variableUpdateStatements[scopedVariableName] = variableUpdateStatements[scopedVariableName]!.concat(attribute.setStatements);
                    }
                }
            }
        }

        for (const [scopedVariableName, statements] of Object.entries(variableUpdateStatements)) {
            updateStatements.push(`if m.__dirty__["${scopedVariableName}"] <> invalid`);
            updateStatements.push(...statements.map(s => {
                let statementText = `\t${s.trim()}`;
                for (const variable of scopedVariables) {
                    if (statementText.includes(variable)) {
                        statementText = statementText.replaceAll(variable, `m.${variable}`);
                    }
                }
                return statementText;
            }));
            updateStatements.push(`\tm.__dirty__.Delete("${scopedVariableName}")`);
            updateStatements.push('end if');
        }

        const updateCallable = this.callable('sub', '__update__', updateStatements);

        return `${reactiveBrs}${updateStatements.length > 0 ? `\n\n${updateCallable}` : ''}`;
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
