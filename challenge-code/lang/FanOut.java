import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

record Dashboard(String profile, List<String> orders, String recommendations) {}

/**
 * Call three services in parallel and combine them. Each call has its own timeout and fallback,
 * so one slow or failing dependency degrades the page instead of breaking it.
 */
class DashboardService {
    private final ExecutorService executor; // a dedicated pool, not the common ForkJoinPool, for blocking I/O

    DashboardService(ExecutorService executor) {
        this.executor = executor;
    }

    private <T> CompletableFuture<T> call(Supplier<T> remote, long timeoutMs, T fallback) {
        return CompletableFuture.supplyAsync(remote, executor)
            .completeOnTimeout(fallback, timeoutMs, TimeUnit.MILLISECONDS) // Java 9+
            .exceptionally(err -> fallback);
    }

    Dashboard load(Supplier<String> profile, Supplier<List<String>> orders, Supplier<String> recs) {
        CompletableFuture<String> p = CompletableFuture.supplyAsync(profile, executor) // required: no fallback
            .orTimeout(500, TimeUnit.MILLISECONDS);
        CompletableFuture<List<String>> o = call(orders, 300, List.of());
        CompletableFuture<String> r = call(recs, 200, "popular-items");
        // allOf waits for all three; join() then can't block. All three ran concurrently.
        return CompletableFuture.allOf(p, o, r).thenApply(v -> new Dashboard(p.join(), o.join(), r.join())).join();
    }
}
