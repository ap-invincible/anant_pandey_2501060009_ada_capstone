const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),
  listNetworks: () => request("/networks"),
  createNetwork: (data) =>
    request("/networks", { method: "POST", body: JSON.stringify(data) }),
  deleteNetwork: (id) => request(`/networks/${id}`, { method: "DELETE" }),
  optimize: (data) =>
    request("/optimize", { method: "POST", body: JSON.stringify(data) }),
  generate: (data) =>
    request("/generate", { method: "POST", body: JSON.stringify(data) }),
  compareConfigs: () => request("/compare-configs"),
  listRuns: () => request("/runs"),
};
