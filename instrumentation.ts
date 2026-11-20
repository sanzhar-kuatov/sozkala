import type { Instrumentation } from "next";

/**
 * Server errors → ErrorLog (spec §11 "error journal", /admin/logs).
 * Only the path (without the query string), method and route kind are stored —
 * never headers, cookies or bodies.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./lib/errors");
  await logError(error, {
    path: request.path.split("?")[0],
    method: request.method,
    route: context.routePath,
    kind: context.routeType,
  });
};
