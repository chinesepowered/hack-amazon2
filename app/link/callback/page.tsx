"use client";

import { useEffect, useState } from "react";

// OAuth redirect target for the simulated Alexa+ device: exchanges the code + PKCE verifier for a token.
export default function LinkCallback() {
  const [status, setStatus] = useState("Linking your Bedtime Saga account…");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const verifier = sessionStorage.getItem("saga_pkce_verifier");
      if (!code || !verifier || state !== sessionStorage.getItem("saga_pkce_state")) {
        setStatus("Linking failed: missing or mismatched authorization response.");
        return;
      }
      const res = await fetch("/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          client_id: "alexa-plus-simulator",
          redirect_uri: `${window.location.origin}/link/callback`,
          resource: `${window.location.origin}/api/mcp`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`Linking failed: ${json.error_description ?? json.error}`);
        return;
      }
      localStorage.setItem("saga_token", json.access_token);
      sessionStorage.removeItem("saga_pkce_verifier");
      window.location.replace("/");
    })();
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#fff4dc", fontFamily: "var(--font-nunito)" }}>
      <p>{status}</p>
    </main>
  );
}
