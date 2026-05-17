from pathlib import Path
import json
from typing import Any, Dict, List

DATA_DIR = Path(__file__).parent / "data"


def read_json(filename: str, default: Any):
    path = DATA_DIR / filename
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(filename: str, data: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / filename
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def list_records(filename: str) -> List[Dict[str, Any]]:
    data = read_json(filename, [])
    if isinstance(data, dict):
        for key in ["items", "patients", "alerts", "reports", "care_plans"]:
            if key in data and isinstance(data[key], list):
                return data[key]
        return [data]
    return data


def find_by_id(filename: str, item_id: str, id_keys=("id", "patient_id", "staff_id", "trusted_person_id")):
    for item in list_records(filename):
        for key in id_keys:
            if str(item.get(key)) == str(item_id):
                return item
    return None


def append_record(filename: str, record: Dict[str, Any]) -> None:
    items = list_records(filename)
    items.append(record)
    write_json(filename, items)
