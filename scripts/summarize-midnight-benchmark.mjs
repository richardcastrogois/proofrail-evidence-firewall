import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('Usage: node scripts/summarize-midnight-benchmark.mjs <run-directory>');
  process.exit(2);
}

function readKeyValues(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=');
        return separator < 0 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function number(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value) {
  return number(String(value ?? '').replace('%', ''));
}

function bytes(value) {
  const text = String(value ?? '').split('/')[0].trim();
  if (!text) return null;
  const match = text.match(/^([0-9.]+)\s*(B|KiB|MiB|GiB|TiB|kB|MB|GB|TB)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const units = {
    b: 1,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
    tb: 1000 ** 4,
  };
  return Math.round(amount * units[(match[2] ?? 'B').toLowerCase()]);
}

function max(values) {
  const available = values.filter((value) => value !== null);
  return available.length ? Math.max(...available) : null;
}

function min(values) {
  const available = values.filter((value) => value !== null);
  return available.length ? Math.min(...available) : null;
}

function formatBytes(value) {
  if (value === null) return 'n/a';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function formatPercent(value) {
  return value === null ? 'n/a' : `${value.toFixed(2)}%`;
}

const inventory = readKeyValues(path.join(runDir, 'inventory.txt'));
const summary = readKeyValues(path.join(runDir, 'summary.txt'));
const metricsPath = path.join(runDir, 'metrics.tsv');
let samples = [];
if (fs.existsSync(metricsPath)) {
  const [header, ...rows] = fs.readFileSync(metricsPath, 'utf8').trim().split(/\r?\n/);
  const columns = header?.split('\t') ?? [];
  samples = rows.filter(Boolean).map((row) =>
    Object.fromEntries(row.split('\t').map((value, index) => [columns[index], value])),
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  runDirectory: runDir,
  scenario: inventory.scenario ?? summary.scenario ?? 'unknown',
  profile: inventory.profile ?? summary.profile ?? 'unknown',
  durationSeconds: number(summary.duration_seconds),
  commandExitCode: number(summary.command_exit_code),
  timeoutSeconds: number(summary.timeout_seconds),
  timedOut: summary.timed_out === 'true',
  samples: samples.length,
  host: {
    totalMemoryBytes: number(inventory.host_memory_bytes),
    minimumAvailableMemoryBytes: min(samples.map((sample) => number(sample.host_available_bytes))),
    rootFreeBytes: number(inventory.root_free_bytes),
  },
  process: {
    peakRssBytes: max(samples.map((sample) => number(sample.process_rss_bytes))),
    peakCpuPercent: max(samples.map((sample) => number(sample.process_cpu_percent))),
  },
  proofServer: {
    imageBytes: number(inventory.proof_image_bytes),
    memoryLimit: summary.proof_memory_limit || null,
    cpuLimit: number(summary.proof_cpu_limit),
    oomKilled: summary.proof_oom_killed === 'true',
    runningAtEnd: summary.proof_running === 'true',
    exitCode: number(summary.proof_exit_code),
    peakMemoryBytes: max(samples.map((sample) => bytes(sample.container_memory))),
    peakCpuPercent: max(samples.map((sample) => percent(sample.container_cpu))),
  },
  storage: {
    walletStateBytes: number(inventory.wallet_state_bytes),
    midnightStateBytes: number(inventory.midnight_state_bytes),
    rootNodeModulesBytes: number(inventory.root_node_modules_bytes),
    midnightNodeModulesBytes: number(inventory.midnight_chain_node_modules_bytes),
  },
};

fs.writeFileSync(path.join(runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = `# Midnight resource benchmark

| Field | Value |
| --- | --- |
| Scenario | ${report.scenario} |
| Profile | ${report.profile} |
| Duration | ${report.durationSeconds ?? 'n/a'} s |
| Samples | ${report.samples} |
| Command exit | ${report.commandExitCode ?? 'n/a'} |
| Timed out | ${report.timedOut ? 'yes' : 'no'} |
| Host total memory | ${formatBytes(report.host.totalMemoryBytes)} |
| Host minimum available memory | ${formatBytes(report.host.minimumAvailableMemoryBytes)} |
| Process peak RSS | ${formatBytes(report.process.peakRssBytes)} |
| Process peak CPU | ${formatPercent(report.process.peakCpuPercent)} |
| Proof server peak memory | ${formatBytes(report.proofServer.peakMemoryBytes)} |
| Proof server peak CPU | ${formatPercent(report.proofServer.peakCpuPercent)} |
| Proof server memory limit | ${report.proofServer.memoryLimit ?? 'none'} |
| Proof server CPU limit | ${report.proofServer.cpuLimit ?? 'none'} |
| Proof server OOM killed | ${report.proofServer.oomKilled ? 'yes' : 'no'} |
| Proof server image | ${formatBytes(report.proofServer.imageBytes)} |
| Wallet state | ${formatBytes(report.storage.walletStateBytes)} |

This report contains aggregate measurements only. Command output remains local
and must be reviewed for sensitive data before sharing.
`;
fs.writeFileSync(path.join(runDir, 'report.md'), markdown);
console.log(`Report: ${path.join(runDir, 'report.md')}`);
