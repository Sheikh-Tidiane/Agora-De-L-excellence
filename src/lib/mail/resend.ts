import type { MailService } from "@/lib/mail";

/** Envoi par l'API HTTP de Resend (sans SDK). Activé par MAIL_PROVIDER="resend". */
export function createResendMailService(apiKey: string): MailService {
  return {
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });
      if (!response.ok) {
        // Le corps de la réponse peut citer le destinataire : seul le statut est remonté.
        throw new Error(`Resend a refusé l’envoi (HTTP ${response.status})`);
      }
    },
  };
}
