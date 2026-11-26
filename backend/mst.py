"""Simple, explainable Prim's and Kruskal's Minimum Spanning Tree (MST) algorithms."""

from __future__ import annotations

import heapq
import math
import random
import time
from typing import Any


def _node_labels(nodes: list[dict[str, Any]]) -> dict[str, str]:
    return {n["id"]: n.get("label") or n["id"] for n in nodes}


def _edge_payload(u: str, v: str, w: float) -> dict[str, Any]:
    return {"source": u, "target": v, "weight": round(float(w), 2)}


def prim_mst(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    start_id: str | None = None,
    include_steps: bool = True,
) -> dict[str, Any]:
    """
    Prim's algorithm: grows the MST one vertex at a time by always picking
    the lowest-cost edge connecting a visited vertex to an unvisited vertex.
    """
    t0 = time.perf_counter()
    labels = _node_labels(nodes)
    node_ids = [n["id"] for n in nodes]

    if not node_ids:
        return {
            "algorithm": "prim",
            "mst_edges": [],
            "total_cost": 0.0,
            "runtime_ms": 0.0,
            "operations": 0,
            "is_connected": True,
            "components": 0,
            "steps": [],
        }

    # Build undirected adjacency list: u -> [(weight, v)]
    adj: dict[str, list[tuple[float, str]]] = {nid: [] for nid in node_ids}
    for e in edges:
        u, v, w = e["source"], e["target"], float(e["weight"])
        if u in adj and v in adj and u != v:
            adj[u].append((w, v))
            adj[v].append((w, u))

    visited: set[str] = set()
    mst_edges: list[dict[str, Any]] = []
    steps: list[dict[str, Any]] = []
    total_cost = 0.0
    operations = 0
    components = 0

    # Order starting vertices so requested start_id goes first
    order = list(node_ids)
    if start_id and start_id in adj:
        order.remove(start_id)
        order.insert(0, start_id)

    for root in order:
        if root in visited:
            continue

        components += 1
        visited.add(root)
        operations += 1

        if include_steps:
            steps.append({
                "step": len(steps) + 1,
                "action": "start",
                "edge": None,
                "node": root,
                "reason": f"Start tree at {labels[root]}.",
                "visited_count": len(visited),
            })

        # Min-heap stores (weight, from_node, to_node)
        heap: list[tuple[float, str, str]] = []
        for w, nbr in adj[root]:
            heapq.heappush(heap, (w, root, nbr))
            operations += 1

        while heap:
            w, u, v = heapq.heappop(heap)
            operations += 1

            if v in visited:
                if include_steps:
                    steps.append({
                        "step": len(steps) + 1,
                        "action": "skip",
                        "edge": _edge_payload(u, v, w),
                        "node": v,
                        "reason": f"Skip {labels[u]} - {labels[v]} (cost {w:g}): {labels[v]} already connected.",
                        "visited_count": len(visited),
                    })
                continue

            visited.add(v)
            edge_obj = _edge_payload(u, v, w)
            mst_edges.append(edge_obj)
            total_cost += w

            if include_steps:
                steps.append({
                    "step": len(steps) + 1,
                    "action": "add",
                    "edge": edge_obj,
                    "node": v,
                    "reason": f"Add {labels[u]} - {labels[v]} (cost {w:g}): cheapest route to {labels[v]}.",
                    "visited_count": len(visited),
                })

            for next_w, nbr in adj[v]:
                if nbr not in visited:
                    heapq.heappush(heap, (next_w, v, nbr))
                operations += 1

    runtime_ms = round((time.perf_counter() - t0) * 1000, 4)
    return {
        "algorithm": "prim",
        "mst_edges": mst_edges,
        "total_cost": round(total_cost, 2),
        "runtime_ms": runtime_ms,
        "operations": operations,
        "is_connected": components == 1,
        "components": components,
        "steps": steps,
    }


