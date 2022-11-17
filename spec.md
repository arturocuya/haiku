# Haiku compiler technical specification (draft)

Let's consider the minimal example

```
<Label text="Hello world" />
```

Things I need to do:

- Read each character
- Identify that a node is starting with the "<" character.
- Read the name of the node until we get to a whitespace, tab or a newline.
- Identify everything ahead as attributes.
    - Read the name of the attribute until we get to a "=" character.
    - Read the contents of the value, starting and ending with quotes or curly braces.
- Identify the end of the node tag opening with a ">" or the end of the node with a "/>"
