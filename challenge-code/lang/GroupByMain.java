import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public class Main {
    static void check(boolean ok, Object msg) {
        if (!ok) throw new AssertionError(msg);
    }

    public static void main(String[] args) {
        List<Order> orders = List.of(
            new Order("o1", "ada", "books", new BigDecimal("30.00"), "PAID"),
            new Order("o2", "bob", "games", new BigDecimal("60.00"), "PAID"),
            new Order("o3", "ada", "games", new BigDecimal("45.50"), "PAID"),
            new Order("o4", "cy", "books", new BigDecimal("500.00"), "REFUNDED"),
            new Order("o5", "bob", "books", new BigDecimal("10.00"), "PENDING"));

        var top = Reports.topCustomers(orders, 2);
        check(top.get(0).getKey().equals("ada") && top.get(0).getValue().equals(new BigDecimal("75.50")), top);
        check(top.get(1).getKey().equals("bob") && top.size() == 2, top);
        check(Reports.countByStatus(orders).equals(Map.of("PAID", 3L, "PENDING", 1L, "REFUNDED", 1L)), Reports.countByStatus(orders));
        check(Reports.ordersPerCategoryAndCustomer(orders).get("books").equals(Map.of("ada", 1L, "cy", 1L, "bob", 1L)), "nested");
        check(Reports.amountStats(orders).getMax() == 500.0, "stats");
        check(Reports.bigOrders(orders, new BigDecimal("50")).get(true).equals(List.of("o2", "o4")), "partition");
        check(orders.stream().sorted(Reports.byAmountDesc()).findFirst().get().id().equals("o4"), "sort");
        System.out.println("ok");
    }
}
