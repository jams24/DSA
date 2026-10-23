import java.util.List;
import java.util.concurrent.TimeUnit;

public class Main {
    public static void main(String[] args) throws Exception {
        List<WorkerPool.Outcome<Integer>> out = WorkerPool.runAll(List.of(1, 2, 3, 4, 500), n -> {
            if (n == 3) throw new IllegalArgumentException("bad input 3");
            try {
                Thread.sleep(n);
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
            return n * 10;
        }, 3, 200, TimeUnit.MILLISECONDS);

        if (!(out.get(0) instanceof WorkerPool.Ok<Integer> ok) || ok.value() != 10) throw new AssertionError(out);
        if (!(out.get(2) instanceof WorkerPool.Failed<Integer> f) || !f.error().getMessage().equals("bad input 3")) throw new AssertionError(out);
        if (!(out.get(4) instanceof WorkerPool.TimedOut<Integer>)) throw new AssertionError(out);
        System.out.println("ok");
    }
}
