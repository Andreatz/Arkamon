from pathlib import Path

CORE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CORE_DIR.parent

DATA_DIR = PROJECT_ROOT / "data"
SAVES_DIR = PROJECT_ROOT / "saves"
SLOT_1_DIR = SAVES_DIR / "slot_1"
ASSETS_DIR = PROJECT_ROOT / "assets"
MAPS_DIR = ASSETS_DIR / "maps"
TOOLS_DIR = PROJECT_ROOT / "tools"