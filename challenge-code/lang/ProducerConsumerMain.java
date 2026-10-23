import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class Main {
    public static void main(String[] args) throws Exception {
        List<List<Integer>> inputs = List.of(
            IntStream.range(0, 500).boxed().toList(),
            IntStream.range(500, 1000).boxed().toList(),
            IntStream.range(1000, 1500).boxed().toList());
        List<Integer> out = new Pipeline<Integer, Integer>(8).run(inputs, 4, n -> n * 2);
        if (out.size() != 1500) throw new AssertionError(out.size());
        List<Integer> sorted = out.stream().sorted().collect(Collectors.toList());
        for (int i = 0; i < 1500; i++) if (sorted.get(i) != i * 2) throw new AssertionError("missing " + i);
        System.out.println("ok");
    }
}
