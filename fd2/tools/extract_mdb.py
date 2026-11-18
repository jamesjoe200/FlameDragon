"""
Extract FD2 game data from fd2dat.mdb (MS Access) into JSON files.
Requires: pyodbc (pip install pyodbc) + Microsoft ACE OLEDB driver (bundled with Office or Access Runtime)

Usage:
    python extract_mdb.py [--mdb PATH_TO_MDB] [--out OUTPUT_DIR]
"""

import json
import sys
import argparse
import os

DEFAULT_MDB = os.path.join(
    os.path.dirname(__file__),
    "../../炎龙骑士团合集/FlamedragonCollection/Games/GAME/fd2/fd2dat.mdb"
)
DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "../data")

def connect(mdb_path: str):
    try:
        import pyodbc
    except ImportError:
        sys.exit("Missing pyodbc — run: pip install pyodbc")
    conn_str = f"Driver={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={os.path.abspath(mdb_path)};"
    try:
        return pyodbc.connect(conn_str)
    except Exception:
        # Fallback to ACE OLEDB via adodbapi or win32com
        try:
            import win32com.client
            conn = win32com.client.Dispatch("ADODB.Connection")
            conn.Open(f"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={os.path.abspath(mdb_path)};")
            return conn, "adodb"
        except Exception as e:
            sys.exit(f"Cannot open MDB: {e}\nInstall Microsoft Access Runtime from microsoft.com")


