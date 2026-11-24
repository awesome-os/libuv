/*
 * Awesome-OS B8G_ABI_MAGIC_V3 metadata & 64-byte-aligned B8G_ARENA_V1 slab pool
 * for awesome-os/libuv.
 * MIT Licensed — see LICENSE.
 */

#ifndef B8G_LIBUV_H
#define B8G_LIBUV_H

#include <stddef.h>
#include <stdint.h>
#include "uv.h"

#ifdef __cplusplus
extern "C" {
#endif

#define B8G_LIBUV_ABI_MAGIC_V3 0x33564742u
#define B8G_LIBUV_CAS_TAG "awesome-os/libuv+b8g-cas-v11"

#define B8G_LIBUV_SLAB_ALIGN 64u
#define B8G_LIBUV_SLAB_BUF_SIZE 65536u
#define B8G_LIBUV_SLAB_COUNT 64u

UV_EXTERN uint32_t b8g_libuv_abi_magic(void);
UV_EXTERN const char* b8g_libuv_cas_tag(void);

/*
 * Lock-free 64-byte-aligned B8G_ARENA_V1 uv_buf_t slab allocator/releaser
 * for zero-malloc uv_read_start() / \\.\pipe\b8g-* IPC.
 */
UV_EXTERN void b8g_libuv_slab_alloc(uv_handle_t* handle,
                                    size_t suggested_size,
                                    uv_buf_t* buf);
UV_EXTERN void b8g_libuv_slab_release(const uv_buf_t* buf);

#ifdef __cplusplus
}
#endif

#endif /* B8G_LIBUV_H */
