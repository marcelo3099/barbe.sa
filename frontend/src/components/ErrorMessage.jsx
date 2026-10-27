export default function ErrorMessage({ error }) {
  if (!error) return null;
  return (
    <p role="alert" className="error">
      {error.message}
    </p>
  );
}
