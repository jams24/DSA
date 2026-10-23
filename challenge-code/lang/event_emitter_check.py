from solution import EventEmitter

e = EventEmitter()
log = []
unsub = e.on("msg", lambda x: log.append(f"a{x}"))
e.once("msg", lambda x: log.append(f"once{x}"))


@e.listen("msg")
def handler(x):
    log.append(f"h{x}")


assert e.emit("msg", 1)
assert log == ["a1", "once1", "h1"]
e.emit("msg", 2)
assert log[3:] == ["a2", "h2"]
unsub()
e.off("msg", handler)
assert e.emit("msg", 3) is False
print("ok")
