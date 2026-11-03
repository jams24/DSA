import type { Lesson } from "../types";

// Java track, part 4: Ecosystem (libraries and Spring Boot).

export const javaEcosystem: Lesson[] = [
  // ------------------------------------------------------------------ LIBRARIES
  {
    id: "java-libraries",
    stage: "Ecosystem",
    title: "The Java library toolbox",
    tagline: "What to reach for: JSON, HTTP clients, web frameworks, persistence, testing, logging, resilience, messaging, security, CLI and AI libraries.",
    difficulty: "intermediate",
    minutes: 30,
    concept: `
## The JDK is a big library already
Before adding a dependency, check the JDK. It ships an **HTTP client** (\`java.net.http\`), a tiny **HTTP server** (\`com.sun.net.httpserver\`), the **date-time API** (\`java.time\`), **NIO files** (\`java.nio.file.Files\`), **concurrency** utilities, **regex**, **XML**, **crypto** (\`java.security\`, \`javax.crypto\`), **JDBC** and **zip/gzip**. The two samples below use only the JDK.

## Choosing a library
Every dependency is code you ship, patch and debug. Before adding one, check:
- **Maintenance**: recent releases, open issues getting answers, more than one maintainer.
- **Adoption**: widely used libraries have answers on Stack Overflow, and bugs get found by others first.
- **Fit**: does it work with your framework (Spring Boot manages versions for hundreds of libraries) and Java version?
- **License**: Apache 2.0, MIT, EPL and BSD are business-friendly; watch out for AGPL (iText, for example) in closed-source products.
- **Size of the transitive tree**: \`mvn dependency:tree\` before and after.

## The default stack most Java teams use
| Need | Default choice | Alternatives |
|---|---|---|
| Web framework | **Spring Boot** | Quarkus, Micronaut, Helidon, Javalin |
| JSON | **Jackson** | Gson, JSON-B |
| HTTP client | **JDK HttpClient** / Spring **RestClient** | OkHttp, Retrofit, OpenFeign |
| SQL | **Spring Data JPA** (Hibernate) | jOOQ, JdbcClient, MyBatis |
| Migrations | **Flyway** | Liquibase |
| Connection pool | **HikariCP** | (it's the default everywhere) |
| Tests | **JUnit 5**, **AssertJ**, **Mockito**, **Testcontainers** | WireMock, REST Assured, ArchUnit |
| Logging | **SLF4J** + **Logback** | Log4j 2 |
| Metrics and tracing | **Micrometer**, **OpenTelemetry** | |
| Caching | **Caffeine** (local), Redis (shared) | |
| Resilience | **Resilience4j** | |
| Messaging | **Kafka** clients / Spring Kafka | RabbitMQ (Spring AMQP), AWS SDK |

Browse the full catalog on the **Toolbox** tab, with a snippet for the most important ones.

## Framework families for building APIs
- **Spring Boot**: the dominant choice. Huge ecosystem (Data, Security, Cloud, Batch, AI), excellent docs, more jobs than all the others combined. Next chapter.
- **Quarkus** (Red Hat) and **Micronaut**: do dependency injection at **build time**, so they start in milliseconds and use less memory, especially as GraalVM native images. Good for serverless and dense Kubernetes deployments.
- **Helidon** (Oracle): Helidon SE is a lightweight, virtual-thread-first web server; Helidon MP follows MicroProfile.
- **Javalin**: a tiny, unopinionated library (no annotations, no DI). Great for small services and learning.
- **Jakarta EE** (JAX-RS, CDI, JPA): the standard specs, run on servers like WildFly, Payara or Open Liberty.
- **Vert.x**: event-loop, reactive toolkit for very high concurrency.
`,
    keyPoints: [
      "Check the JDK first: HttpClient, java.time, NIO Files, concurrency, crypto",
      "Evaluate dependencies on maintenance, adoption, fit, license and transitive size",
      "Spring Boot + Jackson + Spring Data JPA + Flyway + JUnit/AssertJ/Mockito/Testcontainers is the mainstream stack",
      "Quarkus and Micronaut trade some flexibility for fast startup and low memory",
      "Use SLF4J as the logging API, Micrometer/OpenTelemetry for metrics and traces",
      "Caffeine for local caching, Resilience4j for retries, timeouts and circuit breakers",
    ],
    code: [
      {
        title: "The built-in HTTP server and HttpClient (no dependencies)",
        variants: [
          {
            lang: "java",
            code: `import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;

public class BuiltInHttp {
    static void send(HttpExchange ex, int status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", contentType);
        ex.sendResponseHeaders(status, bytes.length);
        try (var out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);   // port 0: any free port
        server.createContext("/hello", ex -> {
            String query = ex.getRequestURI().getQuery();
            String name = query != null && query.startsWith("name=") ? query.substring(5) : "world";
            send(ex, 200, "application/json", "{\\"greeting\\":\\"hello " + name + "\\"}");
        });
        server.createContext("/echo", ex -> {
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            send(ex, 201, "text/plain", ex.getRequestMethod() + " " + body.toUpperCase());
        });
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());       // one virtual thread per request
        server.start();
        String base = "http://127.0.0.1:" + server.getAddress().getPort();

        try (HttpClient client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(2))
                .build()) {
            HttpRequest get = HttpRequest.newBuilder(URI.create(base + "/hello?name=ada"))
                .timeout(Duration.ofSeconds(5))
                .header("Accept", "application/json")
                .GET()
                .build();
            HttpResponse<String> res = client.send(get, HttpResponse.BodyHandlers.ofString());
            System.out.println(res.statusCode() + " " + res.headers().firstValue("content-type").orElse("?") + " " + res.body());

            HttpRequest post = HttpRequest.newBuilder(URI.create(base + "/echo"))
                .POST(HttpRequest.BodyPublishers.ofString("ping"))
                .build();
            HttpResponse<String> echoed = client.send(post, HttpResponse.BodyHandlers.ofString());
            System.out.println(echoed.statusCode() + " " + echoed.body());

            List<CompletableFuture<String>> calls = List.of("grace", "linus").stream()
                .map(n -> HttpRequest.newBuilder(URI.create(base + "/hello?name=" + n)).build())
                .map(req -> client.sendAsync(req, HttpResponse.BodyHandlers.ofString()).thenApply(HttpResponse::body))
                .toList();                                                     // both requests in flight at once
            calls.forEach(c -> System.out.println("async " + c.join()));

            HttpResponse<String> missing = client.send(HttpRequest.newBuilder(URI.create(base + "/nope")).build(), HttpResponse.BodyHandlers.ofString());
            System.out.println("unknown path -> " + missing.statusCode());
        } finally {
            server.stop(0);
        }
    }
}`,
          },
        ],
        output: `200 application/json {"greeting":"hello ada"}
201 POST PING
async {"greeting":"hello grace"}
async {"greeting":"hello linus"}
unknown path -> 404`,
        explain: `- \`HttpClient\` supports HTTP/1.1 and HTTP/2, sync (\`send\`) and async (\`sendAsync\`) calls, timeouts, redirects and proxies. It's \`AutoCloseable\` since Java 21.
- Always set **timeouts**: a connect timeout on the client and a request timeout per call. The default is to wait forever.
- \`com.sun.net.httpserver\` is fine for tools, tests and demos. For real services use a framework (next chapter) or Javalin/Helidon.
- In a real client you'd map the JSON body to a record with Jackson instead of reading strings.`,
      },
      {
        title: "java.time: dates, time zones and DST done right",
        variants: [
          {
            lang: "java",
            code: `import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

public class Dates {
    public static void main(String[] args) {
        LocalDate ga = LocalDate.of(2025, 9, 16);                              // a date, no time, no zone
        System.out.println("Java 25 shipped on a " + ga.getDayOfWeek() + "; six months later: " + ga.plusMonths(6));
        System.out.println("Jan 31 + 1 month = " + LocalDate.of(2026, 1, 31).plusMonths(1) + " (clamped)");
        System.out.println("age of a leap-day baby on 2026-11-03: " + Period.between(LocalDate.of(2024, 2, 29), LocalDate.of(2026, 11, 3)));
        System.out.println("135 minutes = " + Duration.ofMinutes(135));

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("EEE d MMM HH:mm xxx", Locale.ENGLISH);
        ZonedDateTime london = ZonedDateTime.of(LocalDateTime.of(2026, 3, 29, 9, 0), ZoneId.of("Europe/London"));
        for (String zone : new String[] {"Europe/London", "Africa/Lagos", "America/New_York", "Asia/Tokyo"}) {
            System.out.printf("%-17s %s%n", zone, london.withZoneSameInstant(ZoneId.of(zone)).format(fmt));
        }
        System.out.println("as an Instant (UTC): " + london.toInstant());

        ZonedDateTime gap = ZonedDateTime.of(LocalDateTime.of(2026, 3, 29, 1, 30), ZoneId.of("Europe/London"));
        System.out.println("01:30 doesn't exist that night, so it becomes " + gap.toLocalTime() + " " + gap.getOffset());

        Clock fixed = Clock.fixed(Instant.parse("2026-11-03T10:15:30Z"), ZoneOffset.UTC);   // inject a Clock to test time logic
        LocalDate today = LocalDate.now(fixed);
        System.out.println("days from " + today + " to Christmas: " + ChronoUnit.DAYS.between(today, LocalDate.of(2026, 12, 25)));
    }
}`,
          },
        ],
        output: `Java 25 shipped on a TUESDAY; six months later: 2026-03-16
Jan 31 + 1 month = 2026-02-28 (clamped)
age of a leap-day baby on 2026-11-03: P2Y8M5D
135 minutes = PT2H15M
Europe/London     Sun 29 Mar 09:00 +01:00
Africa/Lagos      Sun 29 Mar 09:00 +01:00
America/New_York  Sun 29 Mar 04:00 -04:00
Asia/Tokyo        Sun 29 Mar 17:00 +09:00
as an Instant (UTC): 2026-03-29T08:00:00Z
01:30 doesn't exist that night, so it becomes 02:30 +01:00
days from 2026-11-03 to Christmas: 52`,
        explain: `- Pick the type that matches the meaning: \`LocalDate\` (a birthday), \`LocalDateTime\` (a wall-clock time with no zone), \`ZonedDateTime\` (a meeting in a city), \`Instant\` (a moment on the timeline: store and transmit these, in UTC).
- 29 March 2026 is the night the UK moves its clocks forward, so London jumps from GMT to BST (+01:00). \`java.time\` handles the gap automatically.
- \`Period\` is calendar-based (years, months, days); \`Duration\` is exact time (hours, minutes, seconds).
- Never use the legacy \`java.util.Date\` and \`SimpleDateFormat\` (mutable, not thread-safe).
- Injecting a \`Clock\` makes time-dependent code testable.`,
      },
    ],
    toolbox: [
      {
        category: "JSON & serialization",
        blurb: "Turning objects into JSON (and back) is the most common job in any API.",
        libs: [
          {
            name: "Jackson",
            tag: "essential",
            what: "The standard JSON library for Java: data binding, streaming, tree model, plus YAML, CSV, XML and many more formats.",
            when: "Default choice, and what Spring Boot uses. Jackson 3 (Maven group tools.jackson, Spring Boot 4's default) has unchecked exceptions and better defaults; Jackson 2 (com.fasterxml) is still everywhere. Works with records out of the box.",
            snippet: {
              lang: "java",
              code: `// Jackson 3: tools.jackson.core:jackson-databind
import tools.jackson.databind.json.JsonMapper;

record User(String name, int age, List<String> roles) {}

JsonMapper mapper = JsonMapper.builder().build();          // build once, reuse: thread-safe
String json = mapper.writeValueAsString(new User("Ada", 36, List.of("admin")));
// {"name":"Ada","age":36,"roles":["admin"]}
User back = mapper.readValue(json, User.class);
List<User> users = mapper.readValue(arrayJson, new TypeReference<List<User>>() {});
JsonNode tree = mapper.readTree(json);                      // when you don't have a class
String role = tree.path("roles").path(0).asString();`,
            },
          },
          {
            name: "Gson",
            tag: "popular",
            what: "Google's simple JSON library with minimal setup.",
            when: "Small projects and Android legacy code. In maintenance mode: prefer Jackson (or Moshi on Android) for new work.",
          },
          {
            name: "JSON-B (Yasson)",
            what: "The Jakarta EE standard JSON binding API.",
            when: "Jakarta EE and MicroProfile applications that want a spec-based API.",
          },
          {
            name: "Protocol Buffers (protobuf-java)",
            tag: "popular",
            what: "Google's compact, schema-first binary format with generated Java classes.",
            when: "Service-to-service messages, gRPC, Kafka payloads where size and schema evolution matter. Avro is the alternative common in Kafka/Hadoop shops.",
          },
        ],
      },
      {
        category: "HTTP clients",
        blurb: "Calling other services and third-party APIs.",
        libs: [
          {
            name: "java.net.http.HttpClient",
            tag: "standard",
            what: "The JDK's modern HTTP/1.1 and HTTP/2 client, sync and async.",
            when: "No-dependency default for plain Java code and libraries. See the sample in this chapter.",
          },
          {
            name: "Spring RestClient",
            tag: "essential",
            what: "Spring's fluent, synchronous HTTP client (Spring 6.1+), plus declarative @HttpExchange interfaces.",
            when: "Inside Spring Boot apps. Replaces RestTemplate for new code; pairs perfectly with virtual threads. WebClient is the reactive equivalent.",
            snippet: {
              lang: "java",
              code: `RestClient github = RestClient.builder()
    .baseUrl("https://api.github.com")
    .defaultHeader("Accept", "application/vnd.github+json")
    .build();

record Repo(String name, int stargazers_count) {}

List<Repo> repos = github.get()
    .uri("/users/{user}/repos?per_page=5", "spring-projects")
    .retrieve()
    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
        throw new IllegalStateException("GitHub said " + res.getStatusCode());
    })
    .body(new ParameterizedTypeReference<>() {});`,
            },
          },
          {
            name: "OkHttp + Retrofit",
            tag: "popular",
            what: "Square's efficient HTTP client, and Retrofit, which turns an annotated interface into a type-safe API client.",
            when: "Android and plain-Java projects outside Spring that want declarative clients.",
          },
          {
            name: "OpenFeign",
            what: "Declarative HTTP clients from interfaces, with Spring Cloud integration.",
            when: "Existing Spring Cloud codebases. For new Spring code, @HttpExchange interfaces cover the same need natively.",
          },
          {
            name: "Apache HttpClient 5",
            what: "The veteran, highly configurable HTTP client.",
            when: "When you need fine control over connection pooling, auth schemes or legacy proxies.",
          },
        ],
      },
      {
        category: "Web & API frameworks",
        blurb: "Where your REST, GraphQL or gRPC endpoints live.",
        libs: [
          {
            name: "Spring Boot",
            tag: "essential",
            what: "Opinionated, auto-configured Spring: embedded server, starters, actuator, a giant ecosystem.",
            when: "The default for Java backends and the most requested skill in job ads. Covered in depth in the next chapter.",
          },
          {
            name: "Quarkus",
            tag: "rising",
            what: "Kubernetes-native Java (Red Hat) with build-time DI, live reload and first-class GraalVM native images.",
            when: "Fast startup and low memory: serverless, many small services. Uses Jakarta REST, CDI and Hibernate (Panache) APIs.",
            snippet: {
              lang: "java",
              code: `@Path("/greetings")
public class GreetingResource {
    @Inject GreetingService service;

    @GET
    @Path("/{name}")
    @Produces(MediaType.APPLICATION_JSON)
    public Greeting hello(@PathParam("name") String name) {
        return service.greet(name);
    }
}
// ./mvnw quarkus:dev  -> live reload on save`,
            },
          },
          {
            name: "Micronaut",
            what: "Compile-time DI and AOP framework with Spring-like annotations and fast startup.",
            when: "Similar goals to Quarkus; comfortable for Spring developers.",
          },
          {
            name: "Javalin",
            tag: "popular",
            what: "A tiny web library: routes as lambdas, no annotations, no magic.",
            when: "Small services, internal tools, learning HTTP without a framework hiding it.",
            snippet: {
              lang: "java",
              code: `var app = Javalin.create(config -> config.useVirtualThreads = true)
    .get("/health", ctx -> ctx.result("ok"))
    .get("/users/{id}", ctx -> ctx.json(users.find(ctx.pathParam("id"))))
    .post("/users", ctx -> {
        User u = ctx.bodyAsClass(User.class);
        ctx.status(201).json(users.save(u));
    })
    .exception(NotFoundException.class, (e, ctx) -> ctx.status(404).json(Map.of("error", e.getMessage())))
    .start(8080);`,
            },
          },
          {
            name: "Helidon",
            what: "Oracle's microservice framework; Helidon SE is built on virtual threads from the ground up.",
            when: "Lightweight services that want blocking code at high concurrency without a big framework.",
          },
          {
            name: "Jakarta EE / MicroProfile",
            tag: "standard",
            what: "The standard enterprise specs (Jakarta REST, CDI, JPA, Bean Validation) on servers like WildFly, Payara, Open Liberty.",
            when: "Enterprises standardized on application servers, or when you want vendor-neutral APIs.",
          },
          {
            name: "Vert.x",
            what: "An event-driven, non-blocking toolkit (it powers Quarkus' reactive core).",
            when: "Extremely high-concurrency networking where you're comfortable with async code.",
          },
        ],
      },
      {
        category: "API contracts: OpenAPI, GraphQL, gRPC",
        libs: [
          {
            name: "springdoc-openapi",
            tag: "essential",
            what: "Generates an OpenAPI 3 spec and Swagger UI from your Spring controllers.",
            when: "Every public or shared Spring REST API: interactive docs at /swagger-ui.html, client generation from /v3/api-docs.",
          },
          {
            name: "OpenAPI Generator",
            what: "Generates clients and server stubs in many languages from an OpenAPI spec.",
            when: "Contract-first APIs, or generating typed clients for a partner's API.",
          },
          {
            name: "grpc-java",
            tag: "popular",
            what: "The official gRPC implementation: HTTP/2, protobuf, streaming, deadlines.",
            when: "Low-latency internal service-to-service calls with strict contracts. Spring gRPC integrates it with Boot.",
          },
          {
            name: "Spring for GraphQL / Netflix DGS",
            what: "GraphQL servers with schema-first annotated controllers.",
            when: "Clients (often mobile or web BFFs) that need flexible queries across many resources.",
          },
        ],
      },
      {
        category: "Persistence & databases",
        blurb: "Talking to SQL and NoSQL stores.",
        libs: [
          {
            name: "Hibernate / Spring Data JPA",
            tag: "essential",
            what: "The standard ORM: map entities to tables; Spring Data generates repositories from interfaces.",
            when: "CRUD-heavy domains. Learn about lazy loading, N+1 queries, fetch joins and transaction boundaries, or it will bite you.",
            snippet: {
              lang: "java",
              code: `@Entity
class Book {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    String title;
    @ManyToOne(fetch = FetchType.LAZY) Author author;
}

interface BookRepository extends JpaRepository<Book, Long> {
    List<Book> findByTitleContainingIgnoreCase(String text);           // query derived from the name

    @Query("select b from Book b join fetch b.author where b.author.name = :name")  // avoids N+1
    List<Book> findWithAuthor(String name);
}`,
            },
          },
          {
            name: "jOOQ",
            tag: "popular",
            what: "Type-safe SQL: write real SQL in Java with classes generated from your schema.",
            when: "SQL-heavy apps, reporting, complex queries, when you want SQL control without string concatenation. Commercial license for some databases.",
            snippet: {
              lang: "java",
              code: `List<OrderSummary> top = ctx
    .select(CUSTOMER.NAME, sum(ORDERS.TOTAL).as("spent"))
    .from(ORDERS).join(CUSTOMER).on(ORDERS.CUSTOMER_ID.eq(CUSTOMER.ID))
    .where(ORDERS.CREATED_AT.gt(LocalDate.now().minusDays(30)))
    .groupBy(CUSTOMER.NAME)
    .orderBy(field("spent").desc())
    .limit(10)
    .fetchInto(OrderSummary.class);`,
            },
          },
          {
            name: "Spring JdbcClient",
            what: "A fluent wrapper over plain JDBC (Spring 6.1+).",
            when: "Simple SQL without an ORM: `jdbc.sql(\"select * from users where id = ?\").param(id).query(User.class).optional()`.",
          },
          {
            name: "MyBatis",
            what: "SQL mapper: SQL in XML or annotations, mapped to objects.",
            when: "Teams that want handwritten SQL with mapping, common in some enterprises and in Asia.",
          },
          {
            name: "HikariCP",
            tag: "essential",
            what: "The fast, reliable JDBC connection pool.",
            when: "Always (Spring Boot's default). Tune maximumPoolSize to what the database can take, not to your thread count.",
          },
          {
            name: "Flyway / Liquibase",
            tag: "essential",
            what: "Versioned database migrations applied automatically at startup or in CI.",
            when: "Every project with a schema. Flyway uses plain SQL files (V1__init.sql); Liquibase adds XML/YAML changelogs and rollbacks.",
          },
          {
            name: "Lettuce / Jedis / Redisson",
            what: "Redis clients (Lettuce is Spring Data Redis' default; Redisson adds distributed locks and collections).",
            when: "Caching, rate limiting, sessions, queues and locks backed by Redis.",
          },
          {
            name: "MongoDB Java driver / Spring Data MongoDB",
            what: "Document database access with repositories and a fluent query API.",
            when: "Document-shaped data with flexible schemas.",
          },
        ],
      },
      {
        category: "Testing",
        libs: [
          {
            name: "JUnit Jupiter",
            tag: "essential",
            what: "The standard test framework: @Test, @ParameterizedTest, @Nested, extensions. JUnit 6 (2025) keeps the same Jupiter API on Java 17+.",
            when: "Every project.",
          },
          {
            name: "AssertJ",
            tag: "essential",
            what: "Fluent, readable assertions with excellent failure messages.",
            when: "Every project: assertThat(list).extracting(User::name).containsExactly(\"Ada\", \"Linus\").",
          },
          {
            name: "Mockito",
            tag: "essential",
            what: "Mocks and stubs for isolating the class under test.",
            when: "Unit tests of services with collaborators. Don't overuse: prefer real objects and fakes where cheap.",
          },
          {
            name: "Testcontainers",
            tag: "essential",
            what: "Starts real databases, brokers and services in Docker for tests.",
            when: "Integration tests against the same Postgres/Kafka/Redis you run in production. Spring Boot wires them with @ServiceConnection.",
            snippet: {
              lang: "java",
              code: `@SpringBootTest
@Testcontainers
class OrderRepositoryIT {
    @Container
    @ServiceConnection                       // Boot points the datasource at the container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired OrderRepository orders;

    @Test
    void savesAndFinds() {
        orders.save(new Order("book", 2));
        assertThat(orders.findByItem("book")).hasSize(1);
    }
}`,
            },
          },
          {
            name: "WireMock",
            tag: "popular",
            what: "A fake HTTP server to stub third-party APIs.",
            when: "Testing your HTTP clients: timeouts, 500s, slow responses, without the real service.",
          },
          {
            name: "REST Assured",
            what: "A fluent DSL for testing REST endpoints over real HTTP.",
            when: "End-to-end API tests: given().body(json).when().post(\"/users\").then().statusCode(201).",
          },
          {
            name: "ArchUnit",
            what: "Unit tests for architecture rules.",
            when: "Enforce layering: \"controllers must not access repositories\", no cycles between packages.",
          },
          {
            name: "Awaitility",
            what: "Waits for asynchronous conditions in tests.",
            when: "Testing Kafka consumers, schedulers, async jobs: await().atMost(5, SECONDS).until(...). Never Thread.sleep in tests.",
          },
          {
            name: "JMH",
            tag: "standard",
            what: "The OpenJDK microbenchmark harness that handles warm-up, dead-code elimination and statistics.",
            when: "Any performance claim about a piece of Java code. Hand-written timing loops lie.",
          },
        ],
      },
      {
        category: "Logging & observability",
        libs: [
          {
            name: "SLF4J",
            tag: "essential",
            what: "The logging facade: code against its API, choose the backend at deploy time.",
            when: "Always. log.info(\"order {} placed\", id) with placeholders, exception as the last argument.",
          },
          {
            name: "Logback",
            tag: "essential",
            what: "The default SLF4J backend (Spring Boot's default).",
            when: "Most apps. Add logstash-logback-encoder (or Boot's structured logging) for JSON logs in production.",
          },
          {
            name: "Log4j 2",
            what: "The other big logging backend, with async loggers for very high throughput.",
            when: "High-volume logging. Keep it patched (remember Log4Shell, CVE-2021-44228).",
          },
          {
            name: "Micrometer",
            tag: "essential",
            what: "Vendor-neutral metrics and observation API (\"SLF4J for metrics\") behind Spring Boot Actuator.",
            when: "Counters, timers and gauges exported to Prometheus, Datadog, CloudWatch and others.",
            snippet: {
              lang: "java",
              code: `Counter orders = Counter.builder("orders.placed").tag("channel", "web").register(registry);
Timer checkout = Timer.builder("checkout.duration").publishPercentiles(0.5, 0.95, 0.99).register(registry);

checkout.record(() -> {
    process(order);
    orders.increment();
});`,
            },
          },
          {
            name: "OpenTelemetry Java",
            tag: "rising",
            what: "The standard for distributed traces, metrics and logs; the Java agent instruments common libraries with zero code.",
            when: "Tracing requests across services. Spring Boot 4 has an OpenTelemetry starter.",
          },
        ],
      },
      {
        category: "Utilities & code generation",
        libs: [
          {
            name: "Guava",
            tag: "popular",
            what: "Google's core libraries: immutable collections, Multimap, Table, caches, hashing, preconditions.",
            when: "Multimaps, BiMaps, Range types, rate limiters. Much of the rest is now in the JDK.",
          },
          {
            name: "Apache Commons (Lang3, IO, Collections)",
            tag: "popular",
            what: "Helpers for strings, IO, reflection and collections.",
            when: "StringUtils, FileUtils and friends in legacy code. Check the JDK first: many helpers now exist natively.",
          },
          {
            name: "Lombok",
            tag: "popular",
            what: "Annotation processor generating getters, builders, constructors and loggers (@Getter, @Builder, @Slf4j).",
            when: "Very common in Spring codebases, but controversial (it hooks into the compiler). For data classes, records now cover most of it.",
          },
          {
            name: "MapStruct",
            tag: "popular",
            what: "Generates type-safe mappers between entities and DTOs at compile time.",
            when: "Many entity ↔ DTO conversions. No reflection, so fast and checked by the compiler.",
            snippet: {
              lang: "java",
              code: `@Mapper(componentModel = "spring")
interface UserMapper {
    @Mapping(target = "fullName", expression = "java(user.getFirst() + \\" \\" + user.getLast())")
    UserDto toDto(User user);
    List<UserDto> toDtos(List<User> users);
}`,
            },
          },
          {
            name: "Hibernate Validator",
            tag: "essential",
            what: "The reference implementation of Jakarta Bean Validation (@NotBlank, @Email, @Size, custom constraints).",
            when: "Validating request bodies and configuration (spring-boot-starter-validation).",
          },
        ],
      },
      {
        category: "Resilience & caching",
        libs: [
          {
            name: "Resilience4j",
            tag: "essential",
            what: "Circuit breaker, retry, rate limiter, bulkhead and time limiter as composable decorators.",
            when: "Every call to a remote dependency that can be slow or fail.",
            snippet: {
              lang: "java",
              code: `CircuitBreaker breaker = CircuitBreaker.ofDefaults("payments");
Retry retry = Retry.of("payments", RetryConfig.custom()
    .maxAttempts(3)
    .intervalFunction(IntervalFunction.ofExponentialRandomBackoff(200, 2.0))
    .build());

Supplier<Receipt> call = Decorators.ofSupplier(() -> payments.charge(order))
    .withRetry(retry)
    .withCircuitBreaker(breaker)
    .withFallback(List.of(CallNotPermittedException.class), e -> Receipt.pending(order))
    .decorate();
// In Spring Boot: @CircuitBreaker(name = "payments", fallbackMethod = "pending") on the method`,
            },
          },
          {
            name: "Caffeine",
            tag: "essential",
            what: "A high-performance in-process cache with size and time eviction and near-optimal hit rates.",
            when: "Local caching of hot data (Spring's @Cacheable uses it as a provider).",
            snippet: {
              lang: "java",
              code: `LoadingCache<Long, Product> products = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(Duration.ofMinutes(5))
    .recordStats()
    .build(id -> repository.findById(id).orElseThrow());

Product p = products.get(42L);    // loads once, then served from memory`,
            },
          },
          {
            name: "Bucket4j",
            what: "Token-bucket rate limiting, in memory or distributed (Redis, Hazelcast).",
            when: "Per-user or per-API-key rate limits.",
          },
        ],
      },
      {
        category: "Messaging & cloud",
        libs: [
          {
            name: "Apache Kafka clients / Spring for Apache Kafka",
            tag: "essential",
            what: "Producers, consumers and Kafka Streams; Spring Kafka adds @KafkaListener and KafkaTemplate.",
            when: "Event streaming between services. See the Kafka world for the deep dive.",
            snippet: {
              lang: "java",
              code: `@Component
class OrderEvents {
    private final KafkaTemplate<String, OrderPlaced> kafka;
    OrderEvents(KafkaTemplate<String, OrderPlaced> kafka) { this.kafka = kafka; }

    void publish(OrderPlaced e) {
        kafka.send("orders.placed", e.orderId(), e);      // key = order id keeps one order's events in order
    }

    @KafkaListener(topics = "payments.completed", groupId = "orders")
    void onPayment(PaymentCompleted p) { /* idempotent handling */ }
}`,
            },
          },
          {
            name: "Spring AMQP (RabbitMQ)",
            what: "RabbitTemplate and @RabbitListener for RabbitMQ.",
            when: "Task queues and routing-heavy messaging.",
          },
          {
            name: "AWS SDK for Java v2",
            tag: "popular",
            what: "Clients for S3, SQS, DynamoDB and every other AWS service, sync and async.",
            when: "Running on AWS. Spring Cloud AWS adds Spring-style integration.",
          },
        ],
      },
      {
        category: "Security",
        libs: [
          {
            name: "Spring Security",
            tag: "essential",
            what: "Authentication and authorization as a servlet filter chain: sessions, JWT resource servers, OAuth2 login, method security.",
            when: "Any Spring app with users or tokens. Steep learning curve, but don't roll your own.",
          },
          {
            name: "Nimbus JOSE + JWT / JJWT",
            what: "Create and verify JWTs (JWS/JWE).",
            when: "Issuing or validating tokens outside Spring Security (which uses Nimbus internally).",
          },
          {
            name: "Keycloak",
            what: "An open-source identity provider (OIDC, SAML, social login, MFA).",
            when: "When you need SSO and user management without writing it. Your app becomes an OAuth2 client or resource server.",
          },
          {
            name: "Bouncy Castle",
            what: "An extensive cryptography provider.",
            when: "Algorithms or formats the JDK lacks (some PGP, PKCS formats, newer curves).",
          },
        ],
      },
      {
        category: "CLI, files & documents",
        libs: [
          {
            name: "picocli",
            tag: "popular",
            what: "Annotation-based command-line parsing with help, subcommands, completion and GraalVM support.",
            when: "Any Java CLI tool.",
            snippet: {
              lang: "java",
              code: `@Command(name = "greet", mixinStandardHelpOptions = true, version = "1.0")
class Greet implements Callable<Integer> {
    @Parameters(index = "0", description = "who to greet") String name;
    @Option(names = {"-n", "--times"}, defaultValue = "1") int times;

    public Integer call() {
        for (int i = 0; i < times; i++) System.out.println("Hello, " + name);
        return 0;
    }

    public static void main(String[] args) { System.exit(new CommandLine(new Greet()).execute(args)); }
}`,
            },
          },
          {
            name: "Apache POI",
            what: "Read and write Excel (.xlsx) and Word documents.",
            when: "Business reports and imports. FastExcel is a lighter option for large exports.",
          },
          {
            name: "Apache PDFBox / OpenPDF",
            what: "Create and parse PDFs (iText is powerful but AGPL or commercial).",
            when: "Invoices, reports, text extraction.",
          },
          {
            name: "jsoup",
            what: "HTML parser with CSS selectors.",
            when: "Scraping, sanitizing user HTML (Safelist), link extraction.",
          },
          {
            name: "ShedLock / Quartz / JobRunr",
            what: "Scheduled and background jobs: ShedLock keeps @Scheduled tasks from running on every instance; Quartz and JobRunr are full job schedulers.",
            when: "Cron-like work in a horizontally scaled service.",
          },
        ],
      },
      {
        category: "AI & LLMs",
        blurb: "Calling large language models from Java.",
        libs: [
          {
            name: "Spring AI",
            tag: "rising",
            what: "Spring's portable API for chat models, embeddings, vector stores, tool calling and RAG.",
            when: "Adding LLM features to a Spring Boot app with Spring-style configuration and observability.",
          },
          {
            name: "LangChain4j",
            tag: "rising",
            what: "A Java take on LangChain: AI services from interfaces, memory, RAG, tools, many providers.",
            when: "Framework-agnostic LLM apps (works with Quarkus, Spring or plain Java).",
          },
          {
            name: "Official provider SDKs",
            what: "Anthropic, OpenAI and Google publish Java SDKs (for example com.anthropic:anthropic-java).",
            when: "When you want the full, newest API surface of one provider without an abstraction layer.",
          },
        ],
      },
    ],
    interview: [
      {
        q: "How do you decide whether to add a third-party library?",
        a: "First check whether the JDK or the framework already covers it. Then weigh maintenance (release cadence, responsiveness, bus factor), adoption, compatibility with your Java and framework versions, license (avoid copyleft surprises like AGPL), security history, and transitive dependency size. Prefer libraries your framework already manages versions for. Wrap less common dependencies behind your own interface so they're easy to replace, and keep them patched with Dependabot or Renovate plus a vulnerability scanner.",
        freq: "common",
      },
      {
        q: "Jackson: how do you handle unknown fields, naming differences and dates?",
        a: "Unknown properties: configure the mapper with `FAIL_ON_UNKNOWN_PROPERTIES` disabled (Spring Boot's default) or annotate the class with `@JsonIgnoreProperties(ignoreUnknown = true)`, which makes clients tolerant of API additions. Naming: `@JsonProperty(\"first_name\")` per field or a global `PropertyNamingStrategies.SNAKE_CASE`. Dates: use `java.time` types and serialize as ISO-8601 strings (not timestamps); Jackson 2 needs the JavaTimeModule (Boot registers it), Jackson 3 supports java.time natively. Reuse one configured mapper; it's thread-safe.",
        freq: "common",
      },
      {
        q: "What's the N+1 query problem and how do you fix it?",
        a: "Loading a list of N entities and then lazily accessing an association on each triggers 1 query for the list plus N more, one per entity. It's invisible in code and devastating at scale. Fix by fetching what you need in one query: `join fetch` in JPQL, an `@EntityGraph` on the repository method, batch fetching (`@BatchSize` or `hibernate.default_batch_fetch_size`) to turn N queries into a few, or a DTO projection query. Detect it by logging SQL or counting statements in tests.",
        freq: "very-common",
      },
      {
        q: "Spring Boot vs Quarkus vs Micronaut?",
        a: "Spring Boot has the largest ecosystem, community and job market, with runtime auto-configuration and reflection (startup in seconds; Spring AOT and native images help). Quarkus and Micronaut move dependency injection and configuration to build time, giving millisecond startup and lower memory, especially as GraalVM native images, which matters for serverless and dense deployments. Quarkus builds on Jakarta/MicroProfile APIs and has great dev mode; Micronaut feels closer to Spring. Pick Spring Boot by default unless startup time and footprint are key requirements.",
        freq: "common",
      },
      {
        q: "How do you make calls to a flaky downstream service resilient?",
        a: "Set connect and read timeouts on every client. Retry only idempotent operations, with exponential backoff and jitter and a small attempt limit. Add a circuit breaker so a failing dependency fails fast instead of tying up threads, and a bulkhead (limited concurrency) so one dependency can't exhaust resources. Provide fallbacks (cached data, a default, a queued request). Resilience4j implements all of these; monitor breaker state and retry counts with Micrometer.",
      },
    ],
    quiz: [
      {
        q: "Which is the JDK's built-in modern HTTP client?",
        options: ["java.net.URLConnection", "java.net.http.HttpClient", "org.apache.http.HttpClient", "RestTemplate"],
        answer: 1,
        explain: "java.net.http.HttpClient (Java 11+) supports HTTP/2, async calls and timeouts.",
      },
      {
        q: "Which library runs a real PostgreSQL in Docker for your tests?",
        options: ["Mockito", "WireMock", "Testcontainers", "JMH"],
        answer: 2,
        explain: "Testcontainers manages throwaway containers for integration tests.",
      },
      {
        q: "What's the right tool for retries, circuit breakers and bulkheads?",
        options: ["Caffeine", "Resilience4j", "Guava", "Lombok"],
        answer: 1,
        explain: "Resilience4j provides composable fault-tolerance decorators.",
      },
      {
        q: "Which java.time type should you store to mark an exact moment, such as when an order was placed?",
        options: ["LocalDateTime", "LocalDate", "Instant", "Period"],
        answer: 2,
        explain: "Instant is a point on the UTC timeline; LocalDateTime has no zone and is ambiguous.",
      },
      {
        q: "What do Flyway and Liquibase do?",
        options: ["Cache queries", "Apply versioned database schema migrations", "Pool connections", "Generate DTOs"],
        answer: 1,
        explain: "They track and apply schema changes in order, the same way in every environment.",
      },
      {
        q: "Why choose Quarkus or Micronaut over Spring Boot?",
        options: ["More libraries", "Build-time DI for faster startup and lower memory", "They don't need a JVM at all", "They're the only ones supporting REST"],
        answer: 1,
        explain: "Doing work at build time pays off in startup time and footprint, especially with native images.",
      },
    ],
  },

  // ------------------------------------------------------------------ SPRING BOOT
  {
    id: "java-spring",
    stage: "Ecosystem",
    title: "Building REST APIs with Spring Boot",
    tagline: "Dependency injection, auto-configuration, controllers, validation, JPA repositories, transactions, error handling, configuration, testing and production readiness.",
    difficulty: "intermediate",
    minutes: 45,
    diagram: {
      title: "The life of a request in Spring MVC",
      nodes: [
        { id: "client", label: "Client", kind: "client", x: 90, y: 280, sub: "curl, browser, mobile app" },
        { id: "filters", label: "Servlet filters", kind: "gateway", x: 240, y: 280, sub: "security, CORS, tracing" },
        { id: "dispatcher", label: "DispatcherServlet", kind: "lb", x: 400, y: 280, sub: "the front controller" },
        { id: "controller", label: "@RestController", kind: "service", x: 570, y: 140, sub: "JSON → DTO, @Valid" },
        { id: "service", label: "@Service", kind: "service", x: 760, y: 140, sub: "@Transactional logic" },
        { id: "repo", label: "Repository", kind: "service", x: 760, y: 320, sub: "Spring Data JPA" },
        { id: "db", label: "PostgreSQL", kind: "db", x: 900, y: 470, sub: "via HikariCP pool" },
        { id: "advice", label: "@RestControllerAdvice", kind: "monitor", x: 570, y: 440, sub: "exception → ProblemDetail" },
      ],
      edges: [
        { from: "client", to: "filters", label: "HTTP request" },
        { from: "filters", to: "dispatcher" },
        { from: "dispatcher", to: "controller", label: "handler mapping" },
        { from: "controller", to: "service", label: "method call" },
        { from: "service", to: "repo" },
        { from: "repo", to: "db", label: "SQL" },
        { from: "controller", to: "advice", label: "exception", dashed: true },
        { from: "service", to: "advice", label: "exception", dashed: true },
        { from: "advice", to: "dispatcher", label: "error response", dashed: true },
      ],
      flows: [
        {
          name: "POST /api/bookmarks (happy path)",
          path: ["client", "filters", "dispatcher", "controller", "service", "repo", "db", "repo", "service", "controller", "dispatcher", "filters", "client"],
          steps: [
            "The request hits the embedded Tomcat server and passes through the filter chain: Spring Security checks the token, CORS headers are added, a trace id is assigned.",
            "The DispatcherServlet is the single entry point for every request. It asks the handler mappings which controller method matches POST /api/bookmarks.",
            "Argument resolvers build the method parameters: Jackson converts the JSON body into a CreateBookmark record and @Valid runs Bean Validation on it.",
            "The controller stays thin: it delegates to the service, which owns business rules. The call goes through a proxy that starts a database transaction (@Transactional).",
            "The service calls the repository, an interface whose implementation Spring Data generated at startup.",
            "Hibernate turns save() into an INSERT, using a connection borrowed from the HikariCP pool.",
            "The database returns the generated id; the entity is now managed and has its id.",
            "The repository returns the saved entity. When the service method returns, the proxy commits the transaction.",
            "The service maps the entity to a response DTO and returns it to the controller.",
            "The controller returns ResponseEntity.created(location).body(dto). An HttpMessageConverter (Jackson) writes it as JSON.",
            "The response travels back out through the filter chain, which can add headers (CORS, trace ids) on the way.",
            "201 Created, with a Location header and the JSON body, reaches the client.",
          ],
        },
        {
          name: "Validation fails (400)",
          path: ["client", "filters", "dispatcher", "controller", "advice", "dispatcher", "filters", "client"],
          steps: [
            "A request with a blank title arrives and passes the filters.",
            "The DispatcherServlet routes it to the controller method.",
            "@Valid fails before your method body even runs: Spring throws MethodArgumentNotValidException.",
            "The @RestControllerAdvice handler catches it and builds an RFC 9457 ProblemDetail listing each invalid field.",
            "The advice's return value is written as application/problem+json with status 400.",
            "The error response passes back through the filters like any other response.",
            "The client gets a consistent, machine-readable error. No stack trace leaks.",
          ],
        },
        {
          name: "Not found (404)",
          path: ["client", "filters", "dispatcher", "controller", "service", "repo", "db", "repo", "service", "advice", "dispatcher", "filters", "client"],
          steps: [
            "GET /api/bookmarks/999 arrives.",
            "It's routed to the get-by-id handler.",
            "The controller calls service.get(999).",
            "The service asks the repository with findById, which returns an Optional.",
            "Hibernate runs a SELECT by primary key.",
            "No row comes back.",
            "The repository returns Optional.empty().",
            "The service calls orElseThrow and throws BookmarkNotFoundException.",
            "The advice maps that exception to ProblemDetail with status 404.",
            "The response is written as application/problem+json.",
            "It passes back out through the filter chain.",
            "The client receives 404 with a clear detail message.",
          ],
        },
      ],
    },
    concept: `
## What Spring Boot gives you
**Spring Framework** is a container that creates your objects (**beans**) and wires them together (**dependency injection**), plus modules for web, data, security, messaging and more. **Spring Boot** adds:
- **Starters**: one dependency per capability (\`spring-boot-starter-webmvc\`, \`-data-jpa\`, \`-validation\`, \`-actuator\`, \`-security\`) with compatible versions managed for you.
- **Auto-configuration**: sees what's on the classpath and configures sensible defaults (Jackson on the classpath gives JSON converters; an H2 jar gives an in-memory datasource). Your own beans and properties override it.
- An **embedded server** (Tomcat by default): \`java -jar app.jar\` and it's running.
- **Externalized configuration**, **profiles**, **Actuator** health and metrics endpoints.

Spring Boot 4 (November 2025) is built on Spring Framework 7 and Jakarta EE 11, requires Java 17+, uses **Jackson 3** by default, split auto-configuration into smaller modules (hence the new \`spring-boot-starter-webmvc\` name), and adds built-in API versioning and null-safety annotations (JSpecify). Most code looks the same as in Boot 3.

## Dependency injection and beans
You declare **what** you need; Spring decides **how** to build it:
\`\`\`java
@Service
public class BookmarkService {
    private final BookmarkRepository repository;
    private final Clock clock;

    public BookmarkService(BookmarkRepository repository, Clock clock) {   // constructor injection
        this.repository = repository;
        this.clock = clock;
    }
}
\`\`\`
- **Stereotypes** mark classes for component scanning: \`@Component\`, \`@Service\`, \`@Repository\`, \`@Controller\`/\`@RestController\`, \`@Configuration\`.
- **\`@Bean\` methods** in a \`@Configuration\` class create beans for classes you don't own (a \`Clock\`, a configured \`RestClient\`).
- Prefer **constructor injection** (final fields, easy to test, no \`@Autowired\` needed with one constructor) over field injection.
- Beans are **singletons** by default: one shared instance, so keep them stateless.
- Spring wraps beans in **proxies** to add behavior (transactions, caching, security, async). Consequence: calling a \`@Transactional\` method **from the same class** bypasses the proxy and gets no transaction (*self-invocation* pitfall).

## The layers of a typical API
\`\`\`text
controller/   @RestController: HTTP only (paths, status codes, DTOs, validation)
service/      @Service: business logic and transactions
repository/   Spring Data interfaces: persistence
domain/       @Entity classes (persistence model)
dto/          records for requests and responses (the API contract)
\`\`\`
Never expose entities directly as API responses: the API contract and the database schema should evolve independently (and lazy associations explode during serialization).

## Controllers
\`\`\`java
@RestController
@RequestMapping("/api/bookmarks")
class BookmarkController {
    @GetMapping("/{id}")
    BookmarkResponse get(@PathVariable long id) { ... }

    @GetMapping
    PageResponse<BookmarkResponse> list(@RequestParam(defaultValue = "") String q,
                                        @RequestParam(defaultValue = "0") int page) { ... }

    @PostMapping
    ResponseEntity<BookmarkResponse> create(@Valid @RequestBody CreateBookmark body) { ... }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id) { ... }
}
\`\`\`
Use the right status codes: **200** OK, **201** Created (+ \`Location\` header), **204** No Content, **400** invalid input, **401** unauthenticated, **403** forbidden, **404** not found, **409** conflict, **422** semantic validation errors, **500** bug.

## Validation and errors
Annotate DTO record components with Bean Validation constraints (\`@NotBlank\`, \`@Size\`, \`@Email\`, \`@Pattern\`, \`@Positive\`) and put \`@Valid\` on the parameter. Handle exceptions **centrally** in a \`@RestControllerAdvice\`, returning **\`ProblemDetail\`** (RFC 9457 \`application/problem+json\`): a standard error shape with \`type\`, \`title\`, \`status\`, \`detail\` and custom properties.

## Data access with Spring Data JPA
Define an \`@Entity\`, then an interface extending \`JpaRepository<Entity, Id>\`; Spring generates the implementation, including queries derived from method names (\`findByTitleContainingIgnoreCase\`), paging (\`Pageable\`) and custom JPQL via \`@Query\`. Put \`@Transactional\` on **service** methods: everything inside commits or rolls back together, and \`readOnly = true\` for queries. Manage the schema with **Flyway** migrations, not \`ddl-auto=update\`.

## Configuration and profiles
\`\`\`yaml
# application.yml
app:
  page-size: 20
spring:
  datasource:
    url: \${DATABASE_URL:jdbc:h2:mem:bookmarks}   # env var with a default
\`\`\`
Bind groups of properties to a **record** with \`@ConfigurationProperties("app")\`. Profiles (\`application-prod.yml\`, activated with \`SPRING_PROFILES_ACTIVE=prod\`) override per environment. Secrets come from environment variables or a secret manager, never from committed files.

## Testing
- **Unit tests** for services with plain JUnit and Mockito (no Spring needed).
- **\`@SpringBootTest\`** starts the whole context; drive the web layer with **MockMvc** (no real network) and assert on JSON with \`jsonPath\`.
- **Slices** (\`@WebMvcTest\`, \`@DataJpaTest\`) load only part of the app for speed.
- **Testcontainers** with \`@ServiceConnection\` for a real Postgres.

## Production readiness
- **Actuator**: \`/actuator/health\` (liveness and readiness probes for Kubernetes), \`/actuator/metrics\`, \`/actuator/prometheus\`. Expose only what you need.
- **Virtual threads**: \`spring.threads.virtual.enabled=true\` makes Tomcat handle each request on a virtual thread.
- **Graceful shutdown** is on by default in recent Boot versions: in-flight requests finish before the app stops.
- **Containers**: \`./mvnw spring-boot:build-image\` builds an optimized OCI image with Buildpacks, or write a multi-stage Dockerfile. GraalVM **native images** start in tens of milliseconds.
- **Security**: add \`spring-boot-starter-security\` and configure a \`SecurityFilterChain\` bean (for APIs: stateless, JWT resource server).

The **Bookmarks API project** builds all of this, step by step.
`,
    keyPoints: [
      "Starters + auto-configuration + embedded server = a runnable service in minutes",
      "Use constructor injection; beans are singletons, so keep them stateless",
      "Proxies add transactions/caching/security; self-invocation bypasses them",
      "Controller (HTTP) → service (logic, @Transactional) → repository (data); DTOs at the edge",
      "Validate request records with @Valid; map exceptions to ProblemDetail in @RestControllerAdvice",
      "Spring Data JPA derives queries from method names; manage schema with Flyway",
      "Config in application.yml + env vars, per-environment profiles, @ConfigurationProperties records",
      "Actuator for health/metrics; spring.threads.virtual.enabled=true for virtual threads",
    ],
    code: [
      {
        title: "The application and a REST controller",
        noCheck: "needs Spring Boot; the Bookmarks API project builds it with Maven",
        variants: [
          {
            lang: "java",
            code: `package com.example.bookmarks;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication          // = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class BookmarksApplication {
    public static void main(String[] args) {
        SpringApplication.run(BookmarksApplication.class, args);
    }
}

// --- web/BookmarkController.java
@RestController
@RequestMapping("/api/bookmarks")
class BookmarkController {
    private final BookmarkService service;

    BookmarkController(BookmarkService service) {      // injected by Spring
        this.service = service;
    }

    @GetMapping("/{id}")
    BookmarkResponse get(@PathVariable long id) {
        return service.get(id);
    }

    @PostMapping
    ResponseEntity<BookmarkResponse> create(@Valid @RequestBody CreateBookmark body) {
        BookmarkResponse created = service.create(body);
        URI location = URI.create("/api/bookmarks/" + created.id());
        return ResponseEntity.created(location).body(created);      // 201 + Location header
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id) {
        service.delete(id);
    }
}

// --- web/dto: records are the API contract
record CreateBookmark(
    @NotBlank @Size(max = 2048) @Pattern(regexp = "https?://.+", message = "must be an http(s) URL") String url,
    @NotBlank @Size(max = 200) String title) {}

record BookmarkResponse(long id, String url, String title, Instant createdAt) {}`,
          },
        ],
        explain: `- \`@SpringBootApplication\` on the class in your root package scans that package and its sub-packages for components.
- The controller has **no business logic**: it translates HTTP to method calls and back.
- \`@Valid\` triggers the constraints on \`CreateBookmark\` before the method runs; failures become a 400 via the advice below.`,
      },
      {
        title: "Service, entity and repository",
        noCheck: "needs Spring Boot; the Bookmarks API project builds it with Maven",
        variants: [
          {
            lang: "java",
            code: `@Entity
@Table(name = "bookmark")
class Bookmark {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String url;
    private String title;
    private Instant createdAt;

    protected Bookmark() {}                     // JPA needs a no-arg constructor

    Bookmark(String url, String title, Instant createdAt) {
        this.url = url;
        this.title = title;
        this.createdAt = createdAt;
    }
    // getters ...
}

interface BookmarkRepository extends JpaRepository<Bookmark, Long> {
    Page<Bookmark> findByTitleContainingIgnoreCase(String text, Pageable pageable);   // derived query
}

@Service
class BookmarkService {
    private final BookmarkRepository repository;
    private final Clock clock;

    BookmarkService(BookmarkRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    BookmarkResponse create(CreateBookmark cmd) {
        Bookmark saved = repository.save(new Bookmark(cmd.url(), cmd.title().strip(), clock.instant()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    BookmarkResponse get(long id) {
        return repository.findById(id).map(this::toResponse).orElseThrow(() -> new BookmarkNotFoundException(id));
    }

    @Transactional
    void delete(long id) {
        if (!repository.existsById(id)) throw new BookmarkNotFoundException(id);
        repository.deleteById(id);
    }

    private BookmarkResponse toResponse(Bookmark b) {
        return new BookmarkResponse(b.getId(), b.getUrl(), b.getTitle(), b.getCreatedAt());
    }
}`,
          },
        ],
        explain: `- \`JpaRepository\` gives \`save\`, \`findById\`, \`findAll(Pageable)\`, \`deleteById\` and more, with no implementation code.
- Transactions belong on the **service**: a use case that touches several repositories commits or rolls back as one.
- Injecting a \`Clock\` bean (\`@Bean Clock clock() { return Clock.systemUTC(); }\`) keeps time testable.`,
      },
      {
        title: "Centralized error handling with ProblemDetail",
        noCheck: "needs Spring Boot; the Bookmarks API project builds it with Maven",
        variants: [
          {
            lang: "java",
            code: `class BookmarkNotFoundException extends RuntimeException {
    BookmarkNotFoundException(long id) { super("bookmark " + id + " not found"); }
}

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(BookmarkNotFoundException.class)
    ProblemDetail notFound(BookmarkNotFoundException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        pd.setTitle("Bookmark not found");
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalid(MethodArgumentNotValidException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "request body is invalid");
        Map<String, String> errors = new TreeMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> errors.put(f.getField(), f.getDefaultMessage()));
        pd.setProperty("errors", errors);
        return pd;
    }
}

// Response for POST {"url":"ftp://x","title":""}:
// HTTP/1.1 400   Content-Type: application/problem+json
// {"type":"about:blank","title":"Bad Request","status":400,"detail":"request body is invalid",
//  "instance":"/api/bookmarks","errors":{"title":"must not be blank","url":"must be an http(s) URL"}}`,
          },
        ],
      },
      {
        title: "Configuration: application.yml and typed properties",
        noCheck: "configuration files",
        variants: [
          {
            lang: "yaml",
            code: `# src/main/resources/application.yml (defaults, used in dev and tests)
spring:
  application:
    name: bookmarks
  datasource:
    url: jdbc:h2:mem:bookmarks;DB_CLOSE_DELAY=-1
  jpa:
    open-in-view: false            # don't keep DB sessions open during JSON rendering
  threads:
    virtual:
      enabled: true                # every request on a virtual thread
app:
  max-page-size: 50
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics

---
# src/main/resources/application-prod.yml (SPRING_PROFILES_ACTIVE=prod)
spring:
  datasource:
    url: \${DATABASE_URL}           # injected by the platform, never committed
    username: \${DATABASE_USER}
    password: \${DATABASE_PASSWORD}`,
          },
          {
            lang: "java",
            code: `@ConfigurationProperties("app")
record AppProperties(@DefaultValue("50") int maxPageSize) {}

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class BookmarksApplication { ... }

// anywhere: constructor-inject AppProperties props; props.maxPageSize()`,
          },
        ],
      },
      {
        title: "Declarative HTTP clients with @HttpExchange",
        noCheck: "needs Spring Boot and network access",
        variants: [
          {
            lang: "java",
            code: `@HttpExchange(url = "/users", accept = "application/vnd.github+json")
interface GitHubUsers {
    @GetExchange("/{login}")
    GitHubUser get(@PathVariable String login);

    @GetExchange("/{login}/repos")
    List<GitHubRepo> repos(@PathVariable String login, @RequestParam("per_page") int perPage);
}

record GitHubUser(String login, String name, int followers) {}
record GitHubRepo(String name, int stargazers_count) {}

@Configuration
class Clients {
    @Bean
    GitHubUsers gitHubUsers(RestClient.Builder builder) {
        RestClient rest = builder
            .baseUrl("https://api.github.com")
            .requestFactory(ClientHttpRequestFactoryBuilder.jdk()
                .withCustomizer(f -> f.setReadTimeout(Duration.ofSeconds(5)))
                .build())
            .build();
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(rest)).build()
            .createClient(GitHubUsers.class);             // Spring implements the interface
    }
}`,
          },
        ],
        explain: `- You write only an interface; Spring generates the HTTP calls, JSON mapping and error handling.
- Pass timeouts explicitly. Wrap the calls with Resilience4j for retries and circuit breaking.`,
      },
      {
        title: "Testing the API with MockMvc",
        noCheck: "needs Spring Boot; the Bookmarks API project runs this test with Maven",
        variants: [
          {
            lang: "java",
            code: `@SpringBootTest
class BookmarkApiTest {
    @Autowired WebApplicationContext context;
    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();   // full app, no real network
    }

    @Test
    void createsAndFetchesABookmark() throws Exception {
        String location = mvc.perform(post("/api/bookmarks")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"url": "https://spring.io", "title": "Spring"}"""))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Spring"))
            .andReturn().getResponse().getHeader("Location");

        mvc.perform(get(location))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.url").value("https://spring.io"));
    }

    @Test
    void rejectsInvalidInputWithProblemDetail() throws Exception {
        mvc.perform(post("/api/bookmarks").contentType(MediaType.APPLICATION_JSON).content("{\\"url\\": \\"nope\\", \\"title\\": \\"\\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors.title").value("must not be blank"));
    }
}`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "What is dependency injection and why does Spring use it?",
        a: "Dependency injection means an object receives its collaborators from outside (usually through its constructor) instead of creating them. The Spring container builds the object graph from bean definitions and injects dependencies. Benefits: loose coupling (depend on interfaces), easy testing (pass mocks or fakes), a single place to configure lifecycles and scopes, and the ability to wrap beans in proxies for cross-cutting concerns like transactions, caching and security. Constructor injection is preferred: dependencies are explicit, fields can be final, and the object is never half-built.",
        freq: "very-common",
      },
      {
        q: "How does Spring Boot auto-configuration work?",
        a: "Boot ships auto-configuration classes listed in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`. Each is a `@Configuration` guarded by conditions: `@ConditionalOnClass` (a library is on the classpath), `@ConditionalOnMissingBean` (you haven't defined your own), `@ConditionalOnProperty`, and so on. So adding a starter brings in a library, the matching auto-configuration activates, and defining your own bean or property overrides the default. Run with `--debug` (or check the `/actuator/conditions` endpoint) to see the condition evaluation report.",
        freq: "very-common",
      },
      {
        q: "How does @Transactional work, and what are its pitfalls?",
        a: "Spring wraps the bean in a proxy; calling a `@Transactional` method through the proxy begins (or joins, per propagation) a transaction, commits when the method returns, and rolls back on unchecked exceptions (not on checked ones unless `rollbackFor` is set). Pitfalls: **self-invocation** (calling the method from the same class bypasses the proxy), annotations on private methods are ignored, catching an exception inside means no rollback, long transactions hold locks and connections (don't call remote APIs inside them), and lazy-loading outside the transaction throws `LazyInitializationException`. Use `readOnly = true` for queries.",
        freq: "very-common",
      },
      {
        q: "What are bean scopes?",
        a: "`singleton` (default): one instance per container, shared, so it must be stateless or thread-safe. `prototype`: a new instance every time it's requested. Web scopes: `request` (one per HTTP request), `session`, `application`, and `websocket`. Injecting a shorter-lived bean into a singleton requires a scoped proxy or an `ObjectProvider`.",
        freq: "common",
      },
      {
        q: "@Component vs @Service vs @Repository vs @Controller?",
        a: "All are stereotypes picked up by component scanning, and functionally `@Service` is just a `@Component`. They communicate intent and enable layer-specific behavior: `@Repository` translates persistence exceptions into Spring's `DataAccessException` hierarchy; `@Controller` marks web handlers (and `@RestController` adds `@ResponseBody`, writing return values as the response body, typically JSON). `@Configuration` marks classes with `@Bean` factory methods.",
        freq: "common",
      },
      {
        q: "How do you handle errors consistently in a Spring REST API?",
        a: "Throw meaningful exceptions from services (`NotFound`, `Conflict`, validation) and map them in a single `@RestControllerAdvice` with `@ExceptionHandler` methods returning `ProblemDetail` (RFC 9457), optionally extending `ResponseEntityExceptionHandler` to cover Spring MVC's own exceptions; enable `spring.mvc.problemdetails.enabled`. Include field-level validation errors as properties, log unexpected exceptions once with a correlation id, and never return stack traces to clients.",
        freq: "common",
      },
      {
        q: "What is the open-session-in-view anti-pattern?",
        a: "Spring Boot by default keeps the JPA session open for the whole web request (`spring.jpa.open-in-view=true`, with a startup warning), so lazy associations can load during JSON serialization in the controller. It hides N+1 queries, holds a database connection for the entire request (hurting throughput), and couples the web layer to persistence. Disable it, fetch what you need in the service within a transaction, and map to DTOs before leaving the service.",
      },
    ],
    quiz: [
      {
        q: "Which annotation combines @Configuration, @EnableAutoConfiguration and @ComponentScan?",
        options: ["@SpringApplication", "@SpringBootApplication", "@EnableSpring", "@BootConfiguration"],
        answer: 1,
        explain: "@SpringBootApplication is the meta-annotation on your main class.",
      },
      {
        q: "A @Transactional method is called from another method in the same class. What happens?",
        options: ["A new transaction starts", "No transaction is applied: the call bypasses the proxy", "It throws an exception", "It joins the caller's transaction automatically"],
        answer: 1,
        explain: "Self-invocation skips the Spring proxy that implements @Transactional.",
      },
      {
        q: "Which status code fits a successful POST that created a resource?",
        options: ["200", "201 with a Location header", "204", "302"],
        answer: 1,
        explain: "201 Created, with Location pointing to the new resource.",
      },
      {
        q: "What does @Valid on a @RequestBody parameter do?",
        options: ["Checks the JSON syntax", "Runs Bean Validation constraints and rejects invalid input with 400", "Validates the database", "Encrypts the body"],
        answer: 1,
        explain: "Constraint violations raise MethodArgumentNotValidException before your method runs.",
      },
      {
        q: "What's the default scope of a Spring bean?",
        options: ["prototype", "request", "singleton", "session"],
        answer: 2,
        explain: "One shared instance per application context.",
      },
      {
        q: "Where do database credentials for production belong?",
        options: ["application.yml committed to git", "Hard-coded in a @Bean", "Environment variables or a secret manager", "The README"],
        answer: 2,
        explain: "Keep secrets out of the repo; application-prod.yml only references environment variables like DATABASE_URL.",
      },
    ],
  },
];
