# `awesome-os/libuv`

Hard-fork of MIT-licensed [`libuv/libuv`](https://github.com/libuv/libuv) serving as Awesome-OS's shared async I/O substrate (`libuv.{dll,so,dylib}`) for Node, `wasi-host`, and `holo-compiler`, tagged with `B8G_ABI_MAGIC_V3` (`0x33564742`).

## Awesome-OS ABI Extensions & Optimizations

Defined in [`include/b8g_libuv.h`](include/b8g_libuv.h), [`src/b8g_libuv.c`](src/b8g_libuv.c), and [`src/threadpool.c`](src/threadpool.c):

- **`B8G_LIBUV_ABI_MAGIC_V3` (`0x33564742u`)**:
  - `UV_EXTERN uint32_t b8g_libuv_abi_magic(void)` — returns `0x33564742u`
  - `UV_EXTERN const char* b8g_libuv_cas_tag(void)` — returns `"awesome-os/libuv+b8g-cas-v11"`
- **Core-Scaled Default Threadpool (`src/threadpool.c`)**: When `UV_THREADPOOL_SIZE` is unset, scales the default worker pool to `uv_available_parallelism()` clamped to `[4, 32]` (explicit `UV_THREADPOOL_SIZE` is always respected).
- **64-Byte-Aligned `B8G_ARENA_V1` `uv_buf_t` Slab Pool (`include/b8g_libuv.h`, `src/b8g_libuv.c`)**:
  - `UV_EXTERN void b8g_libuv_slab_alloc(uv_handle_t*, size_t, uv_buf_t*)`
  - `UV_EXTERN void b8g_libuv_slab_release(const uv_buf_t*)`
  - Lock-free 64-bit atomic freelist over 64 × 64 KiB 64-byte-aligned BSS slabs for zero-malloc `uv_read_start()` / `\\.\pipe\b8g-*` IPC.

## Hermetic `zig cc` Build (Zero WSL)

Compile stripped shared libraries directly with `zig cc` via [`scripts/build-zig-cc.mts`](scripts/build-zig-cc.mts):

```powershell
# Windows x64 DLL + C11 smoke test
node scripts/build-zig-cc.mts --target win64 --smoke

# Cross-compile Linux x64 / arm64 .so from Windows (zero WSL)
node scripts/build-zig-cc.mts --target "linux-x64,linux-arm64"
```

`src/b8g_libuv.c` is also wired into [`CMakeLists.txt`](CMakeLists.txt) for standard CMake consumers.

## License

MIT — see [`LICENSE`](LICENSE) and [`LICENSE-extra`](LICENSE-extra).

## Quick Install & Run (Windows / Linux / macOS)

```sh
# Install / hydrate from v11 CAS via holo-pm
holo-pm install repository://github.com/awesome-os/libuv@main

# Or project & run directly via holo-project (0-byte hardlink)
holo-project "project://cpp/libuv?from=repository://github.com/awesome-os/libuv@main"
```
