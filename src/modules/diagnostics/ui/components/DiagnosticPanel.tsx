import { X, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { usePlatformDiagnostics } from "@/modules/diagnostics/ui/hooks/usePlatformDiagnostics";

interface DiagnosticPanelProps {
  onClose: () => void;
}

export function DiagnosticPanel({ onClose }: DiagnosticPanelProps) {
  const { clariprintTest, aiTest, testClariprint, testAiProvider } = usePlatformDiagnostics();

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
                  <StatusIcon success={clariprintTest.data.authenticated} />
                )}
              </div>
              <button
                onClick={() => void testClariprint()}
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
                {/* Résultat du test */}
                <div
                  className={`rounded-lg p-3 border ${
                    clariprintTest.data.authenticated
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      clariprintTest.data.authenticated ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {clariprintTest.data.summary}
                  </p>
                  {clariprintTest.data.httpStatus && (
                    <p className="text-xs text-gray-500 mt-1">
                      HTTP {clariprintTest.data.httpStatus}
                    </p>
                  )}
                </div>

                {clariprintTest.data.checks.map((check, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                    <span>{check.status === 'ok' ? "✅" : check.status === 'skipped' ? "⏭️" : "❌"}</span>
                    <div><span className="font-medium">{check.name}</span>{check.details && <span className="text-gray-400"> — {check.details}</span>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── TEST FOURNISSEUR IA ─── */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h3 className="font-semibold text-gray-900">
                  Fournisseur IA{aiTest.data ? ` · ${aiTest.data.provider}` : ''}
                </h3>
                {aiTest.data && (
                  <StatusIcon success={aiTest.data.reachable} />
                )}
              </div>
              <button
                onClick={() => void testAiProvider()}
                disabled={aiTest.loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {aiTest.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {aiTest.loading ? "Test en cours..." : "Tester l’IA"}
              </button>
            </div>

            {!aiTest.data && !aiTest.loading && !aiTest.error && (
              <p className="text-sm text-gray-400 italic">
                Teste la configuration du fournisseur IA actif côté serveur.
              </p>
            )}

            {aiTest.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                ❌ Erreur réseau : {aiTest.error}
              </div>
            )}

            {aiTest.data && (
              <div className="space-y-3">
                {/* Résumé */}
                <div
                  className={`rounded-lg p-3 border ${
                    aiTest.data.reachable
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      aiTest.data.reachable ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {aiTest.data.summary}
                  </p>
                  {aiTest.data.responsePreview && (
                    <p className="text-xs text-green-600 mt-1">
                      Réponse : "{aiTest.data.responsePreview}"
                    </p>
                  )}
                </div>

                {/* Checks détaillés */}
                {aiTest.data.checks.length > 0 && (
                  <div className="space-y-1">
                    {aiTest.data.checks.map((check, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                        <span>{check.status === 'ok' ? "✅" : check.status === 'skipped' ? "⏭️" : "❌"}</span>
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
              <strong>l’environnement du serveur API</strong>.
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
