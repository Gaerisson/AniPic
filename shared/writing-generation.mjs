// Responses belong to the animal, mode and text that initiated their request.
// Invalidation also protects asynchronous history refreshes after a response.
export function createWritingGeneration() {
  let sequence = 0;
  return {
    invalidate() {
      sequence++;
    },
    async run({ request, onStart, onResult, onError, onFinish }) {
      const token = ++sequence,
        isCurrent = () => token === sequence;
      onStart();
      try {
        const result = await request();
        if (isCurrent()) await onResult(result, isCurrent);
      } catch (error) {
        if (isCurrent()) onError(error);
      } finally {
        if (isCurrent()) onFinish();
      }
    },
  };
}
