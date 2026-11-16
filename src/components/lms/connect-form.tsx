"use client";

import { useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { connectLmsAction } from "@/server/actions/lms";
import { ExtensionLink } from "./extension-link";

type Provider = "CANVAS" | "MOODLE";
type AuthKind = "extension" | "token" | "cookie" | "password";

/** Formulario para conectar el LMS. La credencial viaja una vez al servidor y no vuelve a mostrarse. */
export function LmsConnectForm({
  defaultProvider = "CANVAS",
  defaultBaseUrl = "",
  defaultAuthKind = "token",
}: {
  defaultProvider?: Provider;
  defaultBaseUrl?: string;
  defaultAuthKind?: AuthKind;
}) {
  const { state, pending, onSubmit } = useActionForm(connectLmsAction);
  const [provider, setProvider] = useState<Provider>(defaultProvider);
  const [authKind, setAuthKind] = useState<AuthKind>(defaultAuthKind);
  const t = TEXT.lms.connection;
  const kinds: AuthKind[] = provider === "CANVAS" ? ["token", "extension", "cookie"] : ["token", "password"];
  const kind = kinds.includes(authKind) ? authKind : "token";

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" aria-label={t.title}>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.provider} htmlFor="lms-provider">
          <Select id="lms-provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            <option value="CANVAS">{t.providers.CANVAS}</option>
            <option value="MOODLE">{t.providers.MOODLE}</option>
          </Select>
        </Field>
        <Field label={t.authKind} htmlFor="lms-auth">
          <Select id="lms-auth" name="authKind" value={kind} onChange={(e) => setAuthKind(e.target.value as AuthKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {t.authKinds[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t.baseUrl} htmlFor="lms-url" hint={t.baseUrlHint}>
        <Input id="lms-url" name="baseUrl" required defaultValue={defaultBaseUrl} placeholder="https://campus.tu-universidad.edu.ar" autoComplete="url" />
      </Field>
      {kind === "token" && (
        <Field label={t.tokenLabel} htmlFor="lms-token" hint={t.tokenHint}>
          <Input id="lms-token" name="token" type="password" required autoComplete="off" />
        </Field>
      )}
      {kind === "cookie" && (
        <Field label={t.cookieLabel} htmlFor="lms-cookie" hint={t.cookieHint}>
          <Textarea id="lms-cookie" name="cookie" required className="min-h-20 font-mono text-xs" autoComplete="off" />
        </Field>
      )}
      {kind === "password" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.username} htmlFor="lms-user">
            <Input id="lms-user" name="username" required autoComplete="username" />
          </Field>
          <Field label={t.password} htmlFor="lms-pass" hint={t.passwordHint}>
            <Input id="lms-pass" name="password" type="password" required autoComplete="current-password" />
          </Field>
        </div>
      )}
      <p className="text-xs text-muted">{t.privacy}</p>
      {kind === "extension" ? (
        <ExtensionLink baseUrlInputId="lms-url" />
      ) : (
        <PendingButton pending={pending} pendingText={t.connecting}>
          {t.connect}
        </PendingButton>
      )}
    </form>
  );
}
