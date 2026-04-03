import { useState, useEffect } from "react";

const CDK_PATTERNS = [
  { name: "the-simple-webservice",            label: "Simple Web Service",           desc: "API Gateway + Lambda + DynamoDB" },
  { name: "the-scalable-webhook",             label: "Scalable Webhook",             desc: "High-throughput webhook via SQS + Lambda" },
  { name: "the-simple-graphql-service",       label: "Simple GraphQL Service",       desc: "AppSync GraphQL API" },
  { name: "the-big-fan",                      label: "The Big Fan",                  desc: "SNS → SQS fan-out with filtering" },
  { name: "the-ecs-pattern",                  label: "ECS Pattern",                  desc: "Containerised service on Fargate" },
  { name: "the-state-machine",                label: "State Machine",                desc: "Step Functions workflow pattern" },
  { name: "the-saga-stepfunction",            label: "Saga Step Function",           desc: "Distributed saga with Step Functions" },
  { name: "the-wandering-state-machine",      label: "Wandering State Machine",      desc: "Dynamic Step Functions branching" },
  { name: "the-eventbridge-atm",              label: "EventBridge ATM",              desc: "Event-driven state machine via EventBridge" },
  { name: "the-eventbridge-etl",              label: "EventBridge ETL",              desc: "ETL pipeline driven by events" },
  { name: "the-eventbridge-circuit-breaker",  label: "EventBridge Circuit Breaker",  desc: "Resilience pattern with EventBridge" },
  { name: "the-dynamo-streamer",              label: "DynamoDB Streamer",            desc: "DynamoDB Streams → Lambda pipeline" },
  { name: "the-destined-lambda",              label: "The Destined Lambda",          desc: "Lambda Destinations for async flows" },
  { name: "the-lambda-circuit-breaker",       label: "Lambda Circuit Breaker",       desc: "Circuit breaker pattern in Lambda" },
  { name: "the-lambda-power-tuner",           label: "Lambda Power Tuner",           desc: "Optimise Lambda memory & cost" },
  { name: "the-predictive-lambda",            label: "Predictive Lambda",            desc: "ML inference with Lambda + SageMaker" },
  { name: "the-recursive-lambda",             label: "Recursive Lambda",             desc: "Self-invoking Lambda for long tasks" },
  { name: "the-rds-proxy",                    label: "RDS Proxy",                    desc: "Serverless → RDS via RDS Proxy" },
  { name: "the-websocket-chat",               label: "WebSocket Chat",               desc: "Real-time chat via API GW WebSockets" },
  { name: "the-xray-tracer",                  label: "X-Ray Tracer",                 desc: "Distributed tracing across services" },
  { name: "the-cloudwatch-dashboard",         label: "CloudWatch Dashboard",         desc: "Ops dashboard for Lambda + API GW" },
].map(p => ({ ...p, url: `https://github.com/cdk-patterns/serverless/tree/master/${p.name}` }));

const AWS_REGIONS = [
  "us-east-1","us-east-2","us-west-1","us-west-2",
  "eu-west-1","eu-west-2","eu-central-1",
  "ap-southeast-1","ap-southeast-2","ap-northeast-1",
];

function generateScript({ github, aws, pattern }) {

  return `#!/usr/bin/env bash
# IDP Deploy — ${pattern.label}
# Repo: ${github.org}/${github.repo} [${github.branch}] | Region: ${aws.region}
# Auth: GitHub=${github.ssoConnected ? "SSO" : "PAT"} AWS=${aws.sessionToken ? "IAM Identity Center SSO" : "Access Keys"}
set -euo pipefail

echo "=== IDP Deploy: ${pattern.label} ==="
${github.ssoConnected
  ? `# GitHub token obtained via SSO (embedded by IDP portal)\nGITHUB_TOKEN="${github.token}"`
  : `read -r -p  "GitHub token:         " GITHUB_TOKEN`}
${aws.sessionToken
  ? `# AWS temporary credentials from IAM Identity Center SSO\nexport AWS_ACCESS_KEY_ID="${aws.accessKeyId}"\nexport AWS_SECRET_ACCESS_KEY="${aws.secretAccessKey}"\nexport AWS_SESSION_TOKEN="${aws.sessionToken}"`
  : `read -r -p  "AWS Access Key ID:    " AWS_ACCESS_KEY_ID\nread -rs -p "AWS Secret Key:       " AWS_SECRET_ACCESS_KEY\necho ""\nexport AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY`}
export AWS_DEFAULT_REGION="${aws.region}"

for cmd in git node npm aws; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Error: $cmd not found"; exit 1; }
done
npx cdk --version >/dev/null 2>&1 || npm install -g aws-cdk

