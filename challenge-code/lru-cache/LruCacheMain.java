public class Main {
    static long now = 0;

    static void check(boolean ok, String msg) {
        if (!ok) throw new AssertionError(msg);
    }

    public static void main(String[] args) {
        LruCache<String, Integer> c = new LruCache<>(2);
        c.put("a", 1);
        c.put("b", 2);
        check(c.get("a") == 1, "get a");
        c.put("c", 3); // evicts b
        check(c.get("b") == null && c.get("a") == 1 && c.get("c") == 3, "evict b");
        c.put("a", 10);
        c.put("d", 4); // evicts c
        check(c.get("c") == null && c.get("a") == 10 && c.size() == 2, "update + evict c");

        LruCache<String, Integer> t = new LruCache<>(10, 5_000, () -> now);
        t.put("x", 1);
        now = 4_999;
        check(t.get("x") == 1, "fresh");
        now = 5_000;
        check(t.get("x") == null && t.size() == 0, "expired");
        System.out.println("ok");
    }
}
