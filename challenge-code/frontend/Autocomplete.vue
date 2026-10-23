<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";

const props = defineProps<{ search: (q: string, signal: AbortSignal) => Promise<string[]> }>();
const emit = defineEmits<{ select: [value: string] }>();

const query = ref("");
const results = ref<string[]>([]);
const status = ref<"idle" | "loading" | "success" | "error">("idle");
const open = ref(false);
const active = ref(-1);
const cache = new Map<string, string[]>();
let timer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;

// Debounce: restart a 250ms timer on every keystroke; only the last one fires a request.
watch(query, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => run(value.trim()), 250);
});

async function run(q: string) {
  controller?.abort(); // cancel the in-flight request so a stale response can't win
  if (!q) return;
  if (cache.has(q)) {
    results.value = cache.get(q)!;
    status.value = "success";
    return;
  }
  controller = new AbortController();
  status.value = "loading";
  try {
    const items = await props.search(q, controller.signal);
    cache.set(q, items);
    results.value = items;
    status.value = "success";
    active.value = -1;
  } catch (err) {
    if ((err as Error).name !== "AbortError") status.value = "error";
  }
}

function choose(value: string) {
  query.value = value;
  open.value = false;
  emit("select", value);
}

function onKeydown(e: KeyboardEvent) {
  const n = results.value.length;
  if (e.key === "ArrowDown" && n) {
    e.preventDefault();
    open.value = true;
    active.value = (active.value + 1) % n;
  } else if (e.key === "ArrowUp" && n) {
    e.preventDefault();
    active.value = (active.value - 1 + n) % n;
  } else if (e.key === "Enter" && active.value >= 0) {
    e.preventDefault();
    choose(results.value[active.value]);
  } else if (e.key === "Escape") {
    open.value = false;
  }
}

onBeforeUnmount(() => {
  clearTimeout(timer);
  controller?.abort();
});
</script>

<template>
  <div class="autocomplete">
    <input
      v-model="query"
      role="combobox"
      aria-controls="ac-list"
      aria-autocomplete="list"
      :aria-expanded="open && !!query"
      :aria-activedescendant="active >= 0 ? `ac-${active}` : undefined"
      @input="open = true"
      @keydown="onKeydown"
      @blur="open = false"
    />
    <ul v-if="open && query" id="ac-list" role="listbox">
      <li v-if="status === 'loading'">Loading…</li>
      <li v-else-if="status === 'error'" role="alert">Something went wrong</li>
      <li v-else-if="results.length === 0">No matches</li>
      <li
        v-for="(r, i) in results"
        v-else
        :id="`ac-${i}`"
        :key="r"
        role="option"
        :aria-selected="i === active"
        @mousedown.prevent="choose(r)"
      >
        {{ r }}
      </li>
    </ul>
  </div>
</template>
