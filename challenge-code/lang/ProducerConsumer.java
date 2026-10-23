import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.function.Function;

/**
 * Producers put work on a bounded BlockingQueue; consumers take it off. put() blocks when the
 * queue is full (backpressure) and take() blocks when it is empty, so no busy-waiting.
 * Shutdown uses one "poison pill" per consumer.
 */
class Pipeline<In, Out> {
    private static final Object POISON = new Object();

    private final BlockingQueue<Object> queue;
    private final List<Out> results = Collections.synchronizedList(new ArrayList<>());

    Pipeline(int capacity) {
        queue = new ArrayBlockingQueue<>(capacity);
    }

    List<Out> run(List<List<In>> producerInputs, int consumers, Function<In, Out> work) throws InterruptedException {
        CountDownLatch producersDone = new CountDownLatch(producerInputs.size());
        CountDownLatch consumersDone = new CountDownLatch(consumers);

        for (List<In> input : producerInputs) {
            new Thread(() -> {
                try {
                    for (In item : input) queue.put(item);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    producersDone.countDown();
                }
            }).start();
        }
        for (int i = 0; i < consumers; i++) {
            new Thread(() -> {
                try {
                    while (true) {
                        Object item = queue.take();
                        if (item == POISON) break;
                        @SuppressWarnings("unchecked")
                        In in = (In) item;
                        results.add(work.apply(in));
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    consumersDone.countDown();
                }
            }).start();
        }

        producersDone.await(); // only after every producer is done is it safe to stop consumers
        for (int i = 0; i < consumers; i++) queue.put(POISON);
        consumersDone.await();
        return new ArrayList<>(results);
    }
}
