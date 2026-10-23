import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class Main {
    public static void main(String[] args) throws Exception {
        Map<String, Integer> hits = new ConcurrentHashMap<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            String q = String.valueOf(ex.getRequestURI().getQuery());
            int n = hits.merge(ex.getRequestURI().getPath() + "?" + q, 1, Integer::sum);
            int status = 200;
            String body = "";
            if (ex.getRequestURI().getPath().equals("/missing")) status = 404;
            else if (q.equals("page=1") && n == 1) status = 503;
            else if (q.equals("page=2") && n == 1) {
                status = 429;
                ex.getResponseHeaders().add("Retry-After", "2");
            } else body = q.equals("page=1") ? "{\"items\":[1],\"next_page\":2}" : "{\"items\":[2],\"next_page\":null}";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
            if (bytes.length > 0) ex.getResponseBody().write(bytes);
            ex.close();
        });
        server.start();
        try {
            List<Duration> slept = new ArrayList<>();
            ApiClient client = new ApiClient("http://127.0.0.1:" + server.getAddress().getPort(), 4, slept::add);
            List<String> pages = client.fetchAllPages();
            if (pages.size() != 2 || !pages.get(1).contains("[2]")) throw new AssertionError(pages);
            if (slept.size() != 2 || slept.get(0).toMillis() > 200 || !slept.get(1).equals(Duration.ofSeconds(2))) throw new AssertionError(slept);
            try {
                client.get("/missing");
                throw new AssertionError("expected failure");
            } catch (ApiException expected) {
                if (hits.get("/missing?null") != 1) throw new AssertionError("404 must not be retried");
            }
            System.out.println("ok");
        } finally {
            server.stop(0);
        }
    }
}
