/*
 * C11 smoke test for awesome-os/libuv shared library + B8G_ABI_MAGIC_V3
 * + 64-byte-aligned B8G_ARENA_V1 uv_buf_t slab pool.
 */

#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "b8g_libuv.h"
#include "uv.h"

static int g_idle_ticks = 0;

static void on_idle(uv_idle_t* handle) {
  g_idle_ticks++;
  uv_idle_stop(handle);
}

int main(void) {
  uint32_t magic = b8g_libuv_abi_magic();
  const char* cas_tag = b8g_libuv_cas_tag();
  const char* ver = uv_version_string();
  unsigned int parallel = uv_available_parallelism();
  uint64_t t0 = uv_hrtime();

  uv_loop_t* loop = uv_default_loop();
  if (loop == NULL) {
    fprintf(stderr, "FAIL: uv_default_loop() returned NULL\n");
    return 1;
  }

  uv_idle_t idler;
  int rc = uv_idle_init(loop, &idler);
  if (rc != 0) {
    fprintf(stderr, "FAIL: uv_idle_init failed: %s\n", uv_strerror(rc));
    return 1;
  }

  rc = uv_idle_start(&idler, on_idle);
  if (rc != 0) {
    fprintf(stderr, "FAIL: uv_idle_start failed: %s\n", uv_strerror(rc));
    return 1;
  }

  rc = uv_run(loop, UV_RUN_DEFAULT);
  if (rc != 0) {
    fprintf(stderr, "FAIL: uv_run returned %d\n", rc);
    return 1;
  }

  uv_close((uv_handle_t*)&idler, NULL);
  uv_run(loop, UV_RUN_DEFAULT);
  uv_loop_close(loop);

  /* Verify 64-byte alignment + zero-alloc slab reuse. */
  uv_buf_t b1 = uv_buf_init(NULL, 0);
  uv_buf_t b2 = uv_buf_init(NULL, 0);
  uv_buf_t b3 = uv_buf_init(NULL, 0);

  b8g_libuv_slab_alloc(NULL, 65536, &b1);
  b8g_libuv_slab_alloc(NULL, 4096, &b2);

  if (b1.base == NULL || b2.base == NULL || b1.base == b2.base) {
    fprintf(stderr, "FAIL: slab alloc returned NULL or duplicate active buffer\n");
    return 5;
  }
  if (((uintptr_t)b1.base % B8G_LIBUV_SLAB_ALIGN) != 0 ||
      ((uintptr_t)b2.base % B8G_LIBUV_SLAB_ALIGN) != 0) {
    fprintf(stderr, "FAIL: slab buffer not 64-byte aligned (%p, %p)\n",
            (void*)b1.base, (void*)b2.base);
    return 6;
  }

  char* first_ptr = b1.base;
  b8g_libuv_slab_release(&b1);
  b8g_libuv_slab_alloc(NULL, 65536, &b3);
  int reused = (b3.base == first_ptr);
  b8g_libuv_slab_release(&b2);
  b8g_libuv_slab_release(&b3);

  uint64_t t1 = uv_hrtime();

  printf("uv_version_string()       = %s\n", ver);
  printf("uv_available_parallelism  = %u\n", parallel);
  printf("uv_hrtime()               = %" PRIu64 " ns (delta %" PRIu64 " ns)\n", t1, t1 - t0);
  printf("b8g_libuv_abi_magic       = 0x%08X (expected 0x%08X)\n", magic, B8G_LIBUV_ABI_MAGIC_V3);
  printf("b8g_libuv_cas_tag         = %s\n", cas_tag);
  printf("uv_run idle ticks         = %d\n", g_idle_ticks);
  printf("b8g_libuv_slab align/reuse= 64B aligned (%p), reused=%d\n", (void*)first_ptr, reused);

  if (magic != B8G_LIBUV_ABI_MAGIC_V3) {
    fprintf(stderr, "FAIL: ABI magic mismatch\n");
    return 2;
  }
  if (strcmp(cas_tag, B8G_LIBUV_CAS_TAG) != 0) {
    fprintf(stderr, "FAIL: CAS tag mismatch\n");
    return 3;
  }
  if (g_idle_ticks != 1) {
    fprintf(stderr, "FAIL: idle callback did not run\n");
    return 4;
  }
  if (!reused) {
    fprintf(stderr, "FAIL: slab pool did not reuse released 64-byte-aligned slot\n");
    return 7;
  }

  printf("PASS: awesome-os/libuv C11 smoke test succeeded\n");
  return 0;
}
