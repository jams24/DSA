package main

import (
	"fmt"
	"sort"
)

func main() {
	in := make([]int, 1000)
	for i := range in {
		in[i] = i
	}
	var got []int
	for v := range Pipeline(in, 4, func(n int) int { return n * 2 }) {
		got = append(got, v)
	}
	sort.Ints(got)
	if len(got) != 1000 {
		panic(len(got))
	}
	for i, v := range got {
		if v != i*2 {
			panic(fmt.Sprint("missing ", i))
		}
	}
	for range Pipeline(nil, 3, func(n int) int { return n }) {
		panic("empty input should yield nothing")
	}
	fmt.Println("ok")
}
