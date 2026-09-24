---
title: Go-ASCII-Streamer
date: 2026-09-12
tags: [go, project]
summary: Streaming live video into the terminal as ASCII, frame by frame.
placeholder: true
---

> [!todo] Placeholder
> Swap this for your build log.

Every frame becomes a grid of characters. Brighter pixels get denser glyphs:

```go
const ramp = " .:-=+*#%@"

func toASCII(lum float64) byte {
    return ramp[int(lum*float64(len(ramp)-1))]
}
```

> [!tip] Why Go?
> Goroutines make the capture → convert → send pipeline trivial to parallelise.

Back to [[hello-world]].
