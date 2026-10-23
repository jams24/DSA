import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

class ApiException extends RuntimeException {
    ApiException(String message, Throwable cause) {
        super(message, cause);
    }
}

class ApiClient {
    interface Sleeper {
        void sleep(Duration d) throws InterruptedException;
    }

    private static final Set<Integer> RETRYABLE = Set.of(408, 429, 500, 502, 503, 504);
    private static final Pattern NEXT_PAGE = Pattern.compile("\"next_page\"\\s*:\\s*(\\d+|null)");

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final String baseUrl;
    private final int maxAttempts;
    private final Sleeper sleeper;

    ApiClient(String baseUrl, int maxAttempts, Sleeper sleeper) {
        this.baseUrl = baseUrl;
        this.maxAttempts = maxAttempts;
        this.sleeper = sleeper;
    }

    ApiClient(String baseUrl) {
        this(baseUrl, 4, d -> Thread.sleep(d.toMillis()));
    }

    /** Exponential backoff with full jitter, capped at 5s. */
    static Duration backoff(int attempt) {
        long ceil = Math.min(5_000, 200L << attempt);
        return Duration.ofMillis(ThreadLocalRandom.current().nextLong(ceil + 1));
    }

    String get(String path) throws InterruptedException {
        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + path)).timeout(Duration.ofSeconds(5)).GET().build();
        Exception last = null;
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            Duration wait = backoff(attempt);
            try {
                HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() < 400) return res.body();
                last = new IOException("HTTP " + res.statusCode());
                if (!RETRYABLE.contains(res.statusCode())) break;
                String retryAfter = res.headers().firstValue("Retry-After").orElse("");
                if (retryAfter.matches("\\d+")) wait = Duration.ofSeconds(Math.min(30, Long.parseLong(retryAfter)));
            } catch (IOException e) { // connection failure or HttpTimeoutException
                last = e;
            }
            if (attempt < maxAttempts - 1) sleeper.sleep(wait);
        }
        throw new ApiException("GET " + path + " failed", last);
    }

    /** Collects the raw JSON of every page. (A real codebase would map pages with Jackson.) */
    List<String> fetchAllPages() throws InterruptedException {
        List<String> pages = new ArrayList<>();
        String page = "1";
        while (!page.equals("null")) {
            String body = get("/items?page=" + page);
            pages.add(body);
            Matcher m = NEXT_PAGE.matcher(body);
            page = m.find() ? m.group(1) : "null";
        }
        return pages;
    }
}
