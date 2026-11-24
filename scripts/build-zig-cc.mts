#!/usr/bin/env node
/**
 * Hermetic zero-WSL `zig cc` builder for awesome-os/libuv.
 *
 * Usage:
 *   node scripts/build-zig-cc.mts [--target win64|linux-x64|linux-arm64|macos-arm64|macos-x64|all] [--out dist] [--smoke]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const COMMON_SOURCES = [
  'src/alloc.c',
  'src/b8g_libuv.c',
  'src/fs-common.c',
  'src/fs-poll.c',
  'src/idna.c',
  'src/inet.c',
  'src/net-common.c',
  'src/random.c',
  'src/strscpy.c',
  'src/strtok.c',
  'src/thread-common.c',
  'src/threadpool.c',
  'src/timer.c',
  'src/uv-common.c',
  'src/uv-data-getter-setters.c',
  'src/version.c',
];

const WIN_SOURCES = [
  'src/win/async.c',
  'src/win/core.c',
  'src/win/detect-wakeup.c',
  'src/win/dl.c',
  'src/win/error.c',
  'src/win/fs.c',
  'src/win/fs-event.c',
  'src/win/getaddrinfo.c',
  'src/win/getnameinfo.c',
  'src/win/handle.c',
  'src/win/loop-watcher.c',
  'src/win/pipe.c',
  'src/win/poll.c',
  'src/win/process.c',
  'src/win/process-stdio.c',
  'src/win/signal.c',
  'src/win/snprintf.c',
  'src/win/stream.c',
  'src/win/tcp.c',
  'src/win/thread.c',
  'src/win/tty.c',
  'src/win/udp.c',
  'src/win/util.c',
  'src/win/winapi.c',
  'src/win/winsock.c',
];

const UNIX_COMMON_SOURCES = [
  'src/unix/async.c',
  'src/unix/core.c',
  'src/unix/dl.c',
  'src/unix/fs.c',
  'src/unix/getaddrinfo.c',
  'src/unix/getnameinfo.c',
  'src/unix/loop-watcher.c',
  'src/unix/loop.c',
  'src/unix/pipe.c',
  'src/unix/poll.c',
  'src/unix/process.c',
  'src/unix/random-devurandom.c',
  'src/unix/signal.c',
  'src/unix/stream.c',
  'src/unix/tcp.c',
  'src/unix/thread.c',
  'src/unix/tty.c',
  'src/unix/udp.c',
];

const LINUX_SOURCES = [
  ...UNIX_COMMON_SOURCES,
  'src/unix/linux.c',
  'src/unix/procfs-exepath.c',
  'src/unix/proctitle.c',
  'src/unix/random-getrandom.c',
  'src/unix/random-sysctl-linux.c',
];

const DARWIN_SOURCES = [
  ...UNIX_COMMON_SOURCES,
  'src/unix/bsd-ifaddrs.c',
  'src/unix/darwin.c',
  'src/unix/darwin-proctitle.c',
  'src/unix/fsevents.c',
  'src/unix/kqueue.c',
  'src/unix/proctitle.c',
  'src/unix/random-getentropy.c',
];

interface TargetSpec {
  id: string;
  zigTarget: string;
  outName: string;
  sources: string[];
  defines: string[];
  cflags: string[];
  ldflags: string[];
  libs: string[];
}

const TARGETS: Record<string, TargetSpec> = {
  win64: {
    id: 'win64',
    zigTarget: 'x86_64-windows-gnu',
    outName: 'libuv.dll',
    sources: [...COMMON_SOURCES, ...WIN_SOURCES],
    defines: [
      'BUILDING_UV_SHARED=1',
      'WIN32_LEAN_AND_MEAN',
      '_WIN32_WINNT=0x0a00',
      '_CRT_DECLARE_NONSTDC_NAMES=0',
    ],
    cflags: ['-O2', '-s', '-std=gnu11', '-fno-strict-aliasing'],
    ldflags: ['-shared'],
    libs: [
      '-lws2_32',
      '-lpsapi',
      '-liphlpapi',
      '-lshell32',
      '-luserenv',
      '-luser32',
      '-ldbghelp',
      '-lole32',
      '-luuid',
      '-ladvapi32',
      '-lapi-ms-win-core-synch-l1-2-0',
    ],
  },
  'linux-x64': {
    id: 'linux-x64',
    zigTarget: 'x86_64-linux-gnu',
    outName: 'libuv-linux-x64.so',
    sources: [...COMMON_SOURCES, ...LINUX_SOURCES],
    defines: [
      'BUILDING_UV_SHARED=1',
      '_FILE_OFFSET_BITS=64',
      '_LARGEFILE_SOURCE',
      '_GNU_SOURCE',
      '_POSIX_C_SOURCE=200112',
    ],
    cflags: ['-O2', '-s', '-fPIC', '-fvisibility=hidden', '-std=gnu11', '-fno-strict-aliasing'],
    ldflags: ['-shared', '-Wl,-soname,libuv.so.1'],
    libs: ['-lpthread', '-ldl', '-lrt'],
  },
  'linux-arm64': {
    id: 'linux-arm64',
    zigTarget: 'aarch64-linux-gnu',
    outName: 'libuv-linux-arm64.so',
    sources: [...COMMON_SOURCES, ...LINUX_SOURCES],
    defines: [
      'BUILDING_UV_SHARED=1',
      '_FILE_OFFSET_BITS=64',
      '_LARGEFILE_SOURCE',
      '_GNU_SOURCE',
      '_POSIX_C_SOURCE=200112',
    ],
    cflags: ['-O2', '-s', '-fPIC', '-fvisibility=hidden', '-std=gnu11', '-fno-strict-aliasing'],
    ldflags: ['-shared', '-Wl,-soname,libuv.so.1'],
    libs: ['-lpthread', '-ldl', '-lrt'],
  },
  'macos-arm64': {
    id: 'macos-arm64',
    zigTarget: 'aarch64-macos',
    outName: 'libuv-macos-arm64.dylib',
    sources: [...COMMON_SOURCES, ...DARWIN_SOURCES],
    defines: [
      'BUILDING_UV_SHARED=1',
      '_FILE_OFFSET_BITS=64',
      '_LARGEFILE_SOURCE',
      '_DARWIN_UNLIMITED_SELECT=1',
      '_DARWIN_USE_64_BIT_INODE=1',
    ],
    cflags: ['-O2', '-s', '-fPIC', '-fvisibility=hidden', '-std=gnu11', '-fno-strict-aliasing'],
    ldflags: ['-shared', '-Wl,-install_name,@rpath/libuv.1.dylib'],
    libs: ['-lpthread'],
  },
  'macos-x64': {
    id: 'macos-x64',
    zigTarget: 'x86_64-macos',
    outName: 'libuv-macos-x64.dylib',
    sources: [...COMMON_SOURCES, ...DARWIN_SOURCES],
    defines: [
      'BUILDING_UV_SHARED=1',
      '_FILE_OFFSET_BITS=64',
      '_LARGEFILE_SOURCE',
      '_DARWIN_UNLIMITED_SELECT=1',
      '_DARWIN_USE_64_BIT_INODE=1',
    ],
    cflags: ['-O2', '-s', '-fPIC', '-fvisibility=hidden', '-std=gnu11', '-fno-strict-aliasing'],
    ldflags: ['-shared', '-Wl,-install_name,@rpath/libuv.1.dylib'],
    libs: ['-lpthread'],
  },
};

function resolveZigCommand(): { bin: string; shell: boolean } {
  if (process.env.ZIG_BIN) {
    return { bin: process.env.ZIG_BIN, shell: process.platform === 'win32' && process.env.ZIG_BIN.endsWith('.cmd') };
  }
  const workspaceZig = resolve(ROOT, '..', '..', '..', 'bin', 'zig.cmd');
  if (process.platform === 'win32' && existsSync(workspaceZig)) {
    return { bin: workspaceZig, shell: true };
  }
  return { bin: 'zig', shell: false };
}

function buildTarget(spec: TargetSpec, outDir: string): string {
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, spec.outName);
  const { bin, shell } = resolveZigCommand();

  const args = [
    'cc',
    '-target',
    spec.zigTarget,
    ...spec.cflags,
    ...spec.ldflags,
    `-I${join(ROOT, 'include')}`,
    `-I${join(ROOT, 'src')}`,
    ...spec.defines.map((d) => `-D${d}`),
    ...spec.sources.map((s) => join(ROOT, s)),
    '-o',
    outPath,
    ...spec.libs,
  ];

  if (spec.id === 'win64') {
    args.push(`-Wl,--out-implib,${join(outDir, 'libuv.dll.a')}`);
  }

  const t0 = Date.now();
  execFileSync(bin, args, { cwd: ROOT, stdio: 'inherit', shell });
  const dt = Date.now() - t0;
  const size = statSync(outPath).size;
  console.log(`[build-zig-cc] ${spec.id} -> ${outPath} (${size} bytes, ${(size / 1024).toFixed(1)} KiB) in ${dt} ms`);
  return outPath;
}

function runSmokeTest(outDir: string): void {
  const { bin, shell } = resolveZigCommand();
  const isWin = process.platform === 'win32';
  const smokeExe = join(outDir, isWin ? 'b8g_libuv_smoke.exe' : 'b8g_libuv_smoke');

  if (isWin) {
    const args = [
      'cc',
      '-target',
      'x86_64-windows-gnu',
      '-O2',
      '-std=c11',
      '-DUSING_UV_SHARED=1',
      `-I${join(ROOT, 'include')}`,
      join(ROOT, 'src', 'b8g_libuv_smoke.c'),
      join(outDir, 'libuv.dll.a'),
      '-o',
      smokeExe,
    ];
    execFileSync(bin, args, { cwd: ROOT, stdio: 'inherit', shell });
    execFileSync(smokeExe, [], { cwd: outDir, stdio: 'inherit' });
  } else {
    const soName = process.platform === 'darwin'
      ? (process.arch === 'arm64' ? 'libuv-macos-arm64.dylib' : 'libuv-macos-x64.dylib')
      : (process.arch === 'arm64' ? 'libuv-linux-arm64.so' : 'libuv-linux-x64.so');
    const sonameLink = join(outDir, process.platform === 'darwin' ? 'libuv.1.dylib' : 'libuv.so.1');
    rmSync(sonameLink, { force: true });
    symlinkSync(soName, sonameLink);
    const args = [
      'cc',
      '-O2',
      '-std=gnu11',
      '-D_GNU_SOURCE',
      `-I${join(ROOT, 'include')}`,
      join(ROOT, 'src', 'b8g_libuv_smoke.c'),
      join(outDir, soName),
      `-Wl,-rpath,${outDir}`,
      '-o',
      smokeExe,
    ];
    execFileSync(bin, args, { cwd: ROOT, stdio: 'inherit', shell });
    execFileSync(smokeExe, [], { cwd: outDir, stdio: 'inherit' });
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  let targetArg = 'win64';
  let outDir = join(ROOT, 'build-zig');
  let smoke = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target' && argv[i + 1]) {
      targetArg = argv[++i];
    } else if (argv[i] === '--out' && argv[i + 1]) {
      outDir = resolve(argv[++i]);
    } else if (argv[i] === '--smoke') {
      smoke = true;
    }
  }

  const targetIds = targetArg === 'all' ? ['win64', 'linux-x64', 'linux-arm64'] : targetArg.split(',');
  for (const id of targetIds) {
    const spec = TARGETS[id];
    if (!spec) {
      console.error(`Unknown target "${id}". Available: ${Object.keys(TARGETS).join(', ')}, all`);
      process.exit(1);
    }
    buildTarget(spec, outDir);
  }

  if (smoke) {
    runSmokeTest(outDir);
  }
}

main();
