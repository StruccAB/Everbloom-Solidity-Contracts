import { ethers, upgrades } from "hardhat";

const {
  PROD_DROP_MANAGER_CONTRACT_ADDRESS,
  PROD_PUBLIC_KEY,
} = process.env;

async function main() {
  let everDropManager;
  if (!PROD_DROP_MANAGER_CONTRACT_ADDRESS) {
    const EverDropManager = await ethers.getContractFactory("EverDropManager");
    everDropManager = await upgrades.deployProxy(EverDropManager, [PROD_PUBLIC_KEY], { kind: 'uups' })
    await everDropManager.deployed();
  }

  const EverNFT = await ethers.getContractFactory("EverNFT");
  const everNFT = await upgrades.deployProxy(
      EverNFT,
      [
          everDropManager?.address || PROD_DROP_MANAGER_CONTRACT_ADDRESS,
          '0x1517a42400f8584034d4317c49fbcf561718d5ee', // TREASURY
          'https://api.everbloom.app/v1/metadata/',
          'Ever Public', // Name
          'EVRBLMPB', // Symbol
      ],
      { kind: 'uups' }
      );
  await everNFT.deployed();

  if (everDropManager?.address) {
    console.log("EverDropManager Contract deployed to address:", everDropManager.address)
  }
  console.log("EverNFT Contract deployed to address:", everNFT.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/*
EverDropManager Contract deployed to address: 0x110E9Dc3B4c59bC999202eb5b1B0E6CD4bb58E53
EverNFT Contract deployed to address: 0x5e5B713bCe70df6095eb08bb6d0570403E68Bf50
*/

