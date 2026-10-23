import java.util.List;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeoutException;

public class Main {
    static <T> T after(long ms, T value) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return value;
    }

    public static void main(String[] args) {
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            DashboardService svc = new DashboardService(pool);
            long t0 = System.nanoTime();
            Dashboard d = svc.load(() -> after(100, "ada"), () -> after(100, List.of("o1")), () -> after(100, "for-you"));
            long ms = (System.nanoTime() - t0) / 1_000_000;
            if (!d.equals(new Dashboard("ada", List.of("o1"), "for-you"))) throw new AssertionError(d);
            if (ms > 250) throw new AssertionError("calls should run in parallel, took " + ms + "ms");

            d = svc.load(() -> "ada", () -> { throw new IllegalStateException("orders down"); }, () -> after(1000, "late"));
            if (!d.equals(new Dashboard("ada", List.of(), "popular-items"))) throw new AssertionError(d);

            try {
                svc.load(() -> after(2000, "slow"), List::of, () -> "r");
                throw new AssertionError("profile timeout should fail the request");
            } catch (CompletionException e) {
                if (!(e.getCause() instanceof TimeoutException)) throw new AssertionError(e);
            }
            System.out.println("ok");
        } finally {
            pool.shutdownNow();
        }
    }
}
