import { Tap, Address, type Networks, Tx, Signer, type TxData } from '@cmdcode/tapscript';
import { keys } from '@cmdcode/crypto-utils';
import { boardCast, createTextInscription, getAddress, getInscribeAddress, getUTXOList } from './utils';
import * as console from 'console';
import { pk } from '../config/local';

// 很明显这是一个测试网的脚步也就是btctest测试网的脚本

interface UTXO {
  txId: string;
  index: number;
  amount: number;
}

async function main() {
  // 这是私钥
  const secret = pk;

  const address = 'tb1psmhr4gs0wsujlc7kdcp5wgudxl2yn8kvyrmdwlqaxa57wky5e5mqqaxj08';
  const utxos = await getUTXOList(address);
  const utxo = { txId: utxos[0].txid, index: utxos[0].vout, amount: utxos[0].satoshi };
  console.log(utxo);
  // await deploy2(secret, "hffp", 210000, 1, utxo, "testnet")

  await inscriptionMint(secret, 'hffp', 1, 2, 'testnet');

  // const transferList = [
  //   { brc20: 'hffp', toAddress: 'tb1q7gnys2cwhkm7r73px6nus0g9dcr8mjh6fe2ums', amount: 1 },
  //   { brc20: 'hffp', toAddress: 'tb1q7gnys2cwhkm7r73px6nus0g9dcr8mjh6fe2ums', amount: 2 }
  //   //     {brc20: "hffp", toAddress: "tb1q7gnys2cwhkm7r73px6nus0g9dcr8mjh6fe2ums", amount: 1},
  //   //     {brc20: "hffp", toAddress: "tb1q7gnys2cwhkm7r73px6nus0g9dcr8mjh6fe2ums", amount: 1},
  //   //     {brc20: "hffp", toAddress: "tb1q7gnys2cwhkm7r73px6nus0g9dcr8mjh6fe2ums", amount: 1},
  // ];
  // await inscriptionTransfer(secret, transferList, 'testnet');
}

main().catch((error) => {
  console.error(error);
});

// 这是mint铭文应该是到自己手里没有转账
async function inscriptionMint(
  secret: string,
  brc20: string,
  mintAmount: number,
  repeatNum: number,
  network: Networks
) {
  // 限制重复数量
  if (repeatNum > 25) {
    throw Error(
      'Descendants limit 25!!! If you want to get around this, manage the UTXO yourself, just use confirmed UTXO'
    );
  }
  const text = `{"p":"brc-20","op":"mint","tick":"${brc20}","amt":"${mintAmount}"}`;
  const inscription = createTextInscription(text);

  // 从私钥里解出来私钥
  const seckey = keys.get_seckey(secret);
  // console.log('==私钥seckey==>', seckey);
  // 从私钥里解出公钥
  const pubkey = keys.get_pubkey(secret);
  console.log('==公钥pubkey==>', pubkey);

  const { address, cblock, tpubkey, script, tapleaf } = getAddress(pubkey, network);
  // 对解构数据进行重命名
  const {
    address: inscriptionAddress,
    tpubkey: inscriptionTPubKey,
    tapleaf: inscriptionTapleaf,
    cblock: inscriptionCblock,
    script: inscriptionScript
  } = getInscribeAddress(pubkey, inscription, network);
  // console.log(address, inscriptionAddress, 'address');

  const utxos = await getUTXOList(address);
  console.log('==输出解出地址的utxos==>', utxos);

  const feeRate = 2;
  const mintBaseUTXOAmount = 150 * feeRate + 546;
  // 我才它了给了几千的gas，具体来说1000多
  const inputs: UTXO[] = (await getUTXOList(address)).map((item) => {
    console.log(item);
    return { txId: item.txid, index: item.vout, amount: item.satoshi };
  });
  // split 给我的感觉是它在拼接私钥和公钥
  const splitTx = Tx.create({
    vin: inputs.map((item) => {
      return {
        txid: item.txId,
        vout: item.index,
        prevout: {
          value: item.amount,
          scriptPubKey: ['OP_1', tpubkey]
        }
      };
    }),
    vout: [...Array(repeatNum).keys()].map((_) => {
      return {
        value: mintBaseUTXOAmount,
        scriptPubKey: Address.toScriptPubKey(inscriptionAddress)
      };
    })
  });
  const splitTxFee = (Tx.util.getTxSize(splitTx).vsize + 43) * feeRate;
  const splitRecharge =
    inputs.map((item) => item.amount).reduce((pre, cur) => pre + cur) - repeatNum * mintBaseUTXOAmount - splitTxFee;
  // 这块有个546的限制没看懂
  if (splitRecharge > 546) {
    splitTx.vout.push({ value: splitRecharge, scriptPubKey: Address.toScriptPubKey(address) });
  }
  inputs.forEach((item, index) => {
    const sig = Signer.taproot.sign(seckey, splitTx, index, { extension: tapleaf });
    splitTx.vin[index].witness = [sig, script, cblock];
    Signer.taproot.verify(splitTx, index, { pubkey, throws: true });
  });
  const splitTxId = Tx.util.getTxid(splitTx);

  // inscription
  const mintTxs: TxData[] = [];
  for (let i = 0; i < repeatNum; i++) {
    const mintTx = Tx.create({
      vin: [
        {
          txid: splitTxId,
          vout: i,
          prevout: { value: mintBaseUTXOAmount, scriptPubKey: ['OP_1', inscriptionTPubKey] }
        }
      ],
      vout: [{ value: 546, scriptPubKey: Address.toScriptPubKey(address) }]
    });
    const sig = Signer.taproot.sign(seckey, mintTx, 0, { extension: inscriptionTapleaf });
    mintTx.vin[0].witness = [sig, inscriptionScript, inscriptionCblock];
    console.log(Tx.util.getTxSize(mintTx), '?');
    Signer.taproot.verify(mintTx, 0, { pubkey, throws: true });
    mintTxs.push(mintTx);
  }
  console.log(`split tx: ${await boardCast(Tx.encode(splitTx).hex)}`);
  await Promise.all(
    mintTxs.map(async (item) => {
      console.log(`mint tx: ${await boardCast(Tx.encode(item).hex)}`);
    })
  );
}

