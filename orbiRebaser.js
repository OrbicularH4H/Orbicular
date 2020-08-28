const CronJob = require('cron').CronJob;
const _ = require('lodash');
const Web3 = require('web3');
const fs = require('fs');
const ethTx = require('ethereumjs-tx').Transaction;

let web3 = new Web3(new Web3.providers.HttpProvider('HTTP://127.0.0.1:8545'));

let readFile = (filename) => {
	return fs.readFileSync(filename, 'utf8');
};

let abi = JSON.parse(readFile('OrbicularABI.txt'));
let ORBI_ETH_UniswapPoolTokenABI = JSON.parse(readFile('ORBI_ETH_UniswapPoolTokenABI.txt'));
let OrbicularAddress = '0x11A2Ab94adE17e96197C78f9D5f057332a19a0b9';
let ORBI_ETH_UniswapPoolTokenAddress = '0x840336E57708B8Ba1E864B2b7dB78AAbEEba1691';

let getSupplyTxData = new web3.eth.Contract(abi, OrbicularAddress).methods.totalSupply().encodeABI();

let job = new CronJob('0 19 * * *', () => {
	
	let totalSupplyNoDec;

	web3.eth.call({
		to: OrbicularAddress,
		data: getSupplyTxData
	})
	.then(totalSupplyHex => { 
	
		let totalSupply = new web3.utils.toBN(totalSupplyHex).toString();
		totalSupplyNoDec = parseInt(totalSupply / 1e9);
		
		web3.eth.getGasPrice()
		.then(gasPrice => {
			
			let targetSupply = parseInt(Math.sin((new Date().getTime() - 1597964400000) * 2 * Math.PI / 1206900000) / 10 * 100000000 + 100000000).toString();
		
			let accountAddress = '0xe1a811bDFb656Dc47a7262dbdE31071d9A916B1a';
			let privateKey = readFile('pKey.txt');
			
			let epoch = Math.floor(new Date() / 1000);
			let supplyDelta/* = 0*/;
			let sub0add1/* = 0*/;
			if (totalSupplyNoDec <= targetSupply) {
				supplyDelta = (targetSupply - totalSupplyNoDec) * 1e9;
				sub0add1 = true;
			} else if (totalSupplyNoDec > targetSupply) {
				supplyDelta = (totalSupplyNoDec - targetSupply) * 1e9;
				sub0add1 = false;
			}
			
			let txData = new web3.eth.Contract(abi, OrbicularAddress).methods.rebase(epoch, supplyDelta, sub0add1).encodeABI();
			let syncTxData = new web3.eth.Contract(ORBI_ETH_UniswapPoolTokenABI, ORBI_ETH_UniswapPoolTokenAddress).methods.sync().encodeABI();
			
			web3.eth.getTransactionCount(accountAddress, (err, nonce) => {
				
				let tx = new ethTx({
					nonce: nonce,
					gasPrice: web3.utils.toHex(gasPrice),
					gasLimit: web3.utils.toHex(100000),
					to: OrbicularAddress,
					value: '0x00',
					data: txData,
				});
				
				let syncTx = new ethTx({
					nonce: nonce + 1,
					gasPrice: web3.utils.toHex(gasPrice),
					gasLimit: web3.utils.toHex(100000),
					to: ORBI_ETH_UniswapPoolTokenAddress,
					value: '0x00',
					data: syncTxData,
				});
				
				tx.sign(Buffer.from(privateKey, 'hex'));
				syncTx.sign(Buffer.from(privateKey, 'hex'));
				
				let serializedTx = tx.serialize();
				let serializedSyncTx = syncTx.serialize();
				let raw = '0x' + serializedTx.toString('hex');
				let syncRaw = '0x' + serializedSyncTx.toString('hex');
				
				web3.eth.sendSignedTransaction(raw, (err, hash) => {
					console.log(err, hash);
					web3.eth.sendSignedTransaction(syncRaw, (err, hash) => {
						console.log(err, hash);
					});
				});
				
			});
			
		});
		
	});

}, null, true, 'America/New_York');

job.start();