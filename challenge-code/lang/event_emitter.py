from collections import defaultdict
from typing import Any, Callable

Listener = Callable[..., Any]


class EventEmitter:
    def __init__(self) -> None:
        self._listeners: defaultdict[str, list[tuple[Listener, bool]]] = defaultdict(list)

    def on(self, event: str, fn: Listener) -> Callable[[], None]:
        self._listeners[event].append((fn, False))
        return lambda: self.off(event, fn)

    def once(self, event: str, fn: Listener) -> Callable[[], None]:
        self._listeners[event].append((fn, True))
        return lambda: self.off(event, fn)

    def off(self, event: str, fn: Listener) -> None:
        listeners = self._listeners.get(event, [])
        for i, (f, _) in enumerate(listeners):
            if f is fn:
                del listeners[i]
                break
        if not listeners:
            self._listeners.pop(event, None)

    def emit(self, event: str, *args: Any, **kwargs: Any) -> bool:
        listeners = list(self._listeners.get(event, []))  # copy: listeners may unsubscribe mid-emit
        for fn, once in listeners:
            if once:
                self.off(event, fn)
            fn(*args, **kwargs)
        return bool(listeners)

    # decorator form: @emitter.listen("ready")
    def listen(self, event: str) -> Callable[[Listener], Listener]:
        def register(fn: Listener) -> Listener:
            self.on(event, fn)
            return fn

        return register
