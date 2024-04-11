require('dotenv').config();
const XDC3 = require('xdc3');

// .envからウォレットの名前と秘密鍵を読み込み
const wallets = Object.keys(process.env)
  .filter(key => key.startsWith('PRIVATE_KEY_'))
  .map(key => {
    return {
      name: process.env[`WALLET_NAME_${key.match(/\d+/)[0]}`],
      privateKey: process.env[key]
    };
  });

// XDC RPCプロバイダに接続
const xdc3 = new XDC3(new XDC3.providers.HttpProvider('https://rpc.ankr.com/xdc'));

// PLIのABIとコントラクトアドレスをロード
const tokenABI = require('./source/PliToken.json');
const tokenAddress = process.env.PLI_TOKEN_ADDRESS;
const tokenContract = new xdc3.eth.Contract(tokenABI, tokenAddress);

// 複数ウォレットから１つのウォレットに送金する宛先・ウォレットアドレスを環境変数から取得
const recipientAddress = process.env.RECIPIENT_ADDRESS;

// トークンを送信する関数
async function sendToken(privateKey, recipient, amount) {
  // 私密鍵からアカウントを復元
  const account = xdc3.eth.accounts.privateKeyToAccount(privateKey);
  xdc3.eth.accounts.wallet.add(account);
  const fromAddress = account.address;

  console.log(`Preparing to send tokens from ${account.address}...`);

  // トランザクションデータをエンコード
  const txData = tokenContract.methods.transfer(recipient, amount).encodeABI();

  // ガス推定
  const gas = await xdc3.eth.estimateGas({ from: fromAddress, to: tokenAddress, data: txData });
  const gasPrice = await xdc3.eth.getGasPrice();
  // トランザクションのnonce取得
  const nonce = await xdc3.eth.getTransactionCount(fromAddress, 'latest');

  const tx = {
    from: fromAddress,
    to: tokenAddress,
    data: txData,
    gas,
    gasPrice,
    nonce,
    chainId: 50, // XDCメインネットのチェーンID
  };

  console.log(`Signing transaction for ${account.address}...`);

  // トランザクションに署名
  const signedTx = await account.signTransaction(tx);

  console.log(`Sending transaction from ${account.address}...`);

  // トランザクションを送信
  return xdc3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .on('transactionHash', hash => console.log(`Transaction hash: ${hash}`))
    .on('receipt', receipt => console.log(`Transaction receipt: ${receipt.transactionHash}`))
    .catch(console.error);
}

// Walletの残高を確認し、トークンを送信する
async function checkAndSendTokens() {
  for (const wallet of wallets) {
    const address = xdc3.eth.accounts.privateKeyToAccount(wallet.privateKey).address;
    try {
      // トークンの残高を取得
      const balance = await tokenContract.methods.balanceOf(address).call();
      if (parseInt(balance, 10) > 0) {
        console.log(`${wallet.name} ${address} has a balance of ${balance}. Initiating transfer...`);
        await sendToken(wallet.privateKey, recipientAddress, balance);
      } else {
        console.log(`${wallet.name} ${address} has zero balance. Skipping...`);
      }
    } catch (error) {
      console.error(`Error processing wallet ${wallet.name} ${address}: ${error.message}`);
    }
  }
}

checkAndSendTokens().then(() => console.log('Done sending tokens.'));
