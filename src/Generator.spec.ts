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

    it('inserts all the script non-callable statements as-is', () => {
        const input = `
        <script>
            x = foo(1,2)
            m.y = 2
            print "hello"
            m.foo = sub()
                print "foo"
            end sub
        </script>
        <Button />
        `;

        const expected = `sub init()
\tx = foo(1, 2)
\tm.y = 2
\tprint "hello"
\tm.foo = sub()
    print "foo"
end sub
\tbutton = CreateObject("roSGNode", "Button")
\tm.top.appendChild(button)
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

    it('inserts all script callables after init()', () => {
        const input = `
        <script>
            print "hello"
            sub foo()
                print "foo"
            end sub
            function bar(x)
                print x
            end function
        </script>
        <Button />
        `;

        const expected = `sub init()
\tprint "hello"
\tbutton = CreateObject("roSGNode", "Button")
\tm.top.appendChild(button)
end sub
sub foo()
    print "foo"
end sub
function bar(x)
    print x
end function`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });
});
