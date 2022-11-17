export enum TokenKind {
    // End of file
    Eof = 'Eof',
    // `<`
    Less = 'Less',
    // '>'
    Great = 'Great',
    // `</`
    LessSlash = 'LessSlash',
    // The name of a tag or SG node.
    NodeName = 'NodeName',
    // />
    SlashGreat = 'SlashGreat',
    // Source code within <script> or in any data binding {expression}
    BrsCode = 'BrsCode',
    // {
    CurlyOpen = 'CurlyOpen',
    // }
    CurlyClose = 'CurlyClose',
    // :
    Colon = 'Colon',
    StringLiteral = 'StringLiteral'
}


