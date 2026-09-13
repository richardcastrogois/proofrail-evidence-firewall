const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function allowedBrowserOrigins(raw = process.env.PROOFRAIL_PUBLIC_ORIGINS): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function isAllowedBrowserOrigin(
  origin: string | undefined,
  configuredOrigins = allowedBrowserOrigins(),
): boolean {
  return (
    origin === undefined ||
    LOCAL_ORIGIN.test(origin) ||
    configuredOrigins.has(origin)
  );
}

export function isLimitedPublicApiMode(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.PROOFRAIL_PUBLIC_API_MODE?.trim() === "limited";
}
