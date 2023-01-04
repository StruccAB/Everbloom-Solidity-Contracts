import { ethers, upgrades } from "hardhat";

async function main() {
  const EverDropManager = await ethers.getContractFactory("EverDropManager");
  const EverNFT = await ethers.getContractFactory("EverNFT");
  const UsdcAddress = '0x0fa8781a83e46826621b3bc094ea2a0212e71b23'

  const everDropManager = await upgrades.deployProxy(EverDropManager, [process.env.PUBLIC_KEY], { kind: 'uups' })
  await everDropManager.deployed();

  const everNFT = await upgrades.deployProxy(
      EverNFT,
      [
          everDropManager.address,
          UsdcAddress,
          process.env.PUBLIC_KEY,
          'https://api-dev.everbloom.app/v1/ever-nft/',
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
EverDropManager Contract deployed to address: 0xd8FCB53965E3646EA11B0972eBb5f17eC4f36021
EverNFT Contract deployed to address: 0x9cbf8826C78eAE0ae9BCf8C1765ad8330ff78ceF
*/

