package main

import (
	"container/list"
	"sync"
	"time"
)

// Cache is a generic LRU cache with an optional per-entry TTL. A map gives O(1) lookup of the
// list element; the list keeps recency order (front = most recent).
type Cache[K comparable, V any] struct {
	mu       sync.Mutex
	capacity int
	ttl      time.Duration // 0 = never expire
	ll       *list.List
	items    map[K]*list.Element
	now      func() time.Time
}

type entry[K comparable, V any] struct {
	key     K
	value   V
	expires time.Time
}

func NewCache[K comparable, V any](capacity int, ttl time.Duration) *Cache[K, V] {
	if capacity <= 0 {
		panic("capacity must be positive")
	}
	return &Cache[K, V]{capacity: capacity, ttl: ttl, ll: list.New(), items: map[K]*list.Element{}, now: time.Now}
}

func (c *Cache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	var zero V
	el, ok := c.items[key]
	if !ok {
		return zero, false
	}
	e := el.Value.(*entry[K, V])
	if c.ttl > 0 && !c.now().Before(e.expires) {
		c.ll.Remove(el)
		delete(c.items, key)
		return zero, false
	}
	c.ll.MoveToFront(el)
	return e.value, true
}

func (c *Cache[K, V]) Put(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()
	expires := c.now().Add(c.ttl)
	if el, ok := c.items[key]; ok {
		el.Value = &entry[K, V]{key, value, expires}
		c.ll.MoveToFront(el)
		return
	}
	c.items[key] = c.ll.PushFront(&entry[K, V]{key, value, expires})
	if c.ll.Len() > c.capacity {
		oldest := c.ll.Back()
		c.ll.Remove(oldest)
		delete(c.items, oldest.Value.(*entry[K, V]).key)
	}
}

func (c *Cache[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.ll.Len()
}
