import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.LongSupplier;

/**
 * LinkedHashMap in access order keeps entries from least to most recently used, and
 * removeEldestEntry lets it evict on insert. synchronized makes it safe to share between threads.
 */
class LruCache<K, V> {
    private record Entry<V>(V value, long expiresAt) {}

    private final int capacity;
    private final long ttlMillis;
    private final LongSupplier clock;
    private final LinkedHashMap<K, Entry<V>> map;

    LruCache(int capacity, long ttlMillis, LongSupplier clock) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity must be positive");
        this.capacity = capacity;
        this.ttlMillis = ttlMillis;
        this.clock = clock;
        this.map = new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<K, Entry<V>> eldest) {
                return size() > LruCache.this.capacity;
            }
        };
    }

    LruCache(int capacity) {
        this(capacity, Long.MAX_VALUE, System::currentTimeMillis);
    }

    synchronized V get(K key) {
        Entry<V> e = map.get(key); // a hit also moves the key to most-recent
        if (e == null) return null;
        if (e.expiresAt() <= clock.getAsLong()) {
            map.remove(key);
            return null;
        }
        return e.value();
    }

    synchronized void put(K key, V value) {
        long now = clock.getAsLong();
        long expires = ttlMillis == Long.MAX_VALUE ? Long.MAX_VALUE : now + ttlMillis;
        map.put(key, new Entry<>(value, expires));
    }

    synchronized int size() {
        return map.size();
    }
}
