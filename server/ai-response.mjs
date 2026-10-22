export function aiFailure(
  message,
  statusCode = 502,
  code = "AI_RESPONSE_INVALID",
) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
    publicMessage: message,
  });
}
export function aiResponseText(data, provider) {
  let output;
  if (provider === "gemini") {
    const candidate = data.candidates?.[0];
    if (
      data.promptFeedback?.blockReason ||
      ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"].includes(
        candidate?.finishReason,
      )
    )
      throw aiFailure(
        "Le service IA a bloqué cette réponse. Reformulez la demande ou utilisez le brouillon local.",
      );
    output = candidate?.content?.parts
      ?.filter((p) => !p.thought)
      .map((p) => p.text || "")
      .join("");
    if (candidate?.finishReason === "MAX_TOKENS")
      throw aiFailure(
        "L’IA a atteint sa limite avant de fournir du texte. Réessayez avec une demande plus courte ou un autre modèle.",
        502,
        "AI_OUTPUT_TRUNCATED",
      );
  } else {
    const content = data.choices?.[0]?.message?.content;
    output = Array.isArray(content)
      ? content
          .filter((p) => ["text", "output_text"].includes(p.type))
          .map((p) =>
            typeof p.text === "string" ? p.text : p.text?.value || "",
          )
          .join("\n")
      : content;
    if (!output && typeof data.output_text === "string")
      output = data.output_text;
    if (!output && typeof data.choices?.[0]?.text === "string")
      output = data.choices[0].text;
    if (!output && Array.isArray(data.output))
      output = data.output
        .filter((p) => p.type === "message")
        .flatMap((p) => p.content || [])
        .filter((p) => ["output_text", "text"].includes(p.type))
        .map((p) => (typeof p.text === "string" ? p.text : p.text?.value || ""))
        .join("\n");
    if (data.choices?.[0]?.message?.refusal)
      throw aiFailure(
        "Le service IA a refusé cette demande. Reformulez-la ou utilisez le brouillon local.",
      );
    if (
      data.choices?.[0]?.finish_reason === "length" ||
      data.incomplete_details?.reason === "max_output_tokens"
    )
      throw aiFailure(
        "L’IA a atteint sa limite avant de terminer le texte.",
        502,
        "AI_OUTPUT_TRUNCATED",
      );
    if (!output && data.choices?.[0]?.message?.tool_calls?.length)
      throw aiFailure(
        "Ce modèle a proposé un appel d’outil au lieu d’un texte. Choisissez un modèle de rédaction.",
        502,
        "AI_TEXT_EXPECTED",
      );
  }
  if (typeof output !== "string" || !output.trim())
    throw aiFailure(
      "Le service IA a répondu sans texte. Réessayez, changez de modèle ou utilisez le brouillon local. Aucun contenu n’a été publié.",
      502,
      "AI_EMPTY_RESPONSE",
    );
  return output.trim();
}

export async function requestAiText({
  fetcher = fetch,
  url,
  headers,
  body,
  provider,
  maxLength = 6000,
  timeout = 45000,
}) {
  let input = structuredClone(body),
    emptyRetried = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetcher(url, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
        redirect: "error",
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      throw aiFailure(
        "Service IA indisponible ou trop lent. Votre texte reste conservé.",
        504,
        "AI_UNAVAILABLE",
      );
    }
    let raw = "";
    const decoder = new TextDecoder();
    for await (const chunk of response.body || []) {
      raw += decoder.decode(chunk, { stream: true });
      if (raw.length > 200000) throw aiFailure("Réponse IA trop volumineuse.");
    }
    raw += decoder.decode();
    if (!response.ok) {
      // Some reasoning models require the newer token-budget parameter.
      if (
        response.status === 400 &&
        attempt < 2 &&
        input.max_tokens &&
        /max_completion_tokens/i.test(raw) &&
        /max_tokens/i.test(raw)
      ) {
        input.max_completion_tokens = input.max_tokens;
        delete input.max_tokens;
        continue;
      }
      if (
        response.status === 400 &&
        attempt < 2 &&
        input.temperature !== undefined &&
        /temperature/i.test(raw) &&
        /unsupported|not supported|does not support/i.test(raw)
      ) {
        delete input.temperature;
        continue;
      }
      throw aiFailure(
        response.status === 429
          ? "Quota ou débit du service IA atteint. Réessayez plus tard ; votre texte reste conservé."
          : `Le service IA répond HTTP ${response.status}. Vérifiez la clé et le modèle. Votre texte reste conservé.`,
        502,
        "AI_PROVIDER_ERROR",
      );
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw aiFailure("Réponse IA illisible. Votre texte reste conservé.");
    }
    try {
      return aiResponseText(data, provider).slice(0, maxLength);
    } catch (error) {
      if (
        !emptyRetried &&
        attempt < 2 &&
        ["AI_EMPTY_RESPONSE", "AI_OUTPUT_TRUNCATED"].includes(error.code)
      ) {
        emptyRetried = true;
        if (provider === "gemini")
          input.generationConfig = {
            ...input.generationConfig,
            maxOutputTokens: 8192,
          };
        else {
          const key = input.max_completion_tokens
            ? "max_completion_tokens"
            : "max_tokens";
          input[key] = 8192;
        }
        continue;
      }
      throw error;
    }
  }
  throw aiFailure(
    "Le modèle choisi n’a pas fourni de texte exploitable. Choisissez un autre modèle ; votre brouillon est conservé.",
  );
}
