import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/status")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend returned an error");
        }
        return response.json();
      })
      .then((data) => setStatus(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Getting Started with DevOps</p>
        <h1>Deployment Status Dashboard</h1>
        <p className="subtitle">
          A tiny React frontend talking to a Python backend.
        </p>
      </section>

      <section className="status-grid" aria-label="Application status">
        <article className="status-card frontend">
          <span className="status-dot" />
          <p className="label">Frontend</p>
          <h2>React</h2>
          <p>{status?.frontend || "Waiting for frontend status..."}</p>
        </article>

        <article className={`status-card backend ${error ? "is-offline" : ""}`}>
          <span className="status-dot" />
          <p className="label">Backend</p>
          <h2>{error ? "Offline" : "FastAPI"}</h2>
          <p>{status ? status.backend : error || "Calling /api/status"}</p>
        </article>

        <article className="status-card deploy">
          <span className="status-dot" />
          <p className="label">Deployment</p>
          <h2>Docker</h2>
          <p>{status?.deployment || "Waiting for deployment status..."}</p>
        </article>
      </section>

      <section className="pipeline">
        <div>Code</div>
        <span />
        <div>Docker</div>
        <span />
        <div>Nginx</div>
        <span />
        <div>VPS</div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
