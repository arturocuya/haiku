import { expect } from 'chai';
import { Generator } from './Generator';

describe('Generator tests', () => {
    it('handles empty program', () => {
        const input = '';
        const actual = Generator.generate(input);
        expect(actual).to.eql({ xml: '', brs: '' });
    });

    it('creates and mounts nodes', () => {
        const input = '<Label text="hello"/>';
        let expected = `sub init()
\tlabel = CreateObject("roSGNode", "Label")
\tlabel.text = "hello"
\tm.top.appendChild(label)
end sub`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });

    it('creates and mounts nodes with data binding', () => {
        const input = '<Label text={m.greet}/>';
        const expected = `sub init()
\tlabel = CreateObject("roSGNode", "Label")
\tlabel.text = m.greet
\tm.top.appendChild(label)
end sub`;
        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });

    // todo: need to start using brighterscript parser to identify callables in the script
    it.skip('inserts all the script non-callable statements as-is', () => {
        const input = `
        <script>
            x = 1
            sub foo()
                ? "foo"
            end sub
        </script>
        <Button />
        `;

        const expected = `sub init()
\t x = 1
\t button = CreateObject("roSGNode", "Button")
\t m.top.appendChild(button)
end sub
sub foo()
\t ? "foo"
end sub`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });

    it('handles observers for attributes with `on:` prefix', () => {
        const input = `<Button
            text="press"
            on:buttonSelected="handleButton"
        />`;
        const expected = `sub init()
\tm.button = CreateObject("roSGNode", "Button")
\tm.button.text = "press"
\tm.button.observeField("buttonSelected", "handleButton")
\tm.top.appendChild(button)
end sub`;
        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });
});