def query_pyodbc(conn, sql: str) -> list[dict]:
    cur = conn.cursor()
    cur.execute(sql)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def extract_all(mdb_path: str, out_dir: str):
    import ctypes
    # Use PowerShell/OleDB via subprocess since pyodbc ACE driver may need 32-bit
    import subprocess, tempfile

    ps_script = f"""
Add-Type -AssemblyName System.Data
$mdb = '{os.path.abspath(mdb_path).replace("'", "''")}'
$conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.ACE.OLEDB.12.0;Data Source='$mdb';")
$conn.Open()
$tables = @('dengchang','diren','huowu','itemx','mofashuxing','mofaxulie','qita','renwu','dengchang_gb','diren_gb','huowu_gb','itemx_gb','mofashuxing_gb','mofaxulie_gb','renwu_gb')
$result = @{{}}
foreach ($t in $tables) {{
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM [$t]"
    $reader = $cmd.ExecuteReader()
    $cols = @()
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {{ $cols += $reader.GetName($i) }}
    $rows = @()
    while ($reader.Read()) {{
        $row = @{{}}
        for ($i = 0; $i -lt $reader.FieldCount; $i++) {{
            $row[$cols[$i]] = $reader[$i].ToString()
        }}
        $rows += $row
    }}
    $reader.Close()
    $result[$t] = $rows
}}
$conn.Close()
$result | ConvertTo-Json -Depth 5 | Out-File -FilePath '{os.path.join(out_dir, "_all_tables.json").replace(chr(92), "/")}' -Encoding UTF8
Write-Host "Done"
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False, encoding='utf-8') as f:
        f.write(ps_script)
        ps_file = f.name

    result = subprocess.run(
        ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", ps_file],
        capture_output=True, text=True
    )
    os.unlink(ps_file)

    if result.returncode != 0:
        print("PowerShell error:", result.stderr)
        sys.exit(1)

    raw_path = os.path.join(out_dir, "_all_tables.json")
    with open(raw_path, encoding='utf-8-sig') as f:
        data = json.load(f)

    # --- Transform each table into clean game data ---

    os.makedirs(out_dir, exist_ok=True)

    # renwu → characters (player stat growth per level)
    characters = []
    for r in data.get("renwu", []):
        characters.append({
            "id": int(r["num"]),
            "name": r["names"],
            "ap_min": int(r["apmin"]), "ap_max": int(r["apmax"]),
            "dp_min": int(r["dpmin"]), "dp_max": int(r["dpmax"]),
            "ev_min": int(r["evmin"]), "ev_max": int(r["evmax"]),
            "hp_min": int(r["hpmin"]), "hp_max": int(r["hpmax"]),
            "mp_min": int(r["mpmin"]), "mp_max": int(r["mpmax"]),
            "magic_type": int(r["mofa"]) if r["mofa"] != "255" else None,
        })
    _write(out_dir, "characters.json", characters)

    # diren → enemies
    enemies = []
    for r in data.get("diren", []):
        enemies.append({
            "id": int(r["inde"]),
            "name": r["names"],
            "friendly": r["yon"] == "1",
            "hp": int(r["hp"]),
            "mp": int(r["mp"]),
            "ap": int(r["ap"]),
            "dp": int(r["dp"]),
            "ev": int(r["ev"]),
            "mv": int(r["mv"]),
        })
    _write(out_dir, "enemies.json", enemies)

    # itemx → items & weapons
    items = []
    for r in data.get("itemx", []):
        items.append({
            "id": int(r["inde"]),
            "hex_id": int(r["inhex"], 16) if isinstance(r["inhex"], str) and any(c in r["inhex"].upper() for c in 'ABCDEF') else int(r["inhex"]),
            "name": r["names"],
            "category": r["names1"],
            "subcategory": r["names2"],
            "type": int(r["typ"]),
            "ap": int(r["ap"]),
            "hit": int(r["hit"]),
            "dp": int(r["dp"]),
            "ev": int(r["ev"]),
            "range_min": int(r["min"]),
            "range_max": int(r["max"]),
            "price_buy": int(r["money1"]) + int(r["money2"]) * 256,
            "usable_by": int(r["nob"]),
        })
    _write(out_dir, "items.json", items)

    # mofashuxing → spells
    spells = []
    for r in data.get("mofashuxing", []):
        spells.append({
            "id": int(r["inde"]),
            "name": r["nam"],
            "power": int(r["xiaoguo"]),
            "accuracy": int(r["mingzhong"]),
            "range": int(r["shecheng"]),
            "aoe": int(r["fanwei"]),
            "mp_cost": int(r["mp"]),
        })
    _write(out_dir, "spells.json", spells)

    # mofaxulie → spell_learn (which spell learned at what level per character)
    spell_learn = []
    for r in data.get("mofaxulie", []):
        learns = []
        for i in range(1, 7):
            lv = r.get(f"lv{i}", "255")
            sk = r.get(f"sk{i}", "255")
            if lv != "255" and sk != "255":
                learns.append({"level": int(lv), "spell_id": int(sk)})
        spell_learn.append({
            "character": r["names"],
            "sequence_id": int(r["num"]),
            "learns": learns,
        })
    _write(out_dir, "spell_learn.json", spell_learn)

    # huowu → shops (items available per chapter)
    shops = []
    for r in data.get("huowu", []):
        weapons = [int(r[f"wuqi{i}"]) for i in range(1, 13) if r.get(f"wuqi{i}", "255") != "255"]
        tools   = [int(r[f"daoju{i}"]) for i in range(1, 9) if r.get(f"daoju{i}", "255") != "255"]
        magic   = [int(r[f"shenmi{i}"]) for i in range(1, 9) if r.get(f"shenmi{i}", "255") != "255"]
        shops.append({
            "id": int(r["id"]),
            "chapter": r["nam"],
            "weapons": weapons,
            "items": tools,
            "magic": magic,
        })
    _write(out_dir, "shops.json", shops)

    # dengchang → character_appearances (entry data per chapter)
    appearances = []
    for r in data.get("dengchang", []):
        appearances.append({
            "id": int(r["inde"]),
            "name": r["names"],
            "type": int(r["typ"]),
            "entry_level": int(r["datlv"]),
            "entry_hp": int(r["dathp"]),
            "entry_mp": int(r["datmp"]),
            "entry_mv": int(r["datmv"]),
            "entry_items": [int(r[f"datitem{i}"]) for i in range(1, 7) if r.get(f"datitem{i}", "255") != "255"],
            "entry_spells": [int(r[f"datmage{i}"]) for i in range(1, 5) if r.get(f"datmage{i}", "0") != "0"],
            "info": r.get("info", ""),
        })
    _write(out_dir, "appearances.json", appearances)

    # qita → misc_tweaks (patch entries from cheat editor)
    tweaks = []
    for r in data.get("qita", []):
        tweaks.append({
            "id": int(r["xuhao"]),
            "description": r["info"],
            "enabled": r["chang"] == "1",
        })
    _write(out_dir, "tweaks.json", tweaks)

    os.unlink(raw_path)
    print(f"Extracted {len(characters)} characters, {len(enemies)} enemies, "
          f"{len(items)} items, {len(spells)} spells, {len(shops)} shops.")
    print(f"JSON files written to: {out_dir}")


def _write(out_dir: str, filename: str, data):
    path = os.path.join(out_dir, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  → {filename} ({len(data)} records)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract FD2 MDB data to JSON")
    parser.add_argument("--mdb", default=DEFAULT_MDB, help="Path to fd2dat.mdb")
    parser.add_argument("--out", default=DEFAULT_OUT, help="Output directory for JSON files")
    args = parser.parse_args()
    extract_all(args.mdb, args.out)
