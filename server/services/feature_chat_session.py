"""
Feature Chat Session
====================

Manages interactive feature creation conversation with Claude.
Uses the create-feature.md skill to guide users through adding a new feature.
"""

import json
import logging
import os
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Optional

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient
from ..schemas import ImageAttachment, FeatureCreate

# Function to create feature in DB
from ..routers.features import _get_db_classes, get_db_session, feature_to_response

logger = logging.getLogger(__name__)

# Root directory of the project
ROOT_DIR = Path(__file__).parent.parent.parent

def get_default_model() -> str:
    """Get the default model based on environment configuration."""
    if os.getenv("CLAUDE_CODE_USE_BEDROCK") == "1":
        return os.getenv(
            "ANTHROPIC_MODEL",
            "us.anthropic.claude-opus-4-5-20251101-v1:0"
        )
    else:
        return "claude-opus-4-5-20251101"

async def _make_multimodal_message(content_blocks: list[dict]) -> AsyncGenerator[dict, None]:
    yield {
        "type": "user",
        "message": {"role": "user", "content": content_blocks},
        "parent_tool_use_id": None,
        "session_id": "default",
    }

class FeatureChatSession:
    """
    Manages a feature creation conversation for one project.
    """

    def __init__(self, project_name: str, project_dir: Path):
        self.project_name = project_name
        self.project_dir = project_dir
        self.client: Optional[ClaudeSDKClient] = None
        self.messages: list[dict] = []
        self.complete: bool = False
        self.created_at = datetime.now()
        self._client_entered: bool = False
        self.created_feature_id: Optional[int] = None

    async def close(self) -> None:
        if self.client and self._client_entered:
            try:
                await self.client.__aexit__(None, None, None)
            except Exception as e:
                logger.warning(f"Error closing Claude client: {e}")
            finally:
                self._client_entered = False
                self.client = None

    async def start(self) -> AsyncGenerator[dict, None]:
        """Initialize session and get initial greeting."""
        
        # Load skill
        skill_path = ROOT_DIR / ".claude" / "commands" / "create-feature.md"
        if not skill_path.exists():
            yield {"type": "error", "content": "Skill not found"}
            return

        try:
            skill_content = skill_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            skill_content = skill_path.read_text(encoding="utf-8", errors="replace")

        # Cleanup potential leftover trigger file
        trigger_file = self.project_dir / ".new_feature.json"
        if trigger_file.exists():
            trigger_file.unlink()

        # Security settings
        settings_file = self.project_dir / ".claude_feature_settings.json"
        security_settings = {
            "sandbox": {"enabled": False},
            "permissions": {
                "defaultMode": "acceptEdits",
                "allow": ["Read(./**)", "Write(./**)", "Edit(./**)", "Glob(./**)"],
            },
        }
        with open(settings_file, "w") as f:
            json.dump(security_settings, f, indent=2)

        # Create Client
        system_cli = shutil.which("claude")
        try:
            self.client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model=get_default_model(),
                    cli_path=system_cli,
                    system_prompt=skill_content,
                    allowed_tools=["Read", "Write", "Edit", "Glob"],
                    permission_mode="acceptEdits",
                    max_turns=50,
                    cwd=str(self.project_dir.resolve()),
                    settings=str(settings_file.resolve()),
                )
            )
            await self.client.__aenter__()
            self._client_entered = True
        except Exception as e:
            logger.exception("Failed to create Claude client")
            yield {"type": "error", "content": str(e)}
            return

        # Start conversation
        try:
            async for chunk in self._query_claude("I want to add a new feature."):
                yield chunk
            yield {"type": "response_done"}
        except Exception as e:
            logger.exception("Failed to start feature chat")
            yield {"type": "error", "content": str(e)}

    async def send_message(self, user_message: str, attachments: list[ImageAttachment] | None = None) -> AsyncGenerator[dict, None]:
        if not self.client:
            yield {"type": "error", "content": "Session not initialized"}
            return

        self.messages.append({
            "role": "user", 
            "content": user_message, 
            "has_attachments": bool(attachments),
            "timestamp": datetime.now().isoformat()
        })

        try:
            logger.info(f"Processing user message: {user_message[:50]}...")
            async for chunk in self._query_claude(user_message, attachments):
                yield chunk
            logger.info("Finished processing user message")
            yield {"type": "response_done"}
        except Exception as e:
            logger.exception("Error during query")
            yield {"type": "error", "content": str(e)}

    async def _query_claude(self, message: str, attachments: list[ImageAttachment] | None = None) -> AsyncGenerator[dict, None]:
        if not self.client:
            return

        # Send message
        if attachments:
            content_blocks = []
            if message: content_blocks.append({"type": "text", "text": message})
            for att in attachments:
                content_blocks.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": att.mimeType, "data": att.base64Data}
                })
            logger.info("Sent multimodal query to Claude")
            await self.client.query(_make_multimodal_message(content_blocks))
        else:
            logger.info(f"Sent text query to Claude: {message[:50]}...")
            await self.client.query(message)
        
        current_text = ""
        pending_feature_json_write = False

        logger.info("Waiting for response stream...")
        async for msg in self.client.receive_response():
            msg_type = type(msg).__name__
            logger.info(f"Received message type: {msg_type}")

            if msg_type == "AssistantMessage":
                for block in msg.content:
                    block_type = type(block).__name__
                    if block_type == "TextBlock":
                        text = block.text
                        if text:
                            current_text += text
                            yield {"type": "text", "content": text}
                            self.messages.append({"role": "assistant", "content": text, "timestamp": datetime.now().isoformat()})
                    
                    elif block_type == "ToolUseBlock" and block.name in ("Write", "Edit"):
                        # Check for trigger file
                        file_path = block.input.get("file_path", "")
                        if ".new_feature.json" in str(file_path):
                            pending_feature_json_write = True
                            logger.info("Agent is writing .new_feature.json")

            elif msg_type == "UserMessage":
                 # Tool Result
                 if pending_feature_json_write:
                     # Check if file exists and valid
                     trigger_file = self.project_dir / ".new_feature.json"
                     if trigger_file.exists():
                         try:
                             content = json.loads(trigger_file.read_text(encoding="utf-8"))
                             logger.info(f"Loaded feature definition: {content}")
                             
                             # Verify required fields
                             if "name" in content and "description" in content:
                                 # CREATE THE FEATURE!
                                 created_feature = await self._create_feature_in_db(content)
                                 self.complete = True
                                 self.created_feature_id = created_feature.id
                                 
                                 # Notify client
                                 yield {"type": "feature_created", "feature": content}
                                 
                                 # Delete the trigger file
                                 trigger_file.unlink()
                                 pending_feature_json_write = False
                                 return # Stop stream? Or let agent define more? Usually stop.
                         except Exception as e:
                             logger.error(f"Failed to process feature json: {e}")
                             yield {"type": "error", "content": "Failed to create feature from definition."}
                     pending_feature_json_write = False

    async def _create_feature_in_db(self, data: dict):
        """Insert feature into DB using existing logic reusing schemas."""
        _, Feature = _get_db_classes()
        
        priority = 1 # Default
        if data.get("priority"):
             # Handle "Auto", "High", or number
             p = data.get("priority")
             if isinstance(p, int): priority = p
             # Ideally we fetch max priority
        
        steps = data.get("steps", [])
        
        feature_create = FeatureCreate(
            name=data["name"],
            description=data["description"],
            category=data.get("category", "General"),
            priority=priority,
            steps=steps
        )
        
        # Reuse logic from routers/features.py but we need strict access
        # Better to replicate the minimal logic here to avoid circular dependencies with full router
        
        try:
            with get_db_session(self.project_dir) as session:
                if feature_create.priority is None or isinstance(feature_create.priority, str):
                    max_priority = session.query(Feature).order_by(Feature.priority.desc()).first()
                    priority = (max_priority.priority + 1) if max_priority else 1
                else:
                    priority = feature_create.priority

                db_feature = Feature(
                    priority=priority,
                    category=feature_create.category,
                    name=feature_create.name,
                    description=feature_create.description,
                    steps=feature_create.steps,
                    passes=False
                )
                session.add(db_feature)
                session.commit()
                session.refresh(db_feature)
                return db_feature
        except Exception as e:
            logger.exception("DB Error creating feature")
            raise e

# Session Registry (Singleton style)
_sessions: dict[str, FeatureChatSession] = {}
_sessions_lock = threading.Lock()

def get_session(project_name: str) -> Optional[FeatureChatSession]:
    with _sessions_lock:
        return _sessions.get(project_name)

async def create_session(project_name: str, project_dir: Path) -> FeatureChatSession:
    old_session = None
    with _sessions_lock:
        old_session = _sessions.pop(project_name, None)
        session = FeatureChatSession(project_name, project_dir)
        _sessions[project_name] = session
    
    if old_session:
        try: await old_session.close()
        except: pass
    
    return session

async def remove_session(project_name: str):
    session = None
    with _sessions_lock:
        session = _sessions.pop(project_name, None)
    if session:
        try: await session.close()
        except: pass

async def cleanup_all_sessions():
    sessions = []
    with _sessions_lock:
        sessions = list(_sessions.values())
        _sessions.clear()
    for s in sessions:
        try: await s.close()
        except: pass
