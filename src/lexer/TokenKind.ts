export enum TokenKind {
    // End of file
    Eof = 'Eof',
    // `<`
    Less = 'Less',
    // '>'
    Greater = 'Great',
    // `</`
    LessSlash = 'LessSlash',
    // The name of a tag or SG node.
    NodeName = 'NodeName',
    // />
    SlashGreater = 'SlashGreat',
    // Source code within <script> or in any data binding {expression}
    BrsCode = 'BrsCode',
    // {
    CurlyOpen = 'CurlyOpen',
    // }
    CurlyClose = 'CurlyClose',
    StringLiteral = 'StringLiteral',
    Equal = 'Equal',
    NodeAttribute = 'NodeAttribute'
}


