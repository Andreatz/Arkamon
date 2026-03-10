from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from paths import DATA_DIR


def _clean_key(value: str) -> str:
    return value.strip().replace("\ufeff", "").replace(" ", "_").lower()


def _clean_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip().replace("\ufeff", "")
        if value == "":
            return None
    return value


def _to_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    value = _clean_value(value)
    if value is None:
        return default
    try:
        return int(float(str(value).replace(",", ".")))
    except (ValueError, TypeError):
        return default


def _to_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    value = _clean_value(value)
    if value is None:
        return default
    try:
        return float(str(value).replace(",", "."))
    except (ValueError, TypeError):
        return default


def _to_bool(value: Any, default: bool = False) -> bool:
    value = _clean_value(value)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "y", "si", "s"}


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {_clean_key(k): _clean_value(v) for k, v in row.items() if k is not None}


@dataclass
class Species:
    species_id: int
    name: str
    hp_growth_id: str
    type_id: str
    base_hp: int
    move_ids: List[int]
    evolution_level: int
    evolves_to_id: int
    catch_rate: int


@dataclass
class MoveMeta:
    move_id: int
    move_name: str
    type: str
    effect: Optional[str] = None
    effect_value: Optional[str] = None


@dataclass
class MoveScaling:
    move_id: int
    base_dice: int = 1
    dice_step_levels: int = 10
    dice_step_amount: int = 1
    flat_bonus_mode: str = "level_div"
    flat_bonus_value: float = 3.0


@dataclass
class Trainer:
    trainer_id: int
    name: str
    area_id: str
    battle_kind: str


@dataclass
class TrainerPokemon:
    trainer_id: int
    slot: int
    species_id: int
    level: int


@dataclass
class WorldNode:
    node_id: str
    name: str
    node_type: str
    local_map_file: Optional[str]
    world_x: int
    world_y: int
    has_center: bool
    has_gym: bool
    encounter_group: Optional[str]
    notes: Optional[str]


@dataclass
class WorldEdge:
    edge_id: str
    from_node: str
    to_node: str
    path_type: str
    cost: int
    unlock_rule: str
    bidirectional: bool