// 铭刻转账符文但是好像它把铭刻和转账合成了一步了
async function inscriptionTransfer(
  secret: string,
  transferList: Array<{ brc20: string; toAddress: string; amount: number }>,
  network: Networks
) {
  if (transferList.length > 12) {
    throw Error(
      'Descendants limit 25!!! If you want to get around this, manage the UTXO yourself, just use confirmed UTXO'
    );
  }
  // 这里基本确定了是拿着公钥去解响应的私钥, 然后公钥去调取解的方法
  const seckey = keys.get_seckey(secret);
  const pubkey = keys.get_pubkey(secret, true);
  const { address, cblock, tpubkey, script, tapleaf } = getAddress(pubkey, network);

  const inscriptionsInfo = transferList.map((item) => {
    const text = `{"p":"brc-20","op":"transfer","tick":"${item.brc20}","amt":"${item.amount}"}`;
    const inscription = createTextInscription(text);
    const {
      address: inscriptionAddress,
      tpubkey: inscriptionTPubKey,
      tapleaf: inscriptionTapleaf,
      cblock: inscriptionCblock,
      script: inscriptionScript
    } = getInscribeAddress(pubkey, inscription, network);
    return { inscriptionAddress, inscriptionTPubKey, inscriptionTapleaf, inscriptionCblock, inscriptionScript };
  });

  const feeRate = 2;
  const inscriptionBaseUTXOAmount = (151 + 171) * feeRate + 546;
  const inputs: UTXO[] = (await getUTXOList(address)).map((item) => {
    return { txId: item.txid, index: item.vout, amount: item.satoshi };
  });

  // splitTx
  const splitTx = Tx.create({
    vin: inputs.map((item) => {
      return {
        txid: item.txId,
        vout: item.index,
        prevout: {
          value: item.amount,
          scriptPubKey: ['OP_1', tpubkey]
        }
      };
    }),
    // 这个费率2 1000 多sats 的手续费 真不好说是高，还是低
    vout: inscriptionsInfo.map((inscription) => {
      return {
        value: inscriptionBaseUTXOAmount,
        scriptPubKey: Address.toScriptPubKey(inscription.inscriptionAddress)
      };
    })
  });
  const splitTxFee = (Tx.util.getTxSize(splitTx).vsize + 43) * feeRate;
  const splitRecharge =
    inputs.map((item) => item.amount).reduce((pre, cur) => pre + cur) -
    inscriptionsInfo.length * inscriptionBaseUTXOAmount -
    splitTxFee;
  if (splitRecharge > 546) {
    splitTx.vout.push({ value: splitRecharge, scriptPubKey: Address.toScriptPubKey(address) });
  }

  inputs.forEach((item, index) => {
    const sig = Signer.taproot.sign(seckey, splitTx, index, { extension: tapleaf });
    splitTx.vin[index].witness = [sig, script, cblock];
    Signer.taproot.verify(splitTx, index, { pubkey, throws: true });
  });
  const splitTxId = Tx.util.getTxid(splitTx);

  // inscription
  const inscriptionTransferTxs: Array<{ tx: TxData; value: number }> = [];
  inscriptionsInfo.forEach((inscription, index) => {
    const tx = Tx.create({
      vin: [
        {
          txid: splitTxId,
          vout: index,
          prevout: { value: inscriptionBaseUTXOAmount, scriptPubKey: ['OP_1', inscription.inscriptionTPubKey] }
        }
      ]
    });
    const fee = (Tx.util.getTxSize(splitTx).vsize + 43) * feeRate;
    const value = inscriptionBaseUTXOAmount - fee;
    tx.vout.push({ value, scriptPubKey: Address.toScriptPubKey(address) });
    const sig = Signer.taproot.sign(seckey, tx, 0, { extension: inscription.inscriptionTapleaf });
    tx.vin[0].witness = [sig, inscription.inscriptionScript, inscription.inscriptionCblock];
    Signer.taproot.verify(tx, 0, { pubkey, throws: true });
    inscriptionTransferTxs.push({ tx, value });
  });

  // transfer
  const transferTxs: TxData[] = [];
  inscriptionTransferTxs.forEach((inscriptionTx, index) => {
    const tx = Tx.create({
      vin: [
        {
          txid: Tx.util.getTxid(inscriptionTx.tx),
          vout: 0,
          prevout: {
            value: inscriptionTx.value,
            scriptPubKey: ['OP_1', tpubkey]
          }
        }
      ],
      vout: [{ value: 546, scriptPubKey: Address.toScriptPubKey(transferList[index].toAddress) }]
    });
    const sig = Signer.taproot.sign(seckey, tx, 0, { extension: tapleaf });
    tx.vin[0].witness = [sig, script, cblock];
    Signer.taproot.verify(tx, 0, { pubkey, throws: true });
    transferTxs.push(tx);
  });

  console.log(`split tx: ${await boardCast(Tx.encode(splitTx).hex)}`);
  await Promise.all(
    inscriptionTransferTxs.map(async (item) => {
      console.log(`inscription transfer tx: ${await boardCast(Tx.encode(item.tx).hex)}`);
    })
  );
  await Promise.all(
    transferTxs.map(async (item) => {
      console.log(`transfer tx: ${await boardCast(Tx.encode(item).hex)}`);
    })
  );
}

