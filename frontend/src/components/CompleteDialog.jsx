import { useState } from "react";

const METHODS = [
  ["CASH", "Dinheiro"],
  ["PIX", "Pix"],
  ["CARD", "Cartão"],
];

export default function CompleteDialog({ onConfirm, onClose, pending = false }) {
  const [method, setMethod] = useState("");
  return (
    <div className="dialog" role="group" aria-label="Forma de pagamento">
      <fieldset>
        <legend>Forma de pagamento</legend>
        {METHODS.map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="paymentMethod" value={value} checked={method === value} onChange={() => setMethod(value)} />{" "}
            {label}
          </label>
        ))}
      </fieldset>
      <div className="row-actions">
        <button type="button" className="btn solid" disabled={!method || pending} onClick={() => onConfirm(method)}>
          Registrar pagamento
        </button>
        <button type="button" className="btn" disabled={pending} onClick={onClose}>
          Voltar
        </button>
      </div>
    </div>
  );
}
