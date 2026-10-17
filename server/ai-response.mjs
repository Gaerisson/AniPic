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
    if (!output?.trim() && candidate?.finishReason === "MAX_TOKENS")
      throw aiFailure(
        "L’IA a atteint sa limite avant de fournir du texte. Réessayez avec une demande plus courte ou un autre modèle.",
      );
  } else {
    const content = data.choices?.[0]?.message?.content;
    output = Array.isArray(content)
      ? content
          .filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("\n")
      : content;
    if (data.choices?.[0]?.message?.refusal)
      throw aiFailure(
        "Le service IA a refusé cette demande. Reformulez-la ou utilisez le brouillon local.",
      );
  }
  if (typeof output !== "string" || !output.trim())
    throw aiFailure(
      "Le service IA a répondu sans texte. Réessayez, changez de modèle ou utilisez le brouillon local. Aucun contenu n’a été publié.",
    );
  return output.trim();
}
