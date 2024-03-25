import * as bitcoin from 'bitcoinjs-lib';

// 这里假设你的公钥是一个 Buffer
const publicKey = Buffer.from('03689ea4514f279d7607e5f79c8c7d010f16c47cdbe030d8769d0855a548f02214', 'hex');

// 创建一个 P2WPKH 地址
const { address } = bitcoin.payments.p2wpkh({ pubkey: publicKey, network: bitcoin.networks.testnet });

console.log(address); // 这将打印出你的比特币地址
