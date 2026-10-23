import java.math.BigDecimal;
import java.util.Comparator;
import java.util.DoubleSummaryStatistics;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

record Order(String id, String customer, String category, BigDecimal amount, String status) {}

class Reports {
    /** Revenue per customer from paid orders, highest first. BigDecimal: never use double for money. */
    static List<Map.Entry<String, BigDecimal>> topCustomers(List<Order> orders, int n) {
        return orders.stream()
            .filter(o -> o.status().equals("PAID"))
            .collect(Collectors.groupingBy(Order::customer, Collectors.reducing(BigDecimal.ZERO, Order::amount, BigDecimal::add)))
            .entrySet().stream()
            .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
            .limit(n)
            .toList();
    }

    /** Count per status, sorted by status name (TreeMap). */
    static Map<String, Long> countByStatus(List<Order> orders) {
        return orders.stream().collect(Collectors.groupingBy(Order::status, TreeMap::new, Collectors.counting()));
    }

    /** category -> (customer -> number of orders): a nested grouping. */
    static Map<String, Map<String, Long>> ordersPerCategoryAndCustomer(List<Order> orders) {
        return orders.stream().collect(Collectors.groupingBy(Order::category, TreeMap::new, Collectors.groupingBy(Order::customer, TreeMap::new, Collectors.counting())));
    }

    static DoubleSummaryStatistics amountStats(List<Order> orders) {
        return orders.stream().collect(Collectors.summarizingDouble(o -> o.amount().doubleValue()));
    }

    /** partitioningBy always returns both keys, true and false. */
    static Map<Boolean, List<String>> bigOrders(List<Order> orders, BigDecimal threshold) {
        return orders.stream().collect(Collectors.partitioningBy(o -> o.amount().compareTo(threshold) >= 0, Collectors.mapping(Order::id, Collectors.toList())));
    }

    static Comparator<Order> byAmountDesc() {
        return Comparator.comparing(Order::amount).reversed().thenComparing(Order::id);
    }
}
