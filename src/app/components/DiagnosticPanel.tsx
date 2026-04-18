import { useState } from "react";
import { X, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

interface DiagnosticPanelProps {
  onClose: () => void;
}

interface TestResult {
  loading: boolean;
  data: any | null;
  error: string | null;
}

export function DiagnosticPanel({ onClose }: DiagnosticPanelProps) {
  const [clariprintTest, setClariprintTest] = useState<TestResult>({
    loading: false,
    data: null,
    error: null,
  });
  const [claudeTest, setClaudeTest] = useState<TestResult>({
    loading: false,
    data: null,
    error: null,
  });

  const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${publicAnonKey}`,
  };

  const testClariprint = async () => {
    setClariprintTest({ loading: true, data: null, error: null });
    try {
      const res = await fetch(`${baseUrl}/clariprint-test`, { headers });
      const data = await res.json();
      setClariprintTest({ loading: false, data, error: null });
    } catch (e) {
      setClariprintTest({ loading: false, data: null, error: String(e) });
    }
  };

  const testClaude = async () => {
    setClaudeTest({ loading: true, data: null, error: null });
    try {
      const res = await fetch(`${baseUrl}/claude-test`, { headers });
      const data = await res.json();
      setClaudeTest({ loading: false, data, error: null });
    } catch (e) {
      setClaudeTest({ loading: false, data: null, error: String(e) });
    }
  };

  const StatusIcon = ({ success }: { success: boolean | null }) => {
    if (success === null) return null;
    return success ? (
      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🔧 Diagnostic des connexions</h2>
            <p className="text-xs text-gray-500 mt-0.5">Teste la connexion aux APIs externes</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ─── TEST CLARIPRINT ─── */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🖨️</span>
                <h3 className="font-semibold text-gray-900">API Clariprint</h3>
                {clariprintTest.data && (
                  <StatusIcon success={clariprintTest.data.success} />
                )}
              </div>
              <button
                onClick={testClariprint}
                disabled={clariprintTest.loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {clariprintTest.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {clariprintTest.loading ? "Test en cours..." : "Tester CheckAuth"}
              </button>
            </div>

            {!clariprintTest.data && !clariprintTest.loading && !clariprintTest.error && (
              <p className="text-sm text-gray-400 italic">
                Clique sur "Tester CheckAuth" pour vérifier tes credentials Clariprint.
              </p>
            )}

            {clariprintTest.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                ❌ Erreur réseau : {clariprintTest.error}
              </div>
            )}

            {clariprintTest.data && (
              <div className="space-y-3">
                {/* Variables d'environnement */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Secrets Supabase
                  </p>
                  {Object.entries(clariprintTest.data.environment || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-600 font-mono">{key}</span>
                      <span className={String(val).startsWith("✅") ? "text-green-600" : "text-red-600"}>
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Résultat du test */}
                <div
                  className={`rounded-lg p-3 border ${
                    clariprintTest.data.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      clariprintTest.data.success ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {clariprintTest.data.message || clariprintTest.data.error}
                  </p>
                  {clariprintTest.data.httpStatus && (
                    <p className="text-xs text-gray-500 mt-1">
                      HTTP {clariprintTest.data.httpStatus}
                    </p>
                  )}
                </div>

                {/* Réponse brute (accordéon) */}
                {clariprintTest.data.rawResponse && (
                  <details>
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-700">
                      Réponse brute Clariprint
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-900 text-green-400 rounded-lg text-xs overflow-auto max-h-40">
                      {clariprintTest.data.parsedResponse
                        ? JSON.stringify(clariprintTest.data.parsedResponse, null, 2)
                        : clariprintTest.data.rawResponse}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* ─── TEST CLAUDE ─── */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h3 className="font-semibold text-gray-900">API Claude (Anthropic)</h3>
                {claudeTest.data && (
                  <StatusIcon success={claudeTest.data.summary?.startsWith("✅")} />
                )}
              </div>
              <button
                onClick={testClaude}
                disabled={claudeTest.loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {claudeTest.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {claudeTest.loading ? "Test en cours..." : "Tester Claude"}
              </button>
            </div>

            {!claudeTest.data && !claudeTest.loading && !claudeTest.error && (
              <p className="text-sm text-gray-400 italic">
                Clique sur "Tester Claude" pour vérifier la clé API Anthropic.
              </p>
            )}

            {claudeTest.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                ❌ Erreur réseau : {claudeTest.error}
              </div>
            )}

            {claudeTest.data && (
              <div className="space-y-3">
                {/* Variables d'environnement */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Secrets Supabase
                  </p>
                  {Object.entries(claudeTest.data.environment || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-600 font-mono">{key}</span>
                      <span className={String(val).startsWith("✅") ? "text-green-600" : "text-red-600"}>
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Résumé */}
                <div
                  className={`rounded-lg p-3 border ${
                    claudeTest.data.summary?.startsWith("✅")
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      claudeTest.data.summary?.startsWith("✅") ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {claudeTest.data.summary}
                  </p>
                  {claudeTest.data.claudeResponse && (
                    <p className="text-xs text-green-600 mt-1">
                      Réponse Claude : "{claudeTest.data.claudeResponse}"
                    </p>
                  )}
                </div>

                {/* Checks détaillés */}
                {claudeTest.data.checks?.length > 0 && (
                  <div className="space-y-1">
                    {claudeTest.data.checks.map((check: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                        <span>{check.status?.startsWith("✅") ? "✅" : "❌"}</span>
                        <div>
                          <span className="font-medium">{check.name}</span>
                          {check.details && <span className="text-gray-400"> — {check.details}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Info ─── */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Les secrets sont à configurer dans{" "}
              <strong>Supabase → Edge Functions → Secrets</strong>.
              Les credentials Clariprint seront fournis par Optimproject.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
