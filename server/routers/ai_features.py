"""
AI Features Router
==================

Websocket endpoint for the AI Feature Creator chat session.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.feature_chat_session import get_session, create_session, remove_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_name}/ai-features", tags=["ai-features"])

def _get_project_path(project_name: str) -> Path:
    import sys
    root = Path(__file__).parent.parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    from registry import get_project_path
    return get_project_path(project_name)

@router.websocket("/ws")
async def ai_feature_chat_websocket(websocket: WebSocket, project_name: str):
    """
    WebSocket endpoint for AI feature creation chat.
    Protocol similar to Assistant Chat.
    """
    project_path = _get_project_path(project_name)
    if not project_path.exists():
        await websocket.close(code=4004, reason="Project not found")
        return

    await websocket.accept()
    logger.info(f"AI Feature WebSocket connected for project: {project_name}")

    session = None
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                elif msg_type == "start":
                    # Create/Recreate session
                    session = await create_session(project_name, project_path)
                    
                    # Stream initial greeting from session
                    async for chunk in session.start():
                        await websocket.send_json(chunk)

                elif msg_type == "message":
                    if not session:
                        session = get_session(project_name)
                        if not session:
                            # Try to auto-recover session if it exists in memory but local var is None
                            # (unlikely in this flow but good for safety)
                            pass
                            
                        if not session:
                             await websocket.send_json({
                                "type": "error", 
                                "content": "No active session. Send 'start' first."
                            })
                             continue

                    user_content = message.get("content", "").strip()
                    if not user_content:
                        continue

                    async for chunk in session.send_message(user_content):
                        await websocket.send_json(chunk)

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "content": "Invalid JSON"})
                
    except WebSocketDisconnect:
        logger.info(f"AI Feature WebSocket disconnected for {project_name}")
        # Clean up session on disconnect? 
        # For feature creation, maybe we want to keep it briefly?
        # But usually if they close the modal, we want to cleanup.
        # The modal sends specific DELETE if needed, but for WS disconnect
        # let's play it safe and NOT delete immediately to allow reconnects,
        # but the UI should handle session lifecycle.
        pass
    except Exception as e:
        logger.exception(f"WebSocket error for {project_name}")
        try:
             await websocket.send_json({"type": "error", "content": str(e)})
        except:
            pass