@dataclass
class GameData:
    species: Dict[int, Species] = field(default_factory=dict)
    moves_meta: Dict[int, MoveMeta] = field(default_factory=dict)
    move_scaling: Dict[int, MoveScaling] = field(default_factory=dict)
    hp_growth: Dict[str, float] = field(default_factory=dict)
    type_chart: Dict[Tuple[str, str], float] = field(default_factory=dict)
    wild_encounters: Dict[str, Dict[str, List[dict]]] = field(default_factory=dict)
    trainers: Dict[int, Trainer] = field(default_factory=dict)
    trainer_teams: Dict[int, List[TrainerPokemon]] = field(default_factory=dict)
    world_nodes: Dict[str, WorldNode] = field(default_factory=dict)
    world_edges: List[WorldEdge] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class DataLoader:
    def __init__(self, data_dir: str | Path = DATA_DIR, strict: bool = False):
        self.data_dir = Path(data_dir)
        self.strict = strict
        self.warnings: List[str] = []

    def load_all(self) -> GameData:
        data = GameData()
        data.species = self._load_species()
        data.moves_meta = self._load_moves_meta()
        data.move_scaling = self._load_move_scaling(optional=True)
        data.hp_growth = self._load_hp_growth()
        data.type_chart = self._load_type_chart()
        data.wild_encounters = self._load_wild_encounters()
        data.trainers = self._load_trainers()
        data.trainer_teams = self._load_trainer_teams()
        data.world_nodes = self._load_world_nodes()
        data.world_edges = self._load_world_edges()
        data.warnings = self._validate(data)
        return data

    def _warn(self, message: str) -> None:
        self.warnings.append(message)
        if self.strict:
            raise ValueError(message)

    def _candidate_path(self, *filenames: str) -> Optional[Path]:
        for name in filenames:
            path = self.data_dir / name
            if path.exists():
                return path
        return None

    def _read_csv(self, filename: str, required: bool = True, alternatives: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        candidates = [filename] + (alternatives or [])
        path = self._candidate_path(*candidates)
        if path is None:
            if required:
                raise FileNotFoundError(f"File non trovato in {self.data_dir}: {candidates}")
            return []

        rows: List[Dict[str, Any]] = []
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for idx, row in enumerate(reader, start=2):
                normalized = _normalize_row(row)
                if not any(v is not None for v in normalized.values()):
                    continue
                normalized["_source_file"] = path.name
                normalized["_row_number"] = idx
                rows.append(normalized)
        return rows

    def _load_species(self) -> Dict[int, Species]:
        rows = self._read_csv("species.csv")
        out: Dict[int, Species] = {}

        for row in rows:
            species_id = _to_int(row.get("species_id"))
            if species_id is None:
                self._warn(f"species.csv riga {row['_row_number']}: species_id mancante.")
                continue

            move_ids = [
                _to_int(row.get("move_1_id"), 0) or 0,
                _to_int(row.get("move_2_id"), 0) or 0,
                _to_int(row.get("move_3_id"), 0) or 0,
            ]
            move_ids = [m for m in move_ids if m > 0]

            out[species_id] = Species(
                species_id=species_id,
                name=str(row.get("name") or f"species_{species_id}"),
                hp_growth_id=str(row.get("hp_growth_id") or ""),
                type_id=str(row.get("type_id") or ""),
                base_hp=_to_int(row.get("base_hp"), 1) or 1,
                move_ids=move_ids,
                evolution_level=_to_int(row.get("evolution_level"), 0) or 0,
                evolves_to_id=_to_int(row.get("evolves_to_id"), 0) or 0,
                catch_rate=_to_int(row.get("catch_rate"), 0) or 0,
            )
        return out

    def _load_moves_meta(self) -> Dict[int, MoveMeta]:
        rows = self._read_csv("moves_meta.csv")
        out: Dict[int, MoveMeta] = {}

        for row in rows:
            move_id = _to_int(row.get("move_id"))
            if move_id is None:
                self._warn(f"moves_meta.csv riga {row['_row_number']}: move_id mancante.")
                continue

            out[move_id] = MoveMeta(
                move_id=move_id,
                move_name=str(row.get("move_name") or f"move_{move_id}"),
                type=str(row.get("type") or "Normale"),
                effect=row.get("effect"),
                effect_value=row.get("effect_value"),
            )
        return out

    def _load_move_scaling(self, optional: bool = True) -> Dict[int, MoveScaling]:
        rows = self._read_csv(
            "move_scaling.csv",
            required=not optional,
            alternatives=["moves_scaling.csv", "move_scale.csv", "moves_scale.csv"]
        )
        out: Dict[int, MoveScaling] = {}

        if not rows:
            return out

        for row in rows:
            move_id = _to_int(row.get("move_id"))
            if move_id is None:
                self._warn(f"{row['_source_file']} riga {row['_row_number']}: move_id mancante.")
                continue

            out[move_id] = MoveScaling(
                move_id=move_id,
                base_dice=_to_int(row.get("base_dice"), 1) or 1,
                dice_step_levels=_to_int(row.get("dice_step_levels"), 10) or 10,
                dice_step_amount=_to_int(row.get("dice_step_amount"), 1) or 1,
                flat_bonus_mode=str(row.get("flat_bonus_mode") or "level_div"),
                flat_bonus_value=_to_float(row.get("flat_bonus_value"), 3.0) or 3.0,
            )
        return out

    def _load_hp_growth(self) -> Dict[str, float]:
        rows = self._read_csv("hp_growth.csv")
        out: Dict[str, float] = {}

        for row in rows:
            growth_id = row.get("hp_growth_id")
            if not growth_id:
                self._warn(f"hp_growth.csv riga {row['_row_number']}: hp_growth_id mancante.")
                continue
            out[str(growth_id)] = _to_float(row.get("hp_per_level"), 1.0) or 1.0
        return out

    def _load_type_chart(self) -> Dict[Tuple[str, str], float]:
        rows = self._read_csv("type_chart.csv")
        out: Dict[Tuple[str, str], float] = {}

        for row in rows:
            atk = row.get("attack_type")
            defense = row.get("defense_type")
            mult = _to_float(row.get("multiplier"), 1.0)
            if not atk or not defense:
                self._warn(f"type_chart.csv riga {row['_row_number']}: tipo attacco o difesa mancante.")
                continue
            out[(str(atk), str(defense))] = mult if mult is not None else 1.0
        return out

    def _load_wild_encounters(self) -> Dict[str, Dict[str, List[dict]]]:
        rows = self._read_csv("wild_encounters.csv")
        out: Dict[str, Dict[str, List[dict]]] = {}

        for row in rows:
            area_id = str(row.get("area_id") or "")
            group = str(row.get("encounter_group") or "default")
            species_id = _to_int(row.get("species_id"))

            if not area_id or species_id is None:
                self._warn(f"wild_encounters.csv riga {row['_row_number']}: area_id o species_id mancante.")
                continue

            encounter = {
                "species_id": species_id,
                "rarity_weight": str(row.get("rarity_weight") or "Comune"),
                "min_level": _to_int(row.get("min_level"), 1) or 1,
                "max_level": _to_int(row.get("max_level"), 1) or 1,
            }

            out.setdefault(area_id, {}).setdefault(group, []).append(encounter)

        return out

    def _load_trainers(self) -> Dict[int, Trainer]:
        rows = self._read_csv("trainers.csv")
        out: Dict[int, Trainer] = {}

        for row in rows:
            trainer_id = _to_int(row.get("trainer_id"))
            if trainer_id is None:
                self._warn(f"trainers.csv riga {row['_row_number']}: trainer_id mancante.")
                continue

            out[trainer_id] = Trainer(
                trainer_id=trainer_id,
                name=str(row.get("name") or f"trainer_{trainer_id}"),
                area_id=str(row.get("area_id") or ""),
                battle_kind=str(row.get("battle_kind") or "NPC"),
            )
        return out

    def _load_trainer_teams(self) -> Dict[int, List[TrainerPokemon]]:
        rows = self._read_csv("trainer_team.csv")
        out: Dict[int, List[TrainerPokemon]] = {}

        for row in rows:
            trainer_id = _to_int(row.get("trainer_id"))
            slot = _to_int(row.get("slot"))
            species_id = _to_int(row.get("species_id"))
            level = _to_int(row.get("level"), 1)

            if None in (trainer_id, slot, species_id):
                self._warn(f"trainer_team.csv riga {row['_row_number']}: dati squadra incompleti.")
                continue

            tp = TrainerPokemon(
                trainer_id=trainer_id,
                slot=slot,
                species_id=species_id,
                level=level or 1
            )
            out.setdefault(trainer_id, []).append(tp)

        for trainer_id in out:
            out[trainer_id].sort(key=lambda p: p.slot)

        return out

    def _load_world_nodes(self) -> Dict[str, WorldNode]:
        rows = self._read_csv("world_nodes.csv")
        out: Dict[str, WorldNode] = {}

        required_fields = {"node_id", "name", "node_type", "world_x", "world_y"}

        for row in rows:
            if not required_fields.issubset(row.keys()):
                self._warn(f"world_nodes.csv riga {row['_row_number']}: header non valido.")
                continue

            node_id = row.get("node_id")
            name = row.get("name")
            node_type = row.get("node_type")
            world_x = _to_int(row.get("world_x"))
            world_y = _to_int(row.get("world_y"))

            if not node_id or not name or not node_type or world_x is None or world_y is None:
                self._warn(
                    f"world_nodes.csv riga {row['_row_number']}: nodo ignorato per dati mancanti o malformati."
                )
                continue

            out[str(node_id)] = WorldNode(
                node_id=str(node_id),
                name=str(name),
                node_type=str(node_type),
                local_map_file=row.get("local_map_file"),
                world_x=world_x,
                world_y=world_y,
                has_center=_to_bool(row.get("has_center")),
                has_gym=_to_bool(row.get("has_gym")),
                encounter_group=row.get("encounter_group"),
                notes=row.get("notes"),
            )

        return out

    def _load_world_edges(self) -> List[WorldEdge]:
        rows = self._read_csv("world_edges.csv")
        out: List[WorldEdge] = []

        for row in rows:
            edge_id = row.get("edge_id")
            from_node = row.get("from_node")
            to_node = row.get("to_node")

            if not edge_id or not from_node or not to_node:
                self._warn(f"world_edges.csv riga {row['_row_number']}: edge incompleto.")
                continue

            out.append(
                WorldEdge(
                    edge_id=str(edge_id),
                    from_node=str(from_node),
                    to_node=str(to_node),
                    path_type=str(row.get("path_type") or "road"),
                    cost=_to_int(row.get("cost"), 1) or 1,
                    unlock_rule=str(row.get("unlock_rule") or "always"),
                    bidirectional=_to_bool(row.get("bidirectional"), True),
                )
            )
        return out

    def _validate(self, data: GameData) -> List[str]:
        warnings = list(self.warnings)

        for species in data.species.values():
            if species.hp_growth_id not in data.hp_growth:
                warnings.append(
                    f"Species {species.species_id} ({species.name}): hp_growth_id '{species.hp_growth_id}' non trovato."
                )
            if species.type_id and (species.type_id, species.type_id) not in data.type_chart:
                warnings.append(
                    f"Species {species.species_id} ({species.name}): type_id '{species.type_id}' non trovato nella type chart."
                )
            for move_id in species.move_ids:
                if move_id not in data.moves_meta:
                    warnings.append(
                        f"Species {species.species_id} ({species.name}): move_id {move_id} non presente in moves_meta."
                    )

        for trainer_id, team in data.trainer_teams.items():
            if trainer_id not in data.trainers:
                warnings.append(f"trainer_team: trainer_id {trainer_id} non presente in trainers.csv.")
            for member in team:
                if member.species_id not in data.species:
                    warnings.append(
                        f"trainer_team: trainer_id {trainer_id}, slot {member.slot}, species_id {member.species_id} non valido."
                    )

        for trainer in data.trainers.values():
            if trainer.area_id and trainer.area_id not in data.world_nodes and trainer.area_id not in data.wild_encounters:
                warnings.append(
                    f"Trainer {trainer.trainer_id} ({trainer.name}): area_id '{trainer.area_id}' non trovata nei nodi mondo."
                )

        for edge in data.world_edges:
            if edge.from_node not in data.world_nodes:
                warnings.append(f"world_edges: from_node '{edge.from_node}' non presente in world_nodes.")
            if edge.to_node not in data.world_nodes:
                warnings.append(f"world_edges: to_node '{edge.to_node}' non presente in world_nodes.")

        return warnings


if __name__ == "__main__":
    loader = DataLoader(data_dir=DATA_DIR, strict=False)
    game_data = loader.load_all()

    print("=== DATA LOADED ===")
    print(f"Species: {len(game_data.species)}")
    print(f"Moves meta: {len(game_data.moves_meta)}")
    print(f"Move scaling: {len(game_data.move_scaling)}")
    print(f"HP growth entries: {len(game_data.hp_growth)}")
    print(f"Type chart entries: {len(game_data.type_chart)}")
    print(f"Wild areas: {len(game_data.wild_encounters)}")
    print(f"Trainers: {len(game_data.trainers)}")
    print(f"Trainer teams: {len(game_data.trainer_teams)}")
    print(f"World nodes: {len(game_data.world_nodes)}")
    print(f"World edges: {len(game_data.world_edges)}")

    if game_data.warnings:
        print("\n=== WARNINGS ===")
        for warning in game_data.warnings:
            print("-", warning)

