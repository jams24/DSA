import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Key-value store with nested BEGIN / ROLLBACK / COMMIT, using one undo log per open transaction. */
class KvStore {
    private final Map<String, String> data = new HashMap<>();
    private final Map<String, Integer> counts = new HashMap<>();
    // Each log maps key -> value before the transaction first wrote it (Optional.empty() = absent).
    private final Deque<Map<String, Optional<String>>> undo = new ArrayDeque<>();

    private void write(String key, String value, boolean log) {
        if (log && !undo.isEmpty()) undo.peek().putIfAbsent(key, Optional.ofNullable(data.get(key)));
        String old = value == null ? data.remove(key) : data.put(key, value);
        if (old != null) counts.merge(old, -1, Integer::sum);
        if (value != null) counts.merge(value, 1, Integer::sum);
    }

    void set(String key, String value) {
        write(key, value, true);
    }

    String get(String key) {
        return data.get(key);
    }

    boolean delete(String key) {
        if (!data.containsKey(key)) return false;
        write(key, null, true);
        return true;
    }

    int count(String value) {
        return counts.getOrDefault(value, 0);
    }

    void begin() {
        undo.push(new HashMap<>());
    }

    boolean rollback() {
        if (undo.isEmpty()) return false;
        undo.pop().forEach((key, before) -> write(key, before.orElse(null), false));
        return true;
    }

    boolean commit() {
        if (undo.isEmpty()) return false;
        undo.clear();
        return true;
    }
}
