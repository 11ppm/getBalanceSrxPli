require('dotenv').config();
const XDC3 = require('xdc3');
const xdc3 = new XDC3(new XDC3.providers.HttpProvider('https://rpc.ankr.com/xdc'));

const fs = require('fs');

// .envからウォレットの名前と秘密鍵を読み込み
const wallets = Object.keys(process.env)
  .filter(key => key.startsWith('PRIVATE_KEY_'))
  .map(key => {
    return {
      name: process.env[`WALLET_NAME_${key.match(/\d+/)[0]}`],
      privateKey: process.env[key]
    };
  });

// SRX_ABIとコントラクトアドレス
const tokenABI = require('./source/SrxToken.json');
const tokenAddress = process.env.SRX_TOKEN_ADDRESS;
const tokenContract = new xdc3.eth.Contract(tokenABI, tokenAddress);

// 現在の日時を取得
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// 残高を取得してCSVファイルに保存
async function getBalancesAndSave() {
    const dateTime = getCurrentDateTime();
    let csvHeader = "Wallet Name,Address,XDC Balance (XDC),SRX Balance (SRX)";
    let csvContent = `${csvHeader}\n`;

    console.log(csvHeader); // コンソールにCSVヘッダーを表示

    for (const wallet of wallets) {
        const address = xdc3.eth.accounts.privateKeyToAccount(wallet.privateKey).address;

        // XDCとSRXの残高を取得
        const xdcBalanceWei = await xdc3.eth.getBalance(address);
        const xdcBalance = xdc3.utils.fromWei(xdcBalanceWei, 'ether');
        const srxBalance = await tokenContract.methods.balanceOf(address).call();
        const srxBalanceFormatted = xdc3.utils.fromWei(srxBalance, 'ether');

        const csvLine = `${wallet.name},${address},${xdcBalance},${srxBalanceFormatted}`;
        csvContent += `${csvLine}\n`;

        console.log(csvLine); // コンソールに各行の内容を表示
    }

    const fileName = `balances_${dateTime}.csv`; // 保存するCSVファイルの名前を生成
    fs.writeFile(fileName, csvContent, 'utf8', (err) => { // CSV内容をファイルに書き込み
        if (err) {
            console.error('An error occurred while writing CSV to file.', err);
            return;
        }

        console.log(`${fileName} has been saved.`); // 保存完了のログを出力
    });
}

getBalancesAndSave().catch(console.error); // 残高取得とCSV保存を実行し、エラーがあれば表示
