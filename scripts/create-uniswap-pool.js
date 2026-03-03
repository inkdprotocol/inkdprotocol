/**
 * Create Uniswap V3 pool: $TEST / WETH on Base mainnet
 * Price: 0.01 ETH = 1000 TEST → 1 TEST = 0.00001 ETH
 */
const { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData } = require('viem');
const { base } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

const DEPLOYER_KEY = process.env.INKD_DEPLOYER_PRIVATE_KEY;
const TEST_TOKEN   = '0xdea1645d97AE3090fb787bbdB49cf6D5638c1b55';
const WETH         = '0x4200000000000000000000000000000000000006';

// Uniswap V3 on Base
const FACTORY    = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const NPM        = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f4'; // NonfungiblePositionManager
const FEE        = 3000; // 0.3%

// Price: 1 TEST = 0.00001 ETH
// sqrtPriceX96 = sqrt(price) * 2^96
// price = 0.00001 ETH per TEST = 1e-5
// But token order matters: if TEST < WETH (address sort), price = WETH/TEST = 0.00001
// sqrt(0.00001) * 2^96 ≈ 7922816251426433759354
const SQRT_PRICE_X96 = BigInt('7922816251426433759354');

const FACTORY_ABI = [{
  name: 'createPool',
  type: 'function',
  inputs: [
    { name: 'tokenA', type: 'address' },
    { name: 'tokenB', type: 'address' },
    { name: 'fee', type: 'uint24' },
  ],
  outputs: [{ name: 'pool', type: 'address' }],
}];

const POOL_ABI = [{
  name: 'initialize',
  type: 'function',
  inputs: [{ name: 'sqrtPriceX96', type: 'uint160' }],
  outputs: [],
}];

const ERC20_ABI = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const WETH_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

const NPM_ABI = [{
  name: 'mint',
  type: 'function',
  stateMutability: 'payable',
  inputs: [{
    type: 'tuple',
    name: 'params',
    components: [
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'amount0Desired', type: 'uint256' },
      { name: 'amount1Desired', type: 'uint256' },
      { name: 'amount0Min', type: 'uint256' },
      { name: 'amount1Min', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
  }],
  outputs: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'liquidity', type: 'uint128' },
    { name: 'amount0', type: 'uint256' },
    { name: 'amount1', type: 'uint256' },
  ],
}];

async function main() {
  const account = privateKeyToAccount(DEPLOYER_KEY);
  const wallet = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });
  const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

  console.log('Deployer:', account.address);

  // Sort tokens (Uniswap requires token0 < token1)
  const [token0, token1] = TEST_TOKEN.toLowerCase() < WETH.toLowerCase()
    ? [TEST_TOKEN, WETH]
    : [WETH, TEST_TOKEN];

  console.log('token0:', token0);
  console.log('token1:', token1);

  // 1. Create pool
  console.log('\n[1/5] Creating pool...');
  let poolAddress;
  try {
    const createTx = await wallet.writeContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: 'createPool',
      args: [token0, token1, FEE],
    });
    const receipt = await client.waitForTransactionReceipt({ hash: createTx });
    console.log('Pool creation tx:', createTx);

    // Get pool address from factory
    const { readContract } = client;
    poolAddress = await client.readContract({
      address: FACTORY,
      abi: [{ name: 'getPool', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'fee', type: 'uint24' }], outputs: [{ name: 'pool', type: 'address' }] }],
      functionName: 'getPool',
      args: [token0, token1, FEE],
    });
    console.log('Pool address:', poolAddress);
  } catch (e) {
    if (e.message?.includes('already exists')) {
      console.log('Pool already exists, getting address...');
      poolAddress = await client.readContract({
        address: FACTORY,
        abi: [{ name: 'getPool', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'fee', type: 'uint24' }], outputs: [{ name: 'pool', type: 'address' }] }],
        functionName: 'getPool',
        args: [token0, token1, FEE],
      });
      console.log('Existing pool:', poolAddress);
    } else throw e;
  }

  // 2. Initialize pool with price
  console.log('\n[2/5] Initializing pool price...');
  try {
    const initTx = await wallet.writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'initialize',
      args: [SQRT_PRICE_X96],
    });
    await client.waitForTransactionReceipt({ hash: initTx });
    console.log('Pool initialized:', initTx);
  } catch (e) {
    if (e.message?.includes('already initialized')) {
      console.log('Pool already initialized, skipping...');
    } else throw e;
  }

  // 3. Wrap ETH → WETH
  const wethAmount = parseEther('0.009'); // 0.009 ETH
  console.log('\n[3/5] Wrapping ETH to WETH...');
  const wrapTx = await wallet.writeContract({
    address: WETH,
    abi: WETH_ABI,
    functionName: 'deposit',
    value: wethAmount,
  });
  await client.waitForTransactionReceipt({ hash: wrapTx });
  console.log('Wrapped:', wrapTx);

  // 4. Approve both tokens for NPM
  const testAmount = BigInt('1000') * BigInt('1000000000000000000'); // 1000 TEST
  console.log('\n[4/5] Approving tokens...');
  const approveTESTTx = await wallet.writeContract({ address: TEST_TOKEN, abi: ERC20_ABI, functionName: 'approve', args: [NPM, testAmount * BigInt(10)] });
  await client.waitForTransactionReceipt({ hash: approveTESTTx });
  const approveWETHTx = await wallet.writeContract({ address: WETH, abi: WETH_ABI, functionName: 'approve', args: [NPM, wethAmount * BigInt(10)] });
  await client.waitForTransactionReceipt({ hash: approveWETHTx });
  console.log('Approved both tokens');

  // 5. Add liquidity
  // Tick range: full range for simplicity (-887220 to 887220 for fee 3000)
  const TICK_LOWER = -887220;
  const TICK_UPPER = 887220;

  const [amount0Desired, amount1Desired] = token0.toLowerCase() === TEST_TOKEN.toLowerCase()
    ? [testAmount, wethAmount]
    : [wethAmount, testAmount];

  console.log('\n[5/5] Adding liquidity...');
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const mintTx = await wallet.writeContract({
    address: NPM,
    abi: NPM_ABI,
    functionName: 'mint',
    args: [{
      token0,
      token1,
      fee: FEE,
      tickLower: TICK_LOWER,
      tickUpper: TICK_UPPER,
      amount0Desired,
      amount1Desired,
      amount0Min: BigInt(0),
      amount1Min: BigInt(0),
      recipient: account.address,
      deadline,
    }],
  });
  const mintReceipt = await client.waitForTransactionReceipt({ hash: mintTx });
  console.log('\n✅ Liquidity added!');
  console.log('TX:', mintTx);
  console.log('Pool:', poolAddress);
  console.log(`Uniswap: https://app.uniswap.org/explore/pools/base/${poolAddress}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
