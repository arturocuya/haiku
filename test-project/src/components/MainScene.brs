sub init()
    ' bs:disable-next-line
    app = CreateObject("roSGNode", "App")
    m.top.appendChild(app)
    app.callFunc("__set_initial_focus__")
end sub
