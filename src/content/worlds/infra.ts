import type { World } from "../types";
import { infraPart2 } from "./infra-2";

export const infra: World = {
  id: "infra",
  order: 8,
  title: "Container Harbor",
  subtitle: "Networking, Linux, containers, Kubernetes, CI/CD, cloud, observability & SRE",
  description:
    "Where code meets production: the networks, kernels, containers, orchestrators, pipelines and on-call practices underneath every distributed system. This is what DevOps, SRE and platform-engineering interviews are made of, and senior backend loops expect it too.",
  emoji: "⚓",
  color: "#ea580c",
  boss: {
    name: "The CrashLoop Kraken",
    title: "Devourer of Pods",
    emoji: "🐙",
    taunt: "Eight tentacles, eight failing health checks. Your pods restart, I squeeze harder. CrashLoopBackOff forever!",
    defeat: "Readiness probes passing… rollout complete… the pager is silent. I sink back to the depths!",
  },
  lessons: [
    // ------------------------------------------------------------------ URL JOURNEY
    {
      id: "url-journey",
      title: "What Happens When You Type a URL",
      tagline: "The classic warm-up: DNS, TCP, TLS, HTTP, servers and rendering, layer by layer.",
      difficulty: "beginner",
      minutes: 15,
      visualizers: ["handshake"],
      concept: `
## Why interviewers love this question
It has no single answer. It's a tour of every layer of the stack, and the interviewer pushes wherever they want to see depth. Structure your answer as a timeline, keep each step to a sentence, then go deep when asked.

## 1. The browser
- **Parse the input**: is it a URL or a search? Add the scheme.
- **HSTS**: if the domain is on the HSTS preload list (or sent \`Strict-Transport-Security\` before), the browser upgrades to HTTPS without ever trying HTTP.
- **Caches first**: a service worker may answer, or the HTTP cache may hold a fresh copy (\`Cache-Control: max-age\`). A cached response skips the network entirely.

## 2. DNS: name → IP address
Browser cache → OS cache (and \`/etc/hosts\`) → the **recursive resolver** (ISP, 1.1.1.1, 8.8.8.8). On a miss, the resolver walks the hierarchy: a **root** server says who runs \`.com\`, the **TLD** server says who is authoritative for \`example.com\`, and the **authoritative** server returns the record. Every answer carries a **TTL**, and resolvers cache it.
- Records: **A** (IPv4), **AAAA** (IPv6), **CNAME** (alias), **NS** (delegation), **MX** (mail), **TXT** (verification, SPF).
- **GeoDNS** returns different IPs per region; **anycast** announces the same IP from many locations, and BGP routes you to the nearest one (that's how the 13 root server names are served from 1,000+ sites).

## 3. TCP: a reliable connection
Three-way handshake **SYN → SYN-ACK → ACK** costs one round trip. The connection is identified by the 4-tuple (src IP, src port, dst IP, dst port). The client's port is a random **ephemeral** port.

## 4. TLS: encryption and identity
- The **ClientHello** carries **SNI** (which hostname, so one IP can serve many certificates) and **ALPN** (which protocol: \`h2\`, \`http/1.1\`).
- The server proves its identity with a **certificate chain** that the browser verifies up to a trusted root CA, checking the hostname and expiry.
- Key exchange (ECDHE) gives **forward secrecy**. **TLS 1.3** needs one round trip (1.2 needed two), and resumed sessions can use **0-RTT**.

## 5. HTTP
The request (\`GET / HTTP/2\`, headers, cookies) goes out. **HTTP/2** multiplexes many requests as streams over one connection. **HTTP/3** runs over **QUIC** (UDP), which merges the transport and TLS handshakes and avoids TCP's head-of-line blocking. Use the visualizer to count round trips for each.

## 6. The server side
Typically: **CDN edge** (may answer from cache) → **load balancer** (L4/L7, TLS termination) → **reverse proxy / API gateway** → **application server** → caches and databases → response. Each hop adds latency and a place to fail, which is why the rest of this world exists.

## 7. Rendering
The browser parses HTML into the **DOM**, CSS into the **CSSOM**, combines them into the render tree, then **layout → paint → composite**. Scripts can block parsing (\`defer\`/\`async\` help). Every subresource (CSS, JS, images, fonts) repeats much of this journey, mostly on the already-open connection.

## Where the time goes
| Step | Typical cost |
|---|---|
| DNS (cached / uncached) | 0 / 20–100 ms |
| TCP handshake | 1 RTT |
| TLS 1.3 / 1.2 | 1 / 2 RTT |
| HTTP request → first byte | 1 RTT + server time |
| QUIC + TLS (HTTP/3) | 1 RTT total, 0 on resumption |

At 100 ms RTT (a phone far from the server), setup alone can take 300–400 ms. That's why CDNs (shorter RTT), connection reuse, TLS 1.3 and HTTP/3 matter.
`,
      keyPoints: [
        "Answer as a timeline: browser → DNS → TCP → TLS → HTTP → server stack → rendering.",
        "DNS walks root → TLD → authoritative, and every answer is cached for its TTL.",
        "TCP costs 1 RTT, TLS 1.2 costs 2 and TLS 1.3 costs 1. QUIC merges them into 1 (0 on resumption).",
        "SNI picks the certificate and ALPN picks the protocol, both inside the ClientHello.",
        "Latency is dominated by round trips, so shorten them (CDN) or remove them (reuse, TLS 1.3, QUIC).",
      ],
      code: [
        {
          title: "Measure every phase from your terminal",
          note: "curl's timing variables split a request into DNS, connect, TLS and first byte.",
          variants: [
            {
              lang: "bash",
              code: `
# Where does the time go?
curl -so /dev/null -w '
dns lookup:   %{time_namelookup}s
tcp connect:  %{time_connect}s
tls done:     %{time_appconnect}s
first byte:   %{time_starttransfer}s
total:        %{time_total}s
http version: %{http_version}
' https://example.com

# Walk DNS from the root servers down, like a cold resolver
dig +trace www.example.com

# Inspect the certificate chain, SNI and the ALPN-negotiated protocol
openssl s_client -connect example.com:443 -servername example.com -alpn h2,http/1.1 </dev/null \\
  | grep -E 'subject=|issuer=|ALPN|Protocol'

# Try HTTP/3 (needs a curl built with QUIC support)
curl --http3 -sI https://cloudflare.com | head -1
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What happens when you type google.com into a browser and press Enter?",
          a: "Give a layered timeline. **Browser**: parse the input, HSTS forces HTTPS, check the service worker and HTTP cache. **DNS**: browser → OS → recursive resolver → root → .com TLD → authoritative, which returns an A/AAAA record (often a GeoDNS or anycast address of a nearby edge), cached per TTL. **TCP**: SYN, SYN-ACK, ACK. **TLS 1.3**: ClientHello with SNI and ALPN, the server's certificate chain is validated, ECDHE keys are derived, one round trip. **HTTP/2** (or HTTP/3 over QUIC) GET with cookies. **Server side**: edge/CDN → load balancer → reverse proxy → app servers → cache/DB, and the response is compressed and returned. **Rendering**: DOM + CSSOM → layout → paint → composite, with subresources fetched over the same connection. Then offer to go deeper on any step.",
          freq: "very-common",
        },
        {
          q: "How does DNS resolution work, and what is a TTL?",
          a: "A stub resolver on your machine asks a **recursive resolver**. On a cache miss it queries a **root** server (which delegates to the TLD's nameservers), then the **TLD** server (which delegates to the domain's nameservers), then the **authoritative** server, which returns the record. Each response has a **TTL**, how long resolvers may cache it. Low TTLs (30–60 s) allow fast failover and traffic shifting at the cost of more queries; high TTLs reduce load and latency but slow down changes. Note that some clients ignore TTLs, so plan migrations by lowering the TTL well in advance.",
          freq: "very-common",
        },
        {
          q: "Why is TLS 1.3 faster than TLS 1.2?",
          a: "TLS 1.2 needs two round trips: negotiate the cipher and certificate, then exchange keys. TLS 1.3 removed legacy key exchanges, so the client **guesses the group and sends its key share in the ClientHello**. The server replies with its share, certificate and Finished in one flight: **1-RTT**. With session resumption it supports **0-RTT**, sending the request in the first flight. 0-RTT data can be replayed, so it's only safe for idempotent requests. TLS 1.3 also mandates forward secrecy and encrypts more of the handshake.",
          freq: "common",
        },
        {
          q: "What are SNI and ALPN?",
          a: "Both are TLS ClientHello extensions. **SNI** (Server Name Indication) tells the server which hostname the client wants, so one IP address can host many sites with different certificates (essential for CDNs and shared load balancers). **ALPN** (Application-Layer Protocol Negotiation) lets client and server agree on the protocol (h2, http/1.1) during the handshake without an extra round trip. SNI is visible to observers, and Encrypted Client Hello (ECH) is the fix.",
          freq: "occasional",
        },
        {
          q: "A page is slow for users in Australia but fast in the US. What do you look at?",
          a: "Round trips. At ~200 ms RTT, DNS + TCP + TLS + request can take close to a second before the first byte, and every extra sequential request adds more. Check: is static content on a **CDN** with Australian POPs? Is TLS terminated at the edge (so handshakes are short)? Are connections reused, and is HTTP/2 or HTTP/3 enabled? Are there redirect chains, or sequential API calls that could be batched or parallelized? For dynamic data, consider a regional deployment or edge caching. Measure with RUM data split by country, not just synthetic checks from one region.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which DNS server returns the final answer for www.example.com on a cold lookup?",
          options: ["A root server", "The .com TLD server", "example.com's authoritative nameserver", "The browser"],
          answer: 2,
          explain: "Root and TLD servers only delegate. The authoritative server holds the records.",
        },
        {
          q: "Round trips needed before the first HTTP byte with TCP + TLS 1.3 (no resumption, DNS cached)?",
          options: ["1", "2", "3", "4"],
          answer: 2,
          explain: "TCP 1 + TLS 1 + request/response 1 = 3. With TLS 1.2 it's 4.",
        },
        {
          q: "What lets one IP address serve HTTPS for thousands of different domains?",
          options: ["ALPN", "SNI", "HSTS", "OCSP"],
          answer: 1,
          explain: "SNI tells the server which hostname, and therefore which certificate, the client wants.",
        },
        {
          q: "Why is 0-RTT data limited to idempotent requests?",
          options: ["It isn't encrypted", "An attacker can replay it", "It's too small", "It skips certificate checks"],
          answer: 1,
          explain: "0-RTT data has no fresh server randomness in it, so it can be captured and replayed.",
        },
        {
          q: "HSTS causes the browser to…",
          options: ["Cache DNS longer", "Always use HTTPS for the domain", "Use HTTP/3", "Skip certificate validation"],
          answer: 1,
          explain: "Strict-Transport-Security (or the preload list) makes the browser never try plain HTTP.",
        },
      ],
    },

    // ------------------------------------------------------------------ TCP / UDP / HTTP
    {
      id: "tcp-udp-http",
      title: "TCP, UDP & HTTP/1.1 → 2 → 3",
      tagline: "Reliability, congestion control, head-of-line blocking and why HTTP/3 moved to UDP.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["congestion"],
      concept: `
## TCP's promises (and their costs)
TCP gives applications a **reliable, ordered byte stream**:
- **Sequence numbers + ACKs + retransmission** for reliability and ordering.
- **Flow control**: the receiver advertises a window (\`rwnd\`) so a fast sender can't overrun a slow reader.
- **Congestion control**: the sender limits itself (\`cwnd\`) so it doesn't overrun the *network*.
- **Connection lifecycle**: 3-way handshake to open, FIN/ACK to close. The side that closes first sits in **TIME_WAIT** for 2×MSL (60 s on Linux) so stray packets can't corrupt a new connection on the same 4-tuple. Lots of short outbound connections → thousands of TIME_WAIT sockets → ephemeral port exhaustion. Reuse connections.

## UDP
Just datagrams: no handshake, no ordering, no retransmission, no congestion control. Applications add what they need. Used for **DNS**, **VoIP/video/games** (a late packet is useless anyway), **QUIC**, metrics (StatsD), and multicast.

## Congestion control (step through the visualizer)
- **Slow start**: cwnd starts small (10 segments today) and **doubles every RTT** until it hits \`ssthresh\` or a loss.
- **Congestion avoidance**: +1 segment per RTT (**additive increase**).
- **Loss** = congestion signal → **multiplicative decrease**. On 3 duplicate ACKs, Reno halves cwnd (fast retransmit + fast recovery). On a timeout, everything resets to 1.
- This **AIMD** sawtooth is fair between flows and stable.
- **CUBIC** (Linux default) grows as a cubic function of time since the last loss: faster on high bandwidth-delay paths. **BBR** (Google) models bottleneck bandwidth and RTT instead of reacting to loss, which helps on lossy links (Wi-Fi, mobile) and avoids filling buffers (bufferbloat).

## Bandwidth-delay product
To keep a pipe full you need **BDP = bandwidth × RTT** bytes in flight. 1 Gbps × 100 ms = 12.5 MB. If windows (or socket buffers) are smaller, throughput is capped at window ÷ RTT, no matter how fat the link is. That's why long-distance transfers are slow and why tuning \`tcp_rmem\`/\`tcp_wmem\` matters.

## Small-packet gotchas
**Nagle's algorithm** delays small writes to batch them; the receiver's **delayed ACK** waits up to ~40 ms to piggyback. Together they cause mysterious 40 ms stalls in request/response protocols. Set \`TCP_NODELAY\` for latency-sensitive traffic (most RPC frameworks do).

## HTTP's evolution
| Version | Transport | Key ideas | Problem left |
|---|---|---|---|
| HTTP/1.0 | TCP | one request per connection | handshake per request |
| HTTP/1.1 | TCP | **keep-alive**, chunked encoding, Host header | one in-flight request per connection, so browsers open ~6 |
| HTTP/2 | TCP + TLS | binary framing, **multiplexed streams**, HPACK header compression, priorities | **TCP head-of-line blocking**: one lost packet stalls all streams |
| HTTP/3 | **QUIC** over UDP | per-stream loss recovery, 1-RTT/0-RTT handshake, **connection migration**, QPACK | UDP sometimes throttled, more CPU in user space |

QUIC lives in user space, so it evolves without kernel upgrades. It identifies connections by **connection ID** rather than the 4-tuple, so a phone switching from Wi-Fi to 4G keeps its connection.

## Real-time patterns on top of HTTP
- **Polling**: simple, wasteful. **Long polling**: the server holds the request until data arrives.
- **Server-Sent Events**: one-way server → client stream over HTTP, with automatic reconnect.
- **WebSockets**: an HTTP Upgrade to a full-duplex TCP channel (chat, games, collaboration). Stateful connections complicate load balancing and deploys.
- **gRPC**: protobuf over HTTP/2 streams, with unary and bidirectional streaming. Great between services, but needs gRPC-Web or a proxy in browsers.
`,
      keyPoints: [
        "TCP = reliable ordered stream with flow control (rwnd) and congestion control (cwnd).",
        "Slow start doubles per RTT. AIMD adds 1 per RTT and halves on loss.",
        "Throughput ≤ window ÷ RTT, and filling a path needs a window of bandwidth × RTT.",
        "HTTP/2 multiplexes over one TCP connection, which brings TCP head-of-line blocking.",
        "HTTP/3 = QUIC over UDP: independent streams, faster handshakes, connection migration.",
        "TIME_WAIT and per-request connections exhaust ephemeral ports, so pool connections.",
      ],
      code: [
        {
          title: "TCP vs UDP sockets",
          note: "TCP needs listen/accept and gives you a stream. UDP just sends datagrams.",
          variants: [
            {
              lang: "python",
              code: `
import socket

# TCP echo server: connection-oriented, reliable byte stream
def tcp_server(port=9000):
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # rebind despite TIME_WAIT
    srv.bind(("0.0.0.0", port))
    srv.listen(128)                      # backlog of completed handshakes
    while True:
        conn, addr = srv.accept()        # one socket per client 4-tuple
        conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)  # no Nagle delay
        with conn:
            while data := conn.recv(4096):   # a stream: message boundaries are YOUR job
                conn.sendall(data)

# UDP echo server: no connection, each datagram stands alone
def udp_server(port=9001):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", port))
    while True:
        data, addr = sock.recvfrom(65535)    # may be lost, duplicated or reordered
        sock.sendto(data, addr)
`,
            },
            {
              lang: "go",
              code: `
package main

import (
	"io"
	"net"
)

func main() {
	ln, _ := net.Listen("tcp", ":9000")
	for {
		conn, err := ln.Accept()
		if err != nil {
			continue
		}
		go func(c net.Conn) { // one goroutine per connection
			defer c.Close()
			io.Copy(c, c) // echo the byte stream back
		}(conn)
	}
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "TCP vs UDP: when would you choose each?",
          a: "**TCP** when you need every byte, in order: web, APIs, databases, file transfer. You pay a handshake, head-of-line blocking and retransmission delays. **UDP** when timeliness beats completeness or you want to build your own reliability: live video/voice and games (a retransmitted frame arrives too late to matter), DNS (one small request/response, retry at the app level), and QUIC/HTTP/3, which implements reliability and congestion control per stream in user space. UDP has no congestion control of its own, so a UDP app must be careful not to flood the network.",
          freq: "very-common",
        },
        {
          q: "Explain TCP congestion control.",
          a: "The sender keeps a congestion window (cwnd) limiting unacknowledged data. **Slow start**: begin small (10 segments) and double each RTT until reaching ssthresh or seeing loss. **Congestion avoidance**: grow by one segment per RTT. On loss (3 duplicate ACKs), Reno sets ssthresh = cwnd/2 and continues from there (**fast recovery**). On a retransmission timeout, cwnd drops to 1. This AIMD behavior converges to a fair share. Modern stacks use **CUBIC** (more aggressive growth on high-BDP paths) or **BBR**, which estimates bottleneck bandwidth and min RTT and paces at that rate instead of waiting for loss.",
          freq: "common",
        },
        {
          q: "What problem does HTTP/2 solve, and what problem does HTTP/3 solve that HTTP/2 doesn't?",
          a: "HTTP/1.1 allows one outstanding request per connection, so browsers opened ~6 connections per host and developers bundled and sharded domains. **HTTP/2** multiplexes many concurrent streams over a single connection with binary framing and header compression. But it all rides one TCP byte stream: one lost packet blocks every stream until it's retransmitted (**TCP head-of-line blocking**), which hurts on lossy mobile networks. **HTTP/3** runs on QUIC over UDP: streams are independent at the transport layer, the handshake is combined with TLS 1.3 (1-RTT, 0-RTT on resume), and connections migrate across networks.",
          freq: "common",
        },
        {
          q: "What is TIME_WAIT and when does it become a problem?",
          a: "After a TCP connection closes, the side that sent the first FIN keeps the 4-tuple in TIME_WAIT for 2×MSL (60 s on Linux) so delayed packets from the old connection aren't mistaken for a new one and the final ACK can be retransmitted. It becomes a problem when a client opens many short-lived connections to the **same destination IP:port**: each needs a unique ephemeral port (~28k by default), so at a few hundred new connections per second you run out (`cannot assign requested address`). Fix it with **keep-alive / connection pooling**. Mitigate with a wider `ip_local_port_range`, `tcp_tw_reuse`, or more destination IPs.",
          freq: "common",
        },
        {
          q: "Why can't a single TCP connection use all of a 10 Gbps transatlantic link?",
          a: "Throughput ≤ window ÷ RTT. At 80 ms RTT, filling 10 Gbps needs 10e9/8 × 0.08 = **100 MB** in flight (the bandwidth-delay product). Default socket buffers and receive windows are far smaller, and any loss halves cwnd, which then takes many RTTs to regrow. Fixes: larger buffers / window scaling, BBR, or **parallel streams** (many tools split transfers across connections).",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "During TCP slow start, cwnd…",
          options: ["Grows by 1 segment per RTT", "Doubles every RTT", "Stays constant", "Halves every RTT"],
          answer: 1,
          explain: "Each ACK adds a segment, so the window doubles per round trip until ssthresh or loss.",
        },
        {
          q: "TCP head-of-line blocking hurts HTTP/2 because…",
          options: ["Headers are compressed", "All streams share one ordered TCP byte stream", "It uses UDP", "It needs 6 connections"],
          answer: 1,
          explain: "A lost packet must be retransmitted before TCP delivers any later bytes, so every stream waits.",
        },
        {
          q: "Max throughput of one TCP flow with a 1 MB window and 100 ms RTT?",
          options: ["~1 MB/s", "~10 MB/s", "~100 MB/s", "Unlimited"],
          answer: 1,
          explain: "window ÷ RTT = 1 MB / 0.1 s = 10 MB/s.",
        },
        {
          q: "Which uses UDP?",
          options: ["SSH", "HTTP/2", "QUIC / HTTP/3", "PostgreSQL wire protocol"],
          answer: 2,
          explain: "QUIC implements reliability and congestion control on top of UDP.",
        },
        {
          q: "Mysterious 40 ms delays on small request/response messages are often caused by…",
          options: ["DNS caching", "Nagle's algorithm + delayed ACKs", "TLS 1.3", "Jumbo frames"],
          answer: 1,
          explain: "Nagle waits for an ACK before sending a small segment, while the receiver delays its ACK. Use TCP_NODELAY.",
        },
        {
          q: "QUIC connections survive switching from Wi-Fi to 4G because they are identified by…",
          options: ["The 4-tuple", "A connection ID", "The MAC address", "The TLS certificate"],
          answer: 1,
          explain: "The IP changes, but the connection ID stays the same.",
        },
      ],
    },

    // ------------------------------------------------------------------ IP / SUBNETS / VPC
    {
      id: "ip-subnets-vpc",
      title: "IP Addressing, Subnets, NAT & VPCs",
      tagline: "CIDR math, routing, NAT and designing a cloud network that won't paint you into a corner.",
      difficulty: "intermediate",
      minutes: 15,
      visualizers: ["cidr"],
      concept: `
## IPv4 and CIDR
An IPv4 address is 32 bits, written as four octets. **CIDR** notation \`10.0.0.0/16\` means "the first 16 bits are the network, the remaining 16 identify hosts", so 2¹⁶ = 65,536 addresses. Every extra prefix bit halves the block: /24 = 256, /28 = 16, /32 = one address.
- **Netmask**: /24 = 255.255.255.0. An IP is in a subnet iff \`(ip AND mask) == network\`.
- The first address is the network and the last is the broadcast, so a /24 has 254 usable hosts. Clouds reserve more (**AWS: 5 per subnet**).

## Special ranges you must know
| Range | Meaning |
|---|---|
| 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 | **Private** (RFC 1918), not routed on the internet |
| 100.64.0.0/10 | Carrier-grade NAT |
| 127.0.0.0/8 | Loopback |
| 169.254.0.0/16 | Link-local (cloud instance metadata at 169.254.169.254) |
| 0.0.0.0/0 | "Everything": the default route |

## Routing
Each host and router has a routing table. A packet goes to the **longest matching prefix**: \`10.0.1.0/24\` beats \`10.0.0.0/16\`, which beats the default \`0.0.0.0/0\`. Within a subnet, **ARP** maps IPs to MAC addresses. Between networks, routers forward hop by hop. On the internet, **BGP** exchanges routes between autonomous systems (and BGP mistakes cause some of the largest outages).

## NAT
Private addresses aren't routable, so a **NAT** device rewrites the source IP (and port) of outbound packets to its public IP and tracks the mapping to translate replies. Consequences: hosts behind NAT can initiate connections but can't be reached unsolicited; one public IP serves thousands of connections through port translation (with ~64k ports per destination as a limit); and the NAT is a stateful choke point, so cloud NAT gateways are per-AZ and cost per GB. **IPv6** (128 bits, /64 per subnet) has enough addresses that NAT is unnecessary; firewalls do the protecting.

## Designing a VPC
A typical production layout per region:
- One VPC, e.g. \`10.0.0.0/16\`. Choose ranges that **won't overlap** with other VPCs, on-prem networks or partner networks you may peer with later. Overlaps make peering and VPNs impossible.
- **Public subnets** (one per AZ) hold load balancers and NAT gateways and route \`0.0.0.0/0\` to an **internet gateway**.
- **Private subnets** (one per AZ) hold app servers and databases and route \`0.0.0.0/0\` to the NAT gateway for outbound-only internet access.
- Size generously: Kubernetes with VPC-native networking gives **every pod an IP from the subnet**, so a /24 fills up fast.
- **Security groups** are stateful, instance-level allow lists (return traffic automatically allowed). **Network ACLs** are stateless, subnet-level, allow/deny rules evaluated in order (you must allow return ports). Reference security groups by ID ("app SG may reach DB SG on 5432") instead of IP ranges.
- Connect VPCs with **peering** (non-transitive) or a **transit gateway** (hub and spoke). Reach cloud services privately with **VPC endpoints / PrivateLink** instead of going through NAT.
- No SSH bastions if you can avoid them: use session managers (SSM, IAP) with audit logs.
`,
      keyPoints: [
        "/n leaves 32 − n host bits: /16 = 65,536 addresses, /24 = 256.",
        "Membership test: (ip AND mask) == network. Routing picks the longest prefix match.",
        "Know the RFC 1918 ranges, 169.254.169.254 (metadata) and 0.0.0.0/0 (default route).",
        "NAT lets private hosts reach out but not be reached, and it's stateful and finite.",
        "Plan non-overlapping CIDRs, public + private subnets per AZ, and room for pod IPs.",
        "Security groups are stateful and per instance. NACLs are stateless and per subnet.",
      ],
      code: [
        {
          title: "Subnet math with the standard library",
          variants: [
            {
              lang: "python",
              code: `
import ipaddress

vpc = ipaddress.ip_network("10.0.0.0/16")
print(vpc.num_addresses)            # 65536
print(vpc.netmask)                  # 255.255.0.0

# Carve /16 into four /18s: public-a, public-b, private-a, private-b
for name, sub in zip(["public-a", "public-b", "private-a", "private-b"], vpc.subnets(new_prefix=18)):
    hosts = list(sub.hosts())
    print(f"{name:10} {sub}  {hosts[0]} - {hosts[-1]}  ({sub.num_addresses} addrs)")

print(ipaddress.ip_address("10.0.137.20") in vpc)        # True
print(ipaddress.ip_address("10.0.137.20").is_private)   # True
print(vpc.overlaps(ipaddress.ip_network("10.0.128.0/17")))  # True: can't peer these
`,
            },
            {
              lang: "hcl",
              code: `
# Terraform: one VPC, public + private subnets in two AZs
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
}

locals {
  azs = ["us-east-1a", "us-east-1b"]
}

resource "aws_subnet" "public" {
  count                   = length(local.azs)
  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 2, count.index)     # 10.0.0.0/18, 10.0.64.0/18
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 2, count.index + 2)       # 10.0.128.0/18, 10.0.192.0/18
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How many usable hosts are in a /26, and what's its netmask?",
          a: "A /26 leaves 32 − 26 = 6 host bits → 2⁶ = **64 addresses**, minus network and broadcast = **62 usable** (59 in AWS, which reserves 5). Netmask: 26 ones = 255.255.255.**192** (the last octet is 11000000). Example: 10.0.1.64/26 spans 10.0.1.64–10.0.1.127.",
          freq: "common",
        },
        {
          q: "Design the network for a three-tier web app in the cloud.",
          a: "One VPC per environment with a non-overlapping range (e.g. 10.10.0.0/16 prod, 10.20.0.0/16 staging). In each of 2–3 AZs: a **public subnet** for the load balancer and NAT gateway, a **private app subnet** for the instances or Kubernetes nodes (sized for pod IPs), and a **private data subnet** for databases. Route tables: public → internet gateway; private → NAT gateway in the same AZ (so an AZ failure doesn't take out egress for the others). Security groups chain: LB SG allows 443 from the internet; app SG allows the app port only from the LB SG; DB SG allows 5432 only from the app SG. VPC endpoints for S3 and other services to avoid NAT costs. Flow logs on, no public IPs on app or DB instances, admin access via a session manager.",
          freq: "common",
        },
        {
          q: "What's the difference between a security group and a network ACL?",
          a: "**Security groups** attach to instances or ENIs, contain only *allow* rules, and are **stateful**: if inbound traffic is allowed, the response is automatically allowed out. They can reference other security groups. **Network ACLs** attach to subnets, have numbered *allow and deny* rules evaluated in order, and are **stateless**: you must explicitly allow return traffic (ephemeral ports). Use SGs as the main control, and NACLs for coarse subnet-wide denies (e.g. blocking a bad CIDR).",
          freq: "occasional",
        },
        {
          q: "How does NAT work and what are its limitations?",
          a: "Source NAT rewrites the private source IP:port of outgoing packets to the NAT's public IP and a chosen port, storing the mapping in a translation table so replies can be rewritten back. Limitations: inbound connections can't be initiated (good for security, bad for peer-to-peer, hence STUN/TURN); the table is **stateful**, so the NAT is a scaling and failure point; each public IP has ~64k ports **per destination**, so heavy egress to one endpoint needs multiple IPs; and protocols that embed IPs in payloads need helpers. Cloud NAT gateways also charge per GB, which is a common surprise cost.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "How many addresses are in 10.0.0.0/20?",
          options: ["1,024", "2,048", "4,096", "65,536"],
          answer: 2,
          explain: "32 − 20 = 12 host bits → 2¹² = 4,096.",
        },
        {
          q: "Is 10.0.70.5 inside 10.0.64.0/18?",
          options: ["Yes", "No"],
          answer: 0,
          explain: "A /18 starting at 10.0.64.0 covers 10.0.64.0–10.0.127.255.",
        },
        {
          q: "A router has routes 10.0.0.0/8, 10.1.0.0/16 and 0.0.0.0/0. A packet to 10.1.4.2 uses…",
          options: ["10.0.0.0/8", "10.1.0.0/16", "0.0.0.0/0", "All of them"],
          answer: 1,
          explain: "Longest prefix match: /16 is the most specific route that matches.",
        },
        {
          q: "Which range is NOT private (RFC 1918)?",
          options: ["10.20.0.0/16", "172.20.0.0/16", "192.168.5.0/24", "172.40.0.0/16"],
          answer: 3,
          explain: "The private block is 172.16.0.0/12, which covers 172.16–172.31 only.",
        },
        {
          q: "Security groups are…",
          options: ["Stateless and subnet-level", "Stateful and instance-level", "Stateless and instance-level", "Stateful and VPC-level"],
          answer: 1,
          explain: "Return traffic is allowed automatically, and they attach to network interfaces.",
        },
      ],
      problems: [
        { title: "Validate IP Address", url: "https://leetcode.com/problems/validate-ip-address/", difficulty: "Medium" },
        { title: "Restore IP Addresses", url: "https://leetcode.com/problems/restore-ip-addresses/", difficulty: "Medium" },
      ],
    },

    // ------------------------------------------------------------------ LINUX
    {
      id: "linux-troubleshooting",
      title: "Linux Internals & Troubleshooting",
      tagline: "Processes, memory, disks and sockets, plus the 60-second checklist SREs run first.",
      difficulty: "intermediate",
      minutes: 17,
      visualizers: ["incident"],
      concept: `
## Processes, threads and signals
- A **process** has its own virtual address space, file descriptors and PID. **Threads** share the address space.
- **Signals**: \`SIGTERM\` (15) asks politely and can be handled, so apps should finish in-flight work and exit. \`SIGKILL\` (9) can't be caught. \`SIGHUP\` often means "reload config". Kubernetes and systemd send SIGTERM, wait a grace period (30 s by default in k8s), then SIGKILL.
- **Zombies** are exited children whose parent never called \`wait()\`. **Orphans** get re-parented to PID 1. In containers, your app may *be* PID 1 (see the containers lesson).
- Process states in \`ps\`/\`top\`: **R** running, **S** sleeping (interruptible), **D** uninterruptible sleep (almost always waiting on I/O), **Z** zombie.

## File descriptors
Everything is a file: sockets, pipes, files. Each process has a limit (\`ulimit -n\`, often 1024 by default). "**Too many open files**" usually means a leak (sockets not closed) or a limit too low for a busy server. Check with \`ls /proc/PID/fd | wc -l\` and \`lsof -p PID\`.

## Memory
- **VSZ** (virtual size) is mostly meaningless. **RSS** is resident physical memory.
- Linux uses spare RAM as **page cache**. "free" memory being low is normal, so look at **available**.
- **Swap** trades RAM for disk latency, and many servers disable it.
- When memory runs out, the **OOM killer** picks a victim (highest \`oom_score\`) and kills it with SIGKILL, which shows as **exit code 137** (128 + 9). In containers, the **cgroup memory limit** triggers it even if the host has free RAM. Evidence: \`dmesg | grep -i oom\`, \`OOMKilled\` in \`kubectl describe pod\`.

## CPU
- **Load average** (1/5/15 min) = average number of tasks **running or waiting to run, plus tasks in D state**. Compare it to the core count. On Linux, high load with an idle CPU means I/O.
- \`top\`'s CPU split: **us** (user code), **sy** (kernel), **wa** (iowait: idle while waiting on disk), **st** (steal: the hypervisor gave your vCPU to someone else, a noisy neighbor), **si** (softirq, often network).
- High \`sy\` hints at syscalls, context switches or lock contention. High \`st\` means move hosts or instance types.

## Disk
- \`df -h\` shows space and \`df -i\` shows inodes (millions of tiny files can exhaust inodes with space left).
- **Deleted but open**: deleting a 50 GB log a process still writes to frees nothing until the process closes it. \`lsof +L1\` finds them. Truncate (\`: > file\`) instead of \`rm\`, or restart the process.
- \`iostat -x\`: **await** (ms per I/O), **aqu-sz** (queue depth), **%util** (busy time; misleading for SSDs and RAID that serve requests in parallel).

## Network
- \`ss -tanp\` lists sockets; \`ss -s\` summarizes states. Lots of **TIME_WAIT** → connection churn. A large **Recv-Q** on a listening socket → the app isn't calling accept() fast enough.
- **conntrack table full** (\`nf_conntrack: table full, dropping packet\`) silently drops new connections on busy NAT hosts and k8s nodes.
- \`dig\`, \`curl -v\`, \`tcpdump -i any port 53\` for DNS and HTTP. And yes, it's often DNS.

## Method beats tools
**USE method** (Brendan Gregg): for every resource (CPU, memory, disk, network, file descriptors), check **U**tilization, **S**aturation (queueing) and **E**rrors. The **60-second checklist**:
1. \`uptime\`: load trend 2. \`dmesg -T | tail\`: OOM kills, disk errors, conntrack drops 3. \`vmstat 1\`: run queue (r), blocked (b), swap, CPU split 4. \`mpstat -P ALL 1\`: one hot core? 5. \`pidstat 1\`: which process 6. \`iostat -xz 1\`: disk latency and saturation 7. \`free -m\` 8. \`sar -n DEV 1\`: network throughput 9. \`sar -n TCP,ETCP 1\`: connection rate, retransmits 10. \`top\`.

Then go deeper: \`strace -p\` (syscalls), \`perf top\` / flame graphs (CPU profiling), \`tcpdump\` (packets), eBPF tools (\`execsnoop\`, \`biolatency\`, \`tcpretrans\`). Use the drill to practice: form a hypothesis, run the one command that tests it, stop when the evidence is conclusive.
`,
      keyPoints: [
        "SIGTERM = graceful (handle it); SIGKILL = immediate; exit 137 = killed by SIGKILL, often OOM.",
        "Load average counts runnable + D-state tasks: high load with idle CPU means I/O wait.",
        "Look at 'available' memory, not 'free'; page cache is a feature.",
        "Deleted-but-open files keep their space until the process closes them.",
        "Use the USE method: utilization, saturation, errors for every resource.",
        "dmesg reveals OOM kills, disk errors and conntrack drops, so check it early.",
      ],
      code: [
        {
          title: "The 60-second triage, scripted",
          variants: [
            {
              lang: "bash",
              code: `
#!/usr/bin/env bash
# First minute on a misbehaving Linux host (after Brendan Gregg's checklist)
uptime                        # load averages vs nproc; rising or falling?
nproc
dmesg -T | tail -20           # OOM kills, I/O errors, "conntrack: table full"
vmstat 1 5                    # r = run queue, b = blocked on I/O, si/so = swapping, us/sy/id/wa/st
mpstat -P ALL 1 3             # one core pegged? (single-threaded bottleneck)
pidstat 1 3                   # which processes use the CPU
iostat -xz 1 3                # await (latency), aqu-sz (queue), %util per device
free -m                       # "available" is what matters
df -h; df -i                  # space and inodes
ss -s                         # socket states: TIME_WAIT storms, too many conns
sar -n TCP,ETCP 1 3           # new connections/s, retransmits

# Deeper dives
ps -eo pid,stat,pcpu,pmem,rss,cmd --sort=-pcpu | head      # top consumers, D-state processes
lsof +L1                                                    # deleted files still held open
ls /proc/$(pgrep -o java)/fd | wc -l                        # open file descriptors of a process
strace -f -tt -p "$(pgrep -o java)" -e trace=network 2>&1 | head   # live syscalls
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "A server is slow. Walk me through how you'd investigate.",
          a: "Start from the symptom and scope it: one host or all? Since when? What changed (deploys, config, traffic)? Then use the **USE method** on the host: `uptime` (load vs cores), `dmesg` (OOM kills, disk errors), `vmstat 1` (run queue, blocked processes, swapping, us/sy/wa/st), `mpstat` (one hot core?), `pidstat` (which process), `iostat -x` (disk latency and saturation), `free -m`, `df -h` (and inodes), `ss -s` (socket states), `sar -n TCP,ETCP` (retransmits). Form a hypothesis and confirm it with a targeted tool: a CPU profile or flame graph, `strace`, `tcpdump`. Also check the dependencies: slow DB, DNS, GC pauses in app metrics. **Mitigate first** (roll back, shift traffic, restart, scale) and do the root cause after users are fine.",
          freq: "very-common",
        },
        {
          q: "What does load average actually measure?",
          a: "The exponentially-damped moving average (1, 5, 15 minutes) of the number of tasks that are **runnable** (running or waiting for a CPU) **plus, on Linux, tasks in uninterruptible sleep (D state)**, usually blocked on disk or NFS I/O. Interpret it relative to the core count: load 4 on 4 cores is fully busy, load 16 means a queue. High load with low CPU utilization points to I/O, so check iowait and `iostat`. The three numbers show the trend: 15 > 1 means recovering.",
          freq: "common",
        },
        {
          q: "SIGTERM vs SIGKILL, and why does it matter for deployments?",
          a: "**SIGTERM** is a request to terminate that a process can catch: stop accepting new work, finish in-flight requests, flush buffers, close connections, exit. **SIGKILL** can't be caught: the kernel kills the process immediately, and in-flight requests fail. Orchestrators send SIGTERM, wait a grace period (k8s default 30 s), then SIGKILL. If your app ignores SIGTERM (or isn't receiving it because a shell is PID 1), every deploy drops requests. Handle SIGTERM, keep shutdown under the grace period, and in Kubernetes add a short preStop sleep so the pod is removed from load balancers before it stops accepting connections.",
          freq: "common",
        },
        {
          q: "df says the disk is full but du only finds half the usage. Why?",
          a: "Most likely **deleted files that are still open**: a process (often a logger) keeps a file descriptor to a file someone `rm`'d, so the inode and its blocks aren't freed and `du` (which walks the directory tree) can't see it. Find them with `lsof +L1` (or `ls -l /proc/*/fd | grep deleted`), then restart the process or truncate via `/proc/PID/fd/N`. Other causes: files hidden under a mount point, filesystem reserved blocks (5% for root on ext4), or snapshots.",
          freq: "common",
        },
        {
          q: "A process keeps getting killed with exit code 137. What's happening?",
          a: "137 = 128 + 9, so it received **SIGKILL**. Most often that's the **OOM killer**: check `dmesg` for `Out of memory: Killed process` or `Memory cgroup out of memory`, and in Kubernetes `kubectl describe pod` shows `Reason: OOMKilled`. Either the memory limit is too low for the real working set, or there's a leak (memory grows steadily until the kill, then restarts at regular intervals). For JVMs and other runtimes, make the heap aware of the container limit (e.g. `-XX:MaxRAMPercentage`) and leave headroom for off-heap memory. Other sources of SIGKILL: an orchestrator's grace period expiring, or a human running `kill -9`.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Load average 12 on an 8-core box with 70% idle CPU most likely means…",
          options: ["CPU saturation", "Tasks blocked on I/O (D state)", "Too many threads", "Nothing, it's fine"],
          answer: 1,
          explain: "Linux load includes uninterruptible (I/O) waits, so an idle CPU with high load points to disk.",
        },
        {
          q: "Exit code 137 means the process…",
          options: ["Segfaulted", "Was killed by SIGKILL", "Exited normally", "Received SIGTERM and handled it"],
          answer: 1,
          explain: "128 + signal number 9. Often the OOM killer.",
        },
        {
          q: "free -m shows 300 MB free but 9 GB available. The host is…",
          options: ["Out of memory", "Fine: most memory is reclaimable page cache", "Swapping heavily", "Leaking memory"],
          answer: 1,
          explain: "Linux uses spare RAM as cache and gives it back on demand. 'available' is what counts.",
        },
        {
          q: "Which top CPU field shows time stolen by the hypervisor?",
          options: ["wa", "sy", "st", "ni"],
          answer: 2,
          explain: "Steal time: your vCPU was ready but the host ran someone else.",
        },
        {
          q: "You rm'd a 40 GB log file but df still shows the disk full. First thing to check?",
          options: ["fsck", "lsof +L1 for deleted files still held open", "Reboot", "The inode count"],
          answer: 1,
          explain: "A process holding the file open keeps its blocks allocated.",
        },
      ],
      problems: [{ title: "Simplify Path", url: "https://leetcode.com/problems/simplify-path/", difficulty: "Medium", note: "Normalize Unix paths with a stack." }],
    },

    // ------------------------------------------------------------------ CONTAINERS
    {
      id: "containers",
      title: "Containers from First Principles",
      tagline: "Namespaces, cgroups and layered images, plus how to build images that are small and fast.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["layers"],
      concept: `
## A container is just a process
There is no "container" object in the Linux kernel. A container is an ordinary process started with:
- **Namespaces** to isolate what it can **see**: \`pid\` (its own PID 1), \`net\` (its own interfaces, IP, ports), \`mnt\` (its own filesystem tree), \`uts\` (hostname), \`ipc\`, \`user\` (map container root to an unprivileged host user), \`cgroup\`.
- **cgroups** to limit what it can **use**: CPU (shares/quota), memory (hard limit → OOM kill), PIDs, I/O.
- A **layered root filesystem** (overlayfs): read-only image layers plus a thin writable layer on top. Writes are copy-on-write and vanish with the container, so use volumes for data.
- **Security**: dropped Linux capabilities, seccomp syscall filters, AppArmor/SELinux, no-new-privileges.

## Containers vs VMs
| | Container | Virtual machine |
|---|---|---|
| Isolation | Shared host kernel | Own kernel on a hypervisor |
| Startup | Milliseconds to seconds | Tens of seconds |
| Overhead | ~None | Guest OS memory and CPU |
| Security boundary | Weaker (kernel exploits escape) | Stronger |
For untrusted multi-tenant code, use VMs or sandboxed runtimes: **gVisor** (user-space kernel), **Kata** / **Firecracker** microVMs (what AWS Lambda and Fargate use).

## Images
- An image is an ordered list of **layers** (tarballs of filesystem changes) plus a config (env, entrypoint, user). Layers are **content-addressed** by their SHA-256 digest, so they're shared and cached across images and nodes.
- Tags (\`api:1.4\`, \`latest\`) are mutable pointers. **Digests** (\`api@sha256:…\`) are immutable, so pin by digest in production.
- The **OCI** spec standardizes images and runtimes, so Docker, Podman, BuildKit, containerd and Kubernetes all interoperate.

## Writing a good Dockerfile (try the visualizer)
1. **Order by change frequency**: copy the dependency manifests and install dependencies *before* copying source. A source edit then reuses the cached dependency layer.
2. **Multi-stage builds**: compile in a fat builder image and copy only the artifacts into a slim runtime image (\`-slim\`, distroless, or \`scratch\` for static Go binaries). Smaller images pull faster, start faster and have fewer CVEs.
3. **.dockerignore** \`.git\`, \`node_modules\`, build outputs and secrets: everything in the context is sent to the builder and can bust the cache.
4. **Don't run as root** (\`USER app\`), and use a read-only root filesystem where possible.
5. **Never bake secrets** into layers. They stay in the image history even if a later layer deletes them. Use BuildKit secret mounts at build time and runtime secrets injection.
6. **Exec-form ENTRYPOINT/CMD** (\`["node", "server.js"]\`) so your process is PID 1 and receives signals. Shell form runs \`/bin/sh -c\`, which doesn't forward SIGTERM.
7. One main process per container. Add an init (\`tini\`, \`--init\`) if you spawn children, because PID 1 must reap zombies and has no default signal handlers.

## The runtime stack
\`docker\` / \`kubectl\` → **containerd** (image pulls, lifecycle) → **runc** (creates the namespaces and cgroups, execs the process). Kubernetes talks to containerd or CRI-O through the **CRI**. Docker itself is no longer needed on k8s nodes.

## Supply chain
Scan images (Trivy, Grype), generate SBOMs, sign images (cosign / Sigstore) and verify signatures at admission. Rebuild regularly to pick up base-image patches, and keep base images minimal so there's less to patch.
`,
      keyPoints: [
        "Container = process + namespaces (what it sees) + cgroups (what it uses) + overlay filesystem.",
        "Containers share the host kernel: lighter than VMs, weaker isolation.",
        "Layers are content-addressed and cached. A change invalidates that layer and every one after it.",
        "Copy dependency manifests and install before copying source. Use multi-stage builds for small images.",
        "Pin images by digest, run as non-root, never bake secrets into layers.",
        "Exec-form CMD so your app is PID 1 and gets SIGTERM.",
      ],
      code: [
        {
          title: "A production Dockerfile",
          note: "Cache-friendly ordering, multi-stage, non-root, exec form.",
          variants: [
            {
              lang: "dockerfile",
              code: `
# syntax=docker/dockerfile:1
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci        # cached unless the lockfile changes
COPY . .
RUN npm run build && npm prune --omit=dev               # keep only runtime deps

FROM gcr.io/distroless/nodejs22-debian12               # no shell, no package manager
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER nonroot
EXPOSE 3000
CMD ["dist/server.js"]                                  # exec form: node is PID 1 and gets SIGTERM
`,
            },
            {
              lang: "bash",
              code: `
# A "container" by hand: new PID, mount, UTS and network namespaces + a cgroup limit
sudo unshare --pid --fork --mount-proc --uts --net bash -c '
  hostname demo-container
  ps aux          # only this shell and ps: PID 1 is bash
  ip addr         # only a loopback interface
'

# cgroup v2: cap a process at 256 MiB and half a CPU
sudo mkdir /sys/fs/cgroup/demo
echo 268435456 | sudo tee /sys/fs/cgroup/demo/memory.max
echo "50000 100000" | sudo tee /sys/fs/cgroup/demo/cpu.max     # 50 ms of every 100 ms
echo $$ | sudo tee /sys/fs/cgroup/demo/cgroup.procs           # move this shell in

# Inspect image layers and their sizes
docker history --no-trunc myapp:latest
docker image inspect myapp:latest --format '{{.RootFS.Layers}}'
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What is a container, really? How is it different from a VM?",
          a: "A container is a normal Linux process isolated with **namespaces** (its own view of PIDs, network, mounts, hostname, users), constrained by **cgroups** (CPU, memory, PIDs, I/O), and running on a **layered copy-on-write filesystem** from an image, with capabilities and seccomp narrowing what it can do. All containers on a host **share the host kernel**. A VM virtualizes hardware and runs its own kernel on a hypervisor. So containers start in milliseconds with near-zero overhead and dense packing, but the isolation boundary is the kernel's syscall surface, which is weaker. For hostile multi-tenancy use microVMs (Firecracker, Kata) or gVisor.",
          freq: "very-common",
        },
        {
          q: "Our Docker image is 2 GB and builds take 10 minutes. How do you fix it?",
          a: "**Size**: multi-stage builds (compile in the SDK image, ship only artifacts), a slim/distroless/alpine base (watch out for musl differences), production dependencies only, a .dockerignore for .git and build outputs, cleaning package-manager caches in the same RUN layer. **Speed**: order instructions so dependency installation is cached (copy manifests → install → copy source), use BuildKit cache mounts for package caches, a remote build cache in CI (`--cache-from`/`--cache-to`), and parallel stages. Check `docker history` to see which layers are big. Smaller images also mean faster pulls on every node during scale-outs.",
          freq: "common",
        },
        {
          q: "Why might a container ignore SIGTERM and take 30 seconds to stop?",
          a: "The process receiving SIGTERM is PID 1 in the container's PID namespace, and the kernel doesn't apply default signal actions to PID 1: if the app doesn't install a handler, SIGTERM is ignored. Common cause: **shell-form** `CMD npm start` makes `/bin/sh -c` PID 1, which doesn't forward signals, and npm itself may not either. After the grace period the runtime sends SIGKILL, so every stop takes 30 s and in-flight work dies. Fix: exec-form CMD running the app directly, handle SIGTERM in the app, or use an init like `tini` (`docker run --init`) to forward signals and reap zombies.",
          freq: "common",
        },
        {
          q: "How do you handle secrets in container images?",
          a: "Never put them in the image: `ENV`, `COPY .env` or a `RUN` that downloads a secret all leave it in a layer, and deleting it in a later layer doesn't remove it from history. At build time, use **BuildKit secret mounts** (`RUN --mount=type=secret,id=npmrc`), which never persist. At runtime, inject secrets via the orchestrator (Kubernetes Secrets with encryption at rest, or better, an external secrets manager such as Vault or AWS Secrets Manager via a CSI driver or operator) as files or environment variables, use short-lived credentials (workload identity) where possible, and rotate them. Scan images for leaked keys in CI.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which kernel feature limits a container's memory usage?",
          options: ["Namespaces", "cgroups", "overlayfs", "seccomp"],
          answer: 1,
          explain: "Namespaces control what a process sees. cgroups control what it can use.",
        },
        {
          q: "You change one line of source code. With 'COPY . .' placed before 'RUN npm ci', the build…",
          options: ["Reuses npm ci from cache", "Reinstalls all dependencies", "Fails", "Only rebuilds the last layer"],
          answer: 1,
          explain: "The COPY layer changes, invalidating the cache for every instruction after it.",
        },
        {
          q: "Why pin images by digest instead of tag?",
          options: ["Digests are shorter", "Tags are mutable, digests are immutable", "Tags don't work in Kubernetes", "Digests pull faster"],
          answer: 1,
          explain: "api:1.4 can be re-pushed, while api@sha256:… always refers to the same content.",
        },
        {
          q: "A secret was COPY'd in layer 3 and deleted with RUN rm in layer 4. Is it in the image?",
          options: ["No, it was deleted", "Yes, layer 3 still contains it", "Only if the image is public", "Only in Docker, not containerd"],
          answer: 1,
          explain: "Layers are immutable. Anyone with the image can extract layer 3.",
        },
        {
          q: "Containers on the same host share…",
          options: ["Nothing", "The host kernel", "The same PID namespace by default", "One writable filesystem layer"],
          answer: 1,
          explain: "That's what makes them light, and why kernel exploits can escape.",
        },
      ],
    },

    // ------------------------------------------------------------------ KUBERNETES ARCHITECTURE
    {
      id: "k8s-architecture",
      title: "Kubernetes Architecture & Reconciliation",
      tagline: "Desired state, control loops and what really happens after kubectl apply.",
      difficulty: "advanced",
      minutes: 18,
      visualizers: ["kube"],
      diagram: {
        title: "Inside a Kubernetes cluster",
        nodes: [
          { id: "kubectl", label: "kubectl / CI", sub: "apply manifests", kind: "client", x: 90, y: 280 },
          { id: "api", label: "kube-apiserver", sub: "authn · authz · admission", kind: "control", x: 330, y: 280 },
          { id: "etcd", label: "etcd", sub: "Raft key-value store", kind: "db", x: 330, y: 480 },
          { id: "ctrl", label: "controller-manager", sub: "Deployment, ReplicaSet, Node…", kind: "control", x: 600, y: 90 },
          { id: "sched", label: "kube-scheduler", sub: "filter → score → bind", kind: "control", x: 600, y: 280 },
          { id: "kubelet", label: "kubelet", sub: "agent on every node", kind: "node", x: 600, y: 470 },
          { id: "runtime", label: "containerd + runc", sub: "via CRI, CNI for networking", kind: "service", x: 870, y: 470 },
          { id: "registry", label: "Image registry", sub: "layers by digest", kind: "registry", x: 870, y: 260 },
        ],
        edges: [
          { from: "kubectl", to: "api", label: "HTTPS" },
          { from: "api", to: "etcd" },
          { from: "api", to: "ctrl", label: "watch" },
          { from: "api", to: "sched", label: "watch" },
          { from: "api", to: "kubelet", label: "watch" },
          { from: "kubelet", to: "runtime" },
          { from: "runtime", to: "registry", label: "pull" },
        ],
        flows: [
          {
            name: "kubectl apply a Deployment",
            path: ["kubectl", "api", "etcd", "api", "ctrl", "api", "sched", "api", "kubelet", "runtime", "registry", "runtime", "kubelet", "api"],
            steps: [
              "kubectl sends the Deployment manifest. The API server authenticates the caller, authorizes with RBAC, runs admission controllers (defaults, policies) and validates the schema.",
              "The object is persisted in etcd (replicated with Raft). This is the desired state. Nothing is running yet.",
              "Write committed: kubectl prints 'deployment.apps/web created'. Everything from here on is asynchronous.",
              "The Deployment controller is watching Deployments. It sees the new one and creates a ReplicaSet.",
              "The ReplicaSet controller sees 0 of 3 pods and creates 3 Pod objects with no node assigned (Pending).",
              "The scheduler is watching for pods with an empty nodeName.",
              "It filters nodes (resources, taints, affinity), scores the survivors, and writes a Binding: web-x7k2p → node-2.",
              "node-2's kubelet watches pods bound to its node and picks up the new one.",
              "Through the CRI, the kubelet asks containerd to create the pod sandbox (the CNI plugin wires up its network namespace and IP) and the containers.",
              "Image layers not already on the node are pulled by digest.",
              "Layers are unpacked. runc starts the process in its namespaces and cgroups.",
              "The container is running. The kubelet starts the startup and readiness probes.",
              "The kubelet reports Running and Ready. The EndpointSlice controller adds the pod IP to the Service, and traffic flows.",
            ],
          },
          {
            name: "A node dies",
            path: ["kubelet", "api", "ctrl", "api", "sched", "api", "kubelet"],
            steps: [
              "node-3's kubelet stops renewing its Lease (heartbeat). After the grace period (~40–50 s) the node controller marks it NotReady and taints it unreachable.",
              "Its pods are marked not Ready and pulled from Service endpoints. After their toleration expires (default 300 s), they are evicted.",
              "The ReplicaSet controller now counts 2 live pods for 3 desired and creates a replacement.",
              "The new pod is Pending, and the scheduler picks it up.",
              "It's bound to a healthy node with enough free capacity.",
              "That node's kubelet starts it. Self-healing without a human, because the desired state never changed.",
            ],
          },
        ],
      },
      concept: `
## The core idea: declarative desired state + control loops
You don't tell Kubernetes *what to do*; you tell it *what you want* ("3 replicas of web:v2, each with 500m CPU"). The spec is stored in etcd, and dozens of **controllers** run **reconciliation loops**: observe actual state → compare with desired → act to close the gap → repeat. This is why it self-heals, why it's eventually consistent, and why everything is asynchronous. \`kubectl apply\` returns long before your pods run.

## The control plane
- **kube-apiserver**: the front door and the **only** component that talks to etcd. Every request goes through authentication → authorization (**RBAC**) → **admission** (mutating webhooks set defaults or inject sidecars, validating webhooks enforce policy) → schema validation → persistence. Clients **watch** resources for changes instead of polling.
- **etcd**: a strongly consistent key-value store replicated with **Raft** (run 3 or 5 members: a majority must be alive). Back it up, because it *is* the cluster.
- **kube-scheduler**: assigns Pending pods to nodes. **Filter** (enough requested CPU/memory? taints tolerated? affinity rules? volume zone?) then **score** (spread, least allocated, image locality) then **bind**.
- **kube-controller-manager**: Deployment, ReplicaSet, Node (heartbeats, eviction), Job, EndpointSlice, ServiceAccount controllers and more, each a loop.
- **cloud-controller-manager**: talks to the cloud API to create load balancers, routes and volumes.

## The nodes
- **kubelet**: the node agent. It watches pods bound to its node, starts them through the container runtime (**CRI** → containerd), runs probes, reports status and enforces resource limits. It heartbeats via a Lease object.
- **kube-proxy**: programs iptables/IPVS rules so Service virtual IPs load-balance to pod IPs (or an eBPF dataplane like Cilium replaces it).
- **CNI plugin**: gives every pod an IP on a flat network where any pod can reach any other pod without NAT.

## Objects you must know
| Object | Purpose |
|---|---|
| **Pod** | Smallest unit: one or more containers sharing network and volumes, scheduled together |
| **ReplicaSet** | Keeps N identical pods running |
| **Deployment** | Manages ReplicaSets for rolling updates and rollbacks |
| **Service** | Stable virtual IP + DNS name in front of a changing set of pods (selected by **labels**) |
| **ConfigMap / Secret** | Configuration and credentials, mounted as files or env vars |
| **Namespace** | A scope for names, RBAC and quotas |

Labels and selectors glue everything together: a Service doesn't know about Deployments, it selects pods with \`app=web\`.

## Scheduling controls
- **requests** decide placement (the scheduler sums requests, not actual usage). **limits** are enforced at runtime.
- **Taints and tolerations** keep pods off nodes (GPU nodes, dedicated pools) unless they tolerate the taint.
- **Node affinity** pulls pods toward nodes. **Pod anti-affinity** and **topology spread constraints** spread replicas across nodes and zones so one failure can't take them all.
- **PriorityClasses** let important pods preempt less important ones when the cluster is full.

## Failure handling (try it in the simulator)
Pod crashes → the kubelet restarts it with exponential backoff (**CrashLoopBackOff** when it keeps failing). Pod deleted → the ReplicaSet creates a new one. Node dies → after the node-monitor grace period it's marked NotReady and tainted; pods are evicted after their toleration (300 s by default), then rescheduled elsewhere if capacity exists. If not, they stay **Pending** with an event like \`0/3 nodes are available: 3 Insufficient cpu\`, which is where a cluster autoscaler adds nodes.
`,
      keyPoints: [
        "Declarative desired state + reconciliation loops = self-healing, eventually consistent.",
        "Only the API server talks to etcd. Everything else watches the API server.",
        "Scheduler: filter → score → bind, based on requests, taints, affinity and spread.",
        "kubelet runs pods via CRI; kube-proxy/CNI make Services and pod networking work.",
        "Services select pods by labels and give them a stable virtual IP and DNS name.",
        "Pending + 'Insufficient cpu' = no node fits the requests: scale nodes or lower requests.",
      ],
      code: [
        {
          title: "A Deployment and its Service",
          variants: [
            {
              lang: "yaml",
              code: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels: { app: web }
  template:
    metadata:
      labels: { app: web }            # the Service finds pods by this label
    spec:
      topologySpreadConstraints:       # don't put all replicas in one zone
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector: { matchLabels: { app: web } }
      containers:
        - name: web
          image: registry.example.com/web@sha256:3f1c...   # pinned by digest
          ports: [{ containerPort: 8080 }]
          resources:
            requests: { cpu: 500m, memory: 512Mi }          # used for scheduling
            limits: { memory: 512Mi }                       # enforced at runtime
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector: { app: web }
  ports: [{ port: 80, targetPort: 8080 }]   # web.default.svc.cluster.local:80
`,
            },
            {
              lang: "python",
              code: `
# The shape of every Kubernetes controller: a level-triggered reconcile loop
def reconcile(replicaset):
    desired = replicaset.spec.replicas
    pods = api.list_pods(selector=replicaset.spec.selector)
    alive = [p for p in pods if p.deletion_timestamp is None]

    if len(alive) < desired:
        for _ in range(desired - len(alive)):
            api.create_pod(template=replicaset.spec.template)   # scheduler places it later
    elif len(alive) > desired:
        # prefer deleting unscheduled, then not-ready, then newest pods
        for pod in sorted(alive, key=deletion_cost)[: len(alive) - desired]:
            api.delete_pod(pod)

    api.update_status(replicaset, ready=sum(p.ready for p in alive))

# Run on every watch event AND periodically: compare the whole state, not just the
# event, so missed or duplicated events can't leave the system wrong for long.
for event in api.watch(ReplicaSet, Pod):
    reconcile(owner_of(event.object))
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What happens when you run kubectl apply -f deployment.yaml?",
          a: "kubectl sends the manifest to the **API server**, which authenticates, authorizes (RBAC), runs mutating and validating **admission** webhooks, validates the schema and stores the object in **etcd**, then returns. Asynchronously: the **Deployment controller** (watching Deployments) creates or updates a **ReplicaSet**; the **ReplicaSet controller** creates Pod objects; the **scheduler** sees pods without a node, filters and scores nodes, and binds each pod; the **kubelet** on that node sees the binding, asks the runtime via CRI to create the sandbox (the CNI assigns the pod IP) and pull images, starts the containers and runs probes; when readiness passes, the **EndpointSlice controller** adds the pod to its Service, and kube-proxy or the dataplane routes traffic to it.",
          freq: "very-common",
        },
        {
          q: "Why is Kubernetes built around reconciliation loops instead of commands?",
          a: "Because distributed systems lose messages, crash and restart. A command (\"start pod X\") can fail halfway with no one to retry it. A **level-triggered** controller repeatedly compares the *whole* desired state with the *whole* actual state and acts on the difference, so a missed event, a crashed controller or a manual change is corrected on the next pass. It also makes everything composable: each controller owns one concern (ReplicaSet, Endpoint, Node, HPA) and they cooperate through shared state in the API server rather than by calling each other.",
          freq: "common",
        },
        {
          q: "A pod is stuck in Pending. How do you debug it?",
          a: "`kubectl describe pod` and read the Events. Typical causes: **Insufficient cpu/memory**: requests don't fit on any node (lower the requests, add nodes, check the cluster autoscaler); **untolerated taints** (the pod needs a toleration, or the only nodes with room are dedicated); **affinity / topology spread** rules that can't be satisfied; **PVC not bound** or a volume in a different zone from available nodes; **ResourceQuota** exceeded in the namespace; image pull problems show up later as ErrImagePull, not Pending. If there are no events at all, check whether the scheduler is healthy, or whether a custom `schedulerName` is set.",
          freq: "very-common",
        },
        {
          q: "What happens to pods when a node fails?",
          a: "The kubelet stops renewing its node Lease. After the node-monitor grace period (~40–50 s) the node controller sets the node **NotReady/Unknown** and adds the `unreachable` taint; its pods are marked not Ready and **removed from Service endpoints**, so traffic stops. Pods tolerate that taint for 300 s by default; then they're evicted, and their controllers (ReplicaSet, StatefulSet) create replacements, which the scheduler places on healthy nodes. StatefulSet pods are more cautious: a replacement with the same identity isn't started until the old one is confirmed gone, to avoid two writers. Shorten tolerations for faster failover if your app is stateless.",
          freq: "common",
        },
        {
          q: "What's the role of etcd, and what happens if it loses quorum?",
          a: "etcd stores every Kubernetes object: the cluster's entire desired and observed state. It uses Raft, so with 3 members it tolerates 1 failure and with 5 it tolerates 2. If quorum is lost, the API server can't write (or serve linearizable reads): no new deployments, no scheduling, no scaling, and controllers stall. **Already-running pods keep running**, because kubelets and the dataplane don't need the control plane to serve traffic (static stability). Recovery: restore quorum, or restore from an etcd snapshot, which is why regular snapshots and tested restores matter.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which component is the only one that reads and writes etcd directly?",
          options: ["kube-scheduler", "kubelet", "kube-apiserver", "kube-proxy"],
          answer: 2,
          explain: "Everything else goes through the API server and watches it.",
        },
        {
          q: "The scheduler decides whether a pod fits on a node based on…",
          options: ["Current CPU usage", "Resource requests", "Resource limits", "Pod priority only"],
          answer: 1,
          explain: "It sums requests against allocatable capacity, so actual usage doesn't matter for placement.",
        },
        {
          q: "kubectl apply returns successfully. Your pods are…",
          options: ["Running", "Not necessarily created yet: controllers act asynchronously", "Ready", "Scheduled"],
          answer: 1,
          explain: "apply only persists desired state. Reconciliation happens afterwards.",
        },
        {
          q: "How does a Service know which pods to send traffic to?",
          options: ["It's linked to a Deployment", "Label selectors", "Pod names", "Node IPs"],
          answer: 1,
          explain: "Any ready pod whose labels match the selector becomes an endpoint.",
        },
        {
          q: "A 3-member etcd cluster loses 2 members. Running pods…",
          options: ["Are all killed", "Keep running, but the cluster can't change state", "Move to other nodes", "Restart in a loop"],
          answer: 1,
          explain: "The data plane is statically stable, but nothing new can be scheduled or updated.",
        },
        {
          q: "Taints and tolerations are used to…",
          options: ["Attract pods to nodes", "Repel pods from nodes unless they tolerate the taint", "Limit CPU", "Encrypt traffic"],
          answer: 1,
          explain: "e.g. keep ordinary workloads off GPU nodes. Use node affinity to attract.",
        },
      ],
    },

    // ------------------------------------------------------------------ KUBERNETES WORKLOADS
    {
      id: "k8s-workloads",
      title: "Kubernetes Workloads, Networking & Autoscaling",
      tagline: "Probes, requests vs limits, Services and Ingress, and scaling pods and nodes.",
      difficulty: "advanced",
      minutes: 18,
      visualizers: ["hpa"],
      concept: `
## Picking the right workload
| Controller | Use for |
|---|---|
| **Deployment** | Stateless services: interchangeable pods, rolling updates |
| **StatefulSet** | Databases, Kafka, ZooKeeper: stable names (\`db-0\`, \`db-1\`), stable per-pod volumes, ordered startup |
| **DaemonSet** | One pod per node: log shippers, node exporters, CNI agents |
| **Job / CronJob** | Run to completion: migrations, batch, scheduled tasks |

## Probes: the most misused feature
- **Readiness**: "can I take traffic?" Failing removes the pod from Service endpoints, with no restart. Use it during startup, warm-up and overload.
- **Liveness**: "am I wedged?" Failing **restarts** the container. Keep it dumb (the process responds). **Never check dependencies in liveness**: if the database blips, every pod restarts at once and you've turned a DB hiccup into a full outage.
- **Startup**: holds off the other probes until a slow-starting app is up, instead of setting a huge liveness delay.

## Requests vs limits
- **Requests** are what the scheduler reserves. Set them to typical usage, or the node gets overcommitted (or wasted).
- **CPU limit** → the container is **throttled** (CFS quota) when it exceeds it, which shows up as latency spikes rather than errors. Many teams set CPU requests but no CPU limit.
- **Memory limit** → exceeding it means **OOMKilled**. Set memory limit = request for predictable behavior.
- **QoS classes**: **Guaranteed** (requests = limits for every container), **Burstable**, **BestEffort** (none set). Under node memory pressure the kubelet evicts BestEffort first, then Burstable pods exceeding their requests.

## Networking
- Every pod gets its own IP. Pods talk to each other directly (no NAT) across nodes, wired by the **CNI** plugin.
- **Service types**: **ClusterIP** (virtual IP inside the cluster, the default), **NodePort** (a port on every node), **LoadBalancer** (provisions a cloud LB), **Headless** (\`clusterIP: None\`: DNS returns pod IPs directly, used by StatefulSets).
- **DNS**: \`web.prod.svc.cluster.local\` resolves to the Service IP. Pods default to \`ndots:5\`, so external names try cluster search domains first. Use FQDNs with a trailing dot or tune ndots for heavy external callers.
- **Ingress / Gateway API**: L7 routing (host, path, TLS) from outside into Services, implemented by a controller (NGINX, Envoy, cloud LBs). Gateway API is the newer, role-oriented successor.
- **NetworkPolicies**: default-allow out of the box. Add a default-deny policy per namespace and allow explicit flows.

## Config and storage
**ConfigMaps** for config, **Secrets** for credentials. Secrets are only base64-encoded, so enable encryption at rest, restrict RBAC, or sync from an external secrets manager. **PersistentVolumeClaims** request storage from a **StorageClass**. Cloud disks are zonal, so a pod with a volume is pinned to that zone.

## Autoscaling at three levels (try the visualizer)
- **HPA**: \`desired = ceil(current × currentMetric / target)\`, evaluated every 15 s with a 10% tolerance. Scale-ups are fast (up to double, or +4 pods, per step). Scale-downs wait for a **stabilization window** (5 min by default) to avoid flapping. It scales on CPU or memory, or custom and external metrics (RPS, queue depth via **KEDA**).
- **VPA** adjusts requests and limits per pod (by recreating pods). Don't run it on the same metric as the HPA.
- **Cluster Autoscaler / Karpenter** add nodes when pods are Pending for lack of capacity and remove underused nodes.
The HPA only helps if new pods become ready faster than load grows. Slow startup + a high target = dropped requests during spikes, so keep headroom or pre-scale for known peaks.

## Graceful shutdown and disruptions
On delete: the pod is marked Terminating, removed from endpoints (asynchronously!), the **preStop** hook runs, then SIGTERM, then SIGKILL after \`terminationGracePeriodSeconds\` (30 s by default). Endpoint removal and SIGTERM race, so add a few seconds of preStop sleep to avoid dropped requests. **PodDisruptionBudgets** (\`minAvailable: 2\`) stop voluntary disruptions (node drains, upgrades) from taking down too many replicas at once.
`,
      keyPoints: [
        "Readiness gates traffic. Liveness restarts. Never put dependency checks in liveness.",
        "Requests drive scheduling. CPU limits throttle. Memory limits OOM-kill.",
        "ClusterIP for in-cluster, LoadBalancer/Ingress for outside, headless for StatefulSets.",
        "HPA: ceil(current × metric/target), fast up, slow down (stabilization window).",
        "Cluster autoscaler adds nodes for Pending pods, and HPA adds pods. You need both.",
        "preStop sleep + SIGTERM handling + PDBs = zero-downtime deploys and drains.",
      ],
      code: [
        {
          title: "Probes, resources, autoscaling and a disruption budget",
          variants: [
            {
              lang: "yaml",
              code: `
apiVersion: apps/v1
kind: Deployment
metadata: { name: api }
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      terminationGracePeriodSeconds: 40
      containers:
        - name: api
          image: registry.example.com/api@sha256:9ab2...
          resources:
            requests: { cpu: 500m, memory: 768Mi }
            limits: { memory: 768Mi }                 # no CPU limit: avoid throttling
          startupProbe:                               # up to 150 s to boot
            httpGet: { path: /healthz, port: 8080 }
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:                             # gate traffic: may check dependencies
            httpGet: { path: /ready, port: 8080 }
            periodSeconds: 5
          livenessProbe:                              # restart only if the process is wedged
            httpGet: { path: /healthz, port: 8080 }
            periodSeconds: 10
            failureThreshold: 3
          lifecycle:
            preStop: { exec: { command: ["sleep", "5"] } }   # let endpoints update first
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: api }
spec:
  minAvailable: 2
  selector: { matchLabels: { app: api } }
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What's the difference between liveness and readiness probes, and how can they cause outages?",
          a: "**Readiness** decides whether a pod receives traffic: failing removes it from the Service's endpoints but doesn't restart it. **Liveness** decides whether the container should be killed and restarted. Outage patterns: (1) a liveness probe that checks the database or another dependency, so a brief DB blip fails every pod's liveness and the kubelet restarts the whole fleet at once, often into a thundering herd on the DB; (2) a liveness timeout too tight for GC pauses under load, so pods are killed exactly when busiest, and the remaining pods get even busier (a cascade); (3) no startup probe, so slow-booting pods get killed before they're up (CrashLoopBackOff). Keep liveness trivial, put dependency awareness in readiness (carefully), and use startup probes for slow starts.",
          freq: "very-common",
        },
        {
          q: "Explain requests vs limits. Should you set CPU limits?",
          a: "**Requests** are reservations used by the scheduler and for CPU shares under contention. **Limits** are hard caps enforced by cgroups. Exceeding the **memory** limit gets the container OOM-killed. Exceeding the **CPU** limit gets it **throttled** by the CFS quota, which can add large latency spikes even when the node has idle CPU (e.g. a multi-threaded app burns its 100 ms quota in 25 ms, then waits 75 ms). Common practice: always set CPU and memory requests, set memory limit = request, and leave CPU limits off (or generous) for latency-sensitive services, relying on requests for fair sharing. Use ResourceQuotas and LimitRanges to keep tenants honest.",
          freq: "common",
        },
        {
          q: "How does the Horizontal Pod Autoscaler decide how many replicas to run?",
          a: "Every 15 s it computes `desired = ceil(currentReplicas × currentMetricValue / targetValue)`, e.g. 4 pods at 90% CPU with a 60% target → ceil(4 × 90/60) = 6. It ignores changes within a 10% tolerance, treats not-yet-ready pods conservatively, clamps to min/max, and applies **behavior** policies: scale-up can be fast (by default up to 100% or 4 pods per 15 s), while scale-down uses a **stabilization window** (300 s by default, taking the highest recommendation in the window) to prevent flapping. Utilization is relative to **requests**, so wrong requests mean wrong scaling. For queue-driven or bursty workloads, scale on external metrics (queue depth, RPS) with KEDA.",
          freq: "common",
        },
        {
          q: "How do you achieve zero-downtime deployments in Kubernetes?",
          a: "Rolling update with `maxUnavailable: 0` and `maxSurge` > 0 so capacity never drops; a **readiness probe** so new pods only get traffic when ready; **graceful shutdown**: a preStop sleep of a few seconds (endpoint removal propagates asynchronously to kube-proxy and load balancers), then the app handles SIGTERM by finishing in-flight requests within `terminationGracePeriodSeconds`; **PodDisruptionBudgets** so drains don't remove too many replicas; backward-compatible changes so old and new versions can run side by side (API and schema: expand/contract migrations); connection draining on long-lived connections; and for extra safety, canary releases with automated rollback.",
          freq: "very-common",
        },
        {
          q: "When would you use a StatefulSet instead of a Deployment?",
          a: "When pods are not interchangeable: they need a **stable network identity** (`kafka-0.kafka.ns.svc`), **stable per-pod storage** (each replica gets its own PVC from `volumeClaimTemplates`, reattached if the pod moves), and **ordered** deployment, scaling and updates (start `db-0` before `db-1`). Typical: databases, Kafka, ZooKeeper, Elasticsearch. Combine with a headless Service for per-pod DNS. Running stateful systems on Kubernetes also means handling backups, zonal volumes and failover yourself, which is why operators (CloudNativePG, Strimzi) or managed services are popular.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "A failing readiness probe…",
          options: ["Restarts the container", "Removes the pod from Service endpoints", "Deletes the pod", "Reschedules the pod"],
          answer: 1,
          explain: "Readiness gates traffic. Liveness restarts.",
        },
        {
          q: "A container exceeds its CPU limit. It is…",
          options: ["OOM-killed", "Throttled", "Evicted", "Restarted"],
          answer: 1,
          explain: "CPU is compressible: the CFS quota throttles it. Memory overuse is what kills.",
        },
        {
          q: "HPA: 5 pods at 80% CPU, target 50%. Desired replicas?",
          options: ["5", "7", "8", "10"],
          answer: 2,
          explain: "ceil(5 × 80/50) = ceil(8) = 8.",
        },
        {
          q: "Pods are Pending with 'Insufficient memory'. Which autoscaler helps?",
          options: ["HPA", "VPA", "Cluster Autoscaler / Karpenter", "None"],
          answer: 2,
          explain: "The pods exist but no node fits them, so more nodes are needed.",
        },
        {
          q: "Which QoS class is evicted first under node memory pressure?",
          options: ["Guaranteed", "Burstable", "BestEffort", "System"],
          answer: 2,
          explain: "Pods without requests or limits have no reservation to protect them.",
        },
        {
          q: "Why add a short preStop sleep?",
          options: ["To warm caches", "So endpoint removal propagates before the app stops accepting connections", "To slow down deploys", "It's required by the API"],
          answer: 1,
          explain: "Endpoint updates and SIGTERM happen in parallel, and the sleep closes that race.",
        },
      ],
      problems: [
        { title: "Task Scheduler", url: "https://leetcode.com/problems/task-scheduler/", difficulty: "Medium", note: "Greedy scheduling with cooldowns." },
        { title: "Course Schedule", url: "https://leetcode.com/problems/course-schedule/", difficulty: "Medium", note: "Dependency ordering, like init containers and Helm hooks." },
      ],
    },
    ...infraPart2,
  ],
};
