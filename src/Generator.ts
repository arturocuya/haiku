import { TokenType } from './TokenType';
import type { HaikuAst, HaikuNodeAst } from './Visitor';
import { HaikuVisitor } from './Visitor';

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

        const initStatements = this.initStatements();
        if (initStatements.length > 0) {
            brs += this.callable('sub', 'init', this.initStatements());
        }

        return brs;
    }

    private callable(type: 'sub' | 'function', name: string, statements: string[]): string {
        return `${type} ${name}()\n${statements.map(s => `\t${s}`).join('\n')}\nend ${type}`;
    }

    private createObject(node: HaikuNodeAst): string[] {
        const identifier = node.name.toLowerCase();
        const attributes = node.attributes.filter(
            a => a.value.image !== undefined
        );

        const result = [
            `${identifier} = CreateObject("roSGNode", "${node.name}")`
        ];

        for (const attribute of attributes) {
            const attributeValue = attribute.value.type === TokenType.StringLiteral ? attribute.value.image : attribute.value.image?.substring(1, attribute.value.image.length - 1);

            result.push(`${identifier}.${attribute.name} = ${attributeValue}`);
        }

        return result;
    }

    private initStatements(): string[] {
        const initStatements: string[] = [];
        for (const node of this.ast.nodes) {
            initStatements.push(...this.createObject(node));
            initStatements.push(`m.top.appendChild(${node.name.toLowerCase()})`);
        }
        return initStatements;
    }
}
