import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class Main {
    static int calls = 0;

    public static void main(String[] args) throws Exception {
        List<Long> slept = new ArrayList<>();
        String v = Retry.withRetry(() -> {
            if (++calls < 3) throw new IOException("down");
            return "ok";
        }, 4, Duration.ofMillis(100), Set.of(IOException.class), slept::add);
        if (!v.equals("ok") || calls != 3 || slept.size() != 2 || slept.get(0) > 100 || slept.get(1) > 200) throw new AssertionError(slept);

        calls = 0;
        try {
            Retry.withRetry(() -> {
                calls++;
                throw new IllegalStateException("bug");
            }, 3, Duration.ofMillis(1), Set.of(IOException.class), ms -> {});
            throw new AssertionError("expected exception");
        } catch (IllegalStateException expected) {
            if (calls != 1) throw new AssertionError("non-retryable error was retried");
        }

        calls = 0;
        try {
            Retry.withRetry(() -> {
                calls++;
                throw new UncheckedIOException(new IOException("still down"));
            }, 3, Duration.ofMillis(1), Set.of(UncheckedIOException.class), ms -> {});
        } catch (UncheckedIOException expected) {
            if (calls != 3) throw new AssertionError(calls);
        }
        System.out.println("ok");
    }
}
