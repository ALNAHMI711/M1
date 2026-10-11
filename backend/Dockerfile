FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 M1_DB_PATH=/tmp/m1.sqlite3 M1_TESTNET_ENCRYPTION_KEY_FILE=/tmp/m1_testnet_encryption_key

# Preserve the repository-like layout expected by testnet_settings.load_master_key().
WORKDIR /opt/m1/backend
COPY backend/requirements.lock /opt/m1/backend/requirements.lock
RUN python -m pip install --no-cache-dir --upgrade "pip>=26.2.1" "setuptools>=83.0.0" \
    && python -m pip install --no-cache-dir -r /opt/m1/backend/requirements.lock \
    && groupadd --gid 10001 m1 \
    && useradd --uid 10001 --gid m1 --no-create-home --shell /usr/sbin/nologin m1 \
    && mkdir -p /tmp \
    && chown m1:m1 /tmp \
    && chmod 1777 /tmp
COPY --chown=m1:m1 backend/app /opt/m1/backend/app
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD sh -c "python -c \"import urllib.request, os; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/ready', timeout=3)\""
CMD ["sh", "-c", "KEY_FILE=\"${M1_TESTNET_ENCRYPTION_KEY_FILE:-/tmp/m1_testnet_encryption_key}\"; if [ \"$KEY_FILE\" = /tmp/m1_testnet_encryption_key ] && [ ! -s \"$KEY_FILE\" ]; then umask 077; python -c 'import base64,secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())' > \"$KEY_FILE\"; chmod 600 \"$KEY_FILE\"; fi; exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --no-proxy-headers --no-access-log"]
