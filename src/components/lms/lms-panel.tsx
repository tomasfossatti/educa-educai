import { Card, Notice, Section } from "@/components/ui/layout";
import { ConfirmSubmit } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { disconnectLmsAction } from "@/server/actions/lms";
import { LmsAssistantChat } from "./assistant-chat";
import { LmsConnectForm } from "./connect-form";

interface Connection {
  provider: "CANVAS" | "MOODLE";
  baseUrl: string;
  accountName: string | null;
  viaExtension?: boolean;
}

/** Pantalla del asistente: la conexión con el LMS arriba y el chat abajo. Sirve a docentes y estudiantes. */
export function LmsPanel({
  connection,
  welcome,
  extension,
}: {
  connection: Connection | null;
  welcome: string;
  extension?: { stage: string; error: string | null };
}) {
  const t = TEXT.lms.connection;
  const pendingExtension = !connection && (extension?.stage === "linked" || extension?.stage === "error");
  return (
    <div className="space-y-8">
      <Section title={t.title}>
        {connection ? (
          <Card className="space-y-3">
            <Notice tone="success">{t.connectedAs(t.providers[connection.provider], connection.accountName ?? "tu cuenta", connection.baseUrl)}</Notice>
            {connection.viaExtension && <p className="text-xs text-muted">{t.viaExtension}</p>}
            <details>
              <summary className="cursor-pointer text-sm text-primary">{t.reconnect}</summary>
              <div className="mt-4">
                <LmsConnectForm defaultProvider={connection.provider} defaultBaseUrl={connection.baseUrl} defaultAuthKind={connection.viaExtension ? "extension" : "token"} />
              </div>
            </details>
            <form action={disconnectLmsAction}>
              <ConfirmSubmit variant="ghost" size="sm" message={`${t.disconnect}?`}>
                {t.disconnect}
              </ConfirmSubmit>
            </form>
          </Card>
        ) : (
          <Card className="space-y-4">
            <p className="text-sm text-muted">{t.notConnected}</p>
            {extension?.stage === "error" && extension.error && <Notice tone="error">{TEXT.lms.extension.failed(extension.error)}</Notice>}
            {extension?.stage === "linked" && <Notice tone="attention">{TEXT.lms.extension.linked}</Notice>}
            <LmsConnectForm defaultAuthKind={pendingExtension ? "extension" : "token"} />
          </Card>
        )}
      </Section>
      <Section title={TEXT.lms.title}>
        <LmsAssistantChat welcome={welcome} />
      </Section>
    </div>
  );
}
