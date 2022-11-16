# Haiku

> The shortest form of **code** poetry.

Haiku is a compiler for Roku applications that allows you do more with less code.

Spend time coding your intentions, not boilerplate 😌.

```
' App.haiku
<script>
    m.haiku = [
        "The west wind whispered",
        "And touched the eyelids of spring:",
        "Her eyes, Primroses."
    ]
    m.index = 0
</script>
<Button
    :focus="true"
    text={m.haiku[m.index]}
    on:buttonSelected={sub ()
        m.index = m.index < m.haiku.count() - 1 ? m.index + 1 : 0
    end sub}
/>
```

## Getting started

### Using the `create-roku-app` module

```bash
npx create-roku-app --name "My new app" --template haiku
```

### Manual install

(TODO)

## Usage

A Haiku component is conformed by several functions to create, mount, update and dispose the component.

For example, for this minimal code:

```xml
' App.haiku
<Label text="Hello world" />
```

This is the generated component:

```brs
' App.brs
sub init()
    ' Create and mount
    label = CreateObject("roSGNode", "Label")
    label.text = "Hello world"
    m.top.appendChild(label)
end sub
```

```xml
<!-- App.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<component name="App" extends="HaikuComponent">
    <script type="text/brightscript" uri="App.brs"/>
</component>
```

Here you can see some important features of the Haiku compiler:

- SceneGraph components can be declared at the "root" level of the file.

- Comments can be inserted directly with the `'` token.

- The output files are meant to be completely readable.

- All SceneGraph node creation happens on the generated `.brs` file.

- The `Label` node is not reactive, so the `label` variable created to mount it is defined at the scope of the `init()` function instead of being bound to the `m` context.

## The `<script>` tag

We can include BrightScript for our component inside the `<script>` tag. This includes variable definitions, functions and code logic.

```
<script>
    message = "Hello from the console"
    print message
</script>
<Label text="Hello from the screen" />
```

<details>
<summary>See compiler output</summary>

```brs
' App.brs
sub init()
    message = "Hello from the console"
    print message
    label = CreateObject("roSGNode", "Label")
    label.text = "Hello world"
    m.top.appendChild(label)
end sub
```
</details>

---

## Data binding

Using the `<script>` tag you can define variables that can be referenced on your SceneGraph components using curly brackets, even inside quotes:

```
<script>
    earthMessage = "Hello Earth"
    coolPlanet = "Scadrial"
</script>
<Label text={earthMessage} />
<Label text="Hello {coolPlanet}" />
```

<details>
<summary>See compiler output</summary>

```brs
' App.brs
sub init()
    ' Create and mount
    earthMessage = "Hello Earth"
    coolPlanet = "Scadrial"
    label = CreateObject("roSGNode", "Label")
    label.text = earthMessage
    label1 = CreateObject("roSGNode", "Label")
    t0 = "Hello "
    t0 += coolPlanet
    label1.text = t0
    m.top.appendChild(label)
    m.top.appendChild(label1)
end sub
```
</details>

---

## Reactiveness

Let's implement the "Hello world" of reactive applications: A button that updates and shows a counter.

```
<script>
    count = 0
    sub increment()
        count += 1
    end sub
</script>
<Button
    :focus="true"
    text="Haiku has saved you {count} {count === 1 ? "line" : "lines"} of code"
    on:buttonSelected="increment"
/>
```

- When a node has the special `:focus` attribute set to true, the application will set its focus onto it after the parent component is mounted.

- When an attribute starts with the `on:` directive, the compiler will create an observer for that attribute and will set the provided function as the observer handler.

<details>
<summary>See compiler output <b>(Spoiler: Haiku saves you 15 lines (~55%) of boilerplate 🚀)</b></summary>

```brs
sub init()
    m.dirty = {}
    m.count = 0
    m.button = CreateObject("roSGNode", "Button")
    m.button.observeField("buttonSelected", "increment")
    m.top.appendChild(m.button)
    m.button.setFocus(true)
end sub
sub u()
    if (m.dirty.count <> invalid)
        t0 = "Haiku has saved you"
        t0 += stringify(m.count)
        if (m.count = 1)
            t0 += "line"
        else
            t0 += "lines"
        end if
        t0 += " of code"
        m.button.text = t0
        m.dirty.Delete("count")
    end if
end sub
sub increment()
    m.count += 1
    m.dirty.count = true
    u()
end sub
```
</details>

---

You can also set the handler function in-line:

```
<script>
    count = 0
</script>
<Button
    :focus="true"
    text="Haiku has saved you {count} {count = 1 ? "line" : "lines"} of code"
    on:buttonSelected={sub ()
        count += 1
    end sub}
/>
```

## Using BrighterScript

[BrighterScript](https://github.com/rokucommunity/brighterscript#readme) is a superset language that provides new features and syntax enhancement to Roku's BrightScript. Haiku supports BrighterScript by default inside the `<script>` tag and on the data binding statements.

> This can be seen on the previous example with the ternary conditional operator.

We highly recommend using the BrighterScript language. However, if you don't plan on using it you can optimize your build times by applying the following configuration:

1. On a per component basis, you can specify that you will be using vanilla BrightScript on your script like so:

```xml
<script lang="brs">
</script>
```

2. Globally, you can add these configurations to `bsconfig.json`:

```json
{
    "haiku": {
        "scriptLang": "brs",
        "bindingsLang": "brs"
    }
}
```