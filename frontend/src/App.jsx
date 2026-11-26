import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import NetworkCanvas from "./components/NetworkCanvas.jsx";

export default function App() {
  const [networks, setNetworks] = useState([]);
  const [runs, setRuns] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [networkName, setNetworkName] = useState("Metro Hub Delivery");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const [mode, setMode] = useState("add_edge"); // add_node | add_edge | set_start | delete
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [startNodeId, setStartNodeId] = useState(null);
  const [routeCost, setRouteCost] = useState(8);
  const [autoCost, setAutoCost] = useState(true);

  const [presetKind, setPresetKind] = useState("city_grid");
  const [presetCount, setPresetCount] = useState(8);

  const [activeAlgorithm, setActiveAlgorithm] = useState("prim");
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1); // -1 means full MST shown
  const [isPlaying, setIsPlaying] = useState(false);

  const [activeTab, setActiveTab] = useState("compare"); // compare | benchmarks | saved
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [nets, recentRuns] = await Promise.all([
        api.listNetworks(),
        api.listRuns(),
      ]);
      setNetworks(nets);
      setRuns(recentRuns);
      if (nets.length > 0) {
        loadNetworkIntoCanvas(nets[0]);
      }
    } catch (err) {
      setErrorMsg(`Backend unavailable: ${err.message}`);
    }
  }

  function loadNetworkIntoCanvas(net) {
    setNetworkName(net.name);
    setNodes(net.nodes);
    setEdges(net.edges);
    setStartNodeId(net.nodes[0]?.id || null);
    setSelectedNodeId(null);
    setOptimizationResult(null);
    setStepIndex(-1);
    setIsPlaying(false);
    setStatusMsg(`Loaded "${net.name}"`);
    setErrorMsg("");
  }

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !optimizationResult) return;
    const steps = optimizationResult[activeAlgorithm]?.steps || [];
    if (stepIndex >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setStepIndex((prev) => prev + 1);
    }, 850);
    return () => clearTimeout(timer);
  }, [isPlaying, stepIndex, activeAlgorithm, optimizationResult]);

  function nextNodeId() {
    let idx = nodes.length + 1;
    const existing = new Set(nodes.map((n) => n.id));
    while (existing.has(`N${idx}`)) idx += 1;
    return `N${idx}`;
  }

  function handleCanvasClick(x, y) {
    if (mode !== "add_node") return;
    const id = nextNodeId();
    const num = id.replace("N", "");
    const newNode = { id, label: `Stop ${num}`, x, y };
    setNodes((prev) => [...prev, newNode]);
    if (!startNodeId) setStartNodeId(id);
    setOptimizationResult(null);
    setStatusMsg(`Added ${newNode.label}`);
  }

  function handleNodeClick(node) {
    if (mode === "delete") {
      setNodes((prev) => prev.filter((n) => n.id !== node.id));
      setEdges((prev) =>
        prev.filter((e) => e.source !== node.id && e.target !== node.id)
      );
      if (selectedNodeId === node.id) setSelectedNodeId(null);
      if (startNodeId === node.id) setStartNodeId(null);
      setOptimizationResult(null);
      setStatusMsg(`Removed ${node.label}`);
      return;
    }

    if (mode === "set_start") {
      setStartNodeId(node.id);
      setStatusMsg(`Prim's start location set to ${node.label}`);
      return;
    }

    if (mode === "add_edge") {
      if (!selectedNodeId) {
        setSelectedNodeId(node.id);
        setStatusMsg(`Select destination from ${node.label}`);
        return;
      }
      if (selectedNodeId === node.id) {
        setSelectedNodeId(null);
        return;
      }
      const sourceNode = nodes.find((n) => n.id === selectedNodeId);
      const exists = edges.some(
        (e) =>
          (e.source === selectedNodeId && e.target === node.id) ||
          (e.source === node.id && e.target === selectedNodeId)
      );
      if (exists) {
        setErrorMsg("Route between those two locations already exists.");
        setSelectedNodeId(null);
        return;
      }

      let weight = Number(routeCost) || 1;
      if (autoCost && sourceNode) {
        const dist = Math.hypot(sourceNode.x - node.x, sourceNode.y - node.y);
        weight = Math.max(1, Math.round(dist / 22));
      }

      setEdges((prev) => [
        ...prev,
        { source: selectedNodeId, target: node.id, weight },
      ]);
      setSelectedNodeId(null);
      setOptimizationResult(null);
      setErrorMsg("");
      setStatusMsg(`Added route (${selectedNodeId} - ${node.id}, cost ${weight})`);
    }
  }

  function handleEdgeClick(edge) {
    if (mode !== "delete") return;
    setEdges((prev) =>
      prev.filter(
        (e) =>
          !(
            (e.source === edge.source && e.target === edge.target) ||
            (e.source === edge.target && e.target === edge.source)
          )
      )
    );
    setOptimizationResult(null);
    setStatusMsg(`Removed route ${edge.source} - ${edge.target}`);
  }

  async function handleOptimize() {
    if (nodes.length < 2) {
      setErrorMsg("Add at least 2 delivery locations first.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const result = await api.optimize({
        network_name: networkName || "Custom Network",
        nodes,
        edges,
        start_id: startNodeId,
        save_run: true,
      });
      setOptimizationResult(result);
      setStepIndex(-1);
      setIsPlaying(false);
      setStatusMsg(
        `Optimized: Minimum total cost = ${result.summary.total_cost}`
      );
      const recentRuns = await api.listRuns();
      setRuns(recentRuns);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneratePreset() {
    setLoading(true);
    setErrorMsg("");
    try {
      const seed = Math.floor(Math.random() * 900) + 100;
      const gen = await api.generate({
        kind: presetKind,
        num_nodes: Number(presetCount),
        seed,
      });
      setNodes(gen.nodes);
      setEdges(gen.edges);
      setStartNodeId(gen.nodes[0]?.id || null);
      setSelectedNodeId(null);
      setOptimizationResult(null);
      setStepIndex(-1);
      setIsPlaying(false);
      setNetworkName(`${presetKind.replace("_", " ")} (${gen.nodes.length} stops)`);
      setStatusMsg(`Generated ${presetKind} topology`);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNetwork() {
    if (!networkName.trim() || nodes.length === 0) {
      setErrorMsg("Provide a network name and at least 1 location.");
      return;
    }
    setErrorMsg("");
    try {
      const saved = await api.createNetwork({
        name: networkName.trim(),
        description: `${nodes.length} locations, ${edges.length} routes`,
        nodes,
        edges,
      });
      setNetworks((prev) => [saved, ...prev]);
      setStatusMsg(`Saved "${saved.name}" to SQL database`);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  async function handleDeleteSaved(id) {
    try {
      await api.deleteNetwork(id);
      setNetworks((prev) => prev.filter((n) => n.id !== id));
      setStatusMsg("Deleted network from database");
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  async function handleRunBenchmarks() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.compareConfigs();
      setBenchmarks(res.benchmarks);
      setActiveTab("benchmarks");
      setStatusMsg("Completed configuration benchmarks");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClearCanvas() {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setStartNodeId(null);
    setOptimizationResult(null);
    setStepIndex(-1);
    setIsPlaying(false);
    setNetworkName("Custom Network");
    setStatusMsg("Cleared canvas");
  }

  const activeAlgoData = optimizationResult
    ? optimizationResult[activeAlgorithm]
    : null;
  const activeSteps = activeAlgoData?.steps || [];
  const displayedStep =
    stepIndex >= 0 && stepIndex < activeSteps.length
      ? activeSteps[stepIndex]
      : null;

  const maxBenchMs = benchmarks.reduce(
    (m, b) => Math.max(m, b.prim_ms, b.kruskal_ms, 0.01),
    0.01
  );

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Delivery Network MST Optimizer</h1>
          <p className="subtitle">
            Minimum-cost route planning using Prim&apos;s and Kruskal&apos;s algorithms
          </p>
        </div>
        <div className="topbar-stats">
          <div className="stat-box">
            <span>Locations (V)</span>
            <strong>{nodes.length}</strong>
          </div>
          <div className="stat-box">
            <span>Routes (E)</span>
            <strong>{edges.length}</strong>
          </div>
          <div className="stat-box">
            <span>MST Cost</span>
            <strong>
              {optimizationResult ? optimizationResult.summary.total_cost : "—"}
            </strong>
          </div>
        </div>
      </header>

      {(errorMsg || statusMsg) && (
        <div className={`banner ${errorMsg ? "banner-error" : "banner-info"}`}>
          <span>{errorMsg || statusMsg}</span>
          <button
            className="btn-link"
            onClick={() => {
              setErrorMsg("");
              setStatusMsg("");
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="workspace">
        <section className="panel canvas-panel">
          <div className="toolbar">
            <div className="tool-group">
              <button
                className={`btn ${mode === "add_node" ? "btn-active" : ""}`}
                onClick={() => {
                  setMode("add_node");
                  setSelectedNodeId(null);
                }}
              >
                + Add Stop
              </button>
              <button
                className={`btn ${mode === "add_edge" ? "btn-active" : ""}`}
                onClick={() => {
                  setMode("add_edge");
                  setSelectedNodeId(null);
                }}
              >
                Connect Route
              </button>
              <button
                className={`btn ${mode === "set_start" ? "btn-active" : ""}`}
                onClick={() => {
                  setMode("set_start");
                  setSelectedNodeId(null);
                }}
              >
                Set Start
              </button>
              <button
                className={`btn ${mode === "delete" ? "btn-danger-active" : ""}`}
                onClick={() => {
                  setMode("delete");
                  setSelectedNodeId(null);
                }}
              >
                Delete
              </button>
            </div>

            {mode === "add_edge" && (
              <div className="tool-group">
                <label className="inline-field">
                  Cost:
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={routeCost}
                    disabled={autoCost}
                    onChange={(e) => setRouteCost(e.target.value)}
                    className="input-sm"
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={autoCost}
                    onChange={(e) => setAutoCost(e.target.checked)}
                  />
                  Auto from distance
                </label>
              </div>
            )}

            <div className="tool-group ml-auto">
              <button className="btn" onClick={handleClearCanvas}>
                Clear
              </button>
              <button
                className="btn btn-primary"
                onClick={handleOptimize}
                disabled={loading}
              >
                {loading ? "Running..." : "Optimize MST"}
              </button>
            </div>
          </div>

          <NetworkCanvas
            nodes={nodes}
            edges={edges}
            mode={mode}
            selectedNodeId={selectedNodeId}
            startNodeId={startNodeId}
            activeAlgorithm={activeAlgorithm}
            optimizationResult={optimizationResult}
            stepIndex={stepIndex}
            onCanvasClick={handleCanvasClick}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
          />

          <div className="toolbar toolbar-bottom">
            <div className="tool-group">
              <label className="inline-field">
                Name:
                <input
                  type="text"
                  value={networkName}
                  onChange={(e) => setNetworkName(e.target.value)}
                  className="input-md"
                />
              </label>
              <button className="btn" onClick={handleSaveNetwork}>
                Save Network
              </button>
            </div>

            <div className="tool-group ml-auto">
              <select
                value={presetKind}
                onChange={(e) => setPresetKind(e.target.value)}
                className="select-sm"
              >
                <option value="city_grid">City Grid</option>
                <option value="hub_spoke">Hub &amp; Spoke</option>
                <option value="sparse">Sparse Random</option>
                <option value="dense">Dense Random</option>
              </select>
              <input
                type="number"
                min="4"
                max="30"
                value={presetCount}
                onChange={(e) => setPresetCount(e.target.value)}
                className="input-xs"
                title="Number of locations"
              />
              <button className="btn" onClick={handleGeneratePreset}>
                Generate
              </button>
            </div>
          </div>
        </section>

        {/* Right Panel: Algorithm Explainer & Step Trace */}
        <aside className="panel side-panel">
          <div className="panel-head">
            <h2>Algorithm Step-by-Step</h2>
            <div className="segmented">
              <button
                className={`seg-btn ${activeAlgorithm === "prim" ? "seg-active" : ""}`}
                onClick={() => {
                  setActiveAlgorithm("prim");
                  setStepIndex(-1);
                  setIsPlaying(false);
                }}
              >
                Prim&apos;s
              </button>
              <button
                className={`seg-btn ${activeAlgorithm === "kruskal" ? "seg-active" : ""}`}
                onClick={() => {
                  setActiveAlgorithm("kruskal");
                  setStepIndex(-1);
                  setIsPlaying(false);
                }}
              >
                Kruskal&apos;s
              </button>
            </div>
          </div>

          <div className="algo-guide">
            {activeAlgorithm === "prim" ? (
              <>
                <strong>How Prim&apos;s Works:</strong>
                <ol>
                  <li>Start at one delivery location (tree root).</li>
                  <li>Always pick the cheapest route leading to an unvisited location.</li>
                  <li>Repeat until all locations are connected.</li>
                </ol>
              </>
            ) : (
              <>
                <strong>How Kruskal&apos;s Works:</strong>
                <ol>
                  <li>Sort all possible routes from lowest to highest cost.</li>
                  <li>Pick the next cheapest route if it does not form a cycle.</li>
                  <li>Use Union-Find to track connected groups until done.</li>
                </ol>
              </>
            )}
          </div>

          {!optimizationResult ? (
            <div className="empty-box">
              Click <strong>Optimize MST</strong> to run both algorithms and inspect every decision step.
            </div>
          ) : (
            <>
              {!optimizationResult.summary.is_connected && (
                <div className="warning-box">
                  Network is disconnected ({activeAlgoData.components} separate groups). Showing Minimum Spanning Forest.
                </div>
              )}

              <div className="playback-bar">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIndex(0);
                  }}
                  disabled={activeSteps.length === 0}
                >
                  Start
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIndex((i) => Math.max(0, i - 1));
                  }}
                  disabled={stepIndex <= 0}
                >
                  Prev
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    if (stepIndex < 0 || stepIndex >= activeSteps.length - 1) {
                      setStepIndex(0);
                    }
                    setIsPlaying((p) => !p);
                  }}
                  disabled={activeSteps.length === 0}
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIndex((i) =>
                      i < 0 ? 0 : Math.min(activeSteps.length - 1, i + 1)
                    );
                  }}
                  disabled={stepIndex >= activeSteps.length - 1}
                >
                  Next
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setIsPlaying(false);
                    setStepIndex(-1);
                  }}
                >
                  Full MST
                </button>
              </div>

              <div className="step-status">
                {displayedStep ? (
                  <div className={`step-callout step-${displayedStep.action}`}>
                    <div className="step-meta">
                      Step {displayedStep.step} of {activeSteps.length} •{" "}
                      {displayedStep.action.toUpperCase()}
                    </div>
                    <div>{displayedStep.reason}</div>
                  </div>
                ) : (
                  <div className="step-callout">
                    <div className="step-meta">Complete MST Selected</div>
                    <div>
                      Selected {activeAlgoData.mst_edges.length} routes with minimum
                      total cost <strong>{activeAlgoData.total_cost}</strong>.
                    </div>
                  </div>
                )}
              </div>

              <div className="steps-list">
                {activeSteps.map((st, idx) => (
                  <button
                    key={st.step}
                    className={`step-row ${stepIndex === idx ? "step-row-active" : ""}`}
                    onClick={() => {
                      setIsPlaying(false);
                      setStepIndex(idx);
                    }}
                  >
                    <span className={`badge badge-${st.action}`}>
                      {st.action}
                    </span>
                    <span className="step-text">{st.reason}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      </main>

      {/* Bottom Analysis Tabs */}
      <section className="panel bottom-panel">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "compare" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("compare")}
          >
            Current Network Comparison
          </button>
          <button
            className={`tab ${activeTab === "benchmarks" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("benchmarks")}
          >
            Configuration Benchmarks (Sparse vs Dense)
          </button>
          <button
            className={`tab ${activeTab === "saved" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("saved")}
          >
            Saved Networks &amp; Run History ({networks.length})
          </button>
        </div>

        {activeTab === "compare" && (
          <div className="tab-body">
            {!optimizationResult ? (
              <p className="muted">
                Run <strong>Optimize MST</strong> to compare Prim&apos;s and Kruskal&apos;s
                performance on the current network.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Algorithm</th>
                    <th>Data Structure</th>
                    <th>Time Complexity</th>
                    <th>Total Cost</th>
                    <th>MST Edges</th>
                    <th>Operations</th>
                    <th>Runtime (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Prim&apos;s</strong></td>
                    <td>Min-Heap + Adjacency List</td>
                    <td><code>O(E log V)</code></td>
                    <td>{optimizationResult.prim.total_cost}</td>
                    <td>{optimizationResult.prim.mst_edges.length}</td>
                    <td>{optimizationResult.prim.operations}</td>
                    <td>{optimizationResult.prim.runtime_ms} ms</td>
                  </tr>
                  <tr>
                    <td><strong>Kruskal&apos;s</strong></td>
                    <td>Sorted Edges + Union-Find</td>
                    <td><code>O(E log E)</code></td>
                    <td>{optimizationResult.kruskal.total_cost}</td>
                    <td>{optimizationResult.kruskal.mst_edges.length}</td>
                    <td>{optimizationResult.kruskal.operations}</td>
                    <td>{optimizationResult.kruskal.runtime_ms} ms</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "benchmarks" && (
          <div className="tab-body">
            <div className="bench-header">
              <p className="muted">
                Compares Prim&apos;s vs Kruskal&apos;s across small, medium, and large sparse/dense delivery networks.
              </p>
              <button className="btn btn-primary" onClick={handleRunBenchmarks}>
                Run Benchmark Suite
              </button>
            </div>
            {benchmarks.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Configuration</th>
                    <th>V / E</th>
                    <th>Density</th>
                    <th>Prim (ms / ops)</th>
                    <th>Kruskal (ms / ops)</th>
                    <th>Visual Runtime</th>
                    <th>Faster</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((b) => (
                    <tr key={b.config}>
                      <td><strong>{b.config}</strong></td>
                      <td>{b.nodes} / {b.edges}</td>
                      <td>{b.density_pct}%</td>
                      <td>{b.prim_ms} ms ({b.prim_ops})</td>
                      <td>{b.kruskal_ms} ms ({b.kruskal_ops})</td>
                      <td className="bar-cell">
                        <div className="bar-row">
                          <span className="bar-tag">P</span>
                          <div
                            className="bar bar-prim"
                            style={{ width: `${Math.max(4, (b.prim_ms / maxBenchMs) * 100)}%` }}
                          />
                        </div>
                        <div className="bar-row">
                          <span className="bar-tag">K</span>
                          <div
                            className="bar bar-kruskal"
                            style={{ width: `${Math.max(4, (b.kruskal_ms / maxBenchMs) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td><strong>{b.faster}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "saved" && (
          <div className="tab-body two-col">
            <div>
              <h3>Saved Networks (SQLite)</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {networks.map((net) => (
                    <tr key={net.id}>
                      <td>
                        <strong>{net.name}</strong>
                        <div className="muted-sm">{net.description}</div>
                      </td>
                      <td>
                        {net.nodes.length}V / {net.edges.length}E
                      </td>
                      <td className="actions-cell">
                        <button
                          className="btn btn-sm"
                          onClick={() => loadNetworkIntoCanvas(net)}
                        >
                          Load
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDeleteSaved(net.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3>Recent Optimization Runs</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Network</th>
                    <th>Cost</th>
                    <th>Prim</th>
                    <th>Kruskal</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="muted">No runs recorded yet.</td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id}>
                        <td>{r.network_name}</td>
                        <td>{r.total_cost}</td>
                        <td>{r.prim_ms} ms</td>
                        <td>{r.kruskal_ms} ms</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
