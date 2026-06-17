"""
mercury_test.py
Tests de conexión Mercury 2 (Inception Labs) + integración con Zammad 7.0+

Uso:
    pip install requests
    python mercury_test.py
"""

import os
import requests
import json
import sys

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
# Nunca hardcodear claves aquí. Exporta las variables antes de ejecutar, p.ej.:
#   export MERCURY_API_KEY=sk_...
#   export ZAMMAD_TOKEN=...
#   python tools/mercury_test.py
MERCURY_API_KEY  = os.environ.get("MERCURY_API_KEY", "")
MERCURY_BASE_URL = os.environ.get("MERCURY_BASE_URL", "https://api.inceptionlabs.ai/v1")
MERCURY_MODEL    = os.environ.get("MERCURY_MODEL", "mercury-2")

ZAMMAD_URL       = os.environ.get("ZAMMAD_URL", "https://itsm.geimser.cl")
ZAMMAD_TOKEN     = os.environ.get("ZAMMAD_TOKEN", "")   # token de admin Zammad (para tests de integración)
# ──────────────────────────────────────────────────────────────────────────────

if not MERCURY_API_KEY:
    print("⚠️  MERCURY_API_KEY vacío — exporta la variable antes de ejecutar.")
    sys.exit(1)

PASS = "✅"
FAIL = "❌"
SKIP = "⏭️ "


def separator(title):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


# ── TEST 1: Ping al endpoint de Mercury ──────────────────────────────────────
def test_mercury_models():
    separator("TEST 1 · Listar modelos disponibles en Mercury")
    try:
        resp = requests.get(
            f"{MERCURY_BASE_URL}/models",
            headers={"Authorization": f"Bearer {MERCURY_API_KEY}"},
            timeout=10,
        )
        if resp.status_code == 200:
            models = [m["id"] for m in resp.json().get("data", [])]
            print(f"{PASS} Conexión OK — modelos: {models}")
            return True
        else:
            print(f"{FAIL} HTTP {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"{FAIL} Excepción: {e}")
        return False


# ── TEST 2: Chat completion básico ───────────────────────────────────────────
def test_mercury_chat():
    separator("TEST 2 · Chat completion (mercury-2)")
    payload = {
        "model":    MERCURY_MODEL,
        "messages": [{"role": "user", "content": "Responde en una frase: ¿qué es un ticket de soporte?"}],
        "max_tokens": 80,
    }
    try:
        resp = requests.post(
            f"{MERCURY_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {MERCURY_API_KEY}",
                "Content-Type":  "application/json",
            },
            json=payload,
            timeout=20,
        )
        if resp.status_code == 200:
            answer = resp.json()["choices"][0]["message"]["content"]
            print(f"{PASS} Respuesta recibida:")
            print(f"    → {answer.strip()}")
            return True
        else:
            print(f"{FAIL} HTTP {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        print(f"{FAIL} Excepción: {e}")
        return False


# ── TEST 3: Latencia / velocidad ─────────────────────────────────────────────
def test_mercury_latency():
    separator("TEST 3 · Latencia de respuesta")
    import time
    payload = {
        "model":    MERCURY_MODEL,
        "messages": [{"role": "user", "content": "Di solo: pong"}],
        "max_tokens": 5,
    }
    try:
        start = time.time()
        resp = requests.post(
            f"{MERCURY_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {MERCURY_API_KEY}",
                "Content-Type":  "application/json",
            },
            json=payload,
            timeout=15,
        )
        elapsed = time.time() - start
        if resp.status_code == 200:
            print(f"{PASS} Respuesta en {elapsed:.2f}s")
            return True
        else:
            print(f"{FAIL} HTTP {resp.status_code} en {elapsed:.2f}s")
            return False
    except Exception as e:
        print(f"{FAIL} Excepción: {e}")
        return False


# ── TEST 4: Conectividad con Zammad ──────────────────────────────────────────
def test_zammad_connection():
    separator("TEST 4 · Conectividad con Zammad")
    if not ZAMMAD_TOKEN:
        print(f"{SKIP} ZAMMAD_TOKEN vacío — saltando test de Zammad.")
        return None
    try:
        resp = requests.get(
            f"{ZAMMAD_URL}/api/v1/users/me",
            headers={"Authorization": f"Token token={ZAMMAD_TOKEN}"},
            timeout=10,
        )
        if resp.status_code == 200:
            user = resp.json()
            print(f"{PASS} Zammad OK — usuario: {user.get('login')} ({user.get('email')})")
            return True
        else:
            print(f"{FAIL} Zammad HTTP {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"{FAIL} Excepción Zammad: {e}")
        return False


# ── TEST 5: Verificar proveedor IA configurado en Zammad ─────────────────────
def test_zammad_ai_provider():
    separator("TEST 5 · Proveedor IA configurado en Zammad")
    if not ZAMMAD_TOKEN:
        print(f"{SKIP} ZAMMAD_TOKEN vacío — saltando.")
        return None
    try:
        resp = requests.get(
            f"{ZAMMAD_URL}/api/v1/ai_provider",
            headers={"Authorization": f"Token token={ZAMMAD_TOKEN}"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"{PASS} Proveedor IA en Zammad:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return True
        else:
            print(f"{FAIL} HTTP {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"{FAIL} Excepción: {e}")
        return False


# ── RUNNER ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 55)
    print("  MERCURY 2 × ZAMMAD — SUITE DE TESTS")
    print("=" * 55)

    results = {
        "Mercury · modelos":      test_mercury_models(),
        "Mercury · chat":         test_mercury_chat(),
        "Mercury · latencia":     test_mercury_latency(),
        "Zammad · conexión":      test_zammad_connection(),
        "Zammad · proveedor IA":  test_zammad_ai_provider(),
    }

    separator("RESUMEN")
    ok = skip = fail = 0
    for name, r in results.items():
        if r is True:
            print(f"  {PASS}  {name}")
            ok += 1
        elif r is None:
            print(f"  {SKIP}  {name}  (sin token)")
            skip += 1
        else:
            print(f"  {FAIL}  {name}")
            fail += 1

    print(f"\n  Pasados: {ok}  |  Saltados: {skip}  |  Fallidos: {fail}")
    print("=" * 55)
    sys.exit(0 if fail == 0 else 1)
