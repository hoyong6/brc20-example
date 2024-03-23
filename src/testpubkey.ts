import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { pk } from '../config/local';

// 你的私钥Hex字符串, 这套解析方法是从 bitcoinjs-lib 示例中找到的
// 地址是 https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.spec.ts
const privateKeyHex = pk;
const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');

// 通过 ecpair 和 tiny-secp256k1 库。这种方法允许用户通过 ECPairFactory 函数和自定义的椭圆曲线加密库 ecc（在这个例子中是 tiny-secp256k1）来创建 ECPair 实例。
const ECPair = ECPairFactory(ecc);

// 使用私钥Buffer创建ECPair
const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network: bitcoin.networks.testnet });

// 从ECPair获取公钥
const { publicKey } = keyPair;

console.log('==publicKey==>', publicKey);

// 使用公钥生成SegWit地址
const { address } = bitcoin.payments.p2tr({ pubkey: publicKey, network: bitcoin.networks.testnet });

console.log(address);
