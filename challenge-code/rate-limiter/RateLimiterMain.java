import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    static long now = 0;

    public static void main(String[] args) throws Exception {
        SlidingWindowLimiter rl = new SlidingWindowLimiter(3, 10_000, () -> now);
        List<Boolean> got = new ArrayList<>();
        for (long t : new long[] {0, 1000, 2000, 3000, 9900, 10_000, 11_000, 12_500}) {
            now = t;
            got.add(rl.allow("alice"));
        }
        if (!got.equals(List.of(true, true, true, false, false, true, true, true))) throw new AssertionError(got);
        if (!rl.allow("bob")) throw new AssertionError("clients are independent");

        TokenBucketLimiter tb = new TokenBucketLimiter(2, 0.5, () -> now);
        now = 0;
        if (!(tb.allow("a") && tb.allow("a") && !tb.allow("a"))) throw new AssertionError("burst");
        now = 2000;
        if (!(tb.allow("a") && !tb.allow("a"))) throw new AssertionError("refill");

        // Thread safety: 100 threads racing for a limit of 50 must admit exactly 50.
        SlidingWindowLimiter shared = new SlidingWindowLimiter(50, 60_000);
        AtomicInteger admitted = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(16);
        for (int i = 0; i < 100; i++) pool.submit(() -> { if (shared.allow("x")) admitted.incrementAndGet(); });
        pool.shutdown();
        pool.awaitTermination(5, TimeUnit.SECONDS);
        if (admitted.get() != 50) throw new AssertionError(admitted.get());
        System.out.println("ok");
    }
}
