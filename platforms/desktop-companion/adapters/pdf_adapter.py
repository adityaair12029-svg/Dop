"""
PDF & Document Viewer Automation Adapter.
Detects the active PDF viewer first and never assumes identical controls across readers.
"""

from __future__ import annotations
from typing import Any

VIEWER_CAPABILITIES = {
    "adobe_acrobat": {"scroll", "zoom", "pdf_navigate_page", "pdf_fit", "reload_tab"},
    "edge_pdf": {"scroll", "zoom", "pdf_navigate_page", "pdf_fit", "reload_tab"},
    "chrome_pdf": {"scroll", "zoom", "pdf_navigate_page", "reload_tab"},
    "preview_macos": {"scroll", "zoom", "pdf_navigate_page"},
    "evince_linux": {"scroll", "zoom", "pdf_navigate_page", "reload_tab"},
}


class PdfViewerAdapter:
    def identify_viewer(self, window_title: str) -> str:
        lower = window_title.lower()
        if "adobe" in lower or "acrobat" in lower:
            return "adobe_acrobat"
        if "microsoft edge" in lower and ".pdf" in lower:
            return "edge_pdf"
        if "google chrome" in lower and ".pdf" in lower:
            return "chrome_pdf"
        if "preview" in lower and ".pdf" in lower:
            return "preview_macos"
        if "evince" in lower or "document viewer" in lower:
            return "evince_linux"
        return "unknown"

    def execute_pdf_command(self, window_title: str, action_payload: dict[str, Any]) -> dict[str, Any]:
        viewer = self.identify_viewer(window_title)
        if viewer == "unknown":
            return {
                "ok": False,
                "message": "No compatible PDF reader detected in the foreground window.",
            }
        action = action_payload.get("action")
        caps = VIEWER_CAPABILITIES.get(viewer, set())
        if action not in caps:
            return {
                "ok": False,
                "message": f'"{action}" is not supported by the active PDF viewer ({viewer}).',
            }
        return {
            "ok": True,
            "viewer": viewer,
            "message": f'Dispatched "{action}" to {viewer}.',
        }
