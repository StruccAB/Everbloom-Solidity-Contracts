import {expect, use} from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  createDrop,
  deployContracts,
  getAccessControlRevertReason,
  getExternalId,
  SUB_ADMIN_ROLE
} from "./util";
import {StandardMerkleTree} from "@openzeppelin/merkle-tree";
import {EverDropManager} from "../typechain-types";


describe("Ever Drop Manager", function () {
  describe("Deployment", function () {
    it("Should set init states", async function () {
      const { everDropManager } = await loadFixture(deployContracts);

      expect(await everDropManager.drops.length).to.equal(0);
      expect(await everDropManager.externalIdToDropId.length).to.equal(0);
    });
  });

  describe("Drop", function () {
    describe("Validations", function () {
      it("Should create a drop when called by creator", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address)
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), creator1.address);

        await expect(createDrop(everDropManager, everNFT, creator1, usdc.address)).to.be.not.reverted;
        await expect(await everDropManager.drops(0)).to.be.not.null;
        await expect(await everDropManager.externalIdToDropId(getExternalId())).to.equal(0);
        await expect(createDrop(everDropManager, everNFT, creator1, usdc.address)).to.be.not.reverted;
      });

      it("Should be able to get created drop using external id", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address)
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), creator1.address);

        await expect(createDrop(everDropManager, everNFT, creator1, usdc.address)).to.be.not.reverted;
        await expect(
            createDrop(everDropManager, everNFT, creator1, usdc.address, { externalId: getExternalId(2)})
        ).to.be.not.reverted;
        await expect(await everDropManager.getDropByExternalId(getExternalId(2))).to.include(getExternalId(2));
        await expect(await everDropManager.getDropByExternalId(getExternalId(2))).to.not.include(getExternalId(3));
      });

      it("Should not create a drop when nft address is invalid", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address)
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), creator1.address);

        await expect(createDrop(everDropManager, everNFT, creator1, usdc.address, { nftAddress: creator1.address }))
            .to.be.reverted;
      });

      it("Should not create a drop when there is a conflict in external id", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, everErrors, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address);
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), creator1.address);
        await createDrop(everDropManager, everNFT, creator1, usdc.address, { externalId: getExternalId(1) })
        await createDrop(everDropManager, everNFT, creator1, usdc.address, { externalId: getExternalId(2) })

        await expect(createDrop(everDropManager, everNFT, creator1, usdc.address, { externalId: getExternalId(2) }))
            .to.be.revertedWithCustomError(everErrors, 'DropConflict');
      });

      it("Should not create a drop when supply is zero", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, everErrors, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address);
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), creator1.address);

        await expect(createDrop(everDropManager, everNFT, creator1, usdc.address, { supply: 0 }))
            .to.be.revertedWithCustomError(everErrors, 'InvalidSupply');
      });

      it("Should not create a drop when called by user", async function () {
        const { everDropManager, everNFT, user1, usdc } = await loadFixture(deployContracts);

        await expect(createDrop(everDropManager, everNFT, user1, usdc.address)).to.be.reverted;
        await expect(await everDropManager.drops.length).to.equal(0);
      });

      it("Should update a drop when called by sub admin", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, usdc, everErrors } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address);
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(),creator1.address);
        await createDrop(everDropManager, everNFT, creator1, usdc.address);

        const merkleTree = StandardMerkleTree.of(
            [[subAdmin1.address], [creator1.address]],
            ['address']
        );
        const UPDATES = {
          supply: 10,
          saleOpenDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          saleCloseDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          privateSaleOpenTime: Math.floor(new Date('2023-1-1').getTime() / 1000),
          privateSaleMaxMint: 5,
          merkleRoot: merkleTree.root
        }

        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);

        await expect(everDropManager.connect(subAdmin1).setSupply(dropId, UPDATES.supply)).to.be.not.reverted;
        await expect(everDropManager.connect(subAdmin1).setSupply(dropId, 0))
            .to.be.revertedWithCustomError(everErrors, 'InvalidSupply');
        await expect(everDropManager.connect(subAdmin1).setSalesInfo(
            dropId,
            UPDATES.saleOpenDate,
            UPDATES.saleCloseDate,
            UPDATES.privateSaleOpenTime,
            UPDATES.privateSaleMaxMint,
        )).to.be.not.reverted;
        await expect(everDropManager.connect(subAdmin1).setMerkleRoot(
            dropId,
            UPDATES.merkleRoot,
        )).to.be.not.reverted;

        const updatedDrop = await everDropManager.drops(0);
        const newSupply = Number(updatedDrop.tokenInfo.supply);
        const newSaleOpenTime = Number(updatedDrop.saleOpenTime);
        const newSaleCloseTime = Number(updatedDrop.saleCloseTime);
        const newPrivateSaleCloseTime = Number(updatedDrop.privateSaleOpenTime);
        const newPrivateSaleMaxMint = Number(updatedDrop.privateSaleMaxMint);
        const newMerkleRoot = String(updatedDrop.merkleRoot);

        await expect(newSupply).to.equal(UPDATES.supply);
        await expect(newSaleOpenTime).to.equal(UPDATES.saleOpenDate);
        await expect(newSaleCloseTime).to.equal(UPDATES.saleCloseDate);
        await expect(newPrivateSaleCloseTime).to.equal(UPDATES.privateSaleOpenTime);
        await expect(newPrivateSaleMaxMint).to.equal(UPDATES.privateSaleMaxMint);
        await expect(newMerkleRoot).to.equal(UPDATES.merkleRoot);
      });

      it("Should update a drop owner when called by sub admin", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address);
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), creator1.address);
        await createDrop(everDropManager, everNFT, creator1, usdc.address);

        const drop = await everDropManager.drops(0);
        const dropId = parseInt(ethers.utils.formatEther(drop[0]));

        await expect(everDropManager.connect(subAdmin1).setRightHolderInfo(dropId, subAdmin1.address))
            .to.be.revertedWith('New owner is not a creator');
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), subAdmin1.address);
        await expect(everDropManager.connect(subAdmin1).setRightHolderInfo(dropId, subAdmin1.address))
            .to.be.not.reverted;

        const createdDrop = await everDropManager.drops(0);

        await expect(createdDrop.owner).to.equal(subAdmin1.address);
      });

      it("Should not update drop when called by creator", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address);
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), creator1.address);
        await createDrop(everDropManager, everNFT, creator1, usdc.address);
        const merkleTree = StandardMerkleTree.of(
            [[subAdmin1.address], [creator1.address]],
            ['address']
        );
        const UPDATES = {
          supply: 10,
          saleOpenDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          saleCloseDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          privateSaleOpenTime: Math.floor(new Date('2023-1-1').getTime() / 1000),
          privateSaleMaxMint: 5,
          merkleRoot: merkleTree.root
        }

        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);

        await expect(everDropManager.connect(creator1).setSupply(dropId, UPDATES.supply)).to.be.reverted;
        await expect(everDropManager.connect(creator1).setSalesInfo(
            dropId,
            UPDATES.saleOpenDate,
            UPDATES.saleCloseDate,
            UPDATES.privateSaleOpenTime,
            UPDATES.privateSaleMaxMint,
        )).to.be.reverted;
        await expect(everDropManager.connect(creator1).setMerkleRoot(
            dropId,
            UPDATES.merkleRoot
        )).to.be.reverted;
        await expect(everDropManager.connect(creator1).setRightHolderInfo(dropId, subAdmin1.address))
            .to.be.revertedWith(getAccessControlRevertReason(creator1.address, ethers.utils.hexValue(SUB_ADMIN_ROLE)));
      });

      it("Should not update drop when called by user", async function () {
        const { everDropManager, everNFT, subAdmin1, user1, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address);
        await everDropManager.connect(subAdmin1).grantRole(everDropManager.CREATOR_ROLE(), subAdmin1.address);
        await createDrop(everDropManager, everNFT, subAdmin1, usdc.address)
        const merkleTree = StandardMerkleTree.of(
            [[subAdmin1.address], [user1.address]],
            ['address']
        );
        const UPDATES = {
          supply: 10,
          saleOpenDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          saleCloseDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          privateSaleOpenTime: Math.floor(new Date('2023-1-1').getTime() / 1000),
          privateSaleMaxMint: 5,
          merkleRoot: merkleTree.root
        }

        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);

        await expect(everDropManager.connect(user1).setSupply(dropId, UPDATES.supply)).to.be.reverted;
        await expect(everDropManager.connect(user1).setSalesInfo(
            dropId,
            UPDATES.saleOpenDate,
            UPDATES.saleCloseDate,
            UPDATES.privateSaleOpenTime,
            UPDATES.privateSaleMaxMint,
        )).to.be.reverted;
        await expect(everDropManager.connect(user1).setMerkleRoot(
            dropId,
            UPDATES.merkleRoot
        )).to.be.reverted;
        await expect(everDropManager.connect(user1).setRightHolderInfo(dropId, subAdmin1.address))
            .to.be.revertedWith(getAccessControlRevertReason(user1.address, ethers.utils.hexValue(SUB_ADMIN_ROLE)));
      });
    });

    describe("events", function () {
      it("Should emit an event on creating a drop", async function () {
        const { everDropManager, everNFT, owner, usdc } = await loadFixture(deployContracts);

        await expect(createDrop(everDropManager, everNFT, owner, usdc.address))
            .to.emit(everDropManager, "NewDrop")
            .withArgs(0, getExternalId(), everNFT.address);
      });

      it("Should emit an event on updating drop supply", async function () {
        const { everDropManager, everNFT, owner, usdc } = await loadFixture(deployContracts);

        await createDrop(everDropManager, everNFT, owner, usdc.address)
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const UPDATED_SUPPLY = 200;

        await expect(everDropManager.setSupply(dropId, UPDATED_SUPPLY))
            .to.emit(everDropManager, "DropSupplyUpdated")
            .withArgs(dropId, UPDATED_SUPPLY);
      });

      it("Should emit an event on updating drop sale info", async function () {
        const { everDropManager, everNFT, owner, usdc } = await loadFixture(deployContracts);

        await createDrop(everDropManager, everNFT, owner, usdc.address)
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const UPDATED_SALE_OPEN_TIME = Math.floor(new Date('2023-1-1').getTime() / 1000);
        const UPDATED_CLOSE_TIME = Math.floor(new Date('2024-1-1').getTime() / 1000);
        const UPDATED_PRIVATE_SALE_OPEN_TIME = Math.floor(new Date('2023-1-1').getTime() / 1000);
        const UPDATED_PRIVATE_SALE_MAX_MINT = 5;

        await expect(everDropManager.setSalesInfo(
              dropId,
              UPDATED_SALE_OPEN_TIME,
              UPDATED_CLOSE_TIME,
              UPDATED_PRIVATE_SALE_OPEN_TIME,
              UPDATED_PRIVATE_SALE_MAX_MINT
            )).to.emit(everDropManager, "DropSaleInfoUpdated")
            .withArgs(dropId, UPDATED_SALE_OPEN_TIME, UPDATED_CLOSE_TIME, UPDATED_PRIVATE_SALE_OPEN_TIME, UPDATED_PRIVATE_SALE_MAX_MINT);
      });

      it("Should emit an event on updating drop right holder", async function () {
        const { everDropManager, everNFT, creator1, owner, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.CREATOR_ROLE(), creator1.address);

        await createDrop(everDropManager, everNFT, owner, usdc.address)
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);

        await expect(everDropManager.setRightHolderInfo(dropId, creator1.address))
            .to.emit(everDropManager, "DropRightHolderUpdated")
            .withArgs(dropId, creator1.address);
      });

      it("Should emit an event on updating drop merkle", async function () {
        const { everDropManager, everNFT, creator1, owner, usdc } = await loadFixture(deployContracts);
        await everDropManager.grantRole(everDropManager.CREATOR_ROLE(), creator1.address);

        await createDrop(everDropManager, everNFT, owner, usdc.address)
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const merkleTree = StandardMerkleTree.of(
            [[owner.address], [creator1.address]],
            ['address']
        );
        await expect(everDropManager.setMerkleRoot(dropId, merkleTree.root))
            .to.emit(everDropManager, "DropMerkleRootUpdated")
            .withArgs(dropId, merkleTree.root);
      });
    });
  });
});
