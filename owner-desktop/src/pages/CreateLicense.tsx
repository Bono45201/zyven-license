import { Check, Copy, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { CreateLicenseResult, ProductId, ProductScope } from "../types";
import { productName } from "../lib/format";

export default function CreateLicensePage({
  scope,
  busy,
  onCreate,
  onCopy
}: {
  scope: ProductScope;
  busy: boolean;
  onCreate: (payload: {
    product: ProductId;
    customer: string;
    plan: string;
    deviceId: string;
    expiry: string;
  }) => Promise<CreateLicenseResult>;
  onCopy: (value: string) => Promise<void>;
}) {
  const [product, setProduct] = useState<ProductId>(
    scope === "ZYVEN-GP-TOOL" ? "ZYVEN-GP-TOOL" : "ZYVEN-SOUND-TOOL"
  );
  const [customer, setCustomer] = useState("");
  const [plan, setPlan] = useState("Lifetime");
  const [deviceId, setDeviceId] = useState("AUTO");
  const [expiry, setExpiry] = useState("LIFETIME");
  const [result, setResult] = useState<CreateLicenseResult | null>(null);

  useEffect(() => {
    if (scope === "ZYVEN-GP-TOOL" || scope === "ZYVEN-SOUND-TOOL") setProduct(scope);
  }, [scope]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !customer.trim()) return;
    const created = await onCreate({
      product,
      customer: customer.trim(),
      plan: plan.trim() || "Lifetime",
      deviceId: deviceId.trim() || "AUTO",
      expiry: expiry.trim() || "LIFETIME"
    });
    setResult(created);
  }

  function reset() {
    setCustomer("");
    setPlan("Lifetime");
    setDeviceId("AUTO");
    setExpiry("LIFETIME");
    setResult(null);
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>Create License</h1>
          <p>Generate a new server-signed key and bind it to a Zyven product.</p>
        </div>
      </section>

      <section className="create-grid">
        <form className="panel create-form" onSubmit={submit}>
          <div className="panel-header">
            <div>
              <strong>License details</strong>
              <span>The server generates the key. Nothing is fabricated locally.</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field full">
              <label>Product</label>
              <div className="product-picker">
                <button
                  type="button"
                  className={product === "ZYVEN-SOUND-TOOL" ? "selected" : ""}
                  onClick={() => setProduct("ZYVEN-SOUND-TOOL")}
                >
                  <div className="product-mark">S</div>
                  <div>
                    <strong>Zyven Sound Tool</strong>
                    <span>ZYVEN-SOUND-TOOL</span>
                  </div>
                  {product === "ZYVEN-SOUND-TOOL" ? <Check size={17} /> : null}
                </button>
                <button
                  type="button"
                  className={product === "ZYVEN-GP-TOOL" ? "selected" : ""}
                  onClick={() => setProduct("ZYVEN-GP-TOOL")}
                >
                  <div className="product-mark">G</div>
                  <div>
                    <strong>Zyven GP Tool</strong>
                    <span>ZYVEN-GP-TOOL</span>
                  </div>
                  {product === "ZYVEN-GP-TOOL" ? <Check size={17} /> : null}
                </button>
              </div>
            </div>

            <div className="form-field full">
              <label htmlFor="customer">Customer / key name</label>
              <input
                id="customer"
                className="text-input"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Customer"
                maxLength={80}
                autoFocus
              />
            </div>

            <div className="form-field">
              <label htmlFor="plan">Plan</label>
              <input
                id="plan"
                className="text-input"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Lifetime"
                maxLength={40}
              />
            </div>

            <div className="form-field">
              <label htmlFor="device">Device ID</label>
              <input
                id="device"
                className="text-input mono"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                placeholder="AUTO"
              />
              <span className="field-help">AUTO binds on first successful customer login. Use * only when intentionally allowing any device.</span>
            </div>

            <div className="form-field full">
              <label htmlFor="expiry">Expiry</label>
              <div className="inline-input-actions">
                <input
                  id="expiry"
                  className="text-input"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value.toUpperCase())}
                  placeholder="LIFETIME or yyyy-MM-dd"
                />
                <button className="secondary-button" type="button" onClick={() => setExpiry("LIFETIME")}>Lifetime</button>
              </div>
              <span className="field-help">Accepted values: LIFETIME or a date such as 2027-12-31.</span>
            </div>
          </div>

          <div className="form-footer">
            <button className="secondary-button" type="button" onClick={reset}>
              <RotateCcw size={15} /> Reset
            </button>
            <button className="primary-button" type="submit" disabled={busy || !customer.trim()}>
              {busy ? <span className="button-spinner" /> : <KeyRound size={16} />}
              {busy ? "Creating…" : "Create key"}
            </button>
          </div>
        </form>

        <aside className="panel generated-panel">
          <div className="panel-header">
            <div>
              <strong>Generated key</strong>
              <span>Full key is shown only after creation and encrypted locally for Owner access.</span>
            </div>
          </div>

          {result ? (
            <div className="generated-result">
              <div className="success-badge"><ShieldCheck size={17} /> License created</div>
              <div className="result-customer">{result.record.Customer}</div>
              <div className="result-product">{productName(result.record.Product)}</div>

              <div className="generated-key-box mono">{result.licenseKey}</div>

              <button className="primary-button full" type="button" onClick={() => onCopy(result.licenseKey)}>
                <Copy size={16} /> Copy license key
              </button>

              <div className="result-meta">
                <div><span>License ID</span><strong className="mono">{result.record.LicenseId}</strong></div>
                <div><span>Status</span><strong>{result.record.Status}</strong></div>
                <div><span>Device</span><strong className="mono">{result.record.DeviceId}</strong></div>
                <div><span>Expiry</span><strong>{result.record.ExpiresUtc ? new Date(result.record.ExpiresUtc * 1000).toLocaleDateString() : "Lifetime"}</strong></div>
              </div>

              <div className="security-callout">
                Save the copied key for the customer. The license server stores a fingerprint rather than the original full key.
              </div>
            </div>
          ) : (
            <div className="generated-empty">
              <KeyRound size={26} />
              <strong>No key generated yet</strong>
              <span>Complete the form and create the license. The result will appear here immediately.</span>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
