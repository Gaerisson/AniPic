import { InferenceSession, Tensor } from "onnxruntime-node";
// Minimal ONNX identity graph. This exercises the CPU native binding without a model download.
const variable = (n) => {
  const b = [];
  do {
    b.push((n & 127) | (n > 127 ? 128 : 0));
    n >>>= 7;
  } while (n);
  return Buffer.from(b);
};
const message = (field, value) => {
  const b = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([variable((field << 3) | 2), variable(b.length), b]);
};
const integer = (field, value) =>
  Buffer.concat([variable(field << 3), variable(value)]);
const valueInfo = (name) =>
  message(1, name).toString("hex") +
  message(
    2,
    message(
      1,
      Buffer.concat([integer(1, 1), message(2, message(1, integer(1, 1)))]),
    ),
  ).toString("hex");
const graph = Buffer.concat([
  message(
    1,
    Buffer.concat([message(1, "X"), message(2, "Y"), message(4, "Identity")]),
  ),
  message(2, "AniPic CPU check"),
  message(11, Buffer.from(valueInfo("X"), "hex")),
  message(12, Buffer.from(valueInfo("Y"), "hex")),
]);
const bytes = Buffer.concat([
  integer(1, 8),
  message(2, "AniPic"),
  message(7, graph),
  message(8, integer(2, 13)),
]);
const session = await InferenceSession.create(bytes, {
  executionProviders: ["cpu"],
  intraOpNumThreads: 1,
});
try {
  const result = await session.run({
    X: new Tensor("float32", Float32Array.from([42]), [1]),
  });
  if (result.Y.data[0] !== 42) throw Error("CPU inference failed");
  console.log("ONNX CPU inference: OK");
} finally {
  await session.release();
}