// 这是部署铭文
export async function deploy(
  secret: string,
  brc20: string,
  totalSupply: number,
  mintLimit: number,
  input: {
    txId: string;
    index: number;
    amount: number;
  },
  network: Networks
) {
  const text = `{"p":"brc-20","op":"deploy","tick":"${brc20}","max":"${totalSupply}","lim":"${mintLimit}"}`;
  const inscription = createTextInscription(text);

  const seckey = keys.get_seckey(secret);
  const pubkey = keys.get_pubkey(secret, true);

  const { address, tpubkey, cblock, tapleaf, script } = getInscribeAddress(pubkey, inscription, network);
  console.log(address, 'address');
  const txdata = Tx.create({
    vin: [
      {
        // Use the txid of the funding transaction used to send the sats.
        txid: input.txId,
        // Specify the index value of the output that you are going to spend from.
        vout: input.index,
        // Also include the value and script of that ouput.
        prevout: {
          // Feel free to change this if you sent a different amount.
          value: input.amount,
          // This is what our address looks like in script form.
          scriptPubKey: ['OP_1', tpubkey]
        }
      }
    ],
    vout: [
      {
        // We are leaving behind 1000 sats as a fee to the miners.
        value: 546,
        // This is the new script that we are locking our funds to.
        scriptPubKey: Address.toScriptPubKey(address)
      },
      {
        value: input.amount - 5000,
        scriptPubKey: Address.toScriptPubKey(address)
      }
    ]
  });
  const sig = Signer.taproot.sign(seckey, txdata, 0, { extension: tapleaf });
  txdata.vin[0].witness = [sig, script, cblock];
  const isValid = Signer.taproot.verify(txdata, 0, { pubkey, throws: true });
  console.log(Tx.util.getTxSize(txdata), Tx.util.getTxid(txdata));
  console.log('Your txhex:', Tx.encode(txdata).hex, isValid);
  // console.dir(txdata, {depth: null})
  console.log(`deploy tx: ${await boardCast(Tx.encode(txdata).hex)}`);
}
