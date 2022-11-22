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
            m.cool = "beans"
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
\tm.cool = "beans"
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
\tm.top.appendChild(m.button)
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

    it('handles special node attributes', () => {
        const input = `
        <Button
            text="press"
            :focus
        />
        <Label :focus="true" />`;
        const expected = `sub init()
\tbutton = CreateObject("roSGNode", "Button")
\tbutton.text = "press"
\tbutton.setFocus(true)
\tm.top.appendChild(button)
\tlabel = CreateObject("roSGNode", "Label")
\tm.top.appendChild(label)
end sub`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });

    it('handles nested node children', () => {
        const input = `
        <Label text="hello"/>
        <Group>
            <Poster src="pkg:/images/greet.png"/>
        </Group>
        `;

        const expected = `sub init()
\tlabel = CreateObject("roSGNode", "Label")
\tlabel.text = "hello"
\tm.top.appendChild(label)
\tgroup = CreateObject("roSGNode", "Group")
\tposter = CreateObject("roSGNode", "Poster")
\tposter.src = "pkg:/images/greet.png"
\tgroup.appendChild(poster)
\tm.top.appendChild(group)
end sub`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });

    it('prevents collisions between node name indentifiers', () => {
        const input = `
        <Label text="hello"/>
        <Label text="world"/>
        <Group>
            <Label text="lvl1"/>
            <Group>
                <Label text="lvl2"/>
            </Group>
        </Group>
        `;

        const expected = `sub init()
\tlabel = CreateObject("roSGNode", "Label")
\tlabel.text = "hello"
\tm.top.appendChild(label)
\tlabel1 = CreateObject("roSGNode", "Label")
\tlabel1.text = "world"
\tm.top.appendChild(label1)
\tgroup = CreateObject("roSGNode", "Group")
\tlabel2 = CreateObject("roSGNode", "Label")
\tlabel2.text = "lvl1"
\tgroup.appendChild(label2)
\tgroup1 = CreateObject("roSGNode", "Group")
\tlabel3 = CreateObject("roSGNode", "Label")
\tlabel3.text = "lvl2"
\tgroup1.appendChild(label3)
\tgroup.appendChild(group1)
\tm.top.appendChild(group)
end sub`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });

    it('prevents collisions between node names and identifiers from script', () => {
        const input = `
            <script>
                label = "foo"
                label = "bar"
                m.button = "baz"
            </script>
            <Label text="hello"/>
            <Label text="world"/>
            <Button on:buttonSelected="magic"/>
        `;

        const expected = `sub init()
\tlabel = "foo"
\tlabel = "bar"
\tm.button = "baz"
\tlabel1 = CreateObject("roSGNode", "Label")
\tlabel1.text = "hello"
\tm.top.appendChild(label1)
\tlabel2 = CreateObject("roSGNode", "Label")
\tlabel2.text = "world"
\tm.top.appendChild(label2)
\tm.button1 = CreateObject("roSGNode", "Button")
\tm.button1.observeField("buttonSelected", "magic")
\tm.top.appendChild(m.button1)
end sub`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });

    it('handles expressions inside string literal attribute values', () => {
        const input = `
        <Label text={earthMessage} />
        <Label text="Hello {coolPlanet} that is not {world}" />
        <Label text="{coolPlanet}" />
        <Label text="{coolPlanet} {world} yeaa" />
        <Label text="{a}{b}{c} letters" />
        <Label text="escaped \\{curlys\\} will not be detected {butThis} will" />
        <Label text="empty curlys {}are ignored{}{}{} {butThis} is not" />
        `;

        const expected = `sub init()
\tlabel = CreateObject("roSGNode", "Label")
\tlabel.text = earthMessage
\tm.top.appendChild(label)
\tlabel1 = CreateObject("roSGNode", "Label")
\ttext = "Hello "
\ttext += coolPlanet
\ttext += " that is not "
\ttext += world
\tlabel1.text = text
\tm.top.appendChild(label1)
\tlabel2 = CreateObject("roSGNode", "Label")
\tlabel2.text = coolPlanet
\tm.top.appendChild(label2)
\tlabel3 = CreateObject("roSGNode", "Label")
\ttext1 = coolPlanet
\ttext1 += " "
\ttext1 += world
\ttext1 += " yeaa"
\tlabel3.text = text1
\tm.top.appendChild(label3)
\tlabel4 = CreateObject("roSGNode", "Label")
\ttext2 = a
\ttext2 += b
\ttext2 += c
\ttext2 += " letters"
\tlabel4.text = text2
\tm.top.appendChild(label4)
\tlabel5 = CreateObject("roSGNode", "Label")
\ttext3 = "escaped {curlys} will not be detected "
\ttext3 += butThis
\ttext3 += " will"
\tlabel5.text = text3
\tm.top.appendChild(label5)
\tlabel6 = CreateObject("roSGNode", "Label")
\ttext4 = "empty curlys are ignored "
\ttext4 += butThis
\ttext4 += " is not"
\tlabel6.text = text4
\tm.top.appendChild(label6)
end sub`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });

    it('handles inline callables on observable attributes', () => {
        const input = `
            <Button on:buttonSelected={sub ()
                count += 1
            end sub} />
            <Button on:buttonSelected={function ()
                chill = "out"
            end function} />
        `;

        const expected = `sub init()
\tm.button = CreateObject("roSGNode", "Button")
\tm.button.observeField("buttonSelected", "__handle_button_buttonSelected")
\tm.top.appendChild(m.button)
\tm.button1 = CreateObject("roSGNode", "Button")
\tm.button1.observeField("buttonSelected", "__handle_button1_buttonSelected")
\tm.top.appendChild(m.button1)
end sub
sub __handle_button_buttonSelected()
\tcount += 1
end sub
function __handle_button1_buttonSelected()
\tchill = "out"
end function`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.equal(expected);
    });
});
