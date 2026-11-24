// Lista as mensagens de error.details de um 400 VALIDATION_ERROR ({ campo: ["mensagem", ...] }).
export default function FieldErrors({ error }) {
  const details = error?.details;
  if (!details || Array.isArray(details) || typeof details !== "object") return null;
  const messages = [...new Set(Object.values(details).flat().filter((m) => typeof m === "string"))];
  if (messages.length === 0) return null;
  return (
    <ul className="conflicts field-errors">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}