def kruskal_mst(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    include_steps: bool = True,
) -> dict[str, Any]:
    """
    Kruskal's algorithm: sorts all edges by cost ascending and adds each edge
    if it connects two separate components (checked via Union-Find).
    """
    t0 = time.perf_counter()
    labels = _node_labels(nodes)
    node_ids = [n["id"] for n in nodes]

    if not node_ids:
        return {
            "algorithm": "kruskal",
            "mst_edges": [],
            "total_cost": 0.0,
            "runtime_ms": 0.0,
            "operations": 0,
            "is_connected": True,
            "components": 0,
            "steps": [],
        }

    # Disjoint Set Union (Union-Find)
    parent: dict[str, str] = {nid: nid for nid in node_ids}
    rank: dict[str, int] = {nid: 0 for nid in node_ids}
    operations = 0

    def find(x: str) -> str:
        nonlocal operations
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
            operations += 1
        operations += 1
        return x

    def union(a: str, b: str) -> bool:
        ra, rb = find(a), find(b)
        if ra == rb:
            return False
        if rank[ra] < rank[rb]:
            parent[ra] = rb
        elif rank[ra] > rank[rb]:
            parent[rb] = ra
        else:
            parent[rb] = ra
            rank[ra] += 1
        return True

    valid_edges = [
        e for e in edges
        if e["source"] in parent and e["target"] in parent and e["source"] != e["target"]
    ]
    sorted_edges = sorted(valid_edges, key=lambda e: float(e["weight"]))
    # Approximate comparison work for sorting E edges
    if len(sorted_edges) > 1:
        operations += int(len(sorted_edges) * math.log2(len(sorted_edges)))

    mst_edges: list[dict[str, Any]] = []
    steps: list[dict[str, Any]] = []
    total_cost = 0.0
    target_edges = len(node_ids) - 1

    for e in sorted_edges:
        if len(mst_edges) == target_edges:
            break

        u, v, w = e["source"], e["target"], float(e["weight"])
        operations += 1
        edge_obj = _edge_payload(u, v, w)

        if union(u, v):
            mst_edges.append(edge_obj)
            total_cost += w
            if include_steps:
                steps.append({
                    "step": len(steps) + 1,
                    "action": "add",
                    "edge": edge_obj,
                    "node": v,
                    "reason": f"Add {labels[u]} - {labels[v]} (cost {w:g}): connects two separate groups.",
                    "visited_count": len(mst_edges) + 1,
                })
        else:
            if include_steps:
                steps.append({
                    "step": len(steps) + 1,
                    "action": "skip",
                    "edge": edge_obj,
                    "node": None,
                    "reason": f"Skip {labels[u]} - {labels[v]} (cost {w:g}): would form a cycle.",
                    "visited_count": len(mst_edges) + 1,
                })

    components = len({find(nid) for nid in node_ids})
    runtime_ms = round((time.perf_counter() - t0) * 1000, 4)
    return {
        "algorithm": "kruskal",
        "mst_edges": mst_edges,
        "total_cost": round(total_cost, 2),
        "runtime_ms": runtime_ms,
        "operations": operations,
        "is_connected": components == 1,
        "components": components,
        "steps": steps,
    }


