#!/usr/bin/env python3
"""Static gate for LISTIA's browser-native, zero-direct-billing voice layer.

This intentionally audits only the non-Marketplace voice surface. The browser may
internally implement SpeechSynthesis/SpeechRecognition using operating-system or
browser-managed services; LISTIA itself must not add provider credentials or make
network calls from these voice modules.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VOICE = ROOT / "public" / "listia-voice.js"
LAB = ROOT / "public" / "voice-lab.js"
LAB_HTML = ROOT / "public" / "voice-lab.html"

errors: list[str] = []


def read(path: Path) -> str:
    if not path.exists():
        errors.append(f"missing required file: {path.relative_to(ROOT)}")
        return ""
    return path.read_text(encoding="utf-8")


voice = read(VOICE)
lab = read(LAB)
lab_html = read(LAB_HTML)

# No direct network transport belongs in the browser voice implementation.
for path, text in ((VOICE, voice), (LAB, lab)):
    checks = {
        "fetch()": r"\bfetch\s*\(",
        "XMLHttpRequest": r"\bXMLHttpRequest\b",
        "WebSocket": r"\bWebSocket\b",
        "EventSource": r"\bEventSource\b",
        "sendBeacon": r"\bsendBeacon\s*\(",
    }
    for label, pattern in checks.items():
        if re.search(pattern, text):
            errors.append(f"{path.relative_to(ROOT)} contains forbidden network primitive: {label}")

# Provider secrets and common paid TTS/STT endpoints must never enter public voice code.
for path, text in ((VOICE, voice), (LAB, lab), (LAB_HTML, lab_html)):
    lowered = text.lower()
    for marker in (
        "elevenlabs.io",
        "api.elevenlabs",
        "texttospeech.googleapis.com",
        "speech.googleapis.com",
        "api.openai.com/v1/audio",
        "api.deepgram.com",
        "api.play.ht",
        "api.murf.ai",
        "azure.cognitiveservices",
    ):
        if marker in lowered:
            errors.append(f"{path.relative_to(ROOT)} references paid/external voice endpoint: {marker}")

required_voice_markers = (
    "native-zero-billable-v3",
    "zero-billable-v1",
    "directProviderApi: false",
    "directApiBilling: false",
    "SpeechSynthesisUtterance",
    "SpeechRecognition",
    "getReadiness",
    "text-only",
)
for marker in required_voice_markers:
    if marker not in voice:
        errors.append(f"public/listia-voice.js missing policy marker: {marker}")

required_lab_markers = (
    "SIN API FACTURABLE LISTIA",
    "localService",
    "SpeechSynthesisUtterance",
)
for marker in required_lab_markers:
    if marker not in lab:
        errors.append(f"public/voice-lab.js missing diagnostic marker: {marker}")

if "voice-lab.js?v=3" not in lab_html:
    errors.append("public/voice-lab.html must load voice-lab.js?v=3")

if errors:
    print("LISTIA voice zero-billable gate: FAIL", file=sys.stderr)
    for error in errors:
        print(f" - {error}", file=sys.stderr)
    raise SystemExit(1)

print("LISTIA voice zero-billable gate: PASS")
print(" - browser-native TTS/STT only")
print(" - no direct network primitive in voice modules")
print(" - no known paid/external voice endpoint")
print(" - text fallback and readiness diagnostics present")
