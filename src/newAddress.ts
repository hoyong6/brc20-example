import * as ecc from 'tiny-secp256k1';
import { randomBytes } from 'crypto';

// 生成一个随机的私钥
function generatePrivateKey(): Buffer {
  let privateKey: Buffer;
  do {
    privateKey = randomBytes(32);
  } while (!ecc.isPrivate(privateKey));
  return privateKey;
}

// 使用 tiny-secp256k1 从私钥生成 Schnorr 公钥
function generateSchnorrPublicKey(privateKey: Buffer): Buffer {
  // 注意：tiny-secp256k1 v2.0.0 开始支持 Schnorr 相关功能
  // 确保你的 tiny-secp256k1 版本至少为 v2.0.0
  const publicKey = ecc.pointFromScalar(privateKey, true);
  if (!publicKey) {
    throw new Error('Failed to generate public key.');
  }
  console.log('==publicKey==>', publicKey);
  // 将 Uint8Array 转换为 Buffer
  return Buffer.from(publicKey);
}

// 主逻辑
const privateKey = generatePrivateKey();
const schnorrPublicKey = generateSchnorrPublicKey(privateKey);

console.log('Private Key (Hex):', privateKey.toString('hex'));
console.log('Schnorr Public Key (Hex):', schnorrPublicKey.toString('hex'));
