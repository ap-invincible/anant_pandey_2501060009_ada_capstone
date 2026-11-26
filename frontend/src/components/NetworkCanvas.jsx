import React from "react";

function edgeKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export default function NetworkCanvas({
  nodes,
  edges,
  mode,
  selectedNodeId,
  startNodeId,
  activeAlgorithm,
  optimizationResult,
  stepIndex,
  onCanvasClick,
  onNodeClick,
  onEdgeClick,
}) {
  const algoData = optimizationResult ? optimizationResult[activeAlgorithm] : null;
  const steps = algoData?.steps || [];

  // Determine which edges are in the MST up to current stepIndex
  const activeMstKeys = new Set();
  let currentStep = null;

  if (algoData) {
    if (stepIndex < 0 || stepIndex >= steps.length) {
      // Show complete MST
      for (const e of algoData.mst_edges) {
        activeMstKeys.add(edgeKey(e.source, e.target));
      }
    } else {
      currentStep = steps[stepIndex];
      for (let i = 0; i <= stepIndex; i += 1) {
        const st = steps[i];
        if (st.action === "add" && st.edge) {
          activeMstKeys.add(edgeKey(st.edge.source, st.edge.target));
        }
      }
    }
  }

  const currentEdgeKey =
    currentStep?.edge ? edgeKey(currentStep.edge.source, currentStep.edge.target) : null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const handleSvgClick = (e) => {
    if (mode !== "add_node") return;
    if (e.target.closest("[data-graph-item='true']")) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 800);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 460);
    onCanvasClick(
      Math.max(36, Math.min(764, x)),
      Math.max(36, Math.min(424, y))
    );
  };

  return (
    <div className="canvas-wrap">
      <svg
        viewBox="0 0 800 460"
        className={`network-svg mode-${mode}`}
        onClick={handleSvgClick}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="800" height="460" fill="url(#grid)" />

        {/* Edges */}
        {edges.map((edge) => {
          const u = nodeMap.get(edge.source);
          const v = nodeMap.get(edge.target);
          if (!u || !v) return null;

          const key = edgeKey(edge.source, edge.target);
          const isCurrent = currentEdgeKey === key;
          const isInMst = activeMstKeys.has(key);

          let stroke = "#cbd5e1";
          let strokeWidth = 1.75;
          let dash = undefined;

          if (isCurrent && currentStep?.action === "skip") {
            stroke = "#b91c1c";
            strokeWidth = 2.5;
            dash = "6 4";
          } else if (isCurrent && currentStep?.action === "add") {
            stroke = "#047857";
            strokeWidth = 3.5;
          } else if (isInMst) {
            stroke = "#1d4ed8";
            strokeWidth = 3;
          }

          const mx = (u.x + v.x) / 2;
          const my = (u.y + v.y) / 2;

          return (
            <g
              key={key}
              data-graph-item="true"
              className="graph-edge"
              onClick={(ev) => {
                ev.stopPropagation();
                onEdgeClick(edge);
              }}
            >
              <line
                x1={u.x}
                y1={u.y}
                x2={v.x}
                y2={v.y}
                stroke="transparent"
                strokeWidth="14"
              />
              <line
                x1={u.x}
                y1={u.y}
                x2={v.x}
                y2={v.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
              />
              <rect
                x={mx - 15}
                y={my - 10}
                width="30"
                height="20"
                fill="#ffffff"
                stroke={isCurrent || isInMst ? stroke : "#cbd5e1"}
                strokeWidth="1"
              />
              <text
                x={mx}
                y={my + 4}
                textAnchor="middle"
                className="edge-label"
                fill={isCurrent || isInMst ? "#0f172a" : "#475569"}
              >
                {edge.weight}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isStart = startNodeId === node.id;
          const isCurrentNode = currentStep?.node === node.id;

          let fill = "#ffffff";
          let stroke = "#334155";
          let textFill = "#0f172a";

          if (isSelected) {
            fill = "#1d4ed8";
            stroke = "#1e3a8a";
            textFill = "#ffffff";
          } else if (isCurrentNode) {
            fill = "#ecfdf5";
            stroke = "#047857";
          } else if (isStart) {
            fill = "#eff6ff";
            stroke = "#1d4ed8";
          }

          return (
            <g
              key={node.id}
              data-graph-item="true"
              className="graph-node"
              onClick={(ev) => {
                ev.stopPropagation();
                onNodeClick(node);
              }}
            >
              <rect
                x={node.x - 16}
                y={node.y - 16}
                width="32"
                height="32"
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected || isStart || isCurrentNode ? "2.5" : "1.5"}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className="node-id"
                fill={textFill}
              >
                {node.id}
              </text>
              <text
                x={node.x}
                y={node.y + 29}
                textAnchor="middle"
                className="node-sub"
              >
                {node.label || node.id}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="canvas-legend">
        <span><i className="swatch swatch-base" /> Possible Route</span>
        <span><i className="swatch swatch-mst" /> MST Route</span>
        <span><i className="swatch swatch-add" /> Step Added</span>
        <span><i className="swatch swatch-skip" /> Step Skipped (Cycle/Visited)</span>
      </div>
    </div>
  );
}
