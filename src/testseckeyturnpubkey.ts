// 假设 publicKeyUint8Array 是第一个公钥的 Uint8Array 表示
const publicKeyUint8Array = new Uint8Array([
  208, 201, 202, 172, 255, 85, 233, 179, 64, 46, 205, 43, 129, 85, 207, 129, 210, 132, 151, 237, 254, 229, 143, 209, 2,
  62, 52, 121, 182, 82, 198, 235
]);

// 将 Uint8Array 转换为十六进制字符串
const publicKeyHex = Array.from(publicKeyUint8Array)
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

console.log(publicKeyHex);
// 第二个公钥的十六进制字符串
const bufferPublicKeyHex = '03d0c9caacff55e9b3402ecd2b8155cf81d28497edfee58fd1023e3479b652c6eb';

// 比较两个公钥
console.log(publicKeyHex === bufferPublicKeyHex); // 这将输出 true 或 false
