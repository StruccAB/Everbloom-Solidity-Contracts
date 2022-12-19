import { ethers, upgrades } from "hardhat";

async function main() {
  const EverDropManager = await ethers.getContractFactory("EverDropManager");
  const EverNFT = await ethers.getContractFactory("EverNFT");

  const everDropManager = await upgrades.deployProxy(EverDropManager, [process.env.PUBLIC_KEY], { kind: 'uups' })
  await everDropManager.deployed();

  const everNFT = await upgrades.deployProxy(
      EverNFT,
      [
          everDropManager.address,
        'https://api-dev.everbloom.app/v1/print/',
        'EverNFT',
        'EverNFT',
      ],
      { kind: 'uups' }
      );
  await everNFT.deployed();

  console.log("EverDropManager Contract deployed to address:", everDropManager.address)
  console.log("EverNFT Contract deployed to address:", everNFT.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// EverDropManager Contract deployed to address: 0x96E935FB549765b8ea63A6c3372FD6F6405e74af
// EverNFT Contract deployed to address: 0x6faD8e04Ff7d0c2D97fB0624E4B8756Fd47eaB4f

