require('dotenv').config(); 
const XDC3 = require('xdc3'); 
const xdc3 = new XDC3(new XDC3.providers.HttpProvider('https://rpc.ankr.com/xdc')); // XDC RPCプロバイダに接続

// .envから秘密鍵を読み込み
const privateKeys = Object.keys(process.env)
  .filter(key => key.startsWith('PRIVATE_KEY_') && process.env[key])
  .map(key => process.env[key]);

// PLI_ABIとコントラクトアドレス
const tokenABI = require('./source/PliToken.json');
const tokenAddress = process.env.PLI_TOKEN_ADDRESS;
const tokenContract = new xdc3.eth.Contract(tokenABI, tokenAddress);

const fs = require('fs'); // ファイルシステムモジュールをインポート

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
    let csvHeader = "Name,Address,XDC Balance (XDC),SRX Balance (SRX)";
    let csvContent = `${csvHeader}\n`;

    console.log(csvHeader); // コンソールにCSVヘッダーを表示

    for (let i = 0; i < privateKeys.length; i++) {
        const name = `XDCWallet${i + 1}`;
        const address = xdc3.eth.accounts.privateKeyToAccount(privateKeys[i]).address;

        // XDCとSRXの残高を取得
        const xdcBalanceWei = await xdc3.eth.getBalance(address);
        const xdcBalance = xdc3.utils.fromWei(xdcBalanceWei, 'ether');
        const srxBalance = await tokenContract.methods.balanceOf(address).call();
        const srxBalanceFormatted = xdc3.utils.fromWei(srxBalance, 'ether');

        const csvLine = `${name},${address},${xdcBalance},${srxBalanceFormatted}`;
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
