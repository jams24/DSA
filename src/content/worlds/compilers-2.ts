import type { Lesson } from "../types";

// Compilers, part 2: the front end. Lexing, automata, grammars, parsing (top-down and bottom-up),
// name resolution and type checking.

export const compilersPart2: Lesson[] = [
  // ------------------------------------------------------------------ LEXING
  {
    id: "comp-lexing",
    part: "Part 2 · The front end",
    title: "Lexing: from characters to tokens",
    tagline: "Tokens, lexemes and token kinds; a hand-written scanner with line and column tracking; keywords vs identifiers; maximal munch; strings, escapes and comments; regex-based lexers and lexer generators; and good lexical errors.",
    difficulty: "beginner",
    minutes: 30,
    visualizers: ["lexer"],
    concept: `## Explain it like I'm 10 🧸
Look at this: \`thecatsatonthemat\`. Hard to read! Now: \`the cat sat on the mat\`. Your brain didn't change the letters; it just **split them into words**. That's the very first thing a compiler does with your program.

The **lexer** walks along your code one character at a time, like a finger under a line of text, and every time a "word" ends, it writes the word on a card: what **kind** of word it is (a number, a name, a plus sign, a keyword like \`if\`) and **where** it was found. Spaces and comments are thrown away, like the gaps between words. The pile of cards goes to the next stage, the parser, which never has to think about single letters again.

## Tokens
A **token** is the smallest meaningful unit of a program. Each token has:
- a **kind**: identifier (name), keyword, integer, string, operator, punctuation, end of file;
- its **lexeme**: the exact text, like \`counter_2\` or \`>=\`;
- its **position**: line and column, so later errors can point at it.

\`\`\`text
if count >= 10 { print "big"; }
──  ─────  ──  ──  ─  ─────  ─────  ─  ─
kw  name   op  int op kw     string op op
\`\`\`

## How a hand-written lexer works
Look at the current character and decide what kind of token **starts** here:
- a **digit** → keep taking digits: an integer;
- a **letter or \`_\`** → keep taking letters, digits and \`_\`: a word. If the word is in the keyword set (\`let\`, \`if\`, \`while\`...) it's a **keyword**, otherwise a **name**. Checking keywords **after** reading the whole word is simpler and faster than special patterns per keyword;
- \`"\` → a string: read until the closing quote, translating **escapes** like \`\\n\`;
- \`//\` → a comment: skip to the end of the line;
- an operator character → check the **two-character** operators (\`==\`, \`<=\`) **before** the one-character ones (\`=\`, \`<\`);
- anything else → a **lexical error**.

Most lexers are this simple loop. Clang's, Go's, Rust's and V8's lexers are all hand-written: it's easy to make them fast and to give great error messages.

## Maximal munch
The golden rule of lexing: **always take the longest possible token**. That's why:
- \`>=\` is one token, not \`>\` then \`=\`;
- \`iffy\` is one name, not the keyword \`if\` followed by \`fy\`;
- \`x+++y\` in C is \`x ++ + y\` (the lexer greedily takes \`++\` first, even though \`x + ++y\` also makes sense).

Maximal munch occasionally surprises people: in old C++, \`vector<vector<int>>\` didn't compile because \`>>\` was lexed as the shift operator. C++11 added a special rule for it.

## Line and column tracking
Every good compiler error says **where**: \`main.c:12:7: error: ...\`. The lexer is the only phase that sees raw positions, so it stamps every token with the line and column where it **started**. Count a new line at every \`\\n\` and reset the column. (Real compilers usually store a byte **offset** and compute line and column only when printing an error.)

## Lexing with regular expressions
Token patterns are **regular**: they can be described by regular expressions:
| Token | Regular expression |
|---|---|
| integer | \`[0-9]+\` |
| name | \`[A-Za-z_][A-Za-z0-9_]*\` |
| string | \`"\` followed by non-quote characters or escapes, then \`"\` |
| whitespace | \`[ \\t\\r\\n]+\` |

So you can build a lexer from one big regex made of named alternatives (second sample). Two traps:
1. **Order matters**: Python's \`re\` tries alternatives left to right and stops at the first match, so \`<\` listed before \`<=\` breaks \`x<=1\`.
2. Regex alternation isn't maximal munch. Real **lexer generators** (\`lex\`, \`flex\`, \`re2c\`, Rust's \`logos\`) take the **longest** match across all rules and break ties by rule order. They compile all the rules into a single **DFA**, which is the next lesson.

## Things that make lexing harder
- **Keywords that are sometimes names**: \`async\`, \`match\`, \`type\` in Python are **soft keywords**, keywords only in certain places.
- **Significant indentation** (Python): the lexer counts leading spaces and emits \`INDENT\` and \`DEDENT\` tokens, so the parser sees blocks like braces.
- **Nested comments** (\`/* /* */ */\` in Rust and Swift): need a counter, so they're not regular any more.
- **String interpolation** (\`f"{x + 1}"\` in Python, template literals in JavaScript): the lexer must lex an expression **inside** a string, usually by switching modes.
- **Context-dependent lexing**: in JavaScript, \`/\` might start a regex literal or be a division, depending on the previous token.
- **Unicode**: identifiers may contain letters from any language; source is usually UTF-8.

## Good lexical errors
The lexer can find only a few kinds of mistakes: an **unexpected character** (\`@\` where the language has none), an **unterminated string** or comment, a **malformed number** (\`12abc\`, \`0x\`), an **unknown escape**. Report the position where the problem **started**: for an unterminated string, that's the opening quote, not the end of the file.`,
    keyPoints: [
      "The lexer turns characters into tokens: kind, lexeme and position. It drops whitespace and comments",
      "Hand-written lexers look at the current character to decide which kind of token starts there",
      "Read a whole word first, then check whether it's a keyword",
      "Maximal munch: always take the longest token (>= not > =, iffy not if + fy)",
      "Token patterns are regular; lexer generators compile them into one DFA and pick the longest match",
      "Every token remembers its line and column so every later error can point at the source",
    ],
    code: [
      {
        title: "A hand-written lexer for Pebble",
        variants: [{ lang: "python", code: `# A hand-written lexer for Pebble, the little language we build in this world.
# It reads characters left to right and groups them into tokens, remembering where each one started.
from dataclasses import dataclass

KEYWORDS = {"let", "fn", "if", "else", "while", "return", "print", "true", "false", "and", "or"}
TWO_CHAR = {"==", "!=", "<=", ">="}
ONE_CHAR = set("+-*/%=<>!(){},;")


@dataclass
class Token:
    kind: str   # "int", "string", "name", "keyword", "op" or "eof"
    text: str
    line: int
    col: int


class LexError(Exception):
    pass


def lex(src: str) -> list[Token]:
    tokens, i, line, col = [], 0, 1, 1

    def advance(n=1):
        nonlocal i, line, col
        for _ in range(n):
            if src[i] == "\\n":
                line, col = line + 1, 1
            else:
                col += 1
            i += 1

    while i < len(src):
        c = src[i]
        start_line, start_col = line, col
        if c in " \\t\\r\\n":                         # whitespace: skip it
            advance()
        elif src.startswith("//", i):              # comment: skip to the end of the line
            while i < len(src) and src[i] != "\\n":
                advance()
        elif c.isdigit():                          # number: take every digit (maximal munch)
            j = i
            while j < len(src) and src[j].isdigit():
                j += 1
            tokens.append(Token("int", src[i:j], start_line, start_col))
            advance(j - i)
        elif c.isalpha() or c == "_":              # name or keyword
            j = i
            while j < len(src) and (src[j].isalnum() or src[j] == "_"):
                j += 1
            word = src[i:j]
            tokens.append(Token("keyword" if word in KEYWORDS else "name", word, start_line, start_col))
            advance(j - i)
        elif c == '"':                             # string, with \\n and \\" escapes
            advance()
            chars = []
            while i < len(src) and src[i] != '"':
                if src[i] == "\\n":
                    break
                if src[i] == "\\\\" and i + 1 < len(src):
                    advance()
                    chars.append({"n": "\\n", "t": "\\t"}.get(src[i], src[i]))
                else:
                    chars.append(src[i])
                advance()
            if i >= len(src) or src[i] != '"':
                raise LexError(f"{start_line}:{start_col}: unterminated string")
            advance()
            tokens.append(Token("string", "".join(chars), start_line, start_col))
        elif src[i:i + 2] in TWO_CHAR:             # try the longest operator first: "<=" before "<"
            tokens.append(Token("op", src[i:i + 2], start_line, start_col))
            advance(2)
        elif c in ONE_CHAR:
            tokens.append(Token("op", c, start_line, start_col))
            advance()
        else:
            raise LexError(f"{line}:{col}: unexpected character {c!r}")
    tokens.append(Token("eof", "", line, col))
    return tokens


program = """let count = 10; // how many
if count >= 10 { print "big\\\\n"; }
let counter_2 = count<=3;"""

for t in lex(program):
    print(f"{t.line}:{t.col:<3} {t.kind:<8} {t.text!r}")

for bad in ['let x = 5 @ 3;', 'print "oops;']:
    try:
        lex(bad)
    except LexError as e:
        print(f"error in {bad!r}: {e}")` }],
        explain: `- The main loop looks at one character, \`c\`, and the \`if\`/\`elif\` chain picks the kind of token that starts there. Each branch consumes **all** the characters of that token.
- \`advance()\` is the only place that moves forward, so it's the only place that has to update \`line\` and \`col\`. Every token records \`start_line\` and \`start_col\` from **before** it was consumed.
- Numbers and names use **maximal munch**: keep going while the characters still fit. \`counter_2\` is one name; \`count<=3\` is three tokens, with \`<=\` found because the two-character operators are checked first.
- Escapes are translated **here**: the source has backslash and \`n\` (two characters), and the token's text holds one newline character. Later phases never deal with escapes.
- The unterminated-string error points at column 7, the opening quote, where the human needs to look.`,
        output: `1:1   keyword  'let'
1:5   name     'count'
1:11  op       '='
1:13  int      '10'
1:15  op       ';'
2:1   keyword  'if'
2:4   name     'count'
2:10  op       '>='
2:13  int      '10'
2:16  op       '{'
2:18  keyword  'print'
2:24  string   'big\\n'
2:31  op       ';'
2:33  op       '}'
3:1   keyword  'let'
3:5   name     'counter_2'
3:15  op       '='
3:17  name     'count'
3:22  op       '<='
3:24  int      '3'
3:25  op       ';'
3:26  eof      ''
error in 'let x = 5 @ 3;': 1:11: unexpected character '@'
error in 'print "oops;': 1:7: unterminated string`,
      },
      {
        title: "The same lexer as one regular expression",
        variants: [{ lang: "python", code: `# The same idea with regular expressions: one big pattern made of named alternatives.
# This is roughly what lexer generators like lex, flex and re2c build for you (as a DFA).
import re

RULES = [
    ("skip",    r"[ \\t\\r\\n]+|//[^\\n]*"),
    ("int",     r"\\d+"),
    ("name",    r"[A-Za-z_]\\w*"),            # keywords are names too; we check the word afterwards
    ("string",  r'"(?:\\\\.|[^"\\\\\\n])*"'),
    ("op",      r"==|!=|<=|>=|[-+*/%=<>!(){},;]"),  # order matters: two-character operators first
    ("error",   r"."),
]
MASTER = re.compile("|".join(f"(?P<{name}>{pattern})" for name, pattern in RULES))
KEYWORDS = {"let", "fn", "if", "else", "while", "return", "print", "true", "false", "and", "or"}


def lex(src):
    for m in MASTER.finditer(src):
        kind, text = m.lastgroup, m.group()
        if kind == "skip":
            continue
        if kind == "error":
            raise SyntaxError(f"unexpected character {text!r} at offset {m.start()}")
        if kind == "name" and text in KEYWORDS:
            kind = "keyword"
        yield kind, text


print(list(lex("while x <= 10 { x = x + 1; }")))

# Why rule order matters. Put "<" before "<=" and "x<=1" is lexed wrongly:
bad = re.compile(r"(?P<op><|<=|=)|(?P<name>\\w+)")
print("wrong order:", [m.group() for m in bad.finditer("x<=1")])
# Regexes try alternatives left to right and stop at the first match; real lexer generators
# instead always take the LONGEST match (maximal munch), then the earliest rule on a tie.
print("maximal munch:", list(lex("iffy if")))  # the whole word "iffy" is one name, not the keyword "if" + "fy"` }],
        explain: `- Each rule becomes a **named group**, \`(?P<int>\\d+)\`, and the groups are joined with \`|\`. \`m.lastgroup\` tells us which rule matched.
- The catch-all \`error\` rule \`.\` at the end turns any unknown character into an error instead of silently skipping it (\`finditer\` would otherwise just jump ahead).
- "wrong order": with \`<\` listed before \`<=\`, Python's regex engine takes the first alternative that works, so \`<=\` is split. Listing longer operators first fixes it.
- \`iffy\` stays one name because the \`name\` rule itself is greedy (\`\\w*\`): the keyword check happens afterwards, on the whole word.`,
        output: `[('keyword', 'while'), ('name', 'x'), ('op', '<='), ('int', '10'), ('op', '{'), ('name', 'x'), ('op', '='), ('name', 'x'), ('op', '+'), ('int', '1'), ('op', ';'), ('op', '}')]
wrong order: ['x', '<', '=', '1']
maximal munch: [('name', 'iffy'), ('keyword', 'if')]`,
      },
    ],
    interview: [
      {
        q: "What is the difference between a token and a lexeme?",
        freq: "common",
        a: `A **lexeme** is the actual character sequence in the source (\`count\`, \`>=\`, \`42\`). A **token** is the categorised unit the lexer produces: a kind (IDENTIFIER, GE, INT_LITERAL) plus usually the lexeme or its value and a source position. Many lexemes map to the same token kind (\`count\` and \`total\` are both identifiers); some token kinds have exactly one lexeme (\`>=\`).`,
      },
      {
        q: "What is maximal munch? Give an example where it matters.",
        freq: "common",
        a: `The rule that the lexer always consumes the **longest** possible token at the current position. \`>=\` is one token, not \`>\` and \`=\`; \`ifx\` is an identifier, not the keyword \`if\` plus \`x\`. Famous consequences: in C, \`x+++y\` lexes as \`x ++ + y\`; in pre-C++11, \`vector<vector<int>>\` failed because \`>>\` was a single shift token; \`a---b\` is \`a -- - b\`. Lexer generators implement it by running the DFA as far as possible and remembering the last accepting state.`,
      },
      {
        q: "Why do most production compilers use hand-written lexers instead of generators like flex?",
        freq: "occasional",
        a: `Hand-written lexers are simple loops, easy to make **fast** (no table lookups, good branch prediction, SIMD for whitespace and identifiers), easy to give **precise error messages and recovery**, and easy to extend with context-sensitive features: string interpolation, nested comments, Python's INDENT/DEDENT, JavaScript's regex-vs-division decision, contextual keywords. Generators shine for quick prototypes and very regular languages. Clang, GCC, Go, Rust, V8 and CPython all hand-write their lexers.`,
      },
      {
        q: "How would you lex Python's significant indentation?",
        freq: "occasional",
        a: `The lexer keeps a **stack of indentation levels**, starting with 0. At the start of each logical line it measures the leading whitespace: if it's deeper than the top of the stack, push it and emit **INDENT**; if shallower, pop levels emitting one **DEDENT** per pop until it matches (if it never matches exactly, that's an "unindent does not match any outer level" error). Blank lines, comment-only lines and lines inside brackets are ignored. At end of file, emit DEDENTs for everything left. The parser then treats INDENT/DEDENT exactly like \`{\` and \`}\`.`,
      },
      {
        q: "Which errors can a lexer detect, and which can't it?",
        freq: "common",
        a: `It can detect **illegal characters**, **unterminated strings and comments**, **malformed numbers** (\`0x\`, \`1e\`, digits too large), **invalid escapes**, and invalid encodings. It **can't** detect anything about structure or meaning: \`let let = = 5\` lexes perfectly. Missing brackets are the parser's job; undefined variables and type errors belong to semantic analysis.`,
      },
      {
        q: "How are keywords usually recognised?",
        freq: "occasional",
        a: `Lex the whole word with the identifier rule, then look it up in a **keyword table** (hash set, perfect hash, or a switch on length and first character). This keeps the scanner's state machine small and automatically gives maximal munch (\`iffy\` is an identifier). Writing one DFA path per keyword works too (generators do it) but bloats the tables. **Contextual (soft) keywords** like Python's \`match\` or C#'s \`async\` are lexed as identifiers and recognised by the parser in the right position.`,
      },
    ],
    quiz: [
      {
        q: "How many tokens does `count >= 10;` contain (not counting end of file)?",
        options: ["4", "5", "6", "9"],
        answer: 0,
        explain: "count, >=, 10 and ;. Spaces aren't tokens, and >= is a single token by maximal munch.",
      },
      {
        q: "Why should a lexer check `<=` before `<`?",
        options: [
          "Because `<` is rarer",
          "To take the longest token: otherwise `<=` would be split into `<` and `=`",
          "Because the parser expects it",
          "Because `=` is a keyword",
        ],
        answer: 1,
        explain: "Maximal munch: when two operators share a prefix, the longer one must win.",
      },
      {
        q: "How does a typical lexer tell the keyword `while` from the name `whilst`?",
        options: [
          "A special regular expression for each keyword",
          "It reads the whole word, then checks it against a keyword set",
          "The parser decides",
          "By the following character",
        ],
        answer: 1,
        explain: "Read the full identifier (maximal munch), then look it up: whilst isn't in the set, so it's a name.",
      },
      {
        q: "Which of these mistakes can the lexer report?",
        options: ["A missing closing brace", "An undefined variable", "An unterminated string", "Calling a function with too few arguments"],
        answer: 2,
        explain: "The lexer sees characters and tokens only. Braces are the parser's job; names and argument counts are semantic analysis.",
      },
      {
        q: "Where should an 'unterminated string' error point?",
        options: ["At the end of the file", "At the opening quote", "At the next line", "At the first token"],
        answer: 1,
        explain: "The opening quote is where the problem started and where the programmer needs to look.",
      },
      {
        q: "In C, how is `x+++y` lexed?",
        options: ["x + ++ y", "x ++ + y", "x + + + y", "It's a lexical error"],
        answer: 1,
        explain: "Maximal munch takes the longest token at each point: x, then ++, then +, then y.",
      },
      {
        q: "What do lexer generators like flex compile your token rules into?",
        options: ["A recursive descent parser", "A single deterministic finite automaton (DFA)", "Bytecode", "A hash table"],
        answer: 1,
        explain: "All the rules' regular expressions become one DFA that's run to find the longest match, with rule order breaking ties.",
      },
      {
        q: "Why does each token store its line and column?",
        options: ["To speed up parsing", "So later phases can report errors at the right place", "To compute indentation", "Because the linker needs it"],
        answer: 1,
        explain: "Only the lexer sees raw positions. Parser, type checker and even runtime errors use the positions stamped on tokens.",
      },
    ],
  },

  // ------------------------------------------------------------------ AUTOMATA
  {
    id: "comp-automata",
    title: "Regular expressions and finite automata",
    tagline: "The theory under every lexer and regex engine: DFAs and NFAs, Thompson's construction, the subset construction, DFA minimisation, backtracking vs automata matching (and ReDoS), and what regular languages can't do.",
    difficulty: "intermediate",
    minutes: 40,
    visualizers: ["automata"],
    concept: `## Explain it like I'm 10 🧸
Picture a board game. You stand on a **start square**. You read the next letter of a word, and an **arrow** labelled with that letter tells you which square to move to. When the word ends, if you're standing on a **gold square**, the word "matches". If there's no arrow for a letter, you're out.

That's a **finite automaton**: a few squares (states), arrows (transitions), and some gold squares (accepting states). It has no memory except **which square you're on**. Amazingly, every regular expression can be turned into one of these games, and the computer can play it super fast: one move per letter, never going back.

## Deterministic finite automata (DFA)
A **DFA** has a finite set of **states**, a **start** state, some **accepting** states, and for each state and each input character **at most one** next state. Running it is a loop with one table lookup per character:
\`\`\`python
state = start
for c in text:
    state = table[state, c]    # no arrow? reject
return state in accepting
\`\`\`
That's **O(n)** time for a string of length n, with no backtracking, whatever the pattern. This is why lexers are fast.

## Nondeterministic finite automata (NFA)
An **NFA** relaxes the rules: a state can have **several** arrows for the same character, and **ε-moves** (epsilon) that happen without reading anything. An NFA accepts if **any** way of moving ends on an accepting state. NFAs are much easier to **build** from a regex; DFAs are easier to **run**.

## Regex → NFA: Thompson's construction
Build an NFA fragment (one start, one accept state) for every piece of the regex and glue them together:
- a letter \`a\`: two states joined by an \`a\` arrow;
- **concatenation** \`AB\`: an ε-move from A's accept to B's start;
- **alternation** \`A|B\`: a new start with ε-moves into both, and both accepts ε-move to a new accept;
- **star** \`A*\`: ε-moves to skip A entirely, and from A's end back to its start to repeat.

The NFA has at most **2 states per regex symbol**, so it's small. Our sample turns \`(a|b)*abb\` into a 14-state NFA, 11 of whose 16 edges are ε-moves.

## NFA → DFA: the subset construction
The key idea: simulate **all** the places the NFA could be **at once**. A DFA state is a **set of NFA states**.
1. The DFA start state is the **ε-closure** of the NFA's start: everything reachable by ε-moves alone.
2. From a DFA state S and a letter c: take every NFA state in S, follow its c-arrows, then take the ε-closure. That set is the next DFA state.
3. Repeat for every new set until no new sets appear. A DFA state accepts if its set contains the NFA's accept state.

In theory a DFA can have **2ⁿ** states for an n-state NFA (\`(a|b)*a(a|b)(a|b)...\` with k copies needs about 2ᵏ). In practice it's usually small, and engines like RE2 build DFA states **lazily**, only for the inputs they actually see.

## DFA minimisation
Subset construction can produce states that **behave identically**. Minimisation merges them:
1. Split the states into two groups: accepting and non-accepting.
2. Repeatedly split a group if two of its states go to **different groups** on the same letter.
3. When nothing splits, each group becomes one state.

This is **Moore's algorithm** (Hopcroft's is a faster O(n log n) refinement of the same idea). For every regular language there is exactly one smallest DFA, so minimisation is also how you test whether two regexes match the same strings.

## How lexer generators use this
\`flex\` and \`re2c\` turn **every token rule** into an NFA, join them with one big alternation, convert to a single DFA, and mark each accepting state with the **earliest rule** it accepts for. To lex, run the DFA as far as it can go while remembering the **last accepting state** seen; when it gets stuck, back up to that position and emit that token. That's maximal munch, done in linear time.

## Backtracking engines and ReDoS
Most regex libraries you use (Python's \`re\`, JavaScript, Java, PCRE, Perl) are **backtracking** engines: they try one path through the pattern, and when it fails, back up and try another. That makes **backreferences** (\`(a+)\\1\`) and lookarounds possible, but some patterns take **exponential** time:
\`\`\`text
pattern (a+)+$      input "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
\`\`\`
Each \`a\` can belong to the inner or outer loop: 2ⁿ ways to fail. This is **ReDoS** (regular expression denial of service): it took down Stack Overflow in 2016 and Cloudflare in 2019. Automata-based engines (**RE2**, Go's \`regexp\`, Rust's \`regex\`) guarantee linear time by refusing features that need backtracking.

## What regular expressions can't do
A finite automaton has finite memory, so it **can't count without limit**. No regex can match "balanced brackets" or "the same number of a's then b's" (aⁿbⁿ). The **pumping lemma** proves it: any long enough string a DFA accepts has a loop in its path, and repeating that loop gives strings the DFA must also accept. Nesting needs a **stack**, and that's exactly what the next lesson adds: **context-free grammars**.

| Language class | Recognised by | Used for |
|---|---|---|
| Regular | finite automata, regex | tokens |
| Context-free | pushdown automata (an automaton plus a stack), grammars | syntax: nesting, brackets, blocks |
| Context-sensitive and beyond | linear-bounded automata, Turing machines | "declared before use", types (done by hand in semantic analysis) |

This ladder is the **Chomsky hierarchy**.`,
    keyPoints: [
      "A DFA has one move per state and character; running it is O(n) with no backtracking",
      "An NFA may have several moves and ε-moves; it's easy to build from a regex (Thompson's construction)",
      "The subset construction turns an NFA into a DFA whose states are sets of NFA states",
      "Minimisation merges states no input can tell apart; every regular language has one smallest DFA",
      "Backtracking regex engines can take exponential time (ReDoS); RE2, Go and Rust's regex use automata and stay linear",
      "Regular languages can't count or nest: matching brackets needs a grammar and a stack",
    ],
    code: [
      {
        title: "Regex → NFA → DFA",
        variants: [{ lang: "python", code: `# From a regular expression to a machine that matches it:
#   regex --(Thompson's construction)--> NFA --(subset construction)--> DFA
# Supports letters, | (or), * (zero or more), + (one or more), ? (optional) and parentheses.

def to_postfix(regex):
    """Insert explicit concatenation dots, then convert to postfix (shunting-yard)."""
    out, prev = [], None
    for c in regex:  # "ab|c*" -> "a.b|c*"
        if prev is not None and prev not in "(|" and c not in ")|*+?":
            out.append(".")
        out.append(c)
        prev = c
    prec = {"|": 1, ".": 2}
    postfix, ops = [], []
    for c in out:
        if c == "(":
            ops.append(c)
        elif c == ")":
            while ops[-1] != "(":
                postfix.append(ops.pop())
            ops.pop()
        elif c in prec:
            while ops and ops[-1] != "(" and prec[ops[-1]] >= prec[c]:
                postfix.append(ops.pop())
            ops.append(c)
        else:  # a letter, or a postfix operator * + ? that applies to what's already on the output
            postfix.append(c)
    return "".join(postfix + ops[::-1])


class NFA:
    def __init__(self):
        self.edges = []  # (from, symbol or None for an epsilon move, to)
        self.count = 0

    def state(self):
        self.count += 1
        return self.count - 1


def thompson(postfix):
    """Every piece becomes a small NFA fragment (start, accept); operators glue fragments together."""
    nfa, stack = NFA(), []
    for c in postfix:
        if c == ".":
            (s2, a2), (s1, a1) = stack.pop(), stack.pop()
            nfa.edges.append((a1, None, s2))
            stack.append((s1, a2))
        elif c == "|":
            (s2, a2), (s1, a1) = stack.pop(), stack.pop()
            s, a = nfa.state(), nfa.state()
            nfa.edges += [(s, None, s1), (s, None, s2), (a1, None, a), (a2, None, a)]
            stack.append((s, a))
        elif c in "*+?":
            s1, a1 = stack.pop()
            s, a = nfa.state(), nfa.state()
            nfa.edges += [(s, None, s1), (a1, None, a)]
            if c != "+":
                nfa.edges.append((s, None, a))   # skip it entirely
            if c != "?":
                nfa.edges.append((a1, None, s1))  # go round again
            stack.append((s, a))
        else:
            s, a = nfa.state(), nfa.state()
            nfa.edges.append((s, c, a))
            stack.append((s, a))
    start, accept = stack.pop()
    return nfa, start, accept


def closure(nfa, states):
    """Every state reachable through epsilon moves alone."""
    seen, todo = set(states), list(states)
    while todo:
        s = todo.pop()
        for f, sym, t in nfa.edges:
            if f == s and sym is None and t not in seen:
                seen.add(t)
                todo.append(t)
    return frozenset(seen)


def move(nfa, states, c):
    return {t for f, sym, t in nfa.edges if f in states and sym == c}


def subset_construction(nfa, start, accept, alphabet):
    """Each DFA state is a SET of NFA states: all the places the NFA could be at once."""
    first = closure(nfa, {start})
    names, table, todo = {first: "A"}, {}, [first]
    while todo:
        S = todo.pop(0)
        for c in alphabet:
            T = closure(nfa, move(nfa, S, c))
            if not T:
                continue
            if T not in names:
                names[T] = chr(ord("A") + len(names))
                todo.append(T)
            table[names[S], c] = names[T]
    accepting = {names[S] for S in names if accept in S}
    return table, "A", accepting, names


regex = "(a|b)*abb"
postfix = to_postfix(regex)
nfa, start, accept = thompson(postfix)
print(f"regex {regex}   postfix {postfix}")
print(f"NFA: {nfa.count} states, {len(nfa.edges)} edges ({sum(e[1] is None for e in nfa.edges)} are epsilon moves)")

table, dstart, accepting, names = subset_construction(nfa, start, accept, "ab")
print(f"DFA: {len(names)} states, start A, accepting {sorted(accepting)}")
print("state  NFA states                         on a  on b")
for S, n in sorted(names.items(), key=lambda kv: kv[1]):
    print(f"  {n}{'*' if n in accepting else ' '}   {str(sorted(S)):<34} {table.get((n, 'a'), '-'):>4}  {table.get((n, 'b'), '-'):>4}")


def dfa_match(text):
    state = dstart
    for c in text:
        state = table.get((state, c))
        if state is None:
            return False
    return state in accepting


for word in ["abb", "aabb", "babb", "ab", "abba", "bbbabb"]:
    print(f"{word:<7} {'match' if dfa_match(word) else 'no match'}")` }],
        explain: `- \`to_postfix\` first inserts explicit concatenation dots (\`(a|b)*abb\` → \`(a|b)*.a.b.b\`), then uses the **shunting-yard** algorithm so the NFA builder can work with a simple stack: \`ab|*a.b.b.\`.
- \`thompson\` pops fragments and pushes bigger ones, exactly as described above. For \`*\`, the \`(s, None, a)\` edge skips the fragment and \`(a1, None, s1)\` loops back.
- \`closure\` is a graph search following only ε-edges; \`move\` follows one letter. The DFA state for "after reading \`ab\`" is \`D = [0, 2, 3, 4, 5, 7, 8, 11, 12]\`: all the NFA states we could be in.
- Read the table as the DFA: from **E** (just matched \`abb\`), an \`a\` goes to B and a \`b\` to C: the automaton keeps track of how much of a possible ending \`abb\` it has seen.
- \`dfa_match\` is the four-line loop from the lesson: one dictionary lookup per character.`,
        output: `regex (a|b)*abb   postfix ab|*a.b.b.
NFA: 14 states, 16 edges (11 are epsilon moves)
DFA: 5 states, start A, accepting ['E']
state  NFA states                         on a  on b
  A    [0, 2, 4, 6, 7, 8]                    B     C
  B    [0, 1, 2, 4, 5, 7, 8, 9, 10]          B     D
  C    [0, 2, 3, 4, 5, 7, 8]                 B     C
  D    [0, 2, 3, 4, 5, 7, 8, 11, 12]         B     E
  E*   [0, 2, 3, 4, 5, 7, 8, 13]             B     C
abb     match
aabb    match
babb    match
ab      no match
abba    no match
bbbabb  match`,
      },
      {
        title: "Minimising the DFA",
        variants: [{ lang: "python", code: `# DFA minimisation: merge states that can never be told apart (partition refinement).
# The DFA for (a|b)*abb straight out of subset construction has 5 states; the smallest has 4.

table = {
    ("A", "a"): "B", ("A", "b"): "C",
    ("B", "a"): "B", ("B", "b"): "D",
    ("C", "a"): "B", ("C", "b"): "C",
    ("D", "a"): "B", ("D", "b"): "E",
    ("E", "a"): "B", ("E", "b"): "C",
}
states, alphabet, accepting = ["A", "B", "C", "D", "E"], "ab", {"E"}

# Start with two groups: accepting and not accepting. Then keep splitting a group whenever two of
# its states go to DIFFERENT groups on the same letter. Stop when nothing splits any more.
groups = [set(s for s in states if s not in accepting), set(accepting)]
round_ = 0
while True:
    round_ += 1
    which = {s: i for i, g in enumerate(groups) for s in g}
    print(f"round {round_}: " + "  ".join("{" + ",".join(sorted(g)) + "}" for g in groups))
    new_groups = []
    for g in groups:
        by_signature = {}
        for s in sorted(g):
            signature = tuple(which[table[s, c]] for c in alphabet)  # which group each letter leads to
            by_signature.setdefault(signature, set()).add(s)
        new_groups += by_signature.values()
    if len(new_groups) == len(groups):
        break
    groups = new_groups

print(f"done: {len(states)} states -> {len(groups)} states")
for g in groups:
    if len(g) > 1:
        print(f"merged {sorted(g)}: on every input they lead to the same groups, so no string can tell them apart")` }],
        explain: `- Round 1 separates accepting \`{E}\` from the rest. D splits off in round 2 because on \`b\` it reaches E's group while the others don't.
- Round 3 splits B off: B goes to D on \`b\`, A and C go to C. A and C are never split: on \`a\` both go to B, on \`b\` both go to C. **No string** can tell them apart, so they merge.
- The result has 4 states: "seen nothing useful", "seen \`a\`", "seen \`ab\`", "seen \`abb\`". That's the textbook minimal DFA for \`(a|b)*abb\`.`,
        output: `round 1: {A,B,C,D}  {E}
round 2: {A,B,C}  {D}  {E}
round 3: {A,C}  {B}  {D}  {E}
done: 5 states -> 4 states
merged ['A', 'C']: on every input they lead to the same groups, so no string can tell them apart`,
      },
    ],
    interview: [
      {
        q: "What's the difference between a DFA and an NFA? Are NFAs more powerful?",
        freq: "common",
        a: `A **DFA** has exactly one transition per state and symbol and no ε-moves; an **NFA** may have several (or none) per symbol plus ε-moves, and accepts if **any** path accepts. They're **equally powerful**: both recognise exactly the regular languages, and the subset construction converts any NFA into an equivalent DFA. The trade-off is size versus speed: an NFA is small (linear in the regex) but simulating it costs O(n·m); a DFA runs in O(n) but can be exponentially larger.`,
      },
      {
        q: "How do you convert a regular expression into a DFA?",
        freq: "common",
        a: `1. **Thompson's construction**: build an NFA recursively, one fragment per symbol, glued with ε-moves for concatenation, alternation and star.
2. **Subset construction**: each DFA state is the ε-closure of a set of NFA states; follow each symbol from each set until no new sets appear.
3. Optionally **minimise** with Hopcroft's or Moore's partition refinement.

Alternatives: the **direct** construction from the regex's syntax tree using followpos sets (Dragon Book), and **Brzozowski derivatives**.`,
      },
      {
        q: "What is catastrophic backtracking (ReDoS), and how do you prevent it?",
        freq: "common",
        a: `Backtracking regex engines explore alternatives one by one. Patterns with **nested or overlapping quantifiers**, like \`(a+)+$\`, \`(a|a)*\` or \`(\\w+\\s?)*$\`, give exponentially many ways to split a failing input, so matching can take seconds or years. Attackers exploit this with crafted input (ReDoS).

Prevention: use a **linear-time engine** (RE2, Go, Rust's \`regex\`) for untrusted input; avoid nested quantifiers; use **possessive quantifiers** or **atomic groups** where supported; anchor patterns; set match **timeouts**; limit input length; lint patterns with ReDoS checkers.`,
      },
      {
        q: "Can a regular expression check that brackets are balanced? Why or why not?",
        freq: "common",
        a: `No (for true regular expressions). Balanced brackets need to **count** unboundedly deep nesting, but a finite automaton only has finitely many states. By the **pumping lemma**, any DFA claiming to accept balanced strings would also accept \`(ⁿ)ᵐ\` for some n ≠ m. You need a **stack**: a pushdown automaton, which corresponds to **context-free grammars**. (Some "regex" engines add recursion, like PCRE's \`(?R)\`, which makes them more powerful than regular languages.)`,
      },
      {
        q: "How does a lexer generator choose between rules when several match?",
        freq: "occasional",
        a: `Two rules: **longest match** wins (maximal munch), and if two rules match the same longest lexeme, the rule **listed first** wins. The combined DFA's accepting states are labelled with the highest-priority rule they accept for. The scanner runs the DFA as far as possible, remembering the last position where it was in an accepting state, then backs up to it. That's why keyword rules are listed before the identifier rule in flex files.`,
      },
      {
        q: "What does DFA minimisation do, and why is the minimal DFA unique?",
        freq: "occasional",
        a: `It merges **indistinguishable** states: two states are equivalent if, for every possible remaining input, both accept or both reject. Partition refinement starts with {accepting, non-accepting} and splits groups whose members transition into different groups, until stable (Hopcroft's algorithm does it in O(n log n)). The **Myhill–Nerode theorem** says each regular language has a unique minimal DFA (up to renaming states), so minimisation gives a canonical form: two regexes are equivalent iff their minimal DFAs are identical.`,
      },
    ],
    quiz: [
      {
        q: "How long does it take a DFA to check a string of length n?",
        options: ["O(1)", "O(n)", "O(n²)", "It depends on the pattern; it can be exponential"],
        answer: 1,
        explain: "One table lookup per character, never going back. Exponential time is a backtracking-engine problem.",
      },
      {
        q: "What is an ε-move (epsilon move) in an NFA?",
        options: ["A move that reads an e", "A move that happens without reading any input", "A move to an error state", "A move that ends the string"],
        answer: 1,
        explain: "ε-moves let Thompson's construction glue fragments together for free.",
      },
      {
        q: "In the subset construction, what is a DFA state?",
        options: ["One NFA state", "A set of NFA states the NFA could be in at once", "A regex", "A token"],
        answer: 1,
        explain: "The DFA tracks every NFA state reachable after the input read so far.",
      },
      {
        q: "In the minimisation sample, why can A and C be merged?",
        options: [
          "They have the same name",
          "On every letter they go to the same groups, so no input can tell them apart",
          "Neither is accepting",
          "They're both reachable from the start",
        ],
        answer: 1,
        explain: "Both go to B on a and C on b. Two states that react identically to all future input are equivalent.",
      },
      {
        q: "Which engine is immune to catastrophic backtracking?",
        options: ["Python's re", "JavaScript's RegExp", "RE2 / Go's regexp", "PCRE"],
        answer: 2,
        explain: "RE2, Go and Rust's regex use automata and guarantee linear time, giving up backreferences in exchange.",
      },
      {
        q: "Why can't a regular expression match balanced brackets of any depth?",
        options: [
          "Brackets are special characters",
          "Finite automata have finite memory and can't count unbounded nesting",
          "It can, with enough stars",
          "Regexes can't match punctuation",
        ],
        answer: 1,
        explain: "Nesting needs a stack. That's the jump from regular languages to context-free grammars.",
      },
      {
        q: "How big can the DFA from an n-state NFA get, in the worst case?",
        options: ["n states", "2n states", "n² states", "2ⁿ states"],
        answer: 3,
        explain: "Each DFA state is a subset of NFA states, and there are 2ⁿ subsets. In practice it's usually far smaller, and lazy construction avoids the blow-up.",
      },
    ],
  },

  // ------------------------------------------------------------------ GRAMMARS
  {
    id: "comp-grammars",
    title: "Grammars, trees and ambiguity",
    tagline: "Context-free grammars and BNF, derivations, parse trees vs abstract syntax trees, ambiguity and how precedence and associativity remove it, left recursion, FIRST and FOLLOW sets, and LL(1) table-driven parsing.",
    difficulty: "intermediate",
    minutes: 40,
    visualizers: ["llparse"],
    concept: `## Explain it like I'm 10 🧸
Grammar rules are like **LEGO instructions** for sentences. One instruction might say: "a **sentence** is a **naming part** followed by a **doing part**". Another: "a **naming part** is *the* + an animal". Another: "a **doing part** is a verb, maybe followed by another **naming part**". Using the instructions over and over, you can build "the cat chased the dog", and also check whether a sentence someone else built follows the rules.

Programming languages have instructions like that too: "an **if-statement** is the word \`if\`, an **expression**, then a **block**." And the instructions can use **themselves** ("a block contains statements, and a statement can be a block"), which is how code can nest as deep as you like. Regular expressions couldn't do that; grammars can.

## Context-free grammars
A **context-free grammar** (CFG) has:
- **terminals**: the tokens (\`if\`, \`+\`, \`id\`, \`(\`);
- **nonterminals**: named structures (\`Expr\`, \`Stmt\`, \`Block\`);
- **productions** (rules): \`Nonterminal → sequence of symbols\`;
- a **start symbol**.

Written in **BNF** (Backus–Naur form) or its extended form **EBNF** (with \`{ }\` for repetition and \`[ ]\` for optional):
\`\`\`text
program   → { statement }
statement → "let" NAME "=" expr ";"
          | "print" expr ";"
          | "if" expr block [ "else" block ]
          | "while" expr block
block     → "{" { statement } "}"
expr      → expr "+" term | expr "-" term | term
term      → term "*" factor | term "/" factor | factor
factor    → NUMBER | NAME | "(" expr ")"
\`\`\`
Python, Go, Rust and C all publish grammars like this in their language references.

## Derivations and parse trees
A **derivation** starts from the start symbol and repeatedly replaces a nonterminal using a rule, until only tokens are left. Drawing the replacements gives a **parse tree** (concrete syntax tree): every rule used becomes a node. The **parser's job** is the reverse: given tokens, find the tree.

## Parse trees vs abstract syntax trees
A parse tree for \`1 + 2 * 3\` includes every grammar detail: \`expr → term → factor → 1\`, the brackets, the semicolons. Compilers keep an **abstract syntax tree** (AST) instead: only what matters for meaning.
\`\`\`text
parse tree (part)                    AST
expr                                  (+)
├── expr ── term ── factor ── 1      /   \\
├── +                               1    (*)
└── term                                /   \\
    ├── term ── factor ── 2            2     3
    ├── *
    └── factor ── 3
\`\`\`
Brackets disappear (the tree's shape replaces them), chains like \`expr → term → factor\` collapse, and punctuation goes away. Every later phase works on the AST.

## Ambiguity
A grammar is **ambiguous** if some input has **two different parse trees**. The obvious expression grammar is:
\`\`\`text
E → E + E | E * E | num
\`\`\`
With it, \`1 + 2 * 3\` can mean \`1 + (2 * 3) = 7\` **or** \`(1 + 2) * 3 = 9\` (second sample). Ambiguity is a disaster for a programming language: the same code could mean two things. The number of trees grows explosively: 7 operators give 429 possible trees (the **Catalan numbers**).

Two standard fixes:
1. **Rewrite the grammar** with one nonterminal per **precedence level**, as in \`expr\`/\`term\`/\`factor\` above. Lower precedence near the top, higher precedence deeper down.
2. Keep the simple grammar and **declare** precedence and associativity separately (yacc's \`%left '+'\`, Pratt parsing's binding powers).

**Associativity** decides how to group the same operator: \`8 - 3 - 2\` is \`(8 - 3) - 2 = 3\` (**left**-associative), while \`2 ^ 3 ^ 2\` is \`2 ^ (3 ^ 2) = 512\` (**right**-associative). Rules like \`expr → expr - term\` (left recursion) give left associativity; \`pow → base ^ pow\` (right recursion) gives right associativity.

The other famous ambiguity is the **dangling else**: in \`if a then if b then s1 else s2\`, which \`if\` owns the \`else\`? Every language picks "the nearest one" (Python and Go avoid the question with mandatory blocks). You'll see it as a parser conflict in the LR lesson.

## Top-down parsing and left recursion
A **top-down** parser starts at the start symbol and predicts which rule to use, matching tokens as it goes. A rule like \`expr → expr + term\` is **left-recursive**: to parse an \`expr\`, first parse an \`expr\`... forever. Top-down parsers must **eliminate left recursion**:
\`\`\`text
E → E + T | T          becomes          E  → T E'
                                        E' → + T E' | ε
\`\`\`
(\`ε\` means "nothing".) In a hand-written parser it simply becomes a **loop**: parse a \`T\`, then \`while\` the next token is \`+\`, parse another \`T\`. That's what the one-page compiler in Part 1 did.

## FIRST and FOLLOW, and LL(1)
To predict the right rule by looking at **one token ahead**, compute:
- **FIRST(X)**: the tokens that can start something derived from X. FIRST(F) = { \`(\`, \`id\` }.
- **FOLLOW(A)**: the tokens that can come right after A. FOLLOW(E) = { \`)\`, \`$\` } (\`$\` = end of input).

The **LL(1) parse table** says: for nonterminal A and next token t, use the rule whose FIRST contains t (or, if the rule can be empty, the one where t is in FOLLOW(A)). If any cell needs two rules, the grammar **isn't LL(1)**. "LL(1)" means: read **L**eft to right, build a **L**eftmost derivation, **1** token of lookahead.

The table-driven parser keeps a **stack** of what it still expects. Top is a token? It must match the input. Top is a nonterminal? Replace it with the rule the table chooses. Step through it in the visualizer, and in the first sample: the error is caught the moment the table has no entry (\`T\` can't start with \`*\`).

In practice you rarely build LL tables by hand: **recursive descent** (next lesson) is LL parsing written as functions, with the call stack as the parser's stack. ANTLR generates LL(*) parsers for you.`,
    keyPoints: [
      "A context-free grammar has terminals (tokens), nonterminals, productions and a start symbol; written in BNF or EBNF",
      "Parsing finds the tree for the tokens; compilers keep an AST that drops brackets, punctuation and rule chains",
      "Ambiguous grammars give two trees for one input; fix with precedence levels in the grammar or declared precedence",
      "Left recursion gives left associativity but loops forever in top-down parsers: rewrite it as a loop or with E'",
      "FIRST and FOLLOW sets build the LL(1) table: one token of lookahead picks the rule",
      "A table conflict means the grammar isn't LL(1)",
    ],
    code: [
      {
        title: "FIRST, FOLLOW and an LL(1) parser",
        variants: [{ lang: "python", code: `# FIRST and FOLLOW sets, an LL(1) parse table, and a table-driven parser that uses it.
# The grammar is the classic expression grammar with left recursion removed ("eps" means empty).
GRAMMAR = {
    "E":  [["T", "E'"]],
    "E'": [["+", "T", "E'"], ["eps"]],
    "T":  [["F", "T'"]],
    "T'": [["*", "F", "T'"], ["eps"]],
    "F":  [["(", "E", ")"], ["id"]],
}
START = "E"
nonterminals = list(GRAMMAR)
is_terminal = lambda s: s not in GRAMMAR and s != "eps"


def first_of(symbols, FIRST):
    """FIRST of a sequence: the first symbol's FIRST, then the next one's if the first can be empty, ..."""
    out = set()
    for s in symbols:
        f = {s} if is_terminal(s) else ({"eps"} if s == "eps" else FIRST[s])
        out |= f - {"eps"}
        if "eps" not in f:
            return out
    return out | {"eps"}


# Both sets are computed by repeating the rules until nothing changes (a "fixed point").
FIRST = {n: set() for n in nonterminals}
changed = True
while changed:
    changed = False
    for n, prods in GRAMMAR.items():
        for p in prods:
            new = first_of(p, FIRST)
            if not new <= FIRST[n]:
                FIRST[n] |= new
                changed = True

FOLLOW = {n: set() for n in nonterminals}
FOLLOW[START].add("$")  # $ marks the end of the input
changed = True
while changed:
    changed = False
    for n, prods in GRAMMAR.items():
        for p in prods:
            for i, s in enumerate(p):
                if s not in GRAMMAR:
                    continue
                rest = first_of(p[i + 1:], FIRST) if p[i + 1:] else {"eps"}
                new = (rest - {"eps"}) | (FOLLOW[n] if "eps" in rest else set())
                if not new <= FOLLOW[s]:
                    FOLLOW[s] |= new
                    changed = True

fmt = lambda s: "{" + ", ".join(sorted(s)) + "}"
for n in nonterminals:
    print(f"{n:<3} FIRST {fmt(FIRST[n]):<14} FOLLOW {fmt(FOLLOW[n])}")

# The parse table: for nonterminal N and next token t, which production to use.
TABLE = {}
for n, prods in GRAMMAR.items():
    for p in prods:
        f = first_of(p, FIRST)
        for t in (f - {"eps"}) | (FOLLOW[n] if "eps" in f else set()):
            assert (n, t) not in TABLE, f"not LL(1): conflict at {n}, {t}"
            TABLE[n, t] = p
print(f"LL(1) table: {len(TABLE)} entries, no conflicts")


def parse(tokens):
    stack, tokens, i = ["$", START], tokens + ["$"], 0
    print(f"{'stack':<22}{'input':<18}action")
    while stack:
        top, look = stack[-1], tokens[i]
        shown = (" ".join(stack), " ".join(tokens[i:]))
        if top == look:
            action = f"match {look}" if look != "$" else "accept"
            stack.pop()
            i += 1
        elif top in GRAMMAR:
            prod = TABLE.get((top, look))
            if prod is None:
                print(f"{shown[0]:<22}{shown[1]:<18}error: no rule for {top} when the next token is {look}")
                return False
            action = f"{top} -> {' '.join(prod)}"
            stack.pop()
            stack.extend(s for s in reversed(prod) if s != "eps")
        else:
            print(f"{shown[0]:<22}{shown[1]:<18}error: expected {top}, found {look}")
            return False
        print(f"{shown[0]:<22}{shown[1]:<18}{action}")
    return True


parse(["id", "+", "id", "*", "id"])
print()
parse(["id", "+", "*"])` }],
        explain: `- The grammar is the expression grammar with left recursion removed. \`E'\` and \`T'\` handle "more \`+ T\` (or \`* F\`), or nothing".
- FIRST and FOLLOW are computed by **iterating to a fixed point**: apply the rules again and again until no set grows. This style of algorithm is everywhere in compilers (you'll meet it again in data-flow analysis).
- FOLLOW(T') includes \`+\`: after a term can come a \`+\`. That's how the parser knows to pick \`T' → ε\` when it sees \`+\`: the \`*\` part is finished.
- The trace shows the stack (right end = top) and remaining input. \`E -> T E'\` replaces E with its rule, pushed **in reverse** so T ends up on top. A token on top must equal the input token.
- The error case dies with the precise reason: after \`+\`, a T must start with \`(\` or \`id\`, and \`*\` is neither.`,
        output: `E   FIRST {(, id}        FOLLOW {$, )}
E'  FIRST {+, eps}       FOLLOW {$, )}
T   FIRST {(, id}        FOLLOW {$, ), +}
T'  FIRST {*, eps}       FOLLOW {$, ), +}
F   FIRST {(, id}        FOLLOW {$, ), *, +}
LL(1) table: 13 entries, no conflicts
stack                 input             action
$ E                   id + id * id $    E -> T E'
$ E' T                id + id * id $    T -> F T'
$ E' T' F             id + id * id $    F -> id
$ E' T' id            id + id * id $    match id
$ E' T'               + id * id $       T' -> eps
$ E'                  + id * id $       E' -> + T E'
$ E' T +              + id * id $       match +
$ E' T                id * id $         T -> F T'
$ E' T' F             id * id $         F -> id
$ E' T' id            id * id $         match id
$ E' T'               * id $            T' -> * F T'
$ E' T' F *           * id $            match *
$ E' T' F             id $              F -> id
$ E' T' id            id $              match id
$ E' T'               $                 T' -> eps
$ E'                  $                 E' -> eps
$                     $                 accept

stack                 input             action
$ E                   id + * $          E -> T E'
$ E' T                id + * $          T -> F T'
$ E' T' F             id + * $          F -> id
$ E' T' id            id + * $          match id
$ E' T'               + * $             T' -> eps
$ E'                  + * $             E' -> + T E'
$ E' T +              + * $             match +
$ E' T                * $               error: no rule for T when the next token is *`,
      },
      {
        title: "An ambiguous grammar, and how badly it explodes",
        variants: [{ lang: "python", code: `# An ambiguous grammar gives one sentence two different trees, and the trees can mean different things.
#   E -> E + E | E * E | num
# We find EVERY tree for a token list by trying each operator as the root, recursively.
from functools import lru_cache

tokens = ("1", "+", "2", "*", "3")


@lru_cache(maxsize=None)
def trees(lo, hi):
    """All parse trees for tokens[lo:hi]."""
    if hi - lo == 1:
        return [tokens[lo]] if tokens[lo].isdigit() else []
    out = []
    for k in range(lo + 1, hi - 1):
        if tokens[k] in "+*":  # E -> E op E with the op at position k
            for left in trees(lo, k):
                for right in trees(k + 1, hi):
                    out.append((tokens[k], left, right))
    return out


def show(t):
    return t if isinstance(t, str) else f"({show(t[1])} {t[0]} {show(t[2])})"


def value(t):
    if isinstance(t, str):
        return int(t)
    a, b = value(t[1]), value(t[2])
    return a + b if t[0] == "+" else a * b


all_trees = trees(0, len(tokens))
print(f"{' '.join(tokens)} has {len(all_trees)} parse trees with the ambiguous grammar:")
for t in all_trees:
    print(f"  {show(t):<15} = {value(t)}")

# Longer inputs explode: the number of trees grows like the Catalan numbers.
for n in range(1, 8):
    tokens = tuple(" + ".join(["1"] * (n + 1)).split())
    trees.cache_clear()
    count = len(trees(0, len(tokens)))
    print(f"{n} operator{'s' if n > 1 else ' '}: {count:>3} tree{'s' if count > 1 else ''}")

# The fix is to rewrite the grammar with one level per precedence:
#   expr -> expr + term | term      (+ is lower and left-associative)
#   term -> term * num  | num       (* binds tighter)
# Now 1 + 2 * 3 has exactly one tree: (1 + (2 * 3)) = 7.` }],
        explain: `- \`trees(lo, hi)\` tries every operator in the range as the root and combines all the trees for the left and right parts. It's **memoised** with \`lru_cache\`: this is a small version of the **CYK** algorithm, which can parse any context-free grammar in O(n³).
- \`1 + 2 * 3\` has two trees with **different values**, 7 and 9: ambiguity changes the meaning.
- The counts 1, 2, 5, 14, 42, 132, 429 are the **Catalan numbers**: the number of ways to put brackets around n operators. A real language must pick exactly one.`,
        output: `1 + 2 * 3 has 2 parse trees with the ambiguous grammar:
  (1 + (2 * 3))   = 7
  ((1 + 2) * 3)   = 9
1 operator :   1 tree
2 operators:   2 trees
3 operators:   5 trees
4 operators:  14 trees
5 operators:  42 trees
6 operators: 132 trees
7 operators: 429 trees`,
      },
    ],
    interview: [
      {
        q: "What's the difference between a parse tree and an abstract syntax tree?",
        freq: "very-common",
        a: `A **parse tree** (concrete syntax tree) records the full derivation: one node per grammar rule applied, including punctuation, brackets and chain rules like \`expr → term → factor\`. An **AST** keeps only the semantically meaningful structure: operators with their operands, statements with their parts. Brackets vanish because the tree's shape encodes grouping. Compilers do all later work on the AST; tools that must reproduce source exactly (formatters, refactoring tools, IDEs) keep a **concrete** or "lossless" tree with whitespace and comments (Roslyn, rust-analyzer, tree-sitter).`,
      },
      {
        q: "What makes a grammar ambiguous, and how do you resolve ambiguity for arithmetic expressions?",
        freq: "very-common",
        a: `A grammar is ambiguous if some string has more than one parse tree (equivalently, more than one leftmost derivation). \`E → E + E | E * E | num\` is ambiguous: \`1 + 2 * 3\` groups two ways.

Resolve it by encoding **precedence** with one nonterminal per level (\`expr → expr + term | term\`, \`term → term * factor | factor\`) and **associativity** by the direction of recursion (left recursion → left-associative). Or keep the ambiguous grammar and use precedence declarations (\`%left\`, \`%right\` in yacc/bison) or binding powers in a Pratt parser. Ambiguity is undecidable in general, but parser generators report it as conflicts.`,
      },
      {
        q: "What is left recursion and why is it a problem for recursive descent parsers?",
        freq: "common",
        a: `A rule is left-recursive if a nonterminal can derive a string starting with itself, e.g. \`E → E + T\`. A recursive descent function \`parse_E\` would call \`parse_E\` first, without consuming input, and recurse forever. Fix: rewrite as \`E → T E'\`, \`E' → + T E' | ε\`, or more naturally as a loop: \`t = T(); while next is '+': t = Add(t, T())\`. The loop keeps **left associativity**, which naive right-recursive rewriting would lose. Bottom-up (LR) parsers handle left recursion fine; in fact they prefer it.`,
      },
      {
        q: "What are FIRST and FOLLOW sets used for?",
        freq: "common",
        a: `**FIRST(α)** is the set of terminals that can begin strings derived from α (plus ε if α can derive nothing). **FOLLOW(A)** is the set of terminals that can appear immediately after A in some sentential form (plus \`$\` at the end of input). They build **LL(1) parse tables** (choose A → α on token t if t ∈ FIRST(α), or t ∈ FOLLOW(A) when α can be empty) and **SLR** tables (reduce by A → α when the lookahead is in FOLLOW(A)). They're also used for error recovery: skip tokens until one in FOLLOW (a "synchronisation set").`,
      },
      {
        q: "What does LL(1) mean? What grammars are not LL(1)?",
        freq: "occasional",
        a: `**L**eft-to-right scan, **L**eftmost derivation, **1** token of lookahead: the parser must choose each production by looking only at the next token. Not LL(1): any **left-recursive** grammar; grammars with **common prefixes** between alternatives (\`S → if E then S | if E then S else S\`) unless **left-factored**; and all **ambiguous** grammars. Fixes: eliminate left recursion, left-factor, or use more lookahead (LL(k), ANTLR's LL(*)), or backtracking.`,
      },
      {
        q: "How do you parse operators that are right-associative, like exponentiation or assignment?",
        freq: "occasional",
        a: `In a grammar, use **right recursion**: \`pow → unary ^ pow | unary\`, so \`2 ^ 3 ^ 2\` groups as \`2 ^ (3 ^ 2)\`. In recursive descent, parse the right operand by calling the **same** precedence level (instead of the next-higher one). In Pratt parsing, give the operator a right binding power **lower** than its left binding power (e.g. left 16, right 15). Assignment \`a = b = c\` and the conditional operator \`?:\` are right-associative in C-family languages.`,
      },
    ],
    quiz: [
      {
        q: "Why are grammars needed when regular expressions already describe tokens?",
        options: [
          "Grammars are faster",
          "Grammars can describe nesting (blocks inside blocks, brackets inside brackets) which regexes can't",
          "Regexes can't describe keywords",
          "Grammars replace the lexer",
        ],
        answer: 1,
        explain: "Recursive rules give unbounded nesting. Regular languages can't count matching brackets.",
      },
      {
        q: "What does an AST leave out compared with a parse tree?",
        options: ["The operators", "Brackets, punctuation and chain rules like expr → term → factor", "The variable names", "The order of statements"],
        answer: 1,
        explain: "The tree's shape already says how things group, so brackets and pass-through rules are redundant.",
      },
      {
        q: "With `E → E + E | E * E | num`, how many parse trees does `1 + 2 * 3` have?",
        options: ["1", "2", "3", "5"],
        answer: 1,
        explain: "Either `+` or `*` can be the root. The trees compute 7 and 9: ambiguity changes meaning.",
      },
      {
        q: "`8 - 3 - 2` should be 3. Which property of `-` guarantees that?",
        options: ["Precedence", "Left associativity", "Right associativity", "Commutativity"],
        answer: 1,
        explain: "Left-associative means (8 - 3) - 2 = 3. Right-associative would give 8 - (3 - 2) = 7.",
      },
      {
        q: "Why can't a recursive descent parser use the rule `E → E + T` directly?",
        options: [
          "It's ambiguous",
          "It's left-recursive: parse_E would call parse_E without consuming a token and recurse forever",
          "It has no terminals",
          "It needs two tokens of lookahead",
        ],
        answer: 1,
        explain: "Rewrite it as a loop or as E → T E', E' → + T E' or ε.",
      },
      {
        q: "In the LL(1) sample, what is in FOLLOW(T')?",
        options: ["`{*}`", "`{+, ), $}`", "`{(, id}`", "`{eps}`"],
        answer: 1,
        explain: "After a term can come +, a closing bracket, or the end of input. Seeing one of those tells the parser to choose T' → ε.",
      },
      {
        q: "What does it mean if building an LL(1) table puts two rules in the same cell?",
        options: ["The input has a syntax error", "The grammar isn't LL(1)", "The lexer is wrong", "Nothing; pick either"],
        answer: 1,
        explain: "A conflict means one token of lookahead isn't enough to choose: left-factor, remove left recursion, or use a stronger method.",
      },
      {
        q: "What does `2 ^ 3 ^ 2` evaluate to if `^` is right-associative?",
        options: ["64", "512", "36", "81"],
        answer: 1,
        explain: "2 ^ (3 ^ 2) = 2 ^ 9 = 512. Left-associative would be (2 ^ 3) ^ 2 = 64.",
      },
    ],
  },

  // ------------------------------------------------------------------ RECURSIVE DESCENT + PRATT
  {
    id: "comp-parsing",
    title: "Recursive descent and Pratt parsing",
    tagline: "How real parsers are written: one function per rule, a Pratt loop with binding powers for expressions, building an AST, statements and blocks, helpful syntax errors with carets, and error recovery.",
    difficulty: "intermediate",
    minutes: 45,
    visualizers: ["pratt"],
    concept: `## Explain it like I'm 10 🧸
Imagine sorting a messy pile of LEGO into a model by following the instructions **from the top**: "to build a house, build walls, then a roof". To build walls you follow the wall instructions, and so on. Each instruction is a little helper you can call. That's **recursive descent**: one helper per kind of thing.

For maths like \`1 + 2 * 3\`, there's a neat trick. Think of each operator as a **magnet** with a strength: \`*\` is a stronger magnet than \`+\`. The number \`2\` sits between \`+\` and \`*\`, and gets pulled by the **stronger** magnet, so it sticks to \`*\` first: \`2 * 3\`, and only then does \`1 +\` grab the result. That's **Pratt parsing**: give every operator a **binding power** and let the strongest one win.

## Recursive descent
Write **one function per grammar rule**. Each function looks at the current token, decides which alternative applies, and calls the functions for the parts:
\`\`\`python
def statement(self):
    if self.at("let"):   return self.let_statement()
    if self.at("if"):    return self.if_statement()
    if self.at("while"): return self.while_statement()
    ...
def if_statement(self):
    self.expect("if")
    cond = self.expression()
    then = self.block()
    otherwise = self.block() if self.match("else") else None
    return If(cond, then, otherwise)
\`\`\`
Recursive descent is just **LL parsing with functions**: the call stack is the parser's stack. It's what GCC, Clang, Go, Rust, Swift, V8, TypeScript and C# use, because it's easy to read, debug, extend and give **great error messages**.

The small helpers that make it pleasant:
- \`peek\` / \`at(...)\`: look at the current token without consuming it;
- \`advance\`: consume it;
- \`expect(text)\`: consume it if it matches, otherwise raise a syntax error naming what was expected.

## The expression problem
You could write one function per precedence level (\`or\`, \`and\`, equality, comparison, term, factor, unary, call, primary). It works, but every new operator adds a level, and parsing a single number walks through all of them.

## Pratt parsing (top-down operator precedence)
Vaughan Pratt's 1973 idea handles **all** binary operators in one loop. Every infix operator gets a **binding power**:
\`\`\`python
BINARY = {"or": 1, "and": 2, "==": 3, "<": 4, "+": 5, "-": 5, "*": 6, "/": 6}

def expression(min_power=1):
    left = unary()                                   # a number, name, (...), -x, call
    while next_token in BINARY and BINARY[next_token] >= min_power:
        op = advance()
        right = expression(BINARY[op] + 1)           # +1: left-associative
        left = Binary(op, left, right)
    return left
\`\`\`
How \`1 + 2 * 3 - 4\` parses (watch it in the visualizer):
1. \`expression(1)\` reads \`1\`. Next is \`+\` (power 5 ≥ 1): consume it and parse the right side with \`expression(6)\`.
2. \`expression(6)\` reads \`2\`. Next is \`*\` (power 6 ≥ 6): consume it, parse \`expression(7)\`, which reads \`3\` and stops at \`-\` (5 < 7). Fold \`(* 2 3)\`.
3. Back in \`expression(6)\`: next is \`-\` (5 < 6): stop and return \`(* 2 3)\`.
4. Back in \`expression(1)\`: fold \`(+ 1 (* 2 3))\`; \`-\` has power 5 ≥ 1, so continue: fold \`(- (+ 1 (* 2 3)) 4)\`.

The \`min_power\` parameter means "only take operators at least this strong". **Associativity** is the \`+ 1\`: the right operand of \`-\` only accepts operators **stronger** than \`-\`, so the next \`-\` is left for the outer loop: \`(8 - 3) - 2\`. For a **right**-associative operator like \`^\`, parse the right operand with the **same** power, so the next \`^\` binds inside. The sample writes this as a pair of left and right powers.

**Prefix** operators (\`-x\`, \`!x\`) are parsed at the start of \`unary()\`, and **postfix** ones (calls \`f(x)\`, indexing \`a[i]\`, field access \`a.b\`) in a loop right after the primary expression, because they bind tighter than everything.

Pratt parsing is used in V8, rust-analyzer, Clang (as "operator-precedence parsing"), and countless hobby languages. Your Pebble parser uses it.

## Building the AST
Each parse function **returns a node**. Use a small class per node kind (\`Binary(op, left, right)\`, \`If(cond, then, otherwise)\`), and store the **line** (and column) in every node so later phases can report errors. A useful debugging trick is printing the AST as **s-expressions**: \`(+ 1 (* 2 3))\`, as the samples do.

## Statements vs expressions, and assignment
Assignment \`x = 5\` is tricky for a one-token-lookahead parser: when it sees \`x\`, it doesn't know yet whether this is an assignment or an expression like \`x + 1\`. The standard trick: **parse an expression first**; if the next token is \`=\`, check that what you parsed is a valid **assignment target** (a variable, a field, an index) and turn it into an assignment. That's how \`1 + 2 = 3\` gets the error "can only assign to a variable".

## Syntax errors people can understand
A good syntax error has: the **file, line and column**, what was **expected**, what was **found**, and the **source line with a caret**:
\`\`\`text
program.pb:1:13: syntax error: expected ')', found ';'
    print (1 + 2;
                ^
\`\`\`
Point at the **unexpected token**, and phrase the message in the language of the programmer ("expected ';' after the expression") rather than of the grammar ("expected SEMI in stmt_list").

## Error recovery
Stopping at the first error is fine for small tools, but compilers report **many** errors in one run. **Panic-mode recovery**: when an error happens, record it, then skip tokens until a **synchronisation point** (a \`;\`, a \`}\`, or a keyword that starts a statement like \`let\` or \`fn\`) and carry on. The danger is **cascading errors**: one missing bracket causing 50 bogus messages, so recovery points must be chosen well and duplicate errors suppressed. IDEs go further and keep a **partial tree** so completion works while you're typing broken code.

## Parser generators vs hand-written
You can also generate parsers from a grammar: **yacc/bison** (LALR), **ANTLR** (LL(*)), **tree-sitter** (GLR, for editors), **PEG** tools like **pest** (CPython 3.9+ itself uses a PEG generator). Generators guarantee the grammar is unambiguous and are quick to change; hand-written parsers give the best error messages and speed. Most big compilers hand-write theirs.`,
    keyPoints: [
      "Recursive descent: one function per grammar rule; peek, advance and expect are all you need",
      "Pratt parsing handles all binary operators in one loop: keep folding while the next operator's binding power is at least min_power",
      "Parsing the right operand with power + 1 gives left associativity; the same power gives right associativity",
      "Prefix operators are handled first, postfix ones (calls, indexing) in a loop right after the primary",
      "Parse assignments by parsing an expression first, then checking it's a valid target when you see =",
      "Good syntax errors give position, expected vs found, and a caret; recovery skips to a synchronisation point",
    ],
    code: [
      {
        title: "Pratt parsing with a trace",
        variants: [{ lang: "python", code: `# Pratt parsing (top-down operator precedence): each operator has a "binding power".
# The parser keeps folding operators into the left-hand side while the next one binds tighter.
import re

#            (left power, right power): left < right means left-associative, left > right right-associative
INFIX = {"or": (1, 2), "and": (3, 4), "==": (5, 6), "<": (7, 8),
         "+": (9, 10), "-": (9, 10), "*": (11, 12), "/": (11, 12), "^": (16, 15)}
PREFIX = {"-": 13, "not": 13}
CALL = 17  # f(x) binds tightest of all


def tokenize(s):
    return re.findall(r"\\d+|\\w+|==|[-+*/^<(),]", s) + ["<end>"]


class Parser:
    def __init__(self, text, trace=False):
        self.toks, self.i, self.trace, self.depth = tokenize(text), 0, trace, 0

    def peek(self):
        return self.toks[self.i]

    def take(self):
        self.i += 1
        return self.toks[self.i - 1]

    def log(self, msg):
        if self.trace:
            print("  " * self.depth + msg)

    def expr(self, min_power=0):
        self.depth += 1
        tok = self.take()
        if tok == "(":                       # prefix position: what can START an expression?
            left = self.expr(0)
            self.take()                      # ")"
        elif tok in PREFIX:
            left = (tok, self.expr(PREFIX[tok]))
        else:
            left = int(tok) if tok.isdigit() else tok
        self.log(f"start with {show(left)}  (min power {min_power})")
        while True:                          # infix position: what can CONTINUE it?
            op = self.peek()
            if op == "(":                    # a call: f(a, b)
                self.take()
                args = []
                while self.peek() != ")":
                    args.append(self.expr(0))
                    if self.peek() == ",":
                        self.take()
                self.take()
                left = ("call", left, *args)
                continue
            if op not in INFIX:
                break
            lp, rp = INFIX[op]
            if lp < min_power:               # binds too loosely: let our caller take it
                self.log(f"stop at {op!r}: its power {lp} < {min_power}")
                break
            self.take()
            right = self.expr(rp)
            left = (op, left, right)
            self.log(f"fold into {show(left)}")
        self.depth -= 1
        return left


def show(t):
    if not isinstance(t, tuple):
        return str(t)
    return "(" + " ".join(show(x) for x in t) + ")"


print("trace for 1 + 2 * 3 - 4:")
Parser("1 + 2 * 3 - 4", trace=True).expr()
print()
for text in ["1 + 2 * 3", "(1 + 2) * 3", "8 - 3 - 2", "2 ^ 3 ^ 2", "-2 ^ 2", "a < b and not c or d",
             "f(x, y + 1) * 2"]:
    print(f"{text:<22} => {show(Parser(text).expr())}")` }],
        explain: `- Each infix operator has a **pair** of powers. \`+\` is \`(9, 10)\`: it's taken when its left power 9 ≥ \`min_power\`, and its right operand is parsed with \`min_power = 10\`, which **excludes** another \`+\` or \`-\` (power 9). That's left associativity.
- \`^\` is \`(16, 15)\`: its right operand is parsed with 15, which still **accepts** another \`^\` (16 ≥ 15), so \`2 ^ 3 ^ 2\` nests to the right.
- The trace for \`1 + 2 * 3 - 4\` matches the steps in the lesson: \`*\` is folded deep inside, and \`-\` stops twice ("power 9 < 12", "power 9 < 10") until it reaches the level that can take it.
- \`-2 ^ 2\` parses as \`-(2 ^ 2)\` because \`^\` (16) binds tighter than prefix minus (13), the same as in maths and Python, where \`-2 ** 2\` is -4.
- Function calls are a **postfix** operator with the highest power: \`f(x, y + 1) * 2\` calls first, then multiplies.`,
        output: `trace for 1 + 2 * 3 - 4:
  start with 1  (min power 0)
    start with 2  (min power 10)
      start with 3  (min power 12)
      stop at '-': its power 9 < 12
    fold into (* 2 3)
    stop at '-': its power 9 < 10
  fold into (+ 1 (* 2 3))
    start with 4  (min power 10)
  fold into (- (+ 1 (* 2 3)) 4)

1 + 2 * 3              => (+ 1 (* 2 3))
(1 + 2) * 3            => (* (+ 1 2) 3)
8 - 3 - 2              => (- (- 8 3) 2)
2 ^ 3 ^ 2              => (^ 2 (^ 3 2))
-2 ^ 2                 => (- (^ 2 2))
a < b and not c or d   => (or (and (< a b) (not c)) d)
f(x, y + 1) * 2        => (* (call f x (+ y 1)) 2)`,
      },
      {
        title: "A complete parser for Pebble",
        variants: [{ lang: "python", code: `# A complete parser for Pebble: recursive descent for statements, Pratt parsing for expressions.
# It turns tokens into an AST (abstract syntax tree) made of tuples, and reports errors with a caret.
import re

TOKEN = re.compile(r'(?P<ws>\\s+|//[^\\n]*)|(?P<int>\\d+)|(?P<name>[A-Za-z_]\\w*)|(?P<str>"[^"\\n]*")'
                   r'|(?P<op>==|!=|<=|>=|[-+*/%=<>!(){},;])|(?P<bad>.)')
KEYWORDS = {"let", "fn", "if", "else", "while", "return", "print", "true", "false", "and", "or"}
BINARY = {"or": 1, "and": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6}


class ParseError(Exception):
    pass


def lex(src):
    toks, line, line_start = [], 1, 0
    for m in TOKEN.finditer(src):
        kind, text, col = m.lastgroup, m.group(), m.start() - line_start + 1
        if kind == "bad":
            raise ParseError(f"{line}:{col}: unexpected character {text!r}")
        if kind != "ws":
            if kind == "name" and text in KEYWORDS:
                kind = "kw"
            toks.append((kind, text, line, col))
        for k, ch in enumerate(text):  # keep line numbers right across newlines
            if ch == "\\n":
                line, line_start = line + 1, m.start() + k + 1
    return toks + [("eof", "<end of input>", line, len(src) - line_start + 1)]


class Parser:
    def __init__(self, src):
        self.src, self.toks, self.i = src, lex(src), 0

    # ---- helpers
    def peek(self):
        return self.toks[self.i][1]

    def at(self, *texts):
        return self.toks[self.i][1] in texts and self.toks[self.i][0] in ("op", "kw")

    def next(self):
        self.i += 1
        return self.toks[self.i - 1]

    def expect(self, text, what=None):
        if not self.at(text):
            self.error(f"expected {what or repr(text)}")
        return self.next()

    def error(self, msg):
        kind, text, line, col = self.toks[self.i]
        source_line = self.src.split("\\n")[line - 1]
        raise ParseError(f"line {line}, col {col}: {msg}, found {text!r}\\n    {source_line}\\n    {' ' * (col - 1)}^")

    # ---- statements: one function per grammar rule
    def program(self):
        stmts = []
        while self.toks[self.i][0] != "eof":
            stmts.append(self.statement())
        return stmts

    def block(self):
        self.expect("{")
        stmts = []
        while not self.at("}"):
            if self.toks[self.i][0] == "eof":
                self.error("missing '}'")
            stmts.append(self.statement())
        self.next()
        return ("block", stmts)

    def statement(self):
        if self.at("let"):
            self.next()
            name = self.name()
            self.expect("=")
            value = self.expression()
            self.expect(";")
            return ("let", name, value)
        if self.at("print"):
            self.next()
            value = self.expression()
            self.expect(";")
            return ("print", value)
        if self.at("if"):
            self.next()
            cond, then = self.expression(), self.block()
            other = None
            if self.at("else"):
                self.next()
                other = self.statement() if self.at("if") else self.block()
            return ("if", cond, then, other)
        if self.at("while"):
            self.next()
            return ("while", self.expression(), self.block())
        if self.at("fn"):
            self.next()
            name = self.name()
            self.expect("(")
            params = []
            while not self.at(")"):
                params.append(self.name())
                if not self.at(")"):
                    self.expect(",", "',' or ')'")
            self.next()
            return ("fn", name, params, self.block())
        if self.at("return"):
            self.next()
            value = None if self.at(";") else self.expression()
            self.expect(";")
            return ("return", value)
        if self.at("{"):
            return self.block()
        expr = self.expression()
        if self.at("="):  # assignment: the left side must be a plain variable
            if expr[0] != "var":
                self.error("can only assign to a variable")
            self.next()
            value = self.expression()
            self.expect(";")
            return ("assign", expr[1], value)
        self.expect(";", "';' after the expression")
        return ("expr", expr)

    def name(self):
        if self.toks[self.i][0] != "name":
            self.error("expected a name")
        return self.next()[1]

    # ---- expressions: Pratt parsing with the binding powers in BINARY
    def expression(self, min_power=1):
        left = self.unary()
        while self.peek() in BINARY and BINARY[self.peek()] >= min_power and self.toks[self.i][0] in ("op", "kw"):
            op = self.next()[1]
            right = self.expression(BINARY[op] + 1)  # +1: left-associative
            left = ("bin", op, left, right)
        return left

    def unary(self):
        if self.at("-", "!"):
            op = self.next()[1]
            return ("un", op, self.unary())
        return self.call()

    def call(self):
        expr = self.primary()
        while self.at("("):
            self.next()
            args = []
            while not self.at(")"):
                args.append(self.expression())
                if not self.at(")"):
                    self.expect(",", "',' or ')'")
            self.next()
            expr = ("call", expr, args)
        return expr

    def primary(self):
        kind, text, _, _ = self.toks[self.i]
        if kind == "int":
            self.next()
            return ("num", int(text))
        if kind == "str":
            self.next()
            return ("str", text[1:-1])
        if text in ("true", "false") and kind == "kw":
            self.next()
            return ("bool", text == "true")
        if kind == "name":
            self.next()
            return ("var", text)
        if self.at("("):
            self.next()
            e = self.expression()
            self.expect(")")
            return e
        self.error("expected an expression")


def sx(e):
    """An expression as an s-expression: (+ 1 (* 2 3))."""
    if e[0] in ("num", "var"):
        return str(e[1])
    if e[0] == "str":
        return '"' + e[1] + '"'
    if e[0] == "bool":
        return "true" if e[1] else "false"
    if e[0] == "call":
        return "(call " + " ".join(sx(x) for x in [e[1], *e[2]]) + ")"
    return "(" + e[1] + " " + " ".join(sx(x) for x in e[2:]) + ")"


def show(s, pad=""):
    """A statement as indented lines; compound statements put their body on the following lines."""
    kind = s[0]
    if kind == "block":
        return [line for x in s[1] for line in show(x, pad)]
    simple = {"let": lambda: f"(let {s[1]} {sx(s[2])})", "assign": lambda: f"(set {s[1]} {sx(s[2])})",
              "print": lambda: f"(print {sx(s[1])})", "expr": lambda: sx(s[1]),
              "return": lambda: "(return" + (" " + sx(s[1]) if s[1] else "") + ")"}
    if kind in simple:
        return [pad + simple[kind]()]
    head = {"if": lambda: f"(if {sx(s[1])}", "while": lambda: f"(while {sx(s[1])}",
            "fn": lambda: f"(fn {s[1]} ({' '.join(s[2])})"}[kind]()
    body = show(s[3] if kind == "fn" else s[2], pad + "  ")
    if kind == "if" and s[3] is not None:
        body += [pad + " else"] + show(s[3], pad + "  ")
    return [pad + head] + body[:-1] + [body[-1] + ")"]


program = """
fn fib(n) {
  if n < 2 { return n; }
  return fib(n - 1) + fib(n - 2);
}
let i = 0;
while i < 10 {
  if i % 2 == 0 { print fib(i); } else { print -i; }
  i = i + 1;
}
"""
for stmt in Parser(program).program():
    print("\\n".join(show(stmt)))

for bad in ["let x = 1 + ;", "print (1 + 2;", "let = 5;", "fn f(a b) { }", "1 + 2 = 3;"]:
    try:
        Parser(bad).program()
    except ParseError as e:
        print(f"\\n{bad}\\n  error at {e}")` }],
        explain: `- **Statements** use recursive descent: \`statement()\` checks the first token (\`let\`, \`print\`, \`if\`...) and calls the code for that construct. **Expressions** use a Pratt loop over \`BINARY\`.
- \`else if\` needs no special syntax: after \`else\`, if the next token is \`if\`, the "else block" is just another \`if\` statement.
- Assignment uses the parse-an-expression-first trick: \`1 + 2 = 3\` parses \`1 + 2\`, sees \`=\`, and rejects the target.
- \`error()\` builds the caret line from the token's column. Every one of the five broken programs gets a message that names what was expected and points at the exact token.
- The output is the AST as s-expressions: \`(% i 2)\` inside \`(== ... 0)\` shows the precedence came out right. This parser is the starting point for Project 1.`,
        output: `(fn fib (n)
  (if (< n 2)
    (return n))
  (return (+ (call fib (- n 1)) (call fib (- n 2)))))
(let i 0)
(while (< i 10)
  (if (== (% i 2) 0)
    (print (call fib i))
   else
    (print (- i)))
  (set i (+ i 1)))

let x = 1 + ;
  error at line 1, col 13: expected an expression, found ';'
    let x = 1 + ;
                ^

print (1 + 2;
  error at line 1, col 13: expected ')', found ';'
    print (1 + 2;
                ^

let = 5;
  error at line 1, col 5: expected a name, found '='
    let = 5;
        ^

fn f(a b) { }
  error at line 1, col 8: expected ',' or ')', found 'b'
    fn f(a b) { }
           ^

1 + 2 = 3;
  error at line 1, col 7: can only assign to a variable, found '='
    1 + 2 = 3;
          ^`,
      },
    ],
    interview: [
      {
        q: "How does a recursive descent parser work?",
        freq: "very-common",
        a: `It's a top-down parser with **one function per nonterminal**. Each function inspects the lookahead token to choose an alternative, consumes terminals with \`expect\`, and calls the functions of nested nonterminals, building and returning AST nodes. The call stack mirrors the parse tree. Requirements: no left recursion (use loops), and enough lookahead to choose alternatives (usually 1, sometimes more or limited backtracking). It's the most common technique in production compilers because it's readable, fast and gives excellent error messages.`,
      },
      {
        q: "Explain Pratt parsing. Why is it popular?",
        freq: "common",
        a: `Pratt (top-down operator precedence) parsing attaches **binding powers** to tokens. \`parse_expr(min_bp)\` parses a prefix expression (literal, name, prefix operator, parenthesised expression), then loops: while the next token is an infix/postfix operator whose left binding power ≥ \`min_bp\`, consume it and parse the right operand with \`parse_expr(right_bp)\`, folding into the left side. Left associativity: right_bp = left_bp + 1; right associativity: right_bp = left_bp (or less).

It's popular because a whole precedence table fits in a dictionary, adding operators is trivial, there's no deep chain of one-function-per-level calls, and it handles prefix, infix, postfix, mixfix (\`?:\`) and calls uniformly.`,
      },
      {
        q: "How would you parse `a = b = c` and `1 + 2 = 3` in a hand-written parser?",
        freq: "occasional",
        a: `Parse an expression; if the next token is \`=\`, check that the expression is an **l-value** (variable, field access, index), then parse the right side **recursively as an assignment** (right-associative), producing \`Assign(a, Assign(b, c))\`. For \`1 + 2 = 3\` the parsed left side is a \`Binary\` node, not an l-value, so report "invalid assignment target" at the \`=\`. This avoids needing unbounded lookahead to decide in advance that a statement is an assignment.`,
      },
      {
        q: "What is panic-mode error recovery?",
        freq: "common",
        a: `After reporting a syntax error, the parser discards tokens until it reaches a **synchronising token** (\`;\`, \`}\`, or a statement keyword like \`if\`, \`return\`, \`fn\`), resets its state to a known point (e.g. "expecting a statement"), and resumes. This lets one compile report several real errors. Risks: cascading spurious errors; mitigations include suppressing errors until some tokens have been consumed successfully, and good choice of sync points. Alternatives: phrase-level recovery (insert or delete a single token, like a missing \`;\`), error productions in the grammar, and IDE-style trees with error nodes.`,
      },
      {
        q: "Hand-written parser or parser generator: which would you choose?",
        freq: "occasional",
        a: `**Hand-written recursive descent** for a production language: best error messages and recovery, easy context-sensitive hacks, fast, no build-time tooling, easy to debug. **Generator** (ANTLR, bison, tree-sitter, PEG tools) for prototypes, DSLs, config formats, or when a formal grammar must be the source of truth: you get conflict checking (proof of no ambiguity for LR), quick iteration, and multi-language targets. Many projects use both: a grammar for the spec and tests, a hand-written parser in the compiler.`,
      },
      {
        q: "How do you parse function calls and array indexing with the right precedence?",
        freq: "occasional",
        a: `Treat them as **postfix operators** with the highest binding power: after parsing a primary expression, loop while the next token is \`(\`, \`[\` or \`.\`, building \`Call(callee, args)\`, \`Index(target, index)\` or \`Field(object, name)\` with the expression so far as the left side. This makes \`f(x)(y)\`, \`a[i][j]\` and \`obj.method(1).field\` chain correctly, and makes \`-f(x)\` mean \`-(f(x))\`.`,
      },
      {
        q: "What's the 'dangling else' problem and how do recursive descent parsers handle it?",
        freq: "common",
        a: `In \`if a then if b then s1 else s2\`, the grammar allows the \`else\` to belong to either \`if\`. Recursive descent resolves it naturally: the **inner** \`if_statement\` call checks for \`else\` right after its \`then\` branch and greedily takes it, so the \`else\` binds to the **nearest** \`if\`, which is what C, Java and JavaScript specify. LR parsers see it as a shift/reduce conflict and resolve it by shifting. Languages like Go, Rust and Swift avoid the issue by requiring braces.`,
      },
    ],
    quiz: [
      {
        q: "In recursive descent, what plays the role of the parser's stack?",
        options: ["A list of tokens", "The program's call stack (the nested parse function calls)", "The symbol table", "The heap"],
        answer: 1,
        explain: "Each active parse function is a frame on the call stack, and the nesting of calls mirrors the tree.",
      },
      {
        q: "In Pratt parsing, what does `min_power` mean?",
        options: [
          "The number of tokens left",
          "Only operators with at least this binding power may be folded at this level",
          "The depth of recursion",
          "The precedence of the first operator",
        ],
        answer: 1,
        explain: "Weaker operators stop the loop and are left for an outer call, which is how precedence emerges.",
      },
      {
        q: "With `BINARY[op] + 1` for the right operand, how is `8 - 3 - 2` grouped?",
        options: ["8 - (3 - 2)", "(8 - 3) - 2", "It's a syntax error", "It depends on the lexer"],
        answer: 1,
        explain: "The right operand of the first - only accepts operators stronger than -, so the second - is folded by the outer loop: left associativity.",
      },
      {
        q: "How do you make `^` right-associative in a Pratt parser?",
        options: [
          "Give it the lowest power",
          "Parse its right operand with the same (or lower) power, so another ^ can bind inside",
          "Parse it in the lexer",
          "Use a separate function",
        ],
        answer: 1,
        explain: "If the right operand accepts another ^, then 2 ^ 3 ^ 2 becomes 2 ^ (3 ^ 2).",
      },
      {
        q: "Why parse an expression first when a statement might be an assignment?",
        options: [
          "Assignments are rare",
          "With one token of lookahead, you can't know it's an assignment until you reach the =; then you check the left side is a valid target",
          "To save memory",
          "Because = has the highest precedence",
        ],
        answer: 1,
        explain: "x and x.y[3] look like expressions until the = appears. Checking afterwards also gives a clear 'can only assign to a variable' error.",
      },
      {
        q: "What's the best place to point a syntax error's caret?",
        options: ["The start of the line", "The unexpected token", "The end of the file", "The previous statement"],
        answer: 1,
        explain: "The unexpected token is where the parser's expectations failed; the message says what was expected instead.",
      },
      {
        q: "In panic-mode recovery, what does the parser do after an error?",
        options: [
          "Stops immediately",
          "Skips tokens until a synchronisation point such as ; or a statement keyword, then continues",
          "Deletes the whole line",
          "Restarts from the beginning",
        ],
        answer: 1,
        explain: "Skipping to a known point lets the parser report further real errors in the same run.",
      },
      {
        q: "Which binds tighter in the Pratt sample: a function call or `*`?",
        options: ["`*`", "A function call", "They're equal", "It depends on the arguments"],
        answer: 1,
        explain: "Calls are postfix operators with the highest power, so `f(x) * 2` calls first.",
      },
    ],
  },

  // ------------------------------------------------------------------ LR PARSING
  {
    id: "comp-lr",
    title: "Bottom-up parsing: shift, reduce and LR tables",
    tagline: "How yacc and bison parse: handles, shift-reduce parsing, LR(0) items and the automaton of states, SLR, LALR(1) and LR(1), shift/reduce and reduce/reduce conflicts, precedence declarations, and GLR and PEG.",
    difficulty: "advanced",
    minutes: 45,
    visualizers: ["lrparse"],
    concept: `## Explain it like I'm 10 🧸
Top-down parsing is like reading the LEGO instructions first and then looking for the right pieces. **Bottom-up** parsing is the opposite: you pick up pieces one at a time and put them on a tray (**shift**). Whenever the pieces on the end of your tray make something you recognise ("a wheel and an axle! that's a **wheel set**"), you snap them together into one bigger piece (**reduce**). Keep going until the whole tray is one finished model.

The clever part is knowing **when** to snap: if you have \`1 + 2\` on the tray and the next piece is \`*\`, you must **wait**, because \`2\` belongs to the \`*\` first. LR parsers decide using a precomputed table that never guesses wrong.

## Shift-reduce parsing
A bottom-up parser has a **stack** and the **input**. At each step it does one of four things:
- **shift**: move the next token onto the stack;
- **reduce**: the top of the stack matches the right side of a rule (\`T * F\`); pop it and push the left side (\`T\`);
- **accept**: the stack holds just the start symbol and the input is finished;
- **error**: nothing is allowed.

Reading the reductions **backwards** gives a **rightmost derivation**, which is why the family is called **LR**: **L**eft-to-right scan, **R**ightmost derivation in reverse. The thing being reduced each time is called the **handle**.

Trace \`id * id + id\` with \`E → E + T | T\`, \`T → T * F | F\`, \`F → id | ( E )\`:
| Stack | Input | Action |
|---|---|---|
| | \`id * id + id\` | shift |
| \`id\` | \`* id + id\` | reduce F → id |
| \`F\` | \`* id + id\` | reduce T → F |
| \`T\` | \`* id + id\` | shift (don't reduce E → T: \`*\` is next!) |
| \`T *\` | \`id + id\` | shift |
| \`T * id\` | \`+ id\` | reduce F → id, then T → T * F |
| \`T\` | \`+ id\` | reduce E → T (now \`+\` is next, so it's time) |
| \`E +\` ... | | ... and so on to accept |

The hard question is in the 4th row: with \`T\` on the stack, reduce to \`E\` or shift \`*\`? The **LR automaton** answers it.

## LR(0) items and the automaton
An **item** is a rule with a **dot** marking how much of it has been seen: \`T → T • * F\` means "we've seen a T, and if a \`*\` and an F follow, we can reduce". A parser **state** is a **set of items**: every rule we might be in the middle of. Build the states like the subset construction for DFAs:
- **closure**: if an item has the dot before a nonterminal (\`E → • T\`), add all of that nonterminal's rules with the dot at the start (\`T → • T * F\`, \`T → • F\`), recursively;
- **goto**: from a state, move the dot over a symbol in every item where that symbol is next.

The result is a DFA over **grammar symbols**: 12 states for the expression grammar (first sample). It recognises **viable prefixes**: the stack contents that can still lead to a successful parse. The parse stack stores state numbers alongside the symbols (\`0 T 4 * 8\`), so the parser never re-scans the stack.

## The parse tables
- **ACTION[state, token]**: shift and go to state n, reduce by rule r, accept, or error.
- **GOTO[state, nonterminal]**: after a reduce pops back to a state, which state to go to with the new nonterminal.

Different LR variants differ only in **when they allow a reduce**:
| Variant | Reduce A → α when the next token is... | Notes |
|---|---|---|
| **LR(0)** | anything | very few grammars work |
| **SLR(1)** | in FOLLOW(A) | simple; our sample |
| **LALR(1)** | in the precise lookahead set, with states merged as in LR(0) | yacc, bison: small tables, almost as strong as LR(1) |
| **LR(1)** | in the lookahead carried by each item | most powerful, but many more states |

LR(1) parsers handle **every deterministic context-free language**, including left recursion. That's more than LL(1), though in practice recursive descent with small tricks handles real languages too.

## Conflicts
When the table needs **two actions** in one cell, the grammar isn't LR for that variant:
- **shift/reduce conflict**: could shift the next token or reduce. Classic case: the **dangling else**. In state 6 of the second sample, with \`if c then S\` on the stack and \`else\` next, the parser can reduce (attach the \`else\` to an outer \`if\`) or shift it (attach it to this inner \`if\`). yacc **prefers shift** and warns; shifting gives the conventional "else belongs to the nearest if".
- **reduce/reduce conflict**: two different rules could be reduced. Almost always a real grammar bug: two rules describe the same text.

## Precedence declarations
Instead of rewriting the grammar into levels, yacc and bison let you keep the short ambiguous grammar and declare:
\`\`\`text
%left  '+' '-'        /* lowest precedence, left-associative */
%left  '*' '/'
%right '^'            /* highest, right-associative */
%%
expr : expr '+' expr | expr '-' expr | expr '*' expr | expr '/' expr | expr '^' expr | NUM ;
\`\`\`
Each shift/reduce conflict is resolved by comparing the precedence of the **rule** (its last operator) with the **lookahead token**: higher precedence wins; on a tie, \`%left\` means reduce and \`%right\` means shift. This is exactly Pratt's binding powers, applied to tables.

## Beyond LR: GLR and PEG
- **GLR** (generalised LR): when a conflict occurs, **fork** the parse and run both alternatives in parallel, dropping the ones that fail. It handles any context-free grammar, even ambiguous ones (returning all trees). Used by **tree-sitter** (the parser behind syntax highlighting in GitHub, Neovim and Zed), and bison's \`%glr-parser\`. C++, whose grammar needs to know whether a name is a type, is a classic motivation.
- **PEG** (parsing expression grammars): like a grammar, but alternation is **ordered** (\`/\`: try the first, and only if it fails try the second), so a PEG is never ambiguous. **Packrat** parsing memoises results for linear time. CPython has used a PEG parser since 3.9.
- **Earley** and **CYK** parse any context-free grammar in O(n³); used in natural language processing and in some flexible parser libraries.`,
    keyPoints: [
      "Bottom-up parsers shift tokens onto a stack and reduce handles into nonterminals; reading reductions backwards gives a rightmost derivation",
      "LR(0) items (rules with a dot) form the states of a DFA over grammar symbols; the stack holds state numbers",
      "ACTION and GOTO tables drive the parser; SLR, LALR(1) and LR(1) differ only in when they allow a reduce",
      "Shift/reduce conflicts (like the dangling else) are usually resolved by shifting; reduce/reduce conflicts are grammar bugs",
      "yacc and bison resolve operator conflicts with %left, %right and precedence levels",
      "GLR forks on conflicts (tree-sitter); PEGs use ordered choice and are never ambiguous (CPython)",
    ],
    code: [
      {
        title: "Building an SLR table and parsing with it",
        variants: [{ lang: "python", code: `# Bottom-up parsing: build an SLR(1) table from a grammar, then parse with shift and reduce.
# This is what parser generators like yacc and bison do (they use the stronger LALR(1)).

def build(grammar, start):
    prods = [("S'", (start,))] + [(lhs, tuple(rhs)) for lhs, alts in grammar.items() for rhs in alts]
    nts = {lhs for lhs, _ in prods}

    # FIRST and FOLLOW (no empty productions in these grammars, which keeps this short)
    first = {n: set() for n in nts}
    changed = True
    while changed:
        changed = False
        for lhs, rhs in prods:
            f = first[rhs[0]] if rhs[0] in nts else {rhs[0]}
            if not f <= first[lhs]:
                first[lhs] |= f
                changed = True
    follow = {n: set() for n in nts}
    follow["S'"].add("$")
    changed = True
    while changed:
        changed = False
        for lhs, rhs in prods:
            for i, s in enumerate(rhs):
                if s in nts:
                    f = follow[lhs] if i + 1 == len(rhs) else (first[rhs[i + 1]] if rhs[i + 1] in nts else {rhs[i + 1]})
                    if not f <= follow[s]:
                        follow[s] |= f
                        changed = True

    # LR(0) items: a production with a dot showing how much of it we've seen. (prod index, dot position)
    def closure(items):
        items = set(items)
        while True:
            new = {(j, 0) for (p, d) in items if d < len(prods[p][1]) and prods[p][1][d] in nts
                   for j, (lhs, _) in enumerate(prods) if lhs == prods[p][1][d]}
            if new <= items:
                return frozenset(items)
            items |= new

    def goto(items, sym):
        return closure({(p, d + 1) for (p, d) in items if d < len(prods[p][1]) and prods[p][1][d] == sym})

    states = [closure({(0, 0)})]
    trans = {}
    for st in states:  # the list grows while we walk it
        for sym in sorted({prods[p][1][d] for (p, d) in st if d < len(prods[p][1])}):
            nxt = goto(st, sym)
            if nxt not in states:
                states.append(nxt)
            trans[states.index(st), sym] = states.index(nxt)

    action, goto_table, conflicts = {}, {}, []

    def set_action(state, tok, act):
        old = action.get((state, tok))
        if old is not None and old != act:
            shift, reduce = (old, act) if old[0] == "shift" else (act, old)
            conflicts.append((state, tok, reduce))
            act = shift  # a shift/reduce conflict: prefer shift, like yacc does
        action[state, tok] = act

    for i, st in enumerate(states):
        for (p, d) in sorted(st):
            lhs, rhs = prods[p]
            if d < len(rhs) and rhs[d] not in nts:
                set_action(i, rhs[d], ("shift", trans[i, rhs[d]]))
            elif d == len(rhs):
                if lhs == "S'":
                    set_action(i, "$", ("accept",))
                else:
                    for tok in sorted(follow[lhs]):  # SLR: reduce when the next token can follow lhs
                        set_action(i, tok, ("reduce", p))
        for n in nts:
            if (i, n) in trans:
                goto_table[i, n] = trans[i, n]
    return prods, states, action, goto_table, conflicts


def parse(tables, tokens, w1=26, w2=20):
    prods, _, action, goto_table, _ = tables
    stack, tokens, i = [0], tokens + ["$"], 0  # the stack alternates states and symbols: 0 id 5 ...
    print(f"{'stack':<{w1}}{'input':<{w2}}action")
    while True:
        act = action.get((stack[-1], tokens[i]))
        line = f"{' '.join(map(str, stack)):<{w1}}{' '.join(tokens[i:]):<{w2}}"
        if act is None:
            print(line + f"error: unexpected {tokens[i]}")
            return
        if act[0] == "shift":
            print(line + f"shift {tokens[i]}, go to state {act[1]}")
            stack += [tokens[i], act[1]]
            i += 1
        elif act[0] == "reduce":
            lhs, rhs = prods[act[1]]
            del stack[-2 * len(rhs):]  # pop the handle: the right-hand side we just finished
            stack += [lhs, goto_table[stack[-1], lhs]]
            print(line + f"reduce {lhs} -> {' '.join(rhs)}")
        else:
            print(line + "accept")
            return


expr_grammar = {"E": [["E", "+", "T"], ["T"]], "T": [["T", "*", "F"], ["F"]], "F": [["(", "E", ")"], ["id"]]}
tables = build(expr_grammar, "E")
print(f"expression grammar: {len(tables[1])} LR(0) states, {len(tables[2])} actions, {len(tables[4])} conflicts")
parse(tables, ["id", "*", "id", "+", "id"])

# The dangling else: "if c then if c then s else s". Which "if" owns the else?
if_grammar = {"S": [["if", "c", "then", "S"], ["if", "c", "then", "S", "else", "S"], ["s"]]}
tables = build(if_grammar, "S")
for state, tok, reduce in tables[4]:
    lhs, rhs = tables[0][reduce[1]]
    print(f"\\ndangling else: in state {state} with '{tok}' next, shift it or reduce {lhs} -> {' '.join(rhs)}?")
    print("a shift/reduce conflict. Choosing shift attaches the else to the nearest if:")
parse(tables, "if c then if c then s else s".split(), 50, 32)` }],
        explain: `- An item is a pair \`(production index, dot position)\`. \`closure\` keeps adding \`(j, 0)\` items for every nonterminal right after a dot until nothing new appears; \`goto\` moves the dot over one symbol.
- The \`for st in states\` loop discovers new states while iterating, the same worklist idea as the subset construction. The expression grammar gives **12 states**.
- ACTION entries: a terminal after the dot means **shift**; a finished item means **reduce** for every token in FOLLOW of its left side (that's what makes it **S**LR).
- Read the expression trace: state 4 holds \`E → T •\` and \`T → T • * F\`. With \`*\` next it **shifts**, because the second item wants a \`*\`. With \`+\` next it reduces \`E → T\`, because \`+\` is in FOLLOW(E) and \`*\` isn't. The table encodes precedence without any precedence rules.
- The dangling-else grammar produces a conflict in state 6. \`set_action\` prefers shift (like yacc) and the trace shows the \`else\` attaching to the **inner** \`if\`: \`S → if c then S else S\` is reduced first.`,
        output: `expression grammar: 12 LR(0) states, 36 actions, 0 conflicts
stack                     input               action
0                         id * id + id $      shift id, go to state 5
0 id 5                    * id + id $         reduce F -> id
0 F 3                     * id + id $         reduce T -> F
0 T 4                     * id + id $         shift *, go to state 8
0 T 4 * 8                 id + id $           shift id, go to state 5
0 T 4 * 8 id 5            + id $              reduce F -> id
0 T 4 * 8 F 11            + id $              reduce T -> T * F
0 T 4                     + id $              reduce E -> T
0 E 2                     + id $              shift +, go to state 7
0 E 2 + 7                 id $                shift id, go to state 5
0 E 2 + 7 id 5            $                   reduce F -> id
0 E 2 + 7 F 3             $                   reduce T -> F
0 E 2 + 7 T 10            $                   reduce E -> E + T
0 E 2                     $                   accept

dangling else: in state 6 with 'else' next, shift it or reduce S -> if c then S?
a shift/reduce conflict. Choosing shift attaches the else to the nearest if:
stack                                             input                           action
0                                                 if c then if c then s else s $  shift if, go to state 2
0 if 2                                            c then if c then s else s $     shift c, go to state 4
0 if 2 c 4                                        then if c then s else s $       shift then, go to state 5
0 if 2 c 4 then 5                                 if c then s else s $            shift if, go to state 2
0 if 2 c 4 then 5 if 2                            c then s else s $               shift c, go to state 4
0 if 2 c 4 then 5 if 2 c 4                        then s else s $                 shift then, go to state 5
0 if 2 c 4 then 5 if 2 c 4 then 5                 s else s $                      shift s, go to state 3
0 if 2 c 4 then 5 if 2 c 4 then 5 s 3             else s $                        reduce S -> s
0 if 2 c 4 then 5 if 2 c 4 then 5 S 6             else s $                        shift else, go to state 7
0 if 2 c 4 then 5 if 2 c 4 then 5 S 6 else 7      s $                             shift s, go to state 3
0 if 2 c 4 then 5 if 2 c 4 then 5 S 6 else 7 s 3  $                               reduce S -> s
0 if 2 c 4 then 5 if 2 c 4 then 5 S 6 else 7 S 8  $                               reduce S -> if c then S else S
0 if 2 c 4 then 5 S 6                             $                               reduce S -> if c then S
0 S 1                                             $                               accept`,
      },
    ],
    interview: [
      {
        q: "What's the difference between LL and LR parsing?",
        freq: "very-common",
        a: `**LL** (top-down): starts from the start symbol, **predicts** which production to use from the lookahead, builds a leftmost derivation. Recursive descent is LL. Can't handle left recursion; needs left-factoring.

**LR** (bottom-up): shifts tokens and **reduces** when it recognises a complete right-hand side, building a rightmost derivation in reverse. It postpones the decision until it has seen the whole right side, so it handles a strictly larger class of grammars (including left recursion). LR parsers are table-driven and generated (yacc, bison); LL parsers are often hand-written. Error messages are traditionally better with LL.`,
      },
      {
        q: "What is a shift/reduce conflict? Give an example and how it's typically resolved.",
        freq: "common",
        a: `A state where, for some lookahead token, the parser could either **shift** it or **reduce** a completed rule. Examples: the **dangling else** (shift the \`else\` or reduce the inner \`if\`), and \`1 + 2 * 3\` in an ambiguous expression grammar (after \`1 + 2\`, shift \`*\` or reduce \`+\`). yacc/bison resolve it by **shifting by default** (with a warning), or by **precedence and associativity declarations** that compare the rule's operator with the lookahead. The clean fix is to rewrite the grammar or declare precedence so the warning goes away.`,
      },
      {
        q: "What's the difference between SLR, LALR and canonical LR(1)?",
        freq: "occasional",
        a: `All share the shift-reduce driver; they differ in lookahead precision for **reductions**:
- **SLR**: LR(0) states; reduce A → α on any token in FOLLOW(A). Simple, but FOLLOW is too coarse, causing spurious conflicts.
- **LR(1)**: items carry their own lookahead token; reduce only on that. Most powerful, but can have many times more states.
- **LALR(1)**: LR(1) items with states that share the same LR(0) core **merged**: LR(0)-sized tables with nearly LR(1) power. Merging can introduce rare reduce/reduce conflicts. yacc and bison default to LALR(1); bison also offers IELR and canonical LR.`,
      },
      {
        q: "What is a handle in bottom-up parsing?",
        freq: "occasional",
        a: `The substring on top of the stack that matches a production's right side **and** whose reduction is a step in the rightmost derivation (in reverse). Not every match is a handle: with \`T\` on the stack and \`*\` next, \`T\` matches \`E → T\`, but reducing would lead to a dead end. The LR automaton's states recognise exactly when the top of the stack is a handle.`,
      },
      {
        q: "Why might a project choose a GLR or PEG parser?",
        freq: "occasional",
        a: `**GLR**: the grammar is naturally ambiguous or not LR(k) (C++, natural language, incremental parsing of incomplete code), and you want to keep the grammar readable; GLR explores alternatives in parallel and returns one or all parses. tree-sitter uses it for robust, incremental parsing in editors.

**PEG/packrat**: ordered choice makes the grammar unambiguous by construction, it combines lexing and parsing ("scannerless"), and it's easy to write; packrat memoisation guarantees linear time at a memory cost. CPython switched to PEG in 3.9 to escape LL(1) restrictions. The caveat: ordered choice can silently hide alternatives you meant to allow.`,
      },
    ],
    quiz: [
      {
        q: "What does a reduce step do?",
        options: [
          "Reads the next token onto the stack",
          "Replaces the right side of a rule on top of the stack with its left side",
          "Deletes an error",
          "Shrinks the grammar",
        ],
        answer: 1,
        explain: "For example, `T * F` on top of the stack becomes T.",
      },
      {
        q: "With `T` on the stack and `*` as the next token, what should the expression-grammar parser do?",
        options: ["Reduce E → T", "Shift `*`", "Accept", "Report an error"],
        answer: 1,
        explain: "T belongs to the multiplication first. Reducing to E would leave no way to continue with `*`.",
      },
      {
        q: "What does the R in LR stand for?",
        options: ["Recursive", "Rightmost derivation (in reverse)", "Reduce", "Regular"],
        answer: 1,
        explain: "Left-to-right scan, Rightmost derivation built in reverse.",
      },
      {
        q: "What is an LR(0) item?",
        options: ["A token", "A grammar rule with a dot marking how much of it has been recognised", "A parse tree node", "A state number"],
        answer: 1,
        explain: "`T → T • * F` means: we've seen a T and could continue with `* F`.",
      },
      {
        q: "In SLR parsing, when is reducing by A → α allowed?",
        options: ["Always", "When the next token is in FOLLOW(A)", "When the stack is empty", "When the next token is in FIRST(A)"],
        answer: 1,
        explain: "FOLLOW(A) lists the tokens that can legally come right after an A.",
      },
      {
        q: "How do yacc and bison resolve a shift/reduce conflict by default?",
        options: ["Reduce", "Shift (with a warning)", "Refuse to build the parser", "Pick randomly"],
        answer: 1,
        explain: "Shifting by default gives the conventional dangling-else behaviour; precedence declarations can override it.",
      },
      {
        q: "What does a reduce/reduce conflict usually indicate?",
        options: [
          "Normal operator precedence",
          "A real grammar bug: two rules can match the same text",
          "Too little lookahead for an else",
          "A lexer problem",
        ],
        answer: 1,
        explain: "Unlike shift/reduce conflicts, reduce/reduce conflicts rarely have a sensible default resolution.",
      },
      {
        q: "Which parser technique does tree-sitter use to cope with ambiguity and incomplete code?",
        options: ["LL(1)", "SLR", "GLR", "Recursive descent with backtracking"],
        answer: 2,
        explain: "GLR forks the parse at conflicts and keeps the alternatives that survive.",
      },
    ],
  },

  // ------------------------------------------------------------------ SEMANTIC ANALYSIS
  {
    id: "comp-semantic",
    title: "Semantic analysis: names and scopes",
    tagline: "What the parser can't check: symbol tables, nested and lexical scopes, shadowing, resolving each use to its declaration, declaration-before-use, unused variables, and attaching meaning to the AST.",
    difficulty: "intermediate",
    minutes: 35,
    diagram: {
      title: "Semantic analysis",
      nodes: [
        { id: "ast", label: "Syntax tree", kind: "client", x: 100, y: 270, sub: "from the parser" },
        { id: "resolver", label: "Resolver", kind: "service", x: 330, y: 150, sub: "which declaration is this?" },
        { id: "symtab", label: "Symbol table", kind: "db", x: 330, y: 420, sub: "a stack of scopes" },
        { id: "checker", label: "Type checker", kind: "control", x: 590, y: 150, sub: "do the types fit?" },
        { id: "errors", label: "Diagnostics", kind: "monitor", x: 590, y: 420, sub: "undefined, redeclared, unused" },
        { id: "decorated", label: "Annotated AST", kind: "worker", x: 850, y: 270, sub: "every name and type known" },
      ],
      edges: [
        { from: "ast", to: "resolver", label: "walk" },
        { from: "resolver", to: "symtab", label: "declare / look up" },
        { from: "resolver", to: "checker", label: "names resolved" },
        { from: "resolver", to: "errors", label: "problems" },
        { from: "checker", to: "symtab", label: "types of names" },
        { from: "checker", to: "errors", label: "type errors" },
        { from: "checker", to: "decorated", label: "types attached" },
      ],
      flows: [
        {
          name: "Check `let total = count + 1;`",
          path: ["ast", "resolver", "symtab", "resolver", "checker", "symtab", "checker", "decorated"],
          steps: [
            "The resolver walks the tree and reaches the Let node.",
            "It looks up 'count': innermost scope first, then outwards until it's found.",
            "Found two scopes up: this use of 'count' now points at its declaration.",
            "The checker gets the tree with every name resolved.",
            "It reads the declared type of 'count': int.",
            "int + int is int, so 'total' is declared in the current scope as an int.",
            "The annotated tree goes to the next phase: an interpreter or code generator.",
          ],
        },
        {
          name: "Catch `print totl;`",
          path: ["ast", "resolver", "symtab", "resolver", "errors"],
          steps: [
            "The resolver reaches the use of 'totl'.",
            "It searches every scope, innermost to global.",
            "Not found anywhere.",
            "Report 'undefined variable totl' at its line and column, before the program ever runs.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
A sentence can be grammatically perfect and still make no sense: "Give the book to Zork." Who's Zork? Nobody we know! A compiler asks the same question about every name in your program: **who is this?**

Think of a school. When the teacher in **your classroom** says "Sam", she means the Sam **in this room**. If there's no Sam here, she might mean Sam the head teacher, who everyone in the **whole school** knows. Classrooms are **scopes**: a name is looked up in the closest room first, then the bigger ones around it. And if a new kid called Sam joins your class, then in your room "Sam" now means the new kid, even though the head teacher is still around: the new name **shadows** the old one.

Semantic analysis is the compiler going through your program with a list of who's who, making sure every name means exactly one thing.

## What parsing can't check
The parser accepts \`print totl;\` happily: it's a perfectly shaped statement. These need **semantic analysis**:
- Is every name **declared**? Is it declared **twice** in the same scope?
- Is it used **before** it's declared, or in its own initializer (\`let x = x + 1;\`)?
- Is \`return\` inside a function? \`break\` inside a loop?
- Are the **types** right? (Next lesson.)
- Does a function get the right **number of arguments**?
- Warnings: **unused** variables, unreachable code.

Many of these depend on **context**: the meaning of \`x\` depends on where it's declared, which is exactly what a context-free grammar can't express.

## Symbol tables and scopes
A **symbol table** maps names to what they mean: their kind (variable, function, parameter, type), type, and where they're declared. To handle nesting, use a **stack of scopes**, each a dictionary:
- entering a block or function: **push** a new scope;
- \`let x\`: add \`x\` to the **top** scope (error if it's already there);
- using \`x\`: search from the top scope **down** to the global one; the first match wins;
- leaving: **pop** the scope (now is a good moment to warn about unused variables).

This is **lexical** (or **static**) **scoping**: what a name means depends on where it appears in the **source text**, so the compiler can work it out without running the program. Almost every modern language does this. (The alternative, **dynamic** scoping, looks names up in whoever **called** you at run time: early Lisps, Emacs Lisp by default, and Bash variables.)

## Shadowing
A declaration in an inner scope **hides** one with the same name outside:
\`\`\`rust
let x = 5;
{
    let x = "five";   // a different x, only inside this block
    println!("{x}");  // five
}
println!("{x}");      // 5
\`\`\`
Rust even allows re-declaring in the **same** scope (\`let x = x.trim();\`). Many languages forbid shadowing parameters or warn about it, because it's a common source of bugs.

## Resolving: from names to declarations
The **resolver** walks the AST and, for every **use** of a name, records **which declaration** it refers to. A neat representation: how many scopes **up** the declaration is (its "depth"). Later the interpreter or code generator can jump straight there instead of searching by name. You'll do exactly this in the Pebble project, and it fixes a real bug with closures that a naive name-lookup interpreter has.

Two subtle cases:
- **Recursion**: a function's name must be declared **before** its body is checked, so the body can call itself.
- **Own initializer**: in \`let x = x + 1;\`, the inner \`x\` must not mean the new \`x\`. Mark the name as "declared but not ready" while checking the initializer: reading it then is an error (or, in some languages, refers to an outer \`x\`).

## Declare-before-use, or not?
- C requires declarations before use (hence header files and forward declarations). It was designed for compilers that read the source **once**, top to bottom.
- Java, C#, Go and Rust let functions and types be used **anywhere** in their scope. The compiler makes **two passes**: first collect all top-level declarations, then check bodies. Your pebblec checker does the same for functions, which is how mutually recursive functions work.

## What comes out
The output of semantic analysis is the **annotated** (or "decorated") AST: every name linked to its declaration, every expression with its type, plus side tables (symbol tables, function signatures). Plus a list of **diagnostics**. Good compilers collect **all** errors in one run rather than stopping at the first, and use an "error" placeholder so one mistake doesn't cascade into dozens.`,
    keyPoints: [
      "Semantic analysis checks what grammar can't: declarations, scopes, types, argument counts, return outside functions",
      "A symbol table is a stack of scopes: push on entering a block, add on declare, search top-down on use, pop on leaving",
      "Lexical scoping: a name's meaning comes from where it appears in the source, so the compiler can resolve it statically",
      "Inner declarations shadow outer ones with the same name",
      "Declare functions before checking bodies so recursion (and mutual recursion) works; forbid reading a variable in its own initializer",
      "The output is an annotated AST plus diagnostics; collect many errors and avoid cascades",
    ],
    code: [
      {
        title: "A resolver with scopes, shadowing and warnings",
        variants: [{ lang: "python", code: `# Name resolution: for every variable USE, find the declaration it refers to, using nested scopes.
# The AST is written as s-expressions (the form our parser printed) and read by a 10-line reader.
import re


def read(text):
    tokens = re.findall(r'\\(|\\)|"[^"]*"|[^\\s()]+', text)

    def item(i):
        if tokens[i] == "(":
            out, i = [], i + 1
            while tokens[i] != ")":
                x, i = item(i)
                out.append(x)
            return out, i + 1
        t = tokens[i]
        return (int(t) if t.lstrip("-").isdigit() else t), i + 1

    prog, i = [], 0
    while i < len(tokens):
        x, i = item(i)
        prog.append(x)
    return prog


class Resolver:
    def __init__(self):
        self.scopes = [{}]  # the global scope
        self.errors, self.notes, self.used = [], [], set()

    def declare(self, name, kind):
        scope = self.scopes[-1]
        if name in scope:
            self.errors.append(f"'{name}' is already declared in this scope")
        scope[name] = kind

    def use(self, name):
        for hops, scope in enumerate(reversed(self.scopes)):
            if name in scope:
                if scope[name] == "initializing":
                    self.errors.append(f"can't read '{name}' in its own initializer")
                    return
                self.used.add((id(scope), name))
                where = ("global" if hops == len(self.scopes) - 1 else "the same scope" if hops == 0
                         else f"{hops} scope{'s' if hops > 1 else ''} up")
                self.notes.append(f"{name:<10} -> {scope[name]}, {where}")
                return
        self.errors.append(f"undefined variable '{name}'")

    def block(self, stmts):
        self.scopes.append({})
        for s in stmts:
            self.stmt(s)
        scope = self.scopes.pop()
        for name, kind in scope.items():
            if kind == "variable" and (id(scope), name) not in self.used:
                self.errors.append(f"warning: '{name}' is never used")

    def stmt(self, s):
        op = s[0]
        if op == "let":
            self.declare(s[1], "initializing")  # declared, but not ready yet
            self.expr(s[2])
            self.scopes[-1][s[1]] = "variable"
        elif op == "set":
            self.use(s[1])
            self.expr(s[2])
        elif op in ("print", "return"):
            if len(s) > 1:
                self.expr(s[1])
        elif op == "fn":
            self.declare(s[1], "fn")  # declared first, so the body can call itself (recursion)
            self.scopes.append({p: "parameter" for p in s[2]})
            self.block(s[3:])
            self.scopes.pop()
        elif op in ("if", "while"):
            self.expr(s[1])
            body = s[2:]
            if "else" in body:
                k = body.index("else")
                self.block(body[:k])
                self.block(body[k + 1:])
            else:
                self.block(body)
        else:
            self.expr(s)

    def expr(self, e):
        if isinstance(e, int) or (isinstance(e, str) and (e.startswith('"') or e in ("true", "false"))):
            return
        if isinstance(e, str):
            self.use(e)
        elif e[0] == "call":
            for x in e[1:]:
                self.expr(x)
        else:
            for x in e[1:]:
                self.expr(x)


program = read("""
(let limit 3)
(fn countdown (n)
  (while (> n 0)
    (let step 1)
    (print n)
    (set n (- n step)))
  (if (== n 0) (print "liftoff") else (print limit)))
(call countdown limit)
(let x (+ x 1))
(let total 0)
(let total 5)
(print (+ total y))
(fn unused_local () (let tmp 1) (return 0))
""")
r = Resolver()
for statement in program:  # top-level statements declare globals
    r.stmt(statement)
print("resolved uses:")
for n in dict.fromkeys(r.notes):  # each distinct resolution once
    print("  " + n)
print("problems found before the program runs:")
for e in r.errors:
    print("  " + e)` }],
        explain: `- The program is given as s-expressions (the AST format our parser printed) and \`read\` turns it into nested lists. This keeps the sample about **resolution**, not parsing.
- \`declare\` adds to the **top** scope only; \`use\` walks \`reversed(self.scopes)\`: innermost first. \`hops\` is the distance, exactly what an interpreter can use later.
- \`countdown\` declares its name **before** pushing the parameter scope, so a recursive call would resolve. Parameters get their own scope, the function body another one: \`n\` inside the \`while\` body is 2 scopes up.
- \`let x (+ x 1)\` is caught because \`x\` is marked \`"initializing"\` while its initializer is checked.
- The unused-variable warning happens when a scope is **popped**: by then we know every use. \`tmp\` was declared and never read.
- All four problems are reported in one run, before anything executes.`,
        output: `resolved uses:
  n          -> parameter, 1 scope up
  n          -> parameter, 2 scopes up
  step       -> variable, the same scope
  limit      -> variable, global
  countdown  -> fn, global
  total      -> variable, global
problems found before the program runs:
  can't read 'x' in its own initializer
  'total' is already declared in this scope
  undefined variable 'y'
  warning: 'tmp' is never used`,
      },
    ],
    interview: [
      {
        q: "What is a symbol table and how do you implement scopes with it?",
        freq: "very-common",
        a: `A data structure mapping identifiers to their attributes: kind, type, declaration location, storage (global, local slot, register), and so on. Scopes are usually a **stack of hash maps** (or a chain of maps with parent pointers): push on entering a scope, insert declarations into the top map, look up from the top down, pop on exit. Alternatives: a single hash map whose entries are stacks of bindings, plus an undo log per scope (fast lookup, used in older compilers). Compilers often keep the per-scope tables around after analysis for debug info and IDE features.`,
      },
      {
        q: "Lexical vs dynamic scoping: what's the difference?",
        freq: "common",
        a: `**Lexical (static)** scoping resolves a free variable using the **textual** nesting of the program: the enclosing blocks and functions where the code is written. It's decidable at compile time, enables closures and static checking, and is used by almost all modern languages. **Dynamic** scoping resolves it using the **call stack** at run time: the most recent active binding of that name in any caller. Examples: early Lisp, Emacs Lisp (by default), Bash/shell variables, Perl's \`local\`. Dynamic scoping makes functions depend on who calls them, which is hard to reason about.`,
      },
      {
        q: "What's variable shadowing? Is it good or bad?",
        freq: "common",
        a: `A declaration in an inner scope with the same name as an outer one hides the outer within the inner scope. Good: it lets you reuse natural names locally, and in Rust it's idiomatic for transforming a value (\`let line = line.trim();\`) without inventing names. Bad: it can cause bugs when you think you're updating the outer variable (classic in Go with \`:=\` inside an \`if\`, creating a new \`err\`). Many linters warn about shadowing; some languages (Java for locals, C#) forbid shadowing a local with another local.`,
      },
      {
        q: "How do compilers handle functions that call each other (mutual recursion) when the language doesn't require forward declarations?",
        freq: "occasional",
        a: `**Multiple passes.** Pass 1 walks the top level (or a whole module) and enters every function, type and global into the symbol table with its signature, without looking at bodies. Pass 2 checks the bodies, where every function name is already known. C instead requires a **prototype** before use, a design from the era of single-pass compilers with little memory. Languages with type inference for functions (OCaml's \`let rec ... and ...\`) group mutually recursive definitions and infer them together.`,
      },
      {
        q: "Why should a compiler report many errors per run, and how does it avoid cascades?",
        freq: "occasional",
        a: `Fixing one error per compile is slow, especially for big projects or slow builds. To avoid one mistake causing dozens of follow-on errors: give the erroneous expression a special **error type** that's compatible with everything and suppresses further messages; after an undefined name, **declare it** with the error type so later uses don't complain again; limit errors per statement; and use parser recovery that resynchronises cleanly. Clang and rustc are known for doing this well.`,
      },
    ],
    quiz: [
      {
        q: "Which of these does the parser accept but semantic analysis rejects?",
        options: ["print (1 + ;", "print totl; when totl was never declared", "let = 5;", "while { }"],
        answer: 1,
        explain: "The statement is well-formed; only knowing what's declared reveals the problem.",
      },
      {
        q: "How do you look up a name in a stack of scopes?",
        options: [
          "Only in the global scope",
          "From the innermost scope outwards; the first match wins",
          "From the global scope inwards",
          "In every scope, and report all matches",
        ],
        answer: 1,
        explain: "Searching innermost first is what makes shadowing work.",
      },
      {
        q: "What does lexical scoping mean?",
        options: [
          "Names are looked up in the caller's variables at run time",
          "A name's meaning depends on where it's written in the source",
          "Names are case-insensitive",
          "Variables live on the heap",
        ],
        answer: 1,
        explain: "Because it only depends on the source text, the compiler can resolve every name before running anything.",
      },
      {
        q: "Why does the resolver declare a function's name before checking its body?",
        options: ["To save memory", "So the body can call the function recursively", "To check its type", "Because parameters come first"],
        answer: 1,
        explain: "Without it, a recursive call inside the body would be an undefined name.",
      },
      {
        q: "What's wrong with `let x = x + 1;` when no outer x exists?",
        options: [
          "Nothing",
          "x is read in its own initializer, before it has a value",
          "It's a syntax error",
          "x must be a constant",
        ],
        answer: 1,
        explain: "The resolver marks x as 'initializing' while checking the right side and reports the read.",
      },
      {
        q: "When is the best moment to warn about an unused local variable?",
        options: ["When it's declared", "When its scope is popped", "At run time", "During lexing"],
        answer: 1,
        explain: "Only at the end of the scope do you know there were no uses.",
      },
      {
        q: "Bash variables and Emacs Lisp use which kind of scoping by default?",
        options: ["Lexical", "Dynamic", "Block", "Module"],
        answer: 1,
        explain: "They look names up through the run-time call chain, not the source structure.",
      },
    ],
  },

  // ------------------------------------------------------------------ TYPES
  {
    id: "comp-types",
    title: "Type checking and type inference",
    tagline: "Static vs dynamic and strong vs weak typing, type rules, writing a type checker, error types that stop cascades, subtyping and generics, and Hindley–Milner inference with unification, let-polymorphism and the occurs check.",
    difficulty: "advanced",
    minutes: 50,
    diagram: {
      title: "How type inference works",
      nodes: [
        { id: "ast", label: "AST", kind: "client", x: 100, y: 270, sub: "fn x => x + 1" },
        { id: "gen", label: "Constraint generator", kind: "service", x: 330, y: 140, sub: "fresh unknowns: 'a, 'b" },
        { id: "eqs", label: "Equations", kind: "queue", x: 330, y: 410, sub: "'a = int, 'b = int" },
        { id: "unify", label: "Unifier", kind: "control", x: 590, y: 270, sub: "solve or report a clash" },
        { id: "subst", label: "Solution", kind: "cache", x: 840, y: 140, sub: "'a := int" },
        { id: "errors", label: "Type errors", kind: "monitor", x: 840, y: 410, sub: "int vs bool, infinite type" },
      ],
      edges: [
        { from: "ast", to: "gen", label: "walk" },
        { from: "gen", to: "eqs", label: "emit" },
        { from: "eqs", to: "unify", label: "one at a time" },
        { from: "unify", to: "subst", label: "binds unknowns" },
        { from: "unify", to: "errors", label: "can't solve" },
      ],
      flows: [
        {
          name: "Infer fn x => x + 1",
          path: ["ast", "gen", "eqs", "unify", "subst"],
          steps: [
            "Start at the function. x has no annotation, so it gets an unknown type 'a. x + 1 uses +, which needs int and int: emit 'a = int, and the result is int.",
            "The equations go to the unifier one by one.",
            "Unifying 'a with int binds the unknown. Nothing clashes.",
            "Read back the solution: the function is int -> int.",
          ],
        },
        {
          name: "Reject 1 + true",
          path: ["ast", "gen", "eqs", "unify", "errors"],
          steps: [
            "The expression applies + to 1 and true. + needs int and int: emit int = int and bool = int.",
            "Feed them to the unifier.",
            "int = int is fine, but bool = int is a clash between two different known types.",
            "Report 'type mismatch: int vs bool' before the program runs.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Imagine a toy box with shapes cut into the lid: a circle hole, a square hole, a star hole. A **type** is the shape of a piece: a number is a circle, a word is a square, true-or-false is a star. Every operation is a hole that accepts certain shapes: \`+\` wants two circles. A **type checker** tries all the pieces in their holes **before you play**. If you try to push a star into a circle hole (\`1 + true\`), it tells you right away, instead of the game breaking halfway through.

**Type inference** is even cleverer: you don't label your pieces at all, and the checker works out each piece's shape from which holes you push it into, like a detective. "You put \`x\` into a \`+\` hole, so \`x\` must be a circle."

## What types are for
A **type** describes a set of values and the operations allowed on them. Types let a compiler:
- **catch mistakes early**: calling a number, adding a list to a bool, passing 2 arguments to a 3-argument function;
- **choose the right machine code**: integer \`add\` vs floating-point \`addsd\`, 32 vs 64 bits, how to lay out a struct;
- **document** code and power tools: autocomplete, refactoring, go-to-definition.

## Static vs dynamic, strong vs weak
Two separate questions:
- **When** are types checked? **Static** typing: by the compiler, before the program runs (C, Java, Go, Rust, TypeScript, Haskell). **Dynamic** typing: at run time, on each operation (Python, JavaScript, Ruby, Pebble). Static catches errors earlier and enables faster code; dynamic is more flexible and quicker to write.
- **How strict** are they? **Strong** typing refuses to silently mix types (\`"1" + 1\` is an error in Python). **Weak** typing converts implicitly (\`"1" + 1\` is \`"11"\` in JavaScript, and C lets you treat any pointer as an integer). "Strong" and "weak" are informal; "static" and "dynamic" are precise.

**Gradual typing** mixes both: TypeScript, Python's type hints with mypy, PHP. Annotated code is checked statically; the rest stays dynamic.

## Type rules
Type systems are specified with **rules** of the form "if the parts have these types, the whole has this type":
\`\`\`text
e1 : int    e2 : int            cond : bool    e1 : T    e2 : T
────────────────────            ──────────────────────────────
   e1 + e2 : int                 if cond then e1 else e2 : T
\`\`\`
A type checker is these rules turned into a **recursive function** over the AST: compute the types of the children, check them against the rule, return the type of the node. Statements don't produce a type but must be checked: an \`if\` condition must be \`bool\`, an assignment must match the variable's type, a \`return\` must match the function's declared return type.

## Writing a checker
The first sample checks a typed Pebble: functions declare parameter and return types, \`let\` variables take the type of their initializer. Notice three techniques every real checker uses:
1. **Function signatures go in the symbol table** before bodies are checked: \`(params → return type)\`.
2. The **error type**: after one error, the bad expression gets type \`error\`, which is compatible with everything and reports nothing more. Without it, \`(+ nothing 1)\` would cause a second, confusing complaint about \`+\`.
3. Messages name **both** types: "\`half\` is int, can't assign a str".

## Beyond int and bool
- **Function types**: \`int -> bool\`. **Product types**: tuples and structs. **Sum types**: enums with data (\`Option<T>\`, \`Result<T, E>\`), checked with exhaustive \`match\`.
- **Subtyping**: a \`Cat\` can be used where an \`Animal\` is expected. Function types get tricky: a function taking an \`Animal\` can stand in for one taking a \`Cat\` (parameters are **contravariant**), and generic containers need **variance** rules (Java's \`List<? extends Animal>\`).
- **Nominal vs structural**: Java types are equal if they have the same **name**; TypeScript and Go interfaces match by **shape** (any type with the right methods).
- **Generics** (parametric polymorphism): \`List<T>\`, \`fn id<T>(x: T) -> T\`. Compiled by **monomorphisation** (Rust, C++ templates: one copy per type, fast but bigger binaries) or **erasure/boxing** (Java: one copy working on pointers).
- **Soundness**: a type system is sound if well-typed programs never hit a type error at run time. Java has known holes (array covariance throws \`ArrayStoreException\`); TypeScript is **deliberately** unsound in places for convenience.

## Type inference: Hindley–Milner
Many languages can work out types with **no annotations**: OCaml, Haskell, F#, Elm, and (inside functions) Rust, Swift and Kotlin. The classic algorithm, **Hindley–Milner** (algorithm W), works in three moves:
1. **Invent unknowns.** Every expression whose type isn't obvious gets a **type variable**: \`'a\`, \`'b\`...
2. **Collect equations.** Each rule produces equations: in \`x + 1\`, \`+\` needs \`int\`s, so \`'a = int\`. Calling \`f x\` gives \`type of f = type of x -> 'result\`.
3. **Unify.** Solve the equations one by one. Unifying two known types checks they're the same (\`int\` vs \`bool\` is an error); unifying an unknown with something **binds** it; unifying two function types unifies their parts.

What's left unsolved becomes **generic**: \`fn x => x\` has type \`'a -> 'a\` for **any** \`'a\`.

**Let-polymorphism**: a \`let\`-bound function is **generalised**, so each use gets **fresh** type variables. That's why \`let id = fn x => x in (id 1, id true)\` works, while a function **parameter** \`id\` (not let-bound) can't be used at two different types: the sample shows both.

The **occurs check**: unifying \`'a\` with \`'a -> 'b\` would need an infinite type (\`'a = ('a -> 'b) -> 'b = ...\`), so it's rejected. That's why \`fn x => x x\` doesn't type-check.

HM inference is nearly linear in practice, always finds the **most general** type, and needs no annotations at all. Extending it (subtyping, overloading, higher-rank types) quickly gets hard, which is why languages like Rust and TypeScript use **local** inference with annotations at function boundaries.

## Where types go next
The checker records a type for **every** expression. The code generator uses those types to pick instructions (\`i1\` vs \`i64\` in LLVM), which is exactly what your pebblec compiler will do in Part 6.`,
    keyPoints: [
      "Static typing checks before running; dynamic typing checks each operation at run time; strong vs weak is about implicit conversions",
      "Type rules say: if the parts have these types, the whole has that type. A checker is those rules as a recursive function",
      "Put function signatures in the symbol table first, and use an error type so one mistake doesn't cascade",
      "Generics are compiled by monomorphisation (C++, Rust) or erasure (Java); variance rules govern subtyping of containers and functions",
      "Hindley–Milner: invent type variables, collect equations, unify. Leftover variables become generic",
      "Let-bound functions are generalised (fresh variables per use); the occurs check rejects infinite types like 'a = 'a -> 'b",
    ],
    code: [
      {
        title: "A static type checker",
        variants: [{ lang: "python", code: `# A static type checker for a typed Pebble: it finds type errors BEFORE the program runs.
# Function syntax:  (fn name (param type param type ...) return-type body...)
import re


def read(text):
    tokens = re.findall(r'\\(|\\)|"[^"]*"|[^\\s()]+', text)
    pos = 0

    def item():
        nonlocal pos
        pos += 1
        if tokens[pos - 1] != "(":
            t = tokens[pos - 1]
            return int(t) if t.isdigit() else t
        out = []
        while tokens[pos] != ")":
            out.append(item())
        pos += 1
        return out

    prog = []
    while pos < len(tokens):
        prog.append(item())
    return prog


ARITH = {"-", "*", "/", "%"}
COMPARE = {"<", "<=", ">", ">="}


class TypeChecker:
    def __init__(self):
        self.scopes = [{}]
        self.errors = []
        self.fn = None  # (name, return type) of the function we're inside

    def error(self, msg):
        where = f"in fn {self.fn[0]}: " if self.fn else ""
        self.errors.append(where + msg)

    def lookup(self, name):
        for scope in reversed(self.scopes):
            if name in scope:
                return scope[name]
        self.error(f"unknown name '{name}'")
        return "error"  # an "error type" stops one mistake from causing a cascade of messages

    def expr(self, e):
        """Return the type of expression e."""
        if isinstance(e, int):
            return "int"
        if e in ("true", "false"):
            return "bool"
        if isinstance(e, str):
            return "str" if e.startswith('"') else self.lookup(e)
        op, args = e[0], [self.expr(a) for a in e[1:]] if e[0] != "call" else None
        if op == "call":
            ftype = self.lookup(e[1])
            if ftype == "error":
                return "error"
            params, ret = ftype
            got = [self.expr(a) for a in e[2:]]
            if len(got) != len(params):
                self.error(f"{e[1]} takes {len(params)} argument(s), got {len(got)}")
            for i, (want, have) in enumerate(zip(params, got)):
                if have not in (want, "error"):
                    self.error(f"argument {i + 1} of {e[1]} should be {want}, got {have}")
            return ret
        if "error" in args:
            return "error"
        if op == "+":
            if args[0] == args[1] and args[0] in ("int", "str"):
                return args[0]
            self.error(f"'+' needs two ints or two strs, got {args[0]} and {args[1]}")
        elif op in ARITH or op in COMPARE:
            if args != ["int"] * len(args):
                self.error(f"'{op}' needs ints, got {' and '.join(args)}")
            return "bool" if op in COMPARE else "int"
        elif op in ("==", "!="):
            if args[0] != args[1]:
                self.error(f"can't compare {args[0]} with {args[1]} using '{op}'")
            return "bool"
        elif op in ("and", "or", "!"):
            if any(a != "bool" for a in args):
                self.error(f"'{op}' needs bools, got {' and '.join(args)}")
            return "bool"
        return "error"

    def stmt(self, s):
        op = s[0]
        if op == "let":
            self.scopes[-1][s[1]] = self.expr(s[2])  # the variable gets its initializer's type
        elif op == "set":
            want, have = self.lookup(s[1]), self.expr(s[2])
            if "error" not in (want, have) and want != have:
                self.error(f"'{s[1]}' is {want}, can't assign a {have}")
        elif op == "print":
            self.expr(s[1])
        elif op == "return":
            have = self.expr(s[1])
            if have not in (self.fn[1], "error"):
                self.error(f"returns {have}, but it is declared to return {self.fn[1]}")
        elif op in ("if", "while"):
            if (t := self.expr(s[1])) not in ("bool", "error"):
                self.error(f"the condition of '{op}' must be bool, got {t}")
            self.scopes.append({})
            for x in s[2:]:
                if x != "else":
                    self.stmt(x)
            self.scopes.pop()
        elif op == "fn":
            name, params, ret, body = s[1], s[2], s[3], s[4:]
            pairs = list(zip(params[::2], params[1::2]))
            self.scopes[-1][name] = ([t for _, t in pairs], ret)  # declared before the body: recursion works
            outer, self.fn = self.fn, (name, ret)
            self.scopes.append(dict(pairs))
            for x in body:
                self.stmt(x)
            self.scopes.pop()
            self.fn = outer
        else:
            self.expr(s)


program = read("""
(fn area (w int h int) int
  (return (* w h)))
(fn shout (msg str) str
  (return (+ msg "!")))
(let size (call area 3 4))
(print (call shout "hello"))
(if (> size 10) (print "big") else (print "small"))

(fn broken (n int) bool
  (let half (/ n 2))
  (if (+ half 1) (print half))
  (set half "two")
  (return half))
(print (+ size true))
(print (call area 5))
(print (call shout 42))
(print (== size "12"))
(print (+ nothing 1))
""")
tc = TypeChecker()
for s in program:
    tc.stmt(s)
print(f"{len(tc.errors)} type errors, found without running anything:")
for e in tc.errors:
    print("  " + e)` }],
        explain: `- \`expr\` returns the type of an expression; each \`if\` branch is one type rule. \`+\` accepts two ints **or** two strings (string concatenation), the comparisons need ints and give \`bool\`.
- Function declarations store \`([param types], return type)\` in the scope **before** the body is checked, and remember the return type in \`self.fn\` so \`return\` can be checked.
- In \`broken\`, three different statement rules fire: an \`if\` condition that's an int, an assignment of a \`str\` to an \`int\` variable, and a \`return\` of the wrong type.
- \`(print (+ nothing 1))\` reports only "unknown name": \`lookup\` returns \`"error"\`, and \`expr\` returns \`"error"\` without complaining when an argument is already an error.
- All 8 errors appear without running a single line. A dynamically typed Pebble would only hit them one at a time, if and when each line runs.`,
        output: `8 type errors, found without running anything:
  in fn broken: the condition of 'if' must be bool, got int
  in fn broken: 'half' is int, can't assign a str
  in fn broken: returns int, but it is declared to return bool
  '+' needs two ints or two strs, got int and bool
  area takes 2 argument(s), got 1
  argument 1 of shout should be str, got int
  can't compare int with str using '=='
  unknown name 'nothing'`,
      },
      {
        title: "Hindley–Milner type inference",
        variants: [{ lang: "python", code: `# Type inference (Hindley-Milner, the algorithm behind OCaml, Haskell, F# and Rust's local inference).
# No type annotations at all: the checker invents unknowns ("type variables") and solves equations.
#   (fn x body)         a one-argument function      (f a)          call f with a
#   (let x value body)  x is usable in body          (if c a b)     (pair a b)
import re


class TVar:
    """An unknown type. Unification may later point it at a real type."""
    count = 0

    def __init__(self):
        self.ref = None
        TVar.count += 1
        self.id = TVar.count


def prune(t):  # follow the chain of solved type variables
    while isinstance(t, TVar) and t.ref is not None:
        t = t.ref
    return t


def occurs(v, t):
    t = prune(t)
    return t is v or (isinstance(t, tuple) and any(occurs(v, x) for x in t[1:]))


def unify(a, b):
    """Make two types equal, or fail. Types: "int", "bool", ("->", arg, result), ("pair", a, b), TVar."""
    a, b = prune(a), prune(b)
    if isinstance(a, TVar):
        if a is not b:
            if occurs(a, b):
                raise TypeError(f"infinite type: {show(a)} = {show(b)}")
            a.ref = b
    elif isinstance(b, TVar):
        unify(b, a)
    elif isinstance(a, tuple) and isinstance(b, tuple) and a[0] == b[0]:
        for x, y in zip(a[1:], b[1:]):
            unify(x, y)
    elif a != b:
        raise TypeError(f"type mismatch: {show(a)} vs {show(b)}")


def free_vars(t):
    t = prune(t)
    if isinstance(t, TVar):
        return {t}
    return set().union(*(free_vars(x) for x in t[1:])) if isinstance(t, tuple) else set()


def instantiate(scheme):
    """A let-bound (generic) type gets FRESH variables at every use: that's let-polymorphism."""
    generic, t = scheme
    fresh = {v: TVar() for v in generic}

    def copy(t):
        t = prune(t)
        if isinstance(t, TVar):
            return fresh.get(t, t)
        return (t[0], *map(copy, t[1:])) if isinstance(t, tuple) else t
    return copy(t)


BUILTINS = {"+": ("->", "int", ("->", "int", "int")), "<": ("->", "int", ("->", "int", "bool"))}


def infer(e, env):
    if isinstance(e, int):
        return "int"
    if e in ("true", "false"):
        return "bool"
    if isinstance(e, str):
        if e in BUILTINS:
            return BUILTINS[e]
        if e not in env:
            raise TypeError(f"unknown name {e}")
        return instantiate(env[e])
    head = e[0]
    if head == "fn":  # (fn x body): x gets a fresh unknown type
        arg = TVar()
        body = infer(e[2], {**env, e[1]: (set(), arg)})
        return ("->", arg, body)
    if head == "let":  # (let x value body): generalise value's type over variables not fixed by env
        t = infer(e[2], env)
        env_vars = set().union(*(free_vars(s[1]) for s in env.values())) if env else set()
        return infer(e[3], {**env, e[1]: (free_vars(t) - env_vars, t)})
    if head == "if":
        unify(infer(e[1], env), "bool")
        t = infer(e[2], env)
        unify(t, infer(e[3], env))
        return t
    if head == "pair":
        return ("pair", infer(e[1], env), infer(e[2], env))
    # application, curried: (f a b) means ((f a) b)
    t = infer(head, env)
    for arg in e[1:]:
        result = TVar()
        unify(t, ("->", infer(arg, env), result))
        t = result
    return t


def show(t, names=None):
    names = {} if names is None else names
    t = prune(t)
    if isinstance(t, TVar):
        return names.setdefault(t, "'" + "abcdefgh"[len(names)])
    if isinstance(t, tuple):
        if t[0] == "->":
            left = show(t[1], names)
            left = f"({left})" if isinstance(prune(t[1]), tuple) and prune(t[1])[0] == "->" else left
            return f"{left} -> {show(t[2], names)}"
        return f"({show(t[1], names)}, {show(t[2], names)})"
    return t


def read(text):
    tokens = re.findall(r"\\(|\\)|[^\\s()]+", text)

    def item(i):
        if tokens[i] != "(":
            return (int(tokens[i]) if tokens[i].isdigit() else tokens[i]), i + 1
        out, i = [], i + 1
        while tokens[i] != ")":
            x, i = item(i)
            out.append(x)
        return out, i + 1
    return item(0)[0]


examples = [
    "(fn x (+ x 1))",
    "(fn x x)",
    "(fn f (fn x (f (f x))))",
    "(fn x (fn y (if (< x y) x y)))",
    "(fn f (fn g (fn x (g (f x)))))",
    "(let id (fn x x) (pair (id 1) (id true)))",
    "(fn id (pair (id 1) (id true)))",
    "(+ 1 true)",
    "(fn x (x x))",
]
for src in examples:
    try:
        print(f"{src:<44} : {show(infer(read(src), {}))}")
    except TypeError as err:
        print(f"{src:<44} ! {err}")` }],
        explain: `- A \`TVar\` is an unknown; \`ref\` is set when unification solves it. \`prune\` follows the chain to the current answer. This "union-find on types" is how real implementations avoid copying substitutions around.
- \`unify\` is the heart: two equal base types are fine, an unknown gets bound (after the **occurs check**), two function types unify argument with argument and result with result, anything else is a mismatch.
- \`fn f (fn x (f (f x)))\`: \`f\` is applied to \`x\` and to its own result, so its argument and result types must be equal: \`('a -> 'a) -> 'a -> 'a\`. Nobody wrote that type; it was deduced.
- \`let\` generalises: \`free_vars(t) - env_vars\` are the variables that may become fresh at each use (\`instantiate\`). That's why \`(id 1)\` and \`(id true)\` both work when \`id\` is let-bound, but fail when \`id\` is a parameter.
- \`(fn x (x x))\` asks for \`'a = 'a -> 'b\`: the occurs check catches the infinite type.`,
        output: `(fn x (+ x 1))                               : int -> int
(fn x x)                                     : 'a -> 'a
(fn f (fn x (f (f x))))                      : ('a -> 'a) -> 'a -> 'a
(fn x (fn y (if (< x y) x y)))               : int -> int -> int
(fn f (fn g (fn x (g (f x)))))               : ('a -> 'b) -> ('b -> 'c) -> 'a -> 'c
(let id (fn x x) (pair (id 1) (id true)))    : (int, bool)
(fn id (pair (id 1) (id true)))              ! type mismatch: int vs bool
(+ 1 true)                                   ! type mismatch: int vs bool
(fn x (x x))                                 ! infinite type: 'a = 'a -> 'b`,
      },
    ],
    interview: [
      {
        q: "What's the difference between static and dynamic typing, and between strong and weak typing?",
        freq: "very-common",
        a: `**Static** typing checks types at **compile time** (Java, C, Rust, Go, Haskell); **dynamic** typing checks at **run time**, with types attached to values rather than variables (Python, JavaScript, Ruby). Static catches errors earlier, enables optimizations and tooling; dynamic is more flexible and concise.

**Strong** vs **weak** is about implicit conversions and loopholes: strong typing refuses to mix incompatible types silently (Python: \`"1" + 1\` raises), weak typing coerces (JavaScript: \`"1" + 1 === "11"\`, C: pointer/int casts, unchecked unions). The axes are independent: Python is dynamic and strong; C is static and fairly weak.`,
      },
      {
        q: "How does Hindley–Milner type inference work?",
        freq: "common",
        a: `Assign a fresh **type variable** to each unknown (parameters, results), walk the program generating **equality constraints** from each construct (an application \`f x\` gives \`τ_f = τ_x → τ_r\`, an \`if\` makes branches equal and the condition \`bool\`), and solve them by **unification**, which binds variables, decomposes structured types and fails on mismatches or an **occurs-check** violation. At \`let\` bindings, **generalise** the type over variables not free in the environment, producing a polymorphic scheme that's **instantiated** freshly at each use. The result is the **principal** (most general) type, without annotations, in near-linear time for practical programs.`,
      },
      {
        q: "What is unification?",
        freq: "occasional",
        a: `Finding a substitution for type variables that makes two type expressions identical. Rules: a variable unifies with any type not containing it (bind it); two identical constructors unify if their arguments unify pairwise (\`a → b\` with \`int → c\` gives \`a = int\`, \`b = c\`); different constructors fail. Implemented efficiently with union-find over type nodes. It also appears in Prolog, in pattern matching and in theorem provers.`,
      },
      {
        q: "What does it mean for a type system to be sound?",
        freq: "occasional",
        a: `If the type checker accepts a program, that program can't perform an operation on a value of the wrong type at run time ("well-typed programs don't go wrong"), often proven via **progress and preservation** theorems. Unsound examples: Java's covariant arrays (caught at run time by \`ArrayStoreException\`), TypeScript's bivariant method parameters and \`any\`, C's casts. Soundness is a trade-off against convenience and backwards compatibility.`,
      },
      {
        q: "Explain covariance and contravariance.",
        freq: "common",
        a: `Given \`Cat <: Animal\`: a type constructor is **covariant** if it preserves the direction (\`ReadOnlyList<Cat> <: ReadOnlyList<Animal>\`, function **return** types), **contravariant** if it reverses it (function **parameters**: a function accepting any \`Animal\` can be used where a function accepting \`Cat\` is expected), and **invariant** if neither (mutable containers: \`List<Cat>\` isn't a \`List<Animal>\`, or you could add a Dog). Java expresses this with \`? extends T\` / \`? super T\` (PECS), C# and Kotlin with \`out\`/\`in\`.`,
      },
      {
        q: "How are generics implemented: monomorphisation vs type erasure?",
        freq: "common",
        a: `**Monomorphisation** (C++ templates, Rust, Swift when specialised): generate a separate copy of the generic code for each concrete type used. Fast (static dispatch, inlining, unboxed values) but larger binaries and longer compile times. **Type erasure** (Java): compile one copy that works on references (\`Object\`), with casts inserted; small and fast to compile, but primitives must be boxed, and type arguments aren't available at run time (\`new T()\` is impossible). C# and .NET mix both: specialised code for value types, shared code for reference types. Go uses a hybrid ("GC shape stenciling" with dictionaries).`,
      },
      {
        q: "Why do type checkers use an 'error type'?",
        freq: "occasional",
        a: `To prevent **cascading errors**. When an expression is ill-typed or refers to an unknown name, give it a special error type that unifies or is compatible with everything and suppresses diagnostics in expressions that contain it. One root mistake then produces one message, not a chain of increasingly confusing ones. Rust (\`{type error}\`), TypeScript and Clang all do this.`,
      },
    ],
    quiz: [
      {
        q: "Python raises an error for `\"1\" + 1` only when that line runs. That's...",
        options: ["Static and weak", "Dynamic and strong", "Static and strong", "Dynamic and weak"],
        answer: 1,
        explain: "Checked at run time (dynamic), and it refuses to convert silently (strong). JavaScript would give \"11\" (weak).",
      },
      {
        q: "What does the type rule for `if c then e1 else e2` require?",
        options: [
          "c is bool and e1, e2 have the same type, which is the type of the whole",
          "e1 and e2 are bool",
          "c is an int",
          "Nothing",
        ],
        answer: 0,
        explain: "The condition must be bool, and both branches must agree, since either could be the result.",
      },
      {
        q: "In the checker sample, why does `(+ nothing 1)` produce only one error?",
        options: [
          "+ isn't checked",
          "The unknown name gets the error type, and expressions containing it don't report more errors",
          "The checker stops at the first error",
          "nothing is a keyword",
        ],
        answer: 1,
        explain: "The error type absorbs follow-on problems so the programmer sees the real cause.",
      },
      {
        q: "What type does Hindley–Milner infer for `fn x => x`?",
        options: ["int -> int", "'a -> 'a", "'a -> 'b", "It can't be typed"],
        answer: 1,
        explain: "Nothing constrains x, and the result is x itself, so it works for any type: 'a -> 'a.",
      },
      {
        q: "What does unification do when it meets an unknown 'a and the type int?",
        options: ["Reports an error", "Binds 'a to int", "Binds int to 'a", "Ignores it"],
        answer: 1,
        explain: "An unknown can become any type (after the occurs check). Two different known types would be an error.",
      },
      {
        q: "Why does `let id = fn x => x in (id 1, id true)` type-check, but not when id is a function parameter?",
        options: [
          "Parameters can't be functions",
          "let-bound definitions are generalised, so each use gets fresh type variables",
          "true is an int",
          "The pair type is special",
        ],
        answer: 1,
        explain: "Let-polymorphism: id : forall 'a. 'a -> 'a is instantiated separately for int and bool. A parameter has one fixed (unknown) type.",
      },
      {
        q: "Why is `fn x => x x` rejected?",
        options: [
          "Functions can't be called twice",
          "It needs 'a = 'a -> 'b, an infinite type; the occurs check rejects it",
          "x is undefined",
          "It's a syntax error",
        ],
        answer: 1,
        explain: "x would have to be a function that accepts itself, which no finite type describes.",
      },
      {
        q: "How does Rust compile a generic function used with i32 and String?",
        options: [
          "One copy that works on boxed pointers",
          "A separate specialised copy for each type (monomorphisation)",
          "It interprets it",
          "It erases the types at run time like Java",
        ],
        answer: 1,
        explain: "Monomorphisation gives fast static dispatch at the cost of code size and compile time.",
      },
    ],
  },
];
