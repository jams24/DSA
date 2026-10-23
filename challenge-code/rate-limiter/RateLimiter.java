import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.function.LongSupplier;

/** Exact sliding-window log: at most `limit` requests per `windowMillis` per client. */
class SlidingWindowLimiter {
    private final int limit;
    private final long windowMillis;
    private final LongSupplier clock;
    private final Map<String, Deque<Long>> log = new HashMap<>();

    SlidingWindowLimiter(int limit, long windowMillis, LongSupplier clock) {
        this.limit = limit;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    SlidingWindowLimiter(int limit, long windowMillis) {
        this(limit, windowMillis, System::currentTimeMillis);
    }

    synchronized boolean allow(String client) {
        long now = clock.getAsLong();
        Deque<Long> q = log.computeIfAbsent(client, k -> new ArrayDeque<>());
        while (!q.isEmpty() && now - q.peekFirst() >= windowMillis) q.pollFirst();
        if (q.size() >= limit) return false;
        q.addLast(now);
        return true;
    }
}

/** Token bucket: bursts up to `capacity`, refilled at `ratePerSecond`. O(1) state per client. */
class TokenBucketLimiter {
    private static final class Bucket {
        double tokens;
        long last;

        Bucket(double tokens, long last) {
            this.tokens = tokens;
            this.last = last;
        }
    }

    private final double capacity;
    private final double ratePerMilli;
    private final LongSupplier clock;
    private final Map<String, Bucket> buckets = new HashMap<>();

    TokenBucketLimiter(double capacity, double ratePerSecond, LongSupplier clock) {
        this.capacity = capacity;
        this.ratePerMilli = ratePerSecond / 1000.0;
        this.clock = clock;
    }

    synchronized boolean allow(String client) {
        long now = clock.getAsLong();
        Bucket b = buckets.computeIfAbsent(client, k -> new Bucket(capacity, now));
        b.tokens = Math.min(capacity, b.tokens + (now - b.last) * ratePerMilli);
        b.last = now;
        if (b.tokens < 1) return false;
        b.tokens -= 1;
        return true;
    }
}
