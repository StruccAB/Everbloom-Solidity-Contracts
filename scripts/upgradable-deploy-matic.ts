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
          process.env.PUBLIC_KEY,
          'https://api-dev.everbloom.app/v1/metadata/',
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

/*
EverDropManager Contract deployed to address: 0x1C01C375Fb86BF6f1959F74cbEb4834e4277ec1d
EverNFT Contract deployed to address: 0x02C0852b92ef8e23FA73873f4b99D5fC8D1aAD85
*/

