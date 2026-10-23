// Spring Boot 3 (spring-boot-starter-web). Same behavior as the other versions.
import java.net.URI;
import java.security.SecureRandom;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class ShortenerController {
    record ShortenRequest(String url, String alias) {}
    record Link(String url, AtomicLong hits) {}

    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int RATE_LIMIT = 10;
    private static final long WINDOW_MS = 60_000;

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Link> links = new ConcurrentHashMap<>();
    private final Map<String, String> byUrl = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> recent = new ConcurrentHashMap<>();

    private boolean allow(String client) {
        Deque<Long> q = recent.computeIfAbsent(client, k -> new ArrayDeque<>());
        synchronized (q) {
            long now = System.currentTimeMillis();
            while (!q.isEmpty() && now - q.peekFirst() >= WINDOW_MS) q.pollFirst();
            if (q.size() >= RATE_LIMIT) return false;
            q.addLast(now);
            return true;
        }
    }

    private static boolean validUrl(String s) {
        try {
            URI u = new URI(s);
            return ("http".equals(u.getScheme()) || "https".equals(u.getScheme())) && u.getHost() != null;
        } catch (Exception e) {
            return false;
        }
    }

    private String newCode() {
        while (true) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 7; i++) sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            if (!links.containsKey(sb.toString())) return sb.toString();
        }
    }

    @PostMapping("/shorten")
    public synchronized ResponseEntity<Map<String, String>> shorten(@RequestBody ShortenRequest body, HttpServletRequest req) {
        if (!allow(req.getRemoteAddr()))
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "60").build();
        if (body.url() == null || !validUrl(body.url()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "url must be an absolute http(s) URL");

        String code;
        HttpStatus status = HttpStatus.CREATED;
        if (body.alias() != null) {
            if (!body.alias().matches("[A-Za-z0-9]{3,32}"))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "alias must be 3-32 letters or digits");
            if (links.containsKey(body.alias()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "alias already taken");
            code = body.alias();
        } else if (byUrl.containsKey(body.url())) {
            code = byUrl.get(body.url());
            status = HttpStatus.OK;
        } else {
            code = newCode();
            byUrl.put(body.url(), code);
        }
        links.putIfAbsent(code, new Link(body.url(), new AtomicLong()));
        return ResponseEntity.status(status).body(Map.of("code", code, "url", body.url()));
    }

    @GetMapping("/stats/{code}")
    public Map<String, Object> stats(@PathVariable String code) {
        Link l = links.get(code);
        if (l == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown code");
        return Map.of("code", code, "url", l.url(), "hits", l.hits().get());
    }

    @GetMapping("/{code}")
    public ResponseEntity<Void> follow(@PathVariable String code) {
        Link l = links.get(code);
        if (l == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown code");
        l.hits().incrementAndGet();
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(l.url())).build();
    }
}
