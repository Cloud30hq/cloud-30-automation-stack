function toErrorMessage(error) {
  if (!error) return "unknown_error";
  return String(error.message || error).slice(0, 200);
}

export function normalizePhoneForWhatsApp(input) {
  const cleaned = String(input || "").replace(/[^0-9]/g, "");
  let waPhone = cleaned;

  if (/^2340\d{10}$/.test(cleaned)) {
    // Handle numbers entered as +234 (0) 8xx... by dropping the trunk zero.
    waPhone = `234${cleaned.slice(4)}`;
  } else if (/^0\d{10}$/.test(cleaned)) {
    waPhone = `234${cleaned.slice(1)}`;
  } else if (/^\d{10}$/.test(cleaned)) {
    // Local 10-digit phone without leading 0
    waPhone = `234${cleaned}`;
  }

  const isValid = /^234\d{10}$/.test(waPhone);
  const e164 = isValid ? `+${waPhone}` : "";

  return {
    e164,
    waPhone: isValid ? waPhone : "",
    isValid,
    reason: isValid ? "" : "invalid_nigerian_phone_format",
  };
}

export async function verifyViaWaMe(waPhone) {
  if (!waPhone) {
    return {
      checked: false,
      compatible: false,
      httpCode: 0,
      evidence: "missing_phone",
    };
  }

  const url = `https://wa.me/${waPhone}`;

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });

    const httpCode = response.status || 0;
    const compatible = httpCode >= 200 && httpCode < 400;

    return {
      checked: true,
      compatible,
      httpCode,
      evidence: `wa.me returned ${httpCode}`,
    };
  } catch (error) {
    return {
      checked: false,
      compatible: false,
      httpCode: 0,
      evidence: `wa.me check failed: ${toErrorMessage(error)}`,
    };
  }
}

function parseProviderCompatible(payload) {
  if (!payload || typeof payload !== "object") return null;

  const candidates = [
    payload.whatsappCompatible,
    payload.compatible,
    payload.valid,
    payload.registered,
    payload.exists,
    payload.isWhatsapp,
    payload.is_whatsapp,
    payload?.data?.whatsappCompatible,
    payload?.data?.compatible,
    payload?.data?.registered,
    payload?.result?.whatsappCompatible,
    payload?.result?.compatible,
    payload?.result?.registered,
  ];

  for (const value of candidates) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["yes", "true", "1", "registered", "valid"].includes(normalized)) return true;
      if (["no", "false", "0", "not_registered", "invalid"].includes(normalized)) return false;
    }
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }

  return null;
}

export async function verifyViaProvider(waPhone) {
  const apiUrl = process.env.WHATSAPP_VERIFY_API_URL;
  const apiKey = process.env.WHATSAPP_VERIFY_API_KEY;
  const providerName = process.env.WHATSAPP_VERIFY_PROVIDER || "CUSTOM_PROVIDER";

  if (!apiUrl) {
    return {
      available: false,
      checked: false,
      compatible: null,
      providerName,
      httpCode: 0,
      evidence: "provider_not_configured",
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ phone: waPhone }),
      signal: AbortSignal.timeout(10000),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const compatible = parseProviderCompatible(payload);
    const status = response.status || 0;

    return {
      available: true,
      checked: response.ok && typeof compatible === "boolean",
      compatible: typeof compatible === "boolean" ? compatible : false,
      providerName,
      httpCode: status,
      evidence:
        typeof compatible === "boolean"
          ? `${providerName} returned ${compatible ? "registered" : "not_registered"} (${status})`
          : `${providerName} response not parseable (${status})`,
    };
  } catch (error) {
    return {
      available: true,
      checked: false,
      compatible: false,
      providerName,
      httpCode: 0,
      evidence: `${providerName} check failed: ${toErrorMessage(error)}`,
    };
  }
}

export async function verifyWhatsAppCompatibility(input, options = {}) {
  const mode = String(options.mode || process.env.WHATSAPP_VERIFY_MODE || "HYBRID").toUpperCase();
  const checkedAt = new Date().toISOString();
  const normalized = normalizePhoneForWhatsApp(input);

  if (!normalized.isValid) {
    return {
      whatsappCompatible: "NO",
      verificationMethod: mode === "PROVIDER" ? "PROVIDER" : "HYBRID",
      verificationEvidence: normalized.reason,
      verificationHttpCode: 0,
      verificationCheckedAt: checkedAt,
      normalized,
    };
  }

  const waResult = mode === "PROVIDER" ? null : await verifyViaWaMe(normalized.waPhone);
  const providerResult = mode === "WA_ME" ? null : await verifyViaProvider(normalized.waPhone);

  let compatible = false;
  let verificationMethod = "HYBRID";
  let verificationHttpCode = 0;
  let verificationEvidence = "verification_failed";

  if (mode === "WA_ME") {
    compatible = Boolean(waResult?.checked && waResult.compatible);
    verificationMethod = "WA_ME";
    verificationHttpCode = waResult?.httpCode || 0;
    verificationEvidence = waResult?.evidence || "wa_me_check_failed";
  } else if (mode === "PROVIDER") {
    compatible = Boolean(providerResult?.checked && providerResult.compatible);
    verificationMethod = "PROVIDER";
    verificationHttpCode = providerResult?.httpCode || 0;
    verificationEvidence = providerResult?.evidence || "provider_check_failed";
  } else {
    const providerAuthoritative = Boolean(providerResult?.checked);
    if (providerAuthoritative) {
      compatible = Boolean(providerResult.compatible);
      verificationMethod = "HYBRID";
      verificationHttpCode = providerResult?.httpCode || waResult?.httpCode || 0;
      verificationEvidence = `${providerResult.evidence}; wa.me: ${waResult?.evidence || "not_run"}`;
    } else if (waResult?.checked) {
      compatible = Boolean(waResult.compatible);
      verificationMethod = "WA_ME";
      verificationHttpCode = waResult?.httpCode || 0;
      verificationEvidence = `${waResult.evidence}; provider: ${providerResult?.evidence || "not_configured"}`;
    } else {
      compatible = false; // fail closed
      verificationMethod = "HYBRID";
      verificationHttpCode = 0;
      verificationEvidence = `both_checks_unavailable; wa.me: ${waResult?.evidence || "not_run"}; provider: ${providerResult?.evidence || "not_run"}`;
    }
  }

  return {
    whatsappCompatible: compatible ? "YES" : "NO",
    verificationMethod,
    verificationEvidence,
    verificationHttpCode,
    verificationCheckedAt: checkedAt,
    normalized,
    waResult,
    providerResult,
  };
}
