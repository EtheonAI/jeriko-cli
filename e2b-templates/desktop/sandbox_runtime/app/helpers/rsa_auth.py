"""RSA signature verification for sandbox API requests.

Manus pattern: X-Sandbox-Api-Signature-V2 header on every request from orchestrator.
The orchestrator signs the request body with its RSA private key.
This module verifies signatures with the baked-in public key.
"""

import base64
import os
from pathlib import Path

from ..logger import get_logger

logger = get_logger("rsa_auth")

# Public key path — baked into Docker image at build time
PUBLIC_KEY_PATH = os.getenv(
    "RSA_PUBLIC_KEY_PATH", "/opt/.rubic/runtime/public.pem"
)

_public_key = None
_rsa_enabled = False


def _load_public_key():
    global _public_key, _rsa_enabled
    try:
        from cryptography.hazmat.primitives import serialization
        key_path = Path(PUBLIC_KEY_PATH)
        if key_path.exists():
            _public_key = serialization.load_pem_public_key(
                key_path.read_bytes()
            )
            _rsa_enabled = True
            logger.info("RSA public key loaded from %s", PUBLIC_KEY_PATH)
        else:
            logger.warning(
                "RSA public key not found at %s — signature verification disabled",
                PUBLIC_KEY_PATH,
            )
    except ImportError:
        logger.warning(
            "cryptography package not installed — RSA verification disabled"
        )
    except Exception as e:
        logger.warning("Failed to load RSA public key: %s", e)


def init_rsa():
    """Initialize RSA verification. Call once at startup."""
    _load_public_key()


def is_rsa_enabled() -> bool:
    return _rsa_enabled


def verify_body_signature(sig_b64: str, body: bytes) -> None:
    """Verify RSA signature over raw body bytes.

    Called by the pure ASGI middleware — does NOT consume the request stream.
    Raises Exception if signature is invalid.
    """
    if not _rsa_enabled or not _public_key:
        return

    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding

    signature = base64.b64decode(sig_b64)
    _public_key.verify(
        signature,
        body,
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
