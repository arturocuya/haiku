import { CstParser } from 'chevrotain';
import { Tokens } from './Lexer';
import { ParserRule as Rule } from './ParserRule';
import { TokenType } from './TokenType';

export class HaikuParserCst extends CstParser {
    constructor() {
        super(Object.values(Tokens));
        this.performSelfAnalysis();
    }

    ProgramStatement = this.RULE(Rule.ProgramStatement, () => {
        this.OPTION(() => {
            this.SUBRULE(this.ScriptStatement);
        });
        this.MANY(() => {
            this.SUBRULE(this.NodeStatement);
        });
    });

    NodeStatement = this.RULE(Rule.NodeStatement, () => {
        this.CONSUME(Tokens[TokenType.Less]);
        this.CONSUME1(Tokens[TokenType.NodeName]);
        this.MANY1(() => {
            this.SUBRULE(this.NodeAttributeStatement);
        });
        this.OR([
            { ALT: () => this.CONSUME(Tokens[TokenType.SlashGreater]) },
            {
                ALT: () => {
                    this.CONSUME1(Tokens[TokenType.Greater]);
                    this.MANY2(() => {
                        this.SUBRULE(this.NodeStatement);
                    });
                    this.CONSUME(Tokens[TokenType.LessSlash]);
                    this.CONSUME2(Tokens[TokenType.NodeName]);
                    this.CONSUME2(Tokens[TokenType.Greater]);
                }
            }
        ]);
    });

    ScriptStatement = this.RULE(Rule.ScriptStatement, () => {
        this.CONSUME(Tokens[TokenType.Script]);
    });

    NodeAttributeStatement = this.RULE(Rule.NodeAttributeStatement, () => {
        this.CONSUME(Tokens[TokenType.NodeAttribute]);
        this.OPTION(() => {
            this.CONSUME(Tokens[TokenType.Equal]);
            this.OR([
                { ALT: () => this.CONSUME(Tokens[TokenType.StringLiteral]) },
                { ALT: () => this.CONSUME(Tokens[TokenType.DataBinding]) }
            ]);
        });
    });
}

const HaikuParser = new HaikuParserCst();
export { HaikuParser };
