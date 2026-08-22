import readline from "node:readline";

const levels = new Map([
  [10, "TRACE"],
  [20, "DEBUG"],
  [30, "INFO"],
  [40, "WARN"],
  [50, "ERROR"],
  [60, "FATAL"],
]);

const input = readline.createInterface({ input: process.stdin });

input.on("line", (line) => {
  try {
    const entry = JSON.parse(line);
    const time = typeof entry.time === "number"
      ? new Date(entry.time).toISOString()
      : new Date().toISOString();
    const fields = [
      entry.reqId && `reqId=${entry.reqId}`,
      entry.req?.method && `method=${entry.req.method}`,
      entry.req?.url && `url=${entry.req.url}`,
      entry.res?.statusCode && `status=${entry.res.statusCode}`,
      Number.isFinite(entry.durationMs) && `durationMs=${entry.durationMs}`,
      Number.isFinite(entry.responseTime) && `durationMs=${Math.round(entry.responseTime)}`,
      entry.operation && `operation=${entry.operation}`,
      entry.network && `network=${entry.network}`,
      entry.transactionId && `tx=${entry.transactionId}`,
      entry.code && `code=${entry.code}`,
      entry.signal && `signal=${entry.signal}`,
    ].filter(Boolean);
    const suffix = fields.length > 0 ? ` ${fields.join(" ")}` : "";
    process.stdout.write(
      `[API] ${time} ${levels.get(entry.level) ?? entry.level ?? "INFO"} ${entry.msg ?? "log"}${suffix}\n`,
    );
  } catch {
    process.stdout.write(`[API] ${line}\n`);
  }
});
