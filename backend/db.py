"""Minimal SQLite persistence layer using pure SQL."""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

DEFAULT_DB = Path(__file__).resolve().parent / "data" / "delivery_mst.db"
DB_PATH = Path(os.environ.get("DB_PATH", str(DEFAULT_DB)))


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS networks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                nodes_json TEXT NOT NULL,
                edges_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                network_name TEXT NOT NULL,
                node_count INTEGER NOT NULL,
                edge_count INTEGER NOT NULL,
                total_cost REAL NOT NULL,
                prim_ms REAL NOT NULL,
                kruskal_ms REAL NOT NULL,
                prim_ops INTEGER NOT NULL,
                kruskal_ops INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )

        count = conn.execute("SELECT COUNT(*) FROM networks").fetchone()[0]
        if count == 0:
            _seed_defaults(conn)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _seed_defaults(conn: sqlite3.Connection) -> None:
    samples = [
        {
            "name": "Metro Hub Delivery",
            "description": "6-location downtown distribution network",
            "nodes": [
                {"id": "N1", "label": "Central Hub", "x": 140, "y": 240},
                {"id": "N2", "label": "North Depot", "x": 320, "y": 95},
                {"id": "N3", "label": "South Depot", "x": 320, "y": 385},
                {"id": "N4", "label": "Midtown", "x": 450, "y": 240},
                {"id": "N5", "label": "East Port", "x": 640, "y": 120},
                {"id": "N6", "label": "Airport", "x": 640, "y": 360},
            ],
            "edges": [
                {"source": "N1", "target": "N2", "weight": 8},
                {"source": "N1", "target": "N3", "weight": 7},
                {"source": "N1", "target": "N4", "weight": 12},
                {"source": "N2", "target": "N4", "weight": 6},
                {"source": "N3", "target": "N4", "weight": 5},
                {"source": "N2", "target": "N5", "weight": 11},
                {"source": "N4", "target": "N5", "weight": 7},
                {"source": "N4", "target": "N6", "weight": 9},
                {"source": "N3", "target": "N6", "weight": 14},
                {"source": "N5", "target": "N6", "weight": 10},
            ],
        },
        {
            "name": "Regional 8-Stop Grid",
            "description": "Balanced regional delivery routes",
            "nodes": [
                {"id": "N1", "label": "Depot A", "x": 110, "y": 105},
                {"id": "N2", "label": "Depot B", "x": 300, "y": 105},
                {"id": "N3", "label": "Depot C", "x": 490, "y": 105},
                {"id": "N4", "label": "Depot D", "x": 680, "y": 105},
                {"id": "N5", "label": "Depot E", "x": 110, "y": 365},
                {"id": "N6", "label": "Depot F", "x": 300, "y": 365},
                {"id": "N7", "label": "Depot G", "x": 490, "y": 365},
                {"id": "N8", "label": "Depot H", "x": 680, "y": 365},
            ],
            "edges": [
                {"source": "N1", "target": "N2", "weight": 6},
                {"source": "N2", "target": "N3", "weight": 9},
                {"source": "N3", "target": "N4", "weight": 5},
                {"source": "N5", "target": "N6", "weight": 8},
                {"source": "N6", "target": "N7", "weight": 4},
                {"source": "N7", "target": "N8", "weight": 7},
                {"source": "N1", "target": "N5", "weight": 10},
                {"source": "N2", "target": "N6", "weight": 7},
                {"source": "N3", "target": "N7", "weight": 6},
                {"source": "N4", "target": "N8", "weight": 11},
                {"source": "N1", "target": "N6", "weight": 13},
                {"source": "N3", "target": "N8", "weight": 12},
            ],
        },
    ]

    for s in samples:
        conn.execute(
            "INSERT INTO networks (name, description, nodes_json, edges_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (s["name"], s["description"], json.dumps(s["nodes"]), json.dumps(s["edges"]), _now_iso()),
        )


def list_networks() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM networks ORDER BY id DESC").fetchall()
        return [_row_to_network(r) for r in rows]


def get_network(network_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM networks WHERE id = ?", (network_id,)).fetchone()
        return _row_to_network(row) if row else None


def create_network(name: str, description: str, nodes: list[dict], edges: list[dict]) -> dict[str, Any]:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO networks (name, description, nodes_json, edges_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, description, json.dumps(nodes), json.dumps(edges), _now_iso()),
        )
        row = conn.execute("SELECT * FROM networks WHERE id = ?", (cur.lastrowid,)).fetchone()
        return _row_to_network(row)


def delete_network(network_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM networks WHERE id = ?", (network_id,))
        return cur.rowcount > 0


def save_run(
    network_name: str,
    node_count: int,
    edge_count: int,
    total_cost: float,
    prim_ms: float,
    kruskal_ms: float,
    prim_ops: int,
    kruskal_ops: int,
) -> dict[str, Any]:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO runs (
                network_name, node_count, edge_count, total_cost,
                prim_ms, kruskal_ms, prim_ops, kruskal_ops, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (network_name, node_count, edge_count, total_cost, prim_ms, kruskal_ms, prim_ops, kruskal_ops, _now_iso()),
        )
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def list_runs(limit: int = 15) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]


def _row_to_network(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "nodes": json.loads(row["nodes_json"]),
        "edges": json.loads(row["edges_json"]),
        "created_at": row["created_at"],
    }
