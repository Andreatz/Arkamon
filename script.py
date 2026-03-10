from pathlib import Path
import pandas as pd
import re

ROOT = Path(".")
MOSSE_PATH = ROOT / "data" / "mosse.csv"
PINO_PATH = ROOT / "docs" / "Pino.xlsx"   # cambia il path se serve
OUT_DIR = ROOT / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

def clean_columns(df):
    cols = []
    for c in df.columns:
        c = str(c).replace("\\_", "_").strip()
        cols.append(c)
    df.columns = cols
    return df

def to_int_safe(series):
    return (
        series.astype(str)
        .str.strip()
        .replace({"": "0", "nan": "0", "None": "0"})
        .astype(float)
        .astype(int)
    )

# ---------- 1) Leggi mosse.CSV ----------
mosse = pd.read_csv(MOSSE_PATH, sep=";", dtype=str, keep_default_na=False)
mosse = clean_columns(mosse)

# Normalizza eventuali nomi sporchi
rename_map = {
    "ID_Mossa": "ID_Mossa",
    "Nome_Mossa": "Nome_Mossa",
    "Tipo": "Tipo",
    "Effetto": "Effetto",
    "Valore_Effetto": "Valore_Effetto",
}
mosse = mosse.rename(columns=rename_map)

# ---------- 2) moves_meta.csv ----------
meta_cols = ["ID_Mossa", "Nome_Mossa", "Tipo", "Effetto", "Valore_Effetto"]
for col in meta_cols:
    if col not in mosse.columns:
        mosse[col] = ""

moves_meta = mosse[meta_cols].copy()
moves_meta = moves_meta.rename(columns={
    "ID_Mossa": "move_id",
    "Nome_Mossa": "move_name",
    "Tipo": "type",
    "Effetto": "effect",
    "Valore_Effetto": "effect_value"
})

moves_meta["move_id"] = to_int_safe(moves_meta["move_id"])
moves_meta["move_name"] = moves_meta["move_name"].astype(str).str.strip()
moves_meta["type"] = moves_meta["type"].astype(str).str.strip()
moves_meta["effect"] = moves_meta["effect"].astype(str).str.strip()
moves_meta["effect_value"] = moves_meta["effect_value"].astype(str).str.strip()

moves_meta = moves_meta.sort_values("move_id").drop_duplicates(subset=["move_id"])
moves_meta.to_csv(OUT_DIR / "moves_meta.csv", sep=";", index=False, encoding="utf-8")

# ---------- 3) move_scaling.csv ----------
dice_cols = [c for c in mosse.columns if re.fullmatch(r"Dadi_lvl_\d+", c)]
inc_cols = [c for c in mosse.columns if re.fullmatch(r"Incremento_lvl_\d+", c)]

dice_long = mosse[["ID_Mossa"] + dice_cols].melt(
    id_vars=["ID_Mossa"],
    var_name="dice_col",
    value_name="dice_count"
)
dice_long["level"] = dice_long["dice_col"].str.extract(r"(\d+)").astype(int)
dice_long["dice_count"] = to_int_safe(dice_long["dice_count"])

inc_long = mosse[["ID_Mossa"] + inc_cols].melt(
    id_vars=["ID_Mossa"],
    var_name="inc_col",
    value_name="flat_bonus"
)
inc_long["level"] = inc_long["inc_col"].str.extract(r"(\d+)").astype(int)
inc_long["flat_bonus"] = to_int_safe(inc_long["flat_bonus"])

move_scaling = dice_long.merge(
    inc_long[["ID_Mossa", "level", "flat_bonus"]],
    on=["ID_Mossa", "level"],
    how="inner"
)

move_scaling = move_scaling.rename(columns={"ID_Mossa": "move_id"})
move_scaling["move_id"] = to_int_safe(move_scaling["move_id"])

# Tieni tutte le righe se vuoi preservare anche gli zeri iniziali;
# altrimenti decommenta la riga sotto per eliminare i livelli "non attivi".
# move_scaling = move_scaling[(move_scaling["dice_count"] > 0) | (move_scaling["flat_bonus"] > 0)]

move_scaling = move_scaling[["move_id", "level", "dice_count", "flat_bonus"]]
move_scaling = move_scaling.sort_values(["move_id", "level"])
move_scaling.to_csv(OUT_DIR / "move_scaling.csv", sep=";", index=False, encoding="utf-8")

# ---------- 4) Lettura opzionale di Pino.xlsx ----------
# Qui non forziamo un merge, perché Pino sembra una tabella di archetipi/profili.
# Lo importiamo e lo salviamo "grezzo" per ispezione o validazione.
if PINO_PATH.exists():
    xls = pd.ExcelFile(PINO_PATH)
    sheets_info = pd.DataFrame({"sheet_name": xls.sheet_names})
    sheets_info.to_csv(OUT_DIR / "pino_sheets.csv", sep=";", index=False, encoding="utf-8")

    # Salva ogni sheet in CSV grezzo per analizzarla
    raw_dir = OUT_DIR / "pino_raw"
    raw_dir.mkdir(exist_ok=True)

    for sheet in xls.sheet_names:
        df = pd.read_excel(PINO_PATH, sheet_name=sheet, header=None)
        safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", sheet.strip())
        df.to_csv(raw_dir / f"{safe_name}.csv", sep=";", index=False, encoding="utf-8")

print("Creati: data/moves_meta.csv, data/move_scaling.csv e dump grezzo di Pino.xlsx (se presente).")
