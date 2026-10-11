FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 M1_DB_PATH=/data/m1.sqlite3

# Preserve the repository-like layout expected by testnet_settings.load_master_key().
WORKDIR /opt/m1/backend
COPY backend/requirements.lock /opt/m1/backend/requirements.lock
RUN python -m pip install --no-cache-dir --upgrade "pip>=26.2.1" "setuptools>=83.0.0" \
    && python -m pip install --no-cache-dir -r /opt/m1/backend/requirements.lock \
    && groupadd --gid 10001 m1 \
    && useradd --uid 10001 --gid m1 --no-create-home --shell /usr/sbin/nologin m1 \
    && mkdir -p /data \
    && chown m1:m1 /data
COPY --chown=m1:m1 backend/app /opt/m1/backend/app
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready',timeout=3)"
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--no-proxy-headers","--no-access-log"]
