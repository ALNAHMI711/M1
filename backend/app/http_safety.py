"""Bounded bodies, durable throttling, and non-secret HTTP security headers."""
import os
import sqlite3

from starlette.responses import JSONResponse

from .operations import consume_rate_limit


class HTTPSafetyMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        limit = int(os.getenv("M1_MAX_BODY_BYTES", "65536"))

        async def secure_send(message):
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).extend([
                    (b"x-content-type-options", b"nosniff"),
                    (b"cache-control", b"no-store"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"x-frame-options", b"DENY"),
                ])
            await send(message)

        async def reject(status, detail, extra=None):
            await JSONResponse({"detail": detail}, status_code=status, headers=extra)(scope, receive, secure_send)

        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await reject(400, "invalid_content_length")
        if declared < 0:
            return await reject(400, "invalid_content_length")
        if declared > limit:
            return await reject(413, "request_body_too_large")
        # Never trust X-Forwarded-For from arbitrary clients. The proxy deployment
        # also limits requests; Uvicorn proxy headers are disabled.
        ip = (scope.get("client") or ("unknown", 0))[0]
        path = scope["path"]
        if path != "/health":
            try:
                allowed = consume_rate_limit(f"api:{ip}", int(os.getenv("M1_API_RATE_PER_MINUTE", "120")))
                if path == "/v1/auth/token" and scope["method"] == "POST":
                    allowed = consume_rate_limit(f"login:{ip}", int(os.getenv("M1_LOGIN_RATE_PER_MINUTE", "10"))) and allowed
            except (sqlite3.Error, OSError):
                return await reject(503, "operational_store_unavailable")
            if not allowed:
                return await reject(429, "rate_limit_exceeded", {"Retry-After": "60"})
        # Buffer only up to the configured limit, including chunked bodies.
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > limit:
                return await reject(413, "request_body_too_large")
            if not message.get("more_body"):
                break
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, bounded_receive, secure_send)
