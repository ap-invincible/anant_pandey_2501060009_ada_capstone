"""Unit and API tests for MST algorithms and SQLite routes."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi.testclient import TestClient

os.environ["DB_PATH"] = str(Path(__file__).parent / "test_delivery_mst.db")

import db
import main
import mst


def test_prim_and_kruskal_agree_on_mst_cost():
    nodes = [
        {"id": "A", "label": "A", "x": 0, "y": 0},
        {"id": "B", "label": "B", "x": 1, "y": 0},
        {"id": "C", "label": "C", "x": 0, "y": 1},
        {"id": "D", "label": "D", "x": 1, "y": 1},
    ]
    edges = [
        {"source": "A", "target": "B", "weight": 1},
        {"source": "B", "target": "D", "weight": 2},
        {"source": "C", "target": "D", "weight": 3},
        {"source": "A", "target": "C", "weight": 4},
        {"source": "A", "target": "D", "weight": 5},
    ]
    p = mst.prim_mst(nodes, edges)
    k = mst.kruskal_mst(nodes, edges)

    assert p["total_cost"] == 6.0
    assert k["total_cost"] == 6.0
    assert len(p["mst_edges"]) == 3
    assert len(k["mst_edges"]) == 3
    assert p["is_connected"] is True
    assert k["is_connected"] is True


def test_disconnected_graph_handled():
    nodes = [
        {"id": "A", "label": "A", "x": 0, "y": 0},
        {"id": "B", "label": "B", "x": 1, "y": 0},
        {"id": "C", "label": "C", "x": 5, "y": 5},
    ]
    edges = [{"source": "A", "target": "B", "weight": 5}]
    p = mst.prim_mst(nodes, edges)
    k = mst.kruskal_mst(nodes, edges)

    assert p["is_connected"] is False
    assert k["is_connected"] is False
    assert p["components"] == 2
    assert k["components"] == 2
    assert p["total_cost"] == 5.0
    assert k["total_cost"] == 5.0


def test_api_routes_and_sqlite_persistence():
    test_db = Path(os.environ["DB_PATH"])
    if test_db.exists():
        test_db.unlink()

    with TestClient(main.app) as client:
        assert client.get("/health").status_code == 200

        # Seeded networks exist
        nets = client.get("/networks").json()
        assert len(nets) >= 2

        # Create & retrieve network
        created = client.post(
            "/networks",
            json={
                "name": "Test Route",
                "description": "Unit test",
                "nodes": [
                    {"id": "N1", "label": "N1", "x": 100, "y": 100},
                    {"id": "N2", "label": "N2", "x": 200, "y": 100},
                ],
                "edges": [{"source": "N1", "target": "N2", "weight": 9}],
            },
        )
        assert created.status_code == 201
        net_id = created.json()["id"]

        # Optimize & record run
        opt = client.post(
            "/optimize",
            json={
                "network_name": "Test Route",
                "nodes": created.json()["nodes"],
                "edges": created.json()["edges"],
            },
        )
        assert opt.status_code == 200
        body = opt.json()
        assert body["summary"]["total_cost"] == 9.0
        assert len(body["prim"]["steps"]) >= 2
        assert len(body["kruskal"]["steps"]) == 1

        runs = client.get("/runs").json()
        assert len(runs) >= 1

        # Benchmarks & generator
        bench = client.get("/compare-configs").json()
        assert len(bench["benchmarks"]) == 6

        gen = client.post("/generate", json={"kind": "sparse", "num_nodes": 10, "seed": 1})
        assert gen.status_code == 200
        assert len(gen.json()["nodes"]) == 10

        # Delete
        assert client.delete(f"/networks/{net_id}").status_code == 200
        assert client.get(f"/networks/{net_id}").status_code == 404

    if test_db.exists():
        test_db.unlink()
