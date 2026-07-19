import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Loader2,
  Lock,
  Play,
  Plus,
  Shield,
  ShieldCheck,
  StopCircle,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  deleteCredential,
  listCredentials,
  saveCredential,
  startAutopilotRun,
  stopAutopilotRun,
  type AgentRun,
  type SavedCredential,
} from "@/lib/autopilot.client";

export function AutopilotPanel() {
  const { isDemo } = useAuth();
  const [creds, setCreds] = useState<SavedCredential[]>([]);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [targetUrl, setTargetUrl] = useState("");
  const [selectedCredId, setSelectedCredId] = useState<string | "">("");
  const [starting, setStarting] = useState(false);
  const [run, setRun] = useState<AgentRun | null>(null);

  useEffect(() => {
    if (isDemo) { setLoadingCreds(false); return; }
    listCredentials()
      .then(setCreds)
      .catch(() => {})
      .finally(() => setLoadingCreds(false));
  }, [isDemo]);

  const refresh = async () => {
    if (isDemo) return;
    setCreds(await listCredentials());
  };

  const onStart = async () => {
    if (!targetUrl) return;
    if (isDemo) { toast.error("Autopilot not available in demo mode"); return; }
    setStarting(true);
    try {
      const r = await startAutopilotRun({
        data: { targetUrl, credentialId: selectedCredId || null },
      });
      setRun(r);
      toast.success("Cloud browser ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const onStop = async () => {
    if (!run) return;
    try {
      await stopAutopilotRun({ data: { id: run.id } });
      toast.success("Session ended");
      setRun(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {/* Live view */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${run ? "animate-ping bg-emerald-400/70" : "bg-muted"}`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${run ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                />
              </span>
              {run ? "Live cloud browser" : "Cloud browser (idle)"}
            </div>
            {run && (
              <button
                onClick={onStop}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <StopCircle className="h-3.5 w-3.5" />
                End session
              </button>
            )}
          </div>
          <div className="aspect-[16/10] bg-background/60">
            {run?.live_view_url ? (
              <iframe
                key={run.id}
                src={run.live_view_url}
                title="Live cloud browser"
                className="h-full w-full"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                allow="clipboard-read; clipboard-write"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Globe className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold">No active session</div>
                <div className="max-w-sm text-xs text-muted-foreground">
                  Enter a rental site URL, optionally attach saved credentials, and the agent will open a
                  cloud browser you can watch in real time — you can take over at any moment.
                </div>
              </div>
            )}
          </div>
          <AnimatePresence>
            {run && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border/60"
              >
                <div className="max-h-40 space-y-1.5 overflow-auto p-3 font-mono text-[11px] text-muted-foreground">
                  {run.log.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="opacity-60">{new Date(l.ts).toLocaleTimeString()}</span>
                      <span>{l.message}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Start form */}
        {!run && (
          <div className="rounded-3xl border border-border/60 bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Start a session
            </div>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Rental site URL</span>
                <input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://www.immobilienscout24.de/…"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  Use saved credentials (optional)
                </span>
                <select
                  value={selectedCredId}
                  onChange={(e) => setSelectedCredId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">None — I'll sign in manually</option>
                  {creds.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || c.host} · {c.username}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={onStart}
                disabled={!targetUrl || starting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {starting ? "Starting cloud browser…" : "Start session"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right column: credential vault + trust */}
      <div className="space-y-4">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            End-to-end encrypted
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Passwords are sealed with AES-256-GCM before they hit our database. Only your session can decrypt
            them — briefly, in memory — to type into the browser. We never log or replay them.
          </p>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Credential vault
            </div>
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-accent"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>

          {loadingCreds ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : creds.length === 0 && !showAdd ? (
            <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
              No credentials saved yet.
            </div>
          ) : (
            <div className="space-y-2">
              {creds.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{c.label || c.host}</div>
                    <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <UserIcon className="h-3 w-3" />
                      {c.username}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (isDemo) { toast.error("Not available in demo mode"); return; }
                      await deleteCredential({ data: { id: c.id } });
                      await refresh();
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <AddCredentialForm
                  onSaved={async () => {
                    await refresh();
                    setShowAdd(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            The agent never submits an application on your behalf. When you're ready, review the final form
            in the live view and click submit yourself.
          </span>
        </div>
      </div>
    </div>
  );
}

function AddCredentialForm({ onSaved }: { onSaved: () => void }) {
  const { isDemo } = useAuth();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!url || !username || !password) return;
    if (isDemo) { toast.error("Not available in demo mode"); return; }
    setBusy(true);
    try {
      await saveCredential({ data: { url, label: label || undefined, username, password } });
      toast.success("Credential encrypted and saved");
      setUrl("");
      setLabel("");
      setUsername("");
      setPassword("");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-background/60 p-3">
      <input
        placeholder="Site URL (https://…)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      <input
        placeholder="Label (optional)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      <input
        placeholder="Email or username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-60"
      >
        {busy ? "Encrypting…" : "Encrypt & save"}
      </button>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Encrypted with AES-256-GCM using a key we never expose. Only decrypted in memory during your run.
      </p>
    </div>
  );
}
