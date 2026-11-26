"""Simple FastAPI server for Delivery Network MST Optimization."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
import mst


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Delivery Network MST API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class NodeIn(BaseModel):
    id: str
    label: str = ""
    x: float
    y: float


class EdgeIn(BaseModel):
    source: str
    target: str
    weight: float = Field(..., gt=0)


class NetworkCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    nodes: list[NodeIn]
    edges: list[EdgeIn]


class OptimizeRequest(BaseModel):
    network_name: str = "Custom Network"
    nodes: list[NodeIn]
    edges: list[EdgeIn]
    start_id: str | None = None
    save_run: bool = True


class GenerateRequest(BaseModel):
    kind: Literal["city_grid", "hub_spoke", "sparse", "dense"] = "city_grid"
    num_nodes: int = Field(8, ge=3, le=100)
    seed: int = 42


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/networks")
def get_networks():
    return db.list_networks()


@app.post("/networks", status_code=201)
def create_network(payload: NetworkCreate):
    nodes = [n.model_dump() for n in payload.nodes]
    edges = [e.model_dump() for e in payload.edges]
    return db.create_network(payload.name, payload.description, nodes, edges)


@app.get("/networks/{network_id}")
def get_network(network_id: int):
    net = db.get_network(network_id)
    if not net:
        raise HTTPException(status_code=404, detail="Network not found")
    return net


@app.delete("/networks/{network_id}")
def delete_network(network_id: int):
    if not db.delete_network(network_id):
        raise HTTPException(status_code=404, detail="Network not found")
    return {"deleted": network_id}


@app.post("/optimize")
def optimize_network(payload: OptimizeRequest):
    nodes = [n.model_dump() for n in payload.nodes]
    edges = [e.model_dump() for e in payload.edges]

    prim_result = mst.prim_mst(nodes, edges, start_id=payload.start_id)
    kruskal_result = mst.kruskal_mst(nodes, edges)

    if payload.save_run and nodes:
        db.save_run(
            network_name=payload.network_name,
            node_count=len(nodes),
            edge_count=len(edges),
            total_cost=prim_result["total_cost"],
            prim_ms=prim_result["runtime_ms"],
            kruskal_ms=kruskal_result["runtime_ms"],
            prim_ops=prim_result["operations"],
            kruskal_ops=kruskal_result["operations"],
        )

    return {
        "prim": prim_result,
        "kruskal": kruskal_result,
        "summary": {
            "nodes": len(nodes),
            "edges": len(edges),
            "total_cost": prim_result["total_cost"],
            "is_connected": prim_result["is_connected"],
            "faster": "Prim" if prim_result["runtime_ms"] <= kruskal_result["runtime_ms"] else "Kruskal",
        },
    }


@app.post("/generate")
def generate_network(payload: GenerateRequest):
    return mst.generate_network(kind=payload.kind, num_nodes=payload.num_nodes, seed=payload.seed)


@app.get("/compare-configs")
def compare_configs():
    return {"benchmarks": mst.benchmark_configurations()}


@app.get("/runs")
def get_runs():
    return db.list_runs()
