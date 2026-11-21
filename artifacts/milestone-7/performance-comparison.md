# Four-browser performance comparison

Each cell lists the baseline followed by the updated run. Four independent Chromium contexts shared the Windows machine with the authoritative server and PostgreSQL. Sampling began after dungeon preload. The leader used the same route, viewport, controlled encounter positions and gameplay inputs. Host contention varies between runs.

| Zone                          | Cumulative ticks/s | Phaser FPS at sample | Display objects | Gate interaction to visible state (ms) |
| ----------------------------- | ------------------ | -------------------- | --------------- | -------------------------------------- |
| Forsaken Entrance             | 22.9 / 29.9        | 49.8 / 56.9          | 505.0 / 345.0   | 306.0 / 345.0                          |
| Molten Passages               | 23.0 / 30.0        | 54.0 / 55.6          | 520.0 / 334.0   | 274.0 / 263.0                          |
| Forgotten Crypt               | 23.2 / 30.0        | 54.4 / 56.0          | 624.0 / 345.0   | 333.0 / 275.0                          |
| Corrupted Sanctum             | 23.2 / 30.0        | 53.0 / 55.1          | 623.0 / 368.0   | 408.0 / 376.0                          |
| Throne of the Shadow Overlord | 22.1 / 30.0        | 34.5 / 56.3          | 601.0 / 374.0   | 361.0 / 280.0                          |

## Timing and traffic

- Baseline captured 2,466 animation frames. Median interval was 16.7 ms and p95 was 33.4 ms. Preload transferred 7,607,220 bytes over 57 asset entries. The leader received 188,897 WebSocket payload bytes in 924 frames through the last gate.
- Updated captured 2,185 animation frames. Median interval was 16.7 ms and p95 was 33.3 ms. Preload transferred 7,607,220 bytes over 57 asset entries. The leader received 207,567 WebSocket payload bytes in 845 frames through the last gate.
- The final 256 sampled simulation callbacks averaged 0.27 ms per step at the median and 1.11 ms at p95. Callback lateness reached 14.74 ms at p95. The server recovered elapsed time through bounded catch-up.
- At the final gate the updated leader received 24.0 WebSocket frames/s with mean size 246 bytes and p95 1602 bytes. The browser recorded 66 outbound frames. These include room messages and state patches. The gate timing also includes test-controller positioning, input and all-member UI synchronization.

## Scope

The renderer retires off-screen wall sprites. The server clock recovers delayed callbacks. Four simultaneous renderers, local services and instrumentation share the host. A single rAF interval can be short while Phaser reports lower sustained FPS. WAN latency, hour-long stability and sustained 60 FPS remain outside the demonstrated results.

See [baseline samples](performance-before.json), [updated samples](performance-after.json), [single-player idle](one-player-idle.json) and [navigation memory measurements](navigation-memory.json).
