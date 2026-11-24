/*
 * Awesome-OS B8G_ABI_MAGIC_V3 metadata & lock-free 64-byte-aligned B8G_ARENA_V1
 * uv_buf_t slab pool implementation for awesome-os/libuv.
 * MIT Licensed — see LICENSE.
 */

#include <stdatomic.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>

#include "b8g_libuv.h"

/* 64-byte-aligned BSS arena: 64 x 64 KiB = 4 MiB, 0 bytes on disk. */
static _Alignas(B8G_LIBUV_SLAB_ALIGN)
    uint8_t g_b8g_slab_arena[B8G_LIBUV_SLAB_COUNT][B8G_LIBUV_SLAB_BUF_SIZE];

/* Lock-free 64-bit occupancy bitmask (0 = free, 1 = checked out). */
static atomic_uint_fast64_t g_b8g_slab_mask = ATOMIC_VAR_INIT(0);

static unsigned int b8g_ctz64(uint64_t v) {
#if defined(__GNUC__) || defined(__clang__)
  return (unsigned int)__builtin_ctzll(v);
#else
  unsigned int n = 0;
  while ((v & 1ULL) == 0ULL) {
    v >>= 1;
    n++;
  }
  return n;
#endif
}

uint32_t b8g_libuv_abi_magic(void) {
  return B8G_LIBUV_ABI_MAGIC_V3;
}

const char* b8g_libuv_cas_tag(void) {
  return B8G_LIBUV_CAS_TAG;
}

void b8g_libuv_slab_alloc(uv_handle_t* handle,
                          size_t suggested_size,
                          uv_buf_t* buf) {
  (void)handle;
  if (buf == NULL)
    return;

  if (suggested_size <= B8G_LIBUV_SLAB_BUF_SIZE) {
    uint_fast64_t mask = atomic_load_explicit(&g_b8g_slab_mask, memory_order_relaxed);
    for (;;) {
      uint64_t free_bits = ~(uint64_t)mask;
      if (free_bits == 0ULL)
        break;
      unsigned int idx = b8g_ctz64(free_bits);
      uint_fast64_t next = mask | ((uint_fast64_t)1ULL << idx);
      if (atomic_compare_exchange_weak_explicit(&g_b8g_slab_mask,
                                                &mask,
                                                next,
                                                memory_order_acquire,
                                                memory_order_relaxed)) {
        *buf = uv_buf_init((char*)g_b8g_slab_arena[idx], B8G_LIBUV_SLAB_BUF_SIZE);
        return;
      }
    }
  }

  /* Overflow / >64 KiB fallback to heap malloc. */
  size_t alloc_len = suggested_size > 0 ? suggested_size : B8G_LIBUV_SLAB_BUF_SIZE;
  char* mem = (char*)malloc(alloc_len);
  *buf = uv_buf_init(mem, mem != NULL ? (unsigned int)alloc_len : 0u);
}

void b8g_libuv_slab_release(const uv_buf_t* buf) {
  if (buf == NULL || buf->base == NULL)
    return;

  uintptr_t ptr = (uintptr_t)buf->base;
  uintptr_t start = (uintptr_t)&g_b8g_slab_arena[0][0];
  uintptr_t end = start + (uintptr_t)sizeof(g_b8g_slab_arena);

  if (ptr >= start && ptr < end) {
    uintptr_t offset = ptr - start;
    if ((offset % B8G_LIBUV_SLAB_BUF_SIZE) == 0u) {
      unsigned int idx = (unsigned int)(offset / B8G_LIBUV_SLAB_BUF_SIZE);
      atomic_fetch_and_explicit(&g_b8g_slab_mask,
                                ~((uint_fast64_t)1ULL << idx),
                                memory_order_release);
      return;
    }
  }

  free(buf->base);
}