WORK_DIR="$(pwd)/idp-${pattern.name}"
if [ ! -d "$WORK_DIR" ]; then
  git clone --depth 1 --filter=blob:none --sparse \\
    https://github.com/cdk-patterns/serverless.git "$WORK_DIR"
  cd "$WORK_DIR" && git sparse-checkout set ${pattern.name} && cd -
fi

PATTERN_DIR="$WORK_DIR/${pattern.name}/typescript"
[ -d "$PATTERN_DIR" ] || PATTERN_DIR="$WORK_DIR/${pattern.name}"
cd "$PATTERN_DIR" && npm install --silent

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap "aws://$AWS_ACCOUNT/${aws.region}"
npx cdk deploy --require-approval never --outputs-file cdk-outputs.json
cat cdk-outputs.json 2>/dev/null || true

git init -q
git remote remove origin 2>/dev/null || true
git remote add origin "https://$GITHUB_TOKEN@github.com/${github.org}/${github.repo}.git"
git checkout -b ${github.branch} 2>/dev/null || git checkout ${github.branch}
git add -A && git commit -m "deploy: ${pattern.label} via IDP" --allow-empty -q
git push -u origin ${github.branch} --force-with-lease

echo "Done. ${pattern.label} is live in ${aws.region}."
`;
}

function downloadScript(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without clipboard API permissions
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

// ── SSO mock data ─────────────────────────────────────────────────────────────
// In a real deployment these flows would be server-side OAuth / OIDC exchanges.
// Here we simulate the handshakes so the UX is fully exercisable without a backend.

const MOCK_GITHUB_USER = {
  login: "jdoe-demo",
  name: "Jane Doe",
  orgs: ["acme-corp", "my-org", "open-source-demos"],
};

const MOCK_AWS_ACCOUNTS = [
  { id: "123456789012", name: "acme-prod",    roles: ["AdministratorAccess", "PowerUserAccess"] },
  { id: "987654321098", name: "acme-staging", roles: ["PowerUserAccess", "ReadOnlyAccess"] },
  { id: "112233445566", name: "acme-sandbox", roles: ["AdministratorAccess"] },
];

// ── SSO sub-components ────────────────────────────────────────────────────────

function Spinner() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 400);
    return () => clearInterval(t);
  }, []);
  return <span style={{ fontFamily:"ui-monospace,monospace", color:"#86868b" }}>{dots}</span>;
}

function OAuthBadge({ provider, color, icon, children }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"11px 14px", borderRadius:12,
      background: color + "0d", border:`1.5px solid ${color}33`,
    }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>{children}</div>
    </div>
  );
}

function ConnectedChip({ label, onDisconnect }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{
        display:"inline-flex", alignItems:"center", gap:5,
        padding:"3px 10px 3px 8px", borderRadius:20,
        background:"#f0fdf4", border:"1.5px solid #34c75933",
        fontSize:11, fontWeight:600, color:"#1a8c41",
      }}>
        <span style={{ fontSize:9 }}>●</span> {label}
      </span>
      <button
        type="button"
        onClick={onDisconnect}
        style={{ background:"none", border:"none", fontSize:11, color:"#86868b", cursor:"pointer", padding:0 }}
      >
        Disconnect
      </button>
    </div>
  );
}

// ── GitHub SSO ────────────────────────────────────────────────────────────────

function GitHubSSOSection({ onConnect, onDisconnect, connected }) {
  const [phase, setPhase] = useState("idle"); // idle | redirect | authed | org-selected
  const [selectedOrg, setSelectedOrg] = useState(MOCK_GITHUB_USER.orgs[0]);

  const handleSignIn = () => {
    setPhase("redirect");
    // Simulate: open GitHub OAuth → user approves → callback with code → exchange for token
    setTimeout(() => {
      setPhase("authed");
      handleOrgSelect(selectedOrg);
    }, 2000);
  };

  const handleOrgSelect = (org) => {
    setSelectedOrg(org);
    onConnect({
      token: `gho_sso_${Math.random().toString(36).slice(2,14)}`, // mock OAuth token
      org,
      user: MOCK_GITHUB_USER,
    });
  };

  const handleDisconnect = () => {
    setPhase("idle");
    setSelectedOrg(MOCK_GITHUB_USER.orgs[0]);
    onDisconnect();
  };

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        style={{
          width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          padding:"11px 0", borderRadius:12, border:"1.5px solid #24292f33",
          background:"#24292f", color:"#fff", fontSize:13, fontWeight:600,
          cursor:"pointer", letterSpacing:"-0.01em", transition:"opacity 0.15s",
        }}
        onMouseOver={e=>e.currentTarget.style.opacity="0.85"}
        onMouseOut={e=>e.currentTarget.style.opacity="1"}
      >
        <svg height="18" viewBox="0 0 16 16" fill="white" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
            0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
            -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
            .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
            -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
            .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
            .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
            0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        Sign in with GitHub
      </button>
    );
  }

  if (phase === "redirect") {
    return (
      <OAuthBadge provider="github" color="#24292f" icon="🔐">
        <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f" }}>Redirecting to GitHub<Spinner /></div>
        <div style={{ fontSize:11, color:"#86868b", marginTop:2 }}>Awaiting authorization in popup window</div>
      </OAuthBadge>
    );
  }

  // authed — show org selector
  return (
    <div>
      <OAuthBadge provider="github" color="#24292f" icon="✓">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f" }}>@{MOCK_GITHUB_USER.login}</div>
            <div style={{ fontSize:11, color:"#86868b", marginTop:1 }}>{MOCK_GITHUB_USER.name}</div>
          </div>
          <ConnectedChip label="Connected" onDisconnect={handleDisconnect} />
        </div>
      </OAuthBadge>
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f", marginBottom:6 }}>Organization / User</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {MOCK_GITHUB_USER.orgs.map(org => (
            <button
              key={org}
              type="button"
              onClick={() => handleOrgSelect(org)}
              style={{
                padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:500,
                border:`1.5px solid ${selectedOrg===org ? "#0071e3" : "#d2d2d7"}`,
                background: selectedOrg===org ? "#f0f7ff" : "#f5f5f7",
                color: selectedOrg===org ? "#0071e3" : "#1d1d1f",
                cursor:"pointer",
              }}
            >{org}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AWS IAM Identity Center SSO ───────────────────────────────────────────────

function AWSSSOSection({ onConnect, onDisconnect }) {
  const [phase, setPhase] = useState("idle"); // idle | url | connecting | roles | done
  const [ssoUrl, setSsoUrl] = useState("");
  const [urlFocus, setUrlFocus] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(MOCK_AWS_ACCOUNTS[0]);
  const [selectedRole, setSelectedRole] = useState(MOCK_AWS_ACCOUNTS[0].roles[0]);
  const [connected, setConnected] = useState(false);

  const startFlow = () => setPhase("url");

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (!ssoUrl.trim()) return;
    setPhase("connecting");
    // Simulate: SSO portal → device auth → OIDC token → STS AssumeRoleWithWebIdentity
    setTimeout(() => setPhase("roles"), 2200);
  };

  const handleRoleSelect = () => {
    const mockCreds = {
      accessKeyId: `ASIA${Math.random().toString(36).slice(2,14).toUpperCase()}`,
      secretAccessKey: Array.from({length:40},()=>"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[Math.floor(Math.random()*64)]).join(""),
      sessionToken: `IQoJb3JpZ2luX2VjEMock${Math.random().toString(36).slice(2,20)}`,
    };
    setConnected(true);
    setPhase("done");
    onConnect({
      region: "us-east-1",
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      role: selectedRole,
      ...mockCreds,
    });
  };

  const handleDisconnect = () => {
    setPhase("idle");
    setSsoUrl("");
    setConnected(false);
    onDisconnect();
  };

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={startFlow}
        style={{
          width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          padding:"11px 0", borderRadius:12, border:"1.5px solid #ff990033",
          background:"#fff8f0", color:"#cc4400", fontSize:13, fontWeight:600,
          cursor:"pointer", letterSpacing:"-0.01em", transition:"all 0.15s",
        }}
        onMouseOver={e=>{ e.currentTarget.style.background="#fff3e6"; }}
        onMouseOut={e=>{ e.currentTarget.style.background="#fff8f0"; }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#cc4400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Sign in with AWS IAM Identity Center
      </button>
    );
  }

  if (phase === "url") {
    return (
      <form onSubmit={handleUrlSubmit}>
        <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f", marginBottom:6 }}>IAM Identity Center start URL</div>
        <div style={{ fontSize:11, color:"#86868b", marginBottom:8 }}>
          Found in <strong>AWS Console → IAM Identity Center → Settings → Identity Center instance ARN</strong>, or ask your AWS admin.
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input
            type="url"
            value={ssoUrl}
            onChange={e=>setSsoUrl(e.target.value)}
            placeholder="https://my-org.awsapps.com/start"
            onFocus={()=>setUrlFocus(true)}
            onBlur={()=>setUrlFocus(false)}
            style={{
              flex:1, padding:"10px 12px",
              background: urlFocus ? "#fff" : "#f5f5f7",
              border:`1.5px solid ${urlFocus ? "#0071e3" : "transparent"}`,
              borderRadius:10, fontSize:12, outline:"none",
              fontFamily:"ui-monospace,monospace", color:"#1d1d1f",
              boxShadow: urlFocus ? "0 0 0 4px rgba(0,113,227,0.12)" : "none",
            }}
          />
          <button
            type="submit"
            disabled={!ssoUrl.trim()}
            style={{
              padding:"10px 16px", borderRadius:10, border:"none",
              background: ssoUrl.trim() ? "#0071e3" : "#c7c7cc",
              color:"#fff", fontSize:12, fontWeight:600,
              cursor: ssoUrl.trim() ? "pointer" : "not-allowed",
            }}
          >Connect</button>
        </div>
        <button type="button" onClick={()=>setPhase("idle")} style={{ background:"none",border:"none",fontSize:11,color:"#86868b",cursor:"pointer",marginTop:8,padding:0 }}>← Back</button>
      </form>
    );
  }

  if (phase === "connecting") {
    return (
      <OAuthBadge provider="aws" color="#ff9900" icon="☁️">
        <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f" }}>Authenticating with IAM Identity Center<Spinner /></div>
        <div style={{ fontSize:11, color:"#86868b", marginTop:2 }}>{ssoUrl}</div>
      </OAuthBadge>
    );
  }

  if (phase === "roles") {
    return (
      <div>
        <OAuthBadge provider="aws" color="#ff9900" icon="☁️">
          <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f" }}>Choose account &amp; role</div>
          <div style={{ fontSize:11, color:"#86868b", marginTop:1 }}>{ssoUrl}</div>
        </OAuthBadge>
        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
          {MOCK_AWS_ACCOUNTS.map(acct => (
            <div key={acct.id} style={{
              padding:"10px 12px", borderRadius:10,
              border:`1.5px solid ${selectedAccount.id===acct.id ? "#ff9900" : "transparent"}`,
              background: selectedAccount.id===acct.id ? "#fff8f0" : "#f5f5f7",
              cursor:"pointer",
            }} onClick={()=>{ setSelectedAccount(acct); setSelectedRole(acct.roles[0]); }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f" }}>{acct.name}</div>
              <div style={{ fontSize:11, color:"#86868b", fontFamily:"ui-monospace,monospace" }}>{acct.id}</div>
              {selectedAccount.id===acct.id && (
                <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                  {acct.roles.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={e=>{ e.stopPropagation(); setSelectedRole(role); }}
                      style={{
                        padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:500,
                        border:`1.5px solid ${selectedRole===role ? "#ff9900" : "#d2d2d7"}`,
                        background: selectedRole===role ? "#fff3e6" : "#fff",
                        color: selectedRole===role ? "#cc4400" : "#1d1d1f",
                        cursor:"pointer",
                      }}
                    >{role}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRoleSelect}
          style={{
            width:"100%", marginTop:10, padding:"10px 0", borderRadius:10,
            border:"none", background:"#ff9900", color:"#fff",
            fontSize:13, fontWeight:600, cursor:"pointer",
          }}
        >
          Assume {selectedRole} in {selectedAccount.name}
        </button>
      </div>
    );
  }

  // done
  return (
    <OAuthBadge provider="aws" color="#ff9900" icon="✓">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:"#1d1d1f" }}>{selectedAccount.name} ({selectedAccount.id})</div>
          <div style={{ fontSize:11, color:"#86868b", marginTop:1, fontFamily:"ui-monospace,monospace" }}>{selectedRole}</div>
        </div>
        <ConnectedChip label="Connected" onDisconnect={handleDisconnect} />
      </div>
    </OAuthBadge>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0" }}>
      <div style={{ flex:1, height:1, background:"#e5e5ea" }} />
      <span style={{ fontSize:11, color:"#86868b", fontWeight:500 }}>or</span>
      <div style={{ flex:1, height:1, background:"#e5e5ea" }} />
    </div>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────────

let _inputId = 0;

function Input({ label, value, onChange, placeholder, type = "text", hint, mono }) {
  const [id] = useState(() => `inp-${++_inputId}`);
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom: 5 }}>
        <label htmlFor={id} style={{ fontSize: 12, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.01em" }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: "#86868b" }}>{hint}</span>}
      </div>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={isPassword && !show ? "password" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: "100%",
            padding: isPassword ? "10px 52px 10px 12px" : "10px 12px",
            background: focus ? "#fff" : "#f5f5f7",
            border: `1.5px solid ${focus ? "#0071e3" : "transparent"}`,
            borderRadius: 10, fontSize: 13, outline: "none",
            fontFamily: mono ? "ui-monospace, 'SF Mono', monospace" : "-apple-system, sans-serif",
            color: "#1d1d1f", transition: "all 0.15s",
            boxShadow: focus ? "0 0 0 4px rgba(0,113,227,0.12)" : "none",
            boxSizing: "border-box",
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={show ? "Hide" : "Show"}
            style={{
              position:"absolute", right: 12, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer",
              fontSize: 11, color:"#86868b", fontWeight: 500,
            }}
          >{show ? "Hide" : "Show"}</button>
        )}
      </div>
    </div>
  );
}

function SelectInput({ label, value, onChange, options, hint }) {
  const [id] = useState(() => `inp-${++_inputId}`);
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom: 5 }}>
        <label htmlFor={id} style={{ fontSize: 12, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.01em" }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: "#86868b" }}>{hint}</span>}
      </div>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width:"100%", padding:"10px 12px",
          background: focus ? "#fff" : "#f5f5f7",
          border: `1.5px solid ${focus ? "#0071e3" : "transparent"}`,
          borderRadius:10, fontSize:13, color:"#1d1d1f",
          cursor:"pointer", outline:"none",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          transition:"all 0.15s",
          boxShadow: focus ? "0 0 0 4px rgba(0,113,227,0.12)" : "none",
          boxSizing: "border-box",
        }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ number, title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <div style={{
          width:22, height:22, borderRadius:"50%",
          background:"#1d1d1f", color:"#fff",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, fontWeight:700, flexShrink:0,
          fontFamily:"ui-monospace,monospace",
        }}>{number}</div>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:"#1d1d1f", letterSpacing:"-0.02em" }}>{title}</div>
          {subtitle && <div style={{ fontSize:11, color:"#86868b", marginTop:1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{
        background:"#fff", borderRadius:16,
        border:"1px solid rgba(0,0,0,0.08)",
        padding:"18px 18px 12px",
        boxShadow:"0 1px 4px rgba(0,0,0,0.04)",
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Inline callout ────────────────────────────────────────────────────────────

function Tip({ children }) {
  return (
    <div style={{
      background:"#f0f7ff", borderRadius:8,
      padding:"9px 12px", marginBottom:14,
      fontSize:11.5, color:"#0071e3", lineHeight:1.6,
      display:"flex", gap:7, alignItems:"flex-start",
    }}>
      <span style={{ flexShrink:0, marginTop:1 }}>ⓘ</span>
      <span>{children}</span>
    </div>
  );
}

// ── Pattern picker ────────────────────────────────────────────────────────────

function PatternPicker({ selected, onSelect }) {
  const [search, setSearch] = useState("");
  const filtered = CDK_PATTERNS.filter(p =>
    p.label.toLowerCase().includes(search.toLowerCase()) ||
    p.desc.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <Tip>
        Patterns from <a href="https://github.com/cdk-patterns/serverless" target="_blank" rel="noreferrer" style={{ color:"#0071e3", fontWeight:600 }}>cdk-patterns/serverless</a> — community-maintained AWS CDK library. Each deploys a production-ready CloudFormation stack.
      </Tip>
      <div style={{ position:"relative", marginBottom:12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search patterns…"
          aria-label="Search patterns"
          style={{
            width:"100%", padding:"9px 12px 9px 32px",
            background:"#f5f5f7", border:"1.5px solid transparent",
            borderRadius:10, fontSize:13, outline:"none",
            fontFamily:"-apple-system,sans-serif", color:"#1d1d1f",
            boxSizing:"border-box",
          }}
        />
        <span aria-hidden="true" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#86868b", fontSize:13 }}>⌕</span>
      </div>
      <div
        style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, maxHeight:240, overflowY:"auto", paddingRight:2 }}
        role="listbox"
        aria-label="Deployment patterns"
      >
        {filtered.map(p => {
          const active = selected?.name === p.name;
          return (
            <button
              key={p.name}
              role="option"
              aria-selected={active}
              onClick={() => onSelect(p)}
              style={{
                textAlign:"left", padding:"11px 13px",
                border:`1.5px solid ${active ? "#0071e3" : "transparent"}`,
                borderRadius:12, cursor:"pointer",
                background: active ? "#f0f7ff" : "#f5f5f7",
                transition:"all 0.12s",
                boxShadow: active ? "0 0 0 3px rgba(0,113,227,0.12)" : "none",
              }}
            >
              <div style={{ fontSize:12, fontWeight:600, color: active ? "#0071e3" : "#1d1d1f", marginBottom:3 }}>{p.label}</div>
              <div style={{ fontSize:10.5, color:"#86868b", lineHeight:1.4 }}>{p.desc}</div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"20px 0", fontSize:13, color:"#86868b" }}>
            No patterns match "{search}"
          </div>
        )}
      </div>
      {filtered.length > 6 && (
        <p style={{ fontSize:11, color:"#c7c7cc", textAlign:"center", marginTop:6, marginBottom:0 }}>Scroll to see more</p>
      )}
    </div>
  );
}

// ── Deploy confirmation screen ────────────────────────────────────────────────

function CopyValue({ label, value, secret }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const display = secret && !visible ? "•".repeat(Math.min(value.length, 20)) : value;
  const copy = async () => {
    const ok = await copyToClipboard(value);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background:"#f5f5f7", borderRadius:9, marginBottom:6 }}>
      <span style={{ fontSize:11, color:"#86868b", fontWeight:600, minWidth:90, flexShrink:0 }}>{label}</span>
      <span style={{ flex:1, fontSize:11, fontFamily:"ui-monospace,monospace", color:"#1d1d1f", wordBreak:"break-all" }}>{display}</span>
      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
        {secret && (
          <button
            type="button"
            onClick={() => setVisible(v=>!v)}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"#86868b" }}
          >{visible ? "Hide" : "Show"}</button>
        )}
        <button
          type="button"
          onClick={copy}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color: copied ? "#34c759" : "#0071e3", fontWeight:600 }}
        >{copied ? "✓" : "Copy"}</button>
      </div>
    </div>
  );
}

function DeployScreen({ github, aws, pattern, onReset }) {
  const [cmdCopied, setCmdCopied] = useState(false);
  const scriptName = `deploy-${pattern.name}.sh`;
  const runCmd = `chmod +x ${scriptName} && ./${scriptName}`;
  const handleDownload = () => downloadScript(generateScript({ github, aws, pattern }), scriptName);
  const handleCopyCmd = async () => {
    const ok = await copyToClipboard(runCmd);
    if (ok) { setCmdCopied(true); setTimeout(()=>setCmdCopied(false),2000); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f7", display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 20px", fontFamily:"-apple-system,'SF Pro Display',sans-serif" }}>
      <style>{`* { box-sizing:border-box; } ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#d2d2d7;border-radius:2px}`}</style>
      <div style={{ width:"100%", maxWidth:480 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"#1d1d1f", margin:"0 auto 14px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🚀</div>
          <h1 style={{ fontSize:24, fontWeight:700, color:"#1d1d1f", margin:"0 0 6px", letterSpacing:"-0.03em" }}>Ready to deploy</h1>
          <p style={{ fontSize:13, color:"#86868b", margin:0 }}>{pattern.label} → {aws.region}</p>
        </div>

        {/* Download */}
        <div style={{ background:"#fff", borderRadius:16, border:"1px solid rgba(0,0,0,0.08)", padding:20, marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#86868b", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:12 }}>1 — Download Script</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"#1d1d1f" }}>{scriptName}</div>
              <div style={{ fontSize:11, color:"#86868b", marginTop:2 }}>{github.ssoConnected && aws.sessionToken ? "SSO credentials embedded — run immediately" : "Prompts for credentials at runtime"}</div>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              style={{ padding:"8px 16px", borderRadius:20, border:"none", background:"#0071e3", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", letterSpacing:"-0.01em" }}
            >
              Download
            </button>
          </div>
        </div>

        {/* Credentials */}
        <div style={{ background:"#fff", borderRadius:16, border:"1px solid rgba(0,0,0,0.08)", padding:20, marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#86868b", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:12 }}>2 — Credentials</div>
          {github.ssoConnected && aws.sessionToken ? (
            <p style={{ fontSize:12, color:"#34c759", margin:"0 0 12px", lineHeight:1.5, fontWeight:500 }}>
              Both GitHub and AWS authenticated via SSO — credentials are embedded in the script.
            </p>
          ) : (
            <p style={{ fontSize:12, color:"#86868b", margin:"0 0 12px", lineHeight:1.5 }}>
              {github.ssoConnected ? "GitHub token is embedded via SSO." : "The script will prompt for these. Copy each before running."}
            </p>
          )}
          {!github.ssoConnected && <CopyValue label="GitHub token" value={github.token} secret />}
          {github.ssoConnected && (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background:"#f0fdf4", borderRadius:9, marginBottom:6, border:"1px solid #34c75922" }}>
              <span style={{ fontSize:11, color:"#86868b", fontWeight:600, minWidth:90, flexShrink:0 }}>GitHub</span>
              <span style={{ flex:1, fontSize:11, color:"#1a8c41", fontWeight:500 }}>SSO — @{github.user?.login} · {github.org}</span>
            </div>
          )}
          <CopyValue label="AWS Key ID" value={aws.accessKeyId} />
          <CopyValue label="AWS Secret" value={aws.secretAccessKey} secret />
          {aws.sessionToken && <CopyValue label="Session Token" value={aws.sessionToken} secret />}
          {aws.sessionToken && (
            <p style={{ fontSize:11, color:"#86868b", margin:"6px 0 0", lineHeight:1.5 }}>
              IAM Identity Center credentials expire in ~1 hour. Refresh via SSO if the script fails with auth errors.
            </p>
          )}
        </div>

        {/* Run */}
        <div style={{ background:"#fff", borderRadius:16, border:"1px solid rgba(0,0,0,0.08)", padding:20, marginBottom:20, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#86868b", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:12 }}>3 — Run in Terminal</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1d1d1f", borderRadius:10, padding:"10px 14px" }}>
            <code style={{ flex:1, fontSize:11, color:"#f5f5f7", fontFamily:"ui-monospace,monospace" }}>{runCmd}</code>
            <button
              type="button"
              onClick={handleCopyCmd}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color: cmdCopied ? "#34c759" : "#86868b", fontWeight:600, flexShrink:0 }}
            >
              {cmdCopied ? "✓" : "Copy"}
            </button>
          </div>
          <p style={{ fontSize:11, color:"#86868b", margin:"10px 0 0", lineHeight:1.6 }}>
            Requires git, node 18+, aws-cli v2. CDK installed automatically if missing. ~3 min.
          </p>
        </div>

        <div style={{ textAlign:"center" }}>
          <button type="button" onClick={onReset} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#0071e3", fontWeight:500 }}>← Start over</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function IDPSetup() {
  const [github, setGithub] = useState({ token:"", org:"", repo:"", branch:"main", ssoConnected:false, user:null });
  const [aws, setAws] = useState({ region:"us-east-1", accessKeyId:"", secretAccessKey:"", sessionToken:null, accountId:null, accountName:null, role:null });
  const [pattern, setPattern] = useState(null);
  const [done, setDone] = useState(false);
  const [githubManual, setGithubManual] = useState(false);
  const [awsManual, setAwsManual] = useState(false);

  const ug = (k,v) => setGithub(p=>({...p,[k]:v}));
  const ua = (k,v) => setAws(p=>({...p,[k]:v}));

  const githubReady = github.ssoConnected
    ? (github.org && github.repo)
    : (github.token && github.org && github.repo);
  const awsReady = aws.sessionToken
    ? true
    : (aws.accessKeyId && aws.secretAccessKey);
  const ready = githubReady && awsReady && pattern;

  const reset = () => {
    setGithub({token:"",org:"",repo:"",branch:"main",ssoConnected:false,user:null});
    setAws({region:"us-east-1",accessKeyId:"",secretAccessKey:"",sessionToken:null,accountId:null,accountName:null,role:null});
    setPattern(null);
    setDone(false);
    setGithubManual(false);
    setAwsManual(false);
  };

  if (done) return <DeployScreen github={github} aws={aws} pattern={pattern} onReset={reset} />;

  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f7", fontFamily:"-apple-system,'SF Pro Display',sans-serif", padding:"32px 20px" }}>
      <style>{`
        * { box-sizing:border-box; }
        ::placeholder { color:#c7c7cc; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:#d2d2d7; border-radius:2px; }
        select option { font-family: ui-monospace, monospace; }
      `}</style>

      <div style={{ maxWidth:520, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:11, fontWeight:600, color:"#86868b", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:8 }}>Internal Developer Portal</div>
          <h1 style={{ fontSize:28, fontWeight:700, color:"#1d1d1f", margin:"0 0 4px", letterSpacing:"-0.03em" }}>New Service</h1>
          <p style={{ fontSize:14, color:"#86868b", margin:0 }}>Connect your tools and choose a deployment pattern.</p>
        </div>

        {/* GitHub */}
        <Section number="1" title="GitHub" subtitle="Where your source code lives">
          <GitHubSSOSection
            onConnect={({ token, org, user }) => { setGithub(p => ({ ...p, token, org, ssoConnected:true, user })); setGithubManual(false); }}
            onDisconnect={() => setGithub(p => ({ ...p, token:"", org:"", ssoConnected:false, user:null }))}
          />
          {!github.ssoConnected && (
            <>
              <OrDivider />
              {githubManual ? (
                <>
                  <Tip>
                    Generate a token at <strong>github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)</strong> with <code style={{background:"#dbeafe",padding:"1px 4px",borderRadius:3,fontSize:11}}>repo</code> and <code style={{background:"#dbeafe",padding:"1px 4px",borderRadius:3,fontSize:11}}>workflow</code> scopes.
                  </Tip>
                  <Input label="Personal Access Token" type="password" mono value={github.token} onChange={v=>ug("token",v)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
                    <Input label="Organisation / User" value={github.org} onChange={v=>ug("org",v)} placeholder="my-org" />
                    <Input label="Repository" value={github.repo} onChange={v=>ug("repo",v)} placeholder="my-app" />
                  </div>
                  <div style={{ marginTop:8 }}>
                    <Input label="Branch" value={github.branch} onChange={v=>ug("branch",v)} placeholder="main" hint="Default: main" />
                  </div>
                </>
              ) : (
                <button type="button" onClick={()=>setGithubManual(true)} style={{ background:"none", border:"none", fontSize:12, color:"#86868b", cursor:"pointer", padding:0, textDecoration:"underline", textDecorationColor:"#c7c7cc" }}>
                  Use a Personal Access Token instead
                </button>
              )}
            </>
          )}
          {github.ssoConnected && (
            <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Input label="Repository" value={github.repo} onChange={v=>ug("repo",v)} placeholder="my-app" />
              <Input label="Branch" value={github.branch} onChange={v=>ug("branch",v)} placeholder="main" hint="Default: main" />
            </div>
          )}
        </Section>

        {/* AWS */}
        <Section number="2" title="AWS" subtitle="Where your infrastructure will be deployed">
          <AWSSSOSection
            onConnect={({ region, accountId, accountName, role, accessKeyId, secretAccessKey, sessionToken }) => {
              setAws(p => ({ ...p, region, accountId, accountName, role, accessKeyId, secretAccessKey, sessionToken }));
              setAwsManual(false);
            }}
            onDisconnect={() => setAws(p => ({ ...p, accessKeyId:"", secretAccessKey:"", sessionToken:null, accountId:null, accountName:null, role:null }))}
          />
          {!aws.sessionToken && (
            <>
              <OrDivider />
              {awsManual ? (
                <>
                  <Tip>
                    Open <strong>AWS Console → IAM → Users → Security credentials → Create access key</strong> (choose CLI). The user needs <code style={{background:"#dbeafe",padding:"1px 4px",borderRadius:3,fontSize:11}}>AdministratorAccess</code> or CDK-scoped permissions.
                  </Tip>
                  <SelectInput label="Region" value={aws.region} onChange={v=>ua("region",v)} options={AWS_REGIONS} />
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
                    <Input label="Access Key ID" mono value={aws.accessKeyId} onChange={v=>ua("accessKeyId",v)} placeholder="AKIAIOSFODNN7EXAMPLE" />
                    <Input label="Secret Access Key" type="password" mono value={aws.secretAccessKey} onChange={v=>ua("secretAccessKey",v)} placeholder="wJalrXUtnFEMI…" />
                  </div>
                </>
              ) : (
                <button type="button" onClick={()=>setAwsManual(true)} style={{ background:"none", border:"none", fontSize:12, color:"#86868b", cursor:"pointer", padding:0, textDecoration:"underline", textDecorationColor:"#c7c7cc" }}>
                  Use Access Keys instead
                </button>
              )}
            </>
          )}
          {aws.sessionToken && (
            <div style={{ marginTop:10 }}>
              <SelectInput label="Region" value={aws.region} onChange={v=>ua("region",v)} options={AWS_REGIONS} />
            </div>
          )}
        </Section>

        {/* Pattern */}
        <Section number="3" title="Deployment Pattern" subtitle="Choose an AWS CDK architecture from cdk-patterns/serverless">
          <PatternPicker selected={pattern} onSelect={setPattern} />
        </Section>

        {/* CTA */}
        <button
          type="button"
          onClick={() => setDone(true)}
          disabled={!ready}
          style={{
            width:"100%", padding:"14px 0", borderRadius:14, border:"none",
            background: ready ? "#0071e3" : "#c7c7cc",
            color:"#fff", fontSize:15, fontWeight:600,
            cursor: ready ? "pointer" : "not-allowed",
            letterSpacing:"-0.01em", transition:"background 0.2s",
            marginTop:4,
          }}
        >
          {ready ? `Generate Deploy Script — ${pattern.label}` : "Complete all fields to continue"}
        </button>

        <p style={{ textAlign:"center", marginTop:14, fontSize:11, color:"#c7c7cc" }}>
          {github.ssoConnected || aws.sessionToken
            ? "SSO credentials are short-lived and scoped to this session."
            : "Credentials are entered at runtime — never embedded in any file."}
        </p>
      </div>
    </div>
  );
}