def generate_network(
    kind: str = "city_grid",
    num_nodes: int = 8,
    seed: int = 42,
) -> dict[str, Any]:
    """Generate sample delivery network topologies for testing and comparison."""
    rng = random.Random(seed)
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    seen_pairs: set[tuple[str, str]] = set()

    def add_edge(u: str, v: str, w: float | None = None) -> None:
        if u == v:
            return
        pair = (min(u, v), max(u, v))
        if pair in seen_pairs:
            return
        seen_pairs.add(pair)
        if w is None:
            nu = next(n for n in nodes if n["id"] == u)
            nv = next(n for n in nodes if n["id"] == v)
            dist = math.hypot(nu["x"] - nv["x"], nu["y"] - nv["y"])
            w = max(2, round(dist / 18 + rng.randint(1, 6)))
        edges.append({"source": u, "target": v, "weight": round(float(w), 1)})

    if kind == "city_grid":
        cols = max(2, math.ceil(math.sqrt(num_nodes)))
        rows = max(2, math.ceil(num_nodes / cols))
        idx = 0
        for r in range(rows):
            for c in range(cols):
                if idx >= num_nodes:
                    break
                x = 110 + c * (580 / max(cols - 1, 1))
                y = 85 + r * (310 / max(rows - 1, 1))
                nodes.append({"id": f"N{idx+1}", "label": f"Stop {idx+1}", "x": round(x, 1), "y": round(y, 1)})
                idx += 1
        # Connect grid neighbors + some diagonals
        for r in range(rows):
            for c in range(cols):
                i = r * cols + c
                if i >= len(nodes):
                    continue
                if c + 1 < cols and i + 1 < len(nodes):
                    add_edge(nodes[i]["id"], nodes[i + 1]["id"])
                if r + 1 < rows and i + cols < len(nodes):
                    add_edge(nodes[i]["id"], nodes[i + cols]["id"])
                if c + 1 < cols and r + 1 < rows and i + cols + 1 < len(nodes) and rng.random() < 0.45:
                    add_edge(nodes[i]["id"], nodes[i + cols + 1]["id"])

    elif kind == "hub_spoke":
        nodes.append({"id": "N1", "label": "Central Hub", "x": 400, "y": 240})
        count = max(3, num_nodes)
        for i in range(1, count):
            angle = (2 * math.pi * (i - 1)) / (count - 1)
            radius = 155 if i % 2 == 1 else 185
            x = 400 + radius * math.cos(angle)
            y = 240 + radius * math.sin(angle)
            nodes.append({"id": f"N{i+1}", "label": f"Zone {i}", "x": round(x, 1), "y": round(y, 1)})
        for i in range(1, count):
            add_edge("N1", f"N{i+1}")
            next_i = 1 if i == count - 1 else i + 1
            add_edge(f"N{i+1}", f"N{next_i+1}")

    elif kind == "dense":
        for i in range(num_nodes):
            angle = (2 * math.pi * i) / max(num_nodes, 1)
            r = 165 if num_nodes <= 12 else rng.uniform(70, 195)
            x = 400 + r * math.cos(angle)
            y = 240 + r * math.sin(angle)
            nodes.append({"id": f"N{i+1}", "label": f"Depot {i+1}", "x": round(x, 1), "y": round(y, 1)})
        for i in range(num_nodes):
            for j in range(i + 1, num_nodes):
                if rng.random() < 0.78:
                    add_edge(nodes[i]["id"], nodes[j]["id"])

    else:  # sparse
        for i in range(num_nodes):
            x = rng.uniform(80, 720)
            y = rng.uniform(70, 410)
            nodes.append({"id": f"N{i+1}", "label": f"Point {i+1}", "x": round(x, 1), "y": round(y, 1)})
        # Spanning backbone so graph is connected, plus a few extra routes
        for i in range(1, num_nodes):
            parent = rng.randint(0, i - 1)
            add_edge(nodes[parent]["id"], nodes[i]["id"])
        extra = max(1, num_nodes // 2)
        for _ in range(extra):
            u, v = rng.sample(nodes, 2)
            add_edge(u["id"], v["id"])

    return {"kind": kind, "nodes": nodes, "edges": edges}


def benchmark_configurations() -> list[dict[str, Any]]:
    """Compare Prim vs Kruskal across multiple network sizes and densities."""
    configs = [
        ("Sparse Small", "sparse", 12, 101),
        ("Sparse Medium", "sparse", 35, 102),
        ("Sparse Large", "sparse", 80, 103),
        ("Dense Small", "dense", 12, 201),
        ("Dense Medium", "dense", 35, 202),
        ("Dense Large", "dense", 80, 203),
    ]
    results: list[dict[str, Any]] = []
    for label, kind, n, seed in configs:
        net = generate_network(kind=kind, num_nodes=n, seed=seed)
        prim = prim_mst(net["nodes"], net["edges"], include_steps=False)
        kruskal = kruskal_mst(net["nodes"], net["edges"], include_steps=False)
        max_edges = n * (n - 1) // 2
        density_pct = round((len(net["edges"]) / max_edges) * 100, 1) if max_edges else 0.0
        faster = "Prim" if prim["runtime_ms"] <= kruskal["runtime_ms"] else "Kruskal"
        results.append({
            "config": label,
            "topology": kind,
            "nodes": n,
            "edges": len(net["edges"]),
            "density_pct": density_pct,
            "total_cost": prim["total_cost"],
            "prim_ms": prim["runtime_ms"],
            "kruskal_ms": kruskal["runtime_ms"],
            "prim_ops": prim["operations"],
            "kruskal_ops": kruskal["operations"],
            "faster": faster,
        })
    return results
