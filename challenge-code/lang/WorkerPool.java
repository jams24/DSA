import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

class WorkerPool {
    sealed interface Outcome<T> permits Ok, Failed, TimedOut {}
    record Ok<T>(T value) implements Outcome<T> {}
    record Failed<T>(Throwable error) implements Outcome<T> {}
    record TimedOut<T>() implements Outcome<T> {}

    /**
     * Runs every task on a fixed pool and waits at most `timeout` overall. invokeAll cancels
     * (interrupts) whatever hasn't finished by the deadline. Results keep input order.
     */
    static <In, Out> List<Outcome<Out>> runAll(List<In> inputs, Function<In, Out> work, int threads, long timeout, TimeUnit unit) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            List<Callable<Out>> tasks = new ArrayList<>();
            for (In in : inputs) tasks.add(() -> work.apply(in));
            List<Future<Out>> futures = pool.invokeAll(tasks, timeout, unit);
            List<Outcome<Out>> out = new ArrayList<>();
            for (Future<Out> f : futures) {
                try {
                    out.add(new Ok<>(f.get()));
                } catch (CancellationException e) {
                    out.add(new TimedOut<>());
                } catch (ExecutionException e) {
                    out.add(new Failed<>(e.getCause())); // unwrap: the task's own exception
                }
            }
            return out;
        } finally {
            pool.shutdownNow(); // always release the threads, even if we were interrupted
        }
    }
}
