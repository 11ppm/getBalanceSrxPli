require('dotenv').config();
const XDC3 = require('xdc3');

// 環境変数から設定を読み込む
const privateKeys = Object.keys(process.env)
  .filter(key => key.startsWith('PRIVATE_KEY_') && process.env[key])
  .map(key => process.env[key]);

// RPC ここではankrを使用。Apothemの場合は、変更してください
const xdc3 = new XDC3(new XDC3.providers.HttpProvider('https://rpc.ankr.com/xdc'));

// PLI_ABI
const tokenABI = require('./source/PliToken.json'); // 仮のパス、実際のパスに合わせてください
const tokenAddress = process.env.PLI_TOKEN_ADDRESS;
const tokenContract = new xdc3.eth.Contract(tokenABI, tokenAddress);

// 複数ウォレットから１つのウォレットに送金する宛先・ウォレットアドレス
const recipientAddress = process.env.RECIPIENT_ADDRESS;

// トークン送信
async function sendToken(privateKey, recipient, amount) {
  const account = xdc3.eth.accounts.privateKeyToAccount(privateKey);
  xdc3.eth.accounts.wallet.add(account);
  const fromAddress = account.address;

  console.log(`Preparing to send tokens from ${fromAddress}...`);

  const txData = tokenContract.methods.transfer(recipient, amount).encodeABI();

  const gas = await xdc3.eth.estimateGas({
    from: fromAddress,
    to: tokenAddress,
    data: txData,
  });

  const gasPrice = await xdc3.eth.getGasPrice();

  const nonce = await xdc3.eth.getTransactionCount(fromAddress, 'latest');

  const tx = {
    from: fromAddress,
    to: tokenAddress,
    data: txData,
    gas,
    gasPrice,
    nonce,
    chainId: 50, // XDCメインネットのチェーンID。Apothemならば"51"に。
  };

  console.log(`Signing transaction for ${fromAddress}...`);

  const signedTx = await account.signTransaction(tx);

  console.log(`Sending transaction from ${fromAddress}...`);

  return xdc3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .on('transactionHash', hash => console.log(`Transaction hash: ${hash}`))
    .on('receipt', receipt => console.log(`Transaction receipt: ${receipt.transactionHash}`))
    .catch(console.error);
}

// Wallet残高の確認と送信
async function checkAndSendTokens() {
  for (const privateKey of privateKeys) {
    const address = xdc3.eth.accounts.privateKeyToAccount(privateKey).address;
    try {
      const balance = await tokenContract.methods.balanceOf(address).call();
      if (parseInt(balance, 10) > 0) {
        console.log(`Account ${address} has a balance of ${balance}. Initiating transfer...`);
        await sendToken(privateKey, recipientAddress, balance);
      } else {
        console.log(`Account ${address} has zero balance. Skipping...`);
      }
    } catch (error) {
      console.error(`Error processing account ${address}: ${error.message}`);
    }
  }
}

checkAndSendTokens().then(() => console.log('Done sending tokens.'));
