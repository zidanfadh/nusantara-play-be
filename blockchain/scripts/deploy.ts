import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const factory = await ethers.getContractFactory('ProtVerification');
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('ProtVerification deployed to:', address);
  console.log('Set BLOCKCHAIN_CONTRACT_ADDRESS=' + address + ' in your backend .env');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
