public class Main {
    static void check(boolean ok, String msg) {
        if (!ok) throw new AssertionError(msg);
    }

    public static void main(String[] args) {
        KvStore db = new KvStore();
        db.set("a", "10");
        db.set("b", "10");
        check(db.count("10") == 2, "count");
        db.begin();
        db.set("a", "20");
        db.begin();
        db.delete("b");
        check(db.count("10") == 0, "count after delete");
        check(db.rollback() && "10".equals(db.get("b")) && "20".equals(db.get("a")), "inner rollback");
        check(db.rollback() && "10".equals(db.get("a")), "outer rollback");
        check(!db.rollback(), "no transaction");

        KvStore n = new KvStore();
        n.set("a", "1");
        n.begin();
        n.begin();
        n.set("a", "2");
        n.rollback();
        n.rollback();
        check("1".equals(n.get("a")) && n.count("2") == 0, "nested rollback of an untouched key");
        n.begin();
        n.set("x", "9");
        check(n.commit() && "9".equals(n.get("x")) && !n.commit(), "commit");
        System.out.println("ok");
    }
}
