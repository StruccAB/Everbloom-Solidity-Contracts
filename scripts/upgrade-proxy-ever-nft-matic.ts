import { ethers, upgrades } from "hardhat";

async function main() {
  const EverNFTAddress = '0x9cbf8826C78eAE0ae9BCf8C1765ad8330ff78ceF'
  const EverNFT = await ethers.getContractFactory("EverNFT");

  const everNft = await upgrades.upgradeProxy(EverNFTAddress, EverNFT)
  await everNft.deployed();

  console.log("EverNFT Contract deployed to address:", everNft.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/*
EverDropManager Contract deployed to address: 0xd8FCB53965E3646EA11B0972eBb5f17eC4f36021
EverNFT Contract deployed to address: 0x9cbf8826C78eAE0ae9BCf8C1765ad8330ff78ceF
*/

