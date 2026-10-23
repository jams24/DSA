import java.time.Duration;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ThreadLocalRandom;

final class Retry {
    interface Sleeper {
        void sleep(long millis) throws InterruptedException;
    }

    private Retry() {}

    /**
     * Call `task` up to `times` times, retrying only exceptions whose type is in `retryOn`,
     * with exponential backoff and full jitter. The last failure is rethrown.
     */
    static <T> T withRetry(Callable<T> task, int times, Duration base, Set<Class<? extends Exception>> retryOn, Sleeper sleeper) throws Exception {
        if (times < 1) throw new IllegalArgumentException("times must be >= 1");
        for (int attempt = 0; ; attempt++) {
            try {
                return task.call();
            } catch (Exception e) {
                boolean retryable = retryOn.stream().anyMatch(type -> type.isInstance(e));
                if (!retryable || attempt == times - 1) throw e;
                long ceil = Math.min(5_000, base.toMillis() << attempt);
                try {
                    sleeper.sleep(ThreadLocalRandom.current().nextLong(ceil + 1));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt(); // keep the interrupt flag for callers
                    throw ie;
                }
            }
        }
    }

    static <T> T withRetry(Callable<T> task, int times, Set<Class<? extends Exception>> retryOn) throws Exception {
        return withRetry(task, times, Duration.ofMillis(100), retryOn, Thread::sleep);
    }
}
