import { expect } from 'chai';
import { Generator } from './Generator';
import * as chai from 'chai';
import * as chaiString from 'chai-string';
chai.use(chaiString);

describe('Generator tests', () => {
    it('handles empty program', () => {
        const input = '';
        const actual = Generator.generate(input, 'TestComponent');
        const expectedEmptyXml = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<component name=\"TestComponent\" extends=\"Group\">\n\t<script type=\"text/brightscript\" uri=\"TestComponent.brs\" />\n</component>';
        expect(actual).to.eql({ brs: '', xml: expectedEmptyXml });
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
\tbutton = CreateObject("roSGNode", "Button")
\tbutton.text = "press"
\tbutton.observeField("buttonSelected", "handleButton")
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

    describe('handles special attribute `:focus`', () => {
        it('without keeping node in component scope', () => {
            const input = `
            <Button
                text="press"
                :focus
            />
            <Label :focus="true" />`;
            const expected = `sub init()
\tbutton = CreateObject("roSGNode", "Button")
\tbutton.text = "press"
\tbutton.id = "__initial_focus__"
\tm.top.appendChild(button)
\tlabel = CreateObject("roSGNode", "Label")
\tm.top.appendChild(label)
end sub
sub __set_initial_focus__()
\tnode = m.top.findNode("__initial_focus__")
\tnode.id = invalid
\tnode.setFocus(true)
end sub`;

            const actual = Generator.generate(input);
            expect(actual.brs).to.equal(expected);
        });

        it('without keeping node in component scope, when node has id set', () => {
            const input = `
            <Button
                id="btn"
                text="press"
                :focus
            />
            <Label :focus="true" />`;
            const expected = `sub init()
\tbutton = CreateObject("roSGNode", "Button")
\tbutton.id = "btn"
\tbutton.text = "press"
\tm.top.appendChild(button)
\tlabel = CreateObject("roSGNode", "Label")
\tm.top.appendChild(label)
end sub
sub __set_initial_focus__()
\tm.top.findNode("btn").setFocus(true)
end sub`;

            const actual = Generator.generate(input);
            expect(actual.brs).to.equal(expected);
        });

        it('generates xml interface correctly', () => {
            const input = `
                <Button
                    text="press"
                    :focus
                />
            `;
            const expected = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<component name=\"HaikuComponent\" extends=\"Group\">
\t<interface>
\t\t<function name=\"__set_initial_focus__\" />
\t</interface>
\t<script type=\"text/brightscript\" uri=\"HaikuComponent.brs\" />
</component>`;

            const actual = Generator.generate(input);
            expect(actual.xml).to.equal(expected);
        });

        // TODO: this is will be supported when reactivity is implemented
        it.skip('when node is kept in scope', () => {
            const input = `
            <Button
                text="press"
                :focus
                on:buttonSelected="handleButton"
            />
            <Label :focus />`;
            const expected = `sub init()
\tm.button = CreateObject("roSGNode", "Button")
\tm.button.id = "btn"
\tm.button.text = "press"
\tm.button.setFocus(true)
\tm.top.appendChild(m.button)
\tlabel = CreateObject("roSGNode", "Label")
\tm.top.appendChild(label)
end sub
sub __set_initial_focus__()
\tm.button.setFocus(true)
end sub`;

            const actual = Generator.generate(input);
            expect(actual.brs).to.equal(expected);
        });
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
                button = "baz"
            </script>
            <Label text="hello"/>
            <Label text="world"/>
            <Button on:buttonSelected="magic"/>
        `;

        const expected = `sub init()
\tlabel = "foo"
\tlabel = "bar"
\tbutton = "baz"
\tlabel1 = CreateObject("roSGNode", "Label")
\tlabel1.text = "hello"
\tm.top.appendChild(label1)
\tlabel2 = CreateObject("roSGNode", "Label")
\tlabel2.text = "world"
\tm.top.appendChild(label2)
\tbutton1 = CreateObject("roSGNode", "Button")
\tbutton1.observeField("buttonSelected", "magic")
\tm.top.appendChild(button1)
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
        <Label text="Haiku has saved you {m.count} {m.count = 1 ? "line" : "lines"} of code" />
        `;

        const expected = `sub init()
\tlabel = CreateObject("roSGNode", "Label")
\tlabel.text = earthMessage
\tm.top.appendChild(label)
\tlabel1 = CreateObject("roSGNode", "Label")
\ttext = "Hello "
\ttext += bslib_toString(coolPlanet)
\ttext += " that is not "
\ttext += bslib_toString(world)
\tlabel1.text = text
\tm.top.appendChild(label1)
\tlabel2 = CreateObject("roSGNode", "Label")
\tlabel2.text = bslib_toString(coolPlanet)
\tm.top.appendChild(label2)
\tlabel3 = CreateObject("roSGNode", "Label")
\ttext1 = bslib_toString(coolPlanet)
\ttext1 += " "
\ttext1 += bslib_toString(world)
\ttext1 += " yeaa"
\tlabel3.text = text1
\tm.top.appendChild(label3)
\tlabel4 = CreateObject("roSGNode", "Label")
\ttext2 = bslib_toString(a)
\ttext2 += bslib_toString(b)
\ttext2 += bslib_toString(c)
\ttext2 += " letters"
\tlabel4.text = text2
\tm.top.appendChild(label4)
\tlabel5 = CreateObject("roSGNode", "Label")
\ttext3 = "escaped {curlys} will not be detected "
\ttext3 += bslib_toString(butThis)
\ttext3 += " will"
\tlabel5.text = text3
\tm.top.appendChild(label5)
\tlabel6 = CreateObject("roSGNode", "Label")
\ttext4 = "empty curlys are ignored "
\ttext4 += bslib_toString(butThis)
\ttext4 += " is not"
\tlabel6.text = text4
\tm.top.appendChild(label6)
\tlabel7 = CreateObject("roSGNode", "Label")
\ttext5 = "Haiku has saved you "
\ttext5 += bslib_toString(m.count)
\ttext5 += " "
\ttext5 += bslib_toString(bslib_ternary(m.count = 1, "line", "lines"))
\ttext5 += " of code"
\tlabel7.text = text5
\tm.top.appendChild(label7)
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
\tbutton = CreateObject("roSGNode", "Button")
\tbutton.observeField("buttonSelected", "__handle_button_buttonSelected")
\tm.top.appendChild(button)
\tbutton1 = CreateObject("roSGNode", "Button")
\tbutton1.observeField("buttonSelected", "__handle_button1_buttonSelected")
\tm.top.appendChild(button1)
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

describe.skip('reactiveness', () => {
    it('recognizes that a node should be in m scope', () => {
        const input = `
            <script>
                m.message = "hi"
                sub change()
                    m.message = "bye"
                end sub
            </script>
            <Label text={m.message} />
            <Label text="Haiku has saved you {m.count} {m.count = 1 ? "line" : "lines"} of code" />
        `;

        const expected = `sub init()
\tm.message = "hi"
\tm.label = CreateObject("roSGNode", "Label")
\tm.label.text = m.message
\tm.top.appendChild(label)
end sub`;

        const actual = Generator.generate(input);
        expect(actual.brs).to.startWith(expected);
    });
});
