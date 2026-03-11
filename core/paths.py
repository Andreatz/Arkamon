from pathlib import Path

CORE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CORE_DIR.parent

DATA_DIR = PROJECT_ROOT / "data"
SAVES_DIR = PROJECT_ROOT / "saves"
SLOT_1_DIR = SAVES_DIR / "slot_1"
ASSETS_DIR = PROJECT_ROOT / "assets"
MAPS_DIR = ASSETS_DIR / "maps"

SPRITES_DIR = ASSETS_DIR / "sprites"
BACK_SPRITES_DIR = SPRITES_DIR / "back_sprites"
FRONT_SPRITES_DIR = SPRITES_DIR / "front_sprites"
SMALL_SPRITES_DIR = SPRITES_DIR / "small_sprites"

UI_DIR = ASSETS_DIR / "ui"
BACKGROUND_DIR = ASSETS_DIR / "backgrounds"